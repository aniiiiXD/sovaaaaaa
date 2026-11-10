"""Small CPU fixtures for the attention-free decision and distillation pipeline."""

from __future__ import annotations

import copy
import errno
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

import torch
from torch import nn

from sova_data import DecisionExample, GoldTarget, ModelInput
from sova_data.loader import LABELS
from sova_eval.baseline import evaluate
from sova_model import ContextTooLongError, DecisionScores
from sova_student.artifacts import save_student, validate_backbone_config
from sova_student.bootstrap import kernel_wheel_urls
from sova_student.collect_sagemaker import read_archive, validate_outputs
from sova_student.data import StudentItem, encode_student_input, prepare_training_examples
from sova_student.evaluation import MeasuredStudentScorer, latency_summary, matched_latency_comparison, matched_teacher_comparison
from sova_student.inference import StudentScorer
from sova_student.loss import training_loss
from sova_student.model import MambaDecisionModel
from sova_student.s3_preflight import verify_s3_artifact_access
from sova_student.teacher import generate_teacher_records, teacher_record
from sova_student.train import train_epoch
from sova_student import submit_sagemaker
from sova_train.decision import compare_paired


class StudentTokenizer:
    def __init__(self):
        self.prompt = None

    def encode(self, prompt, *, add_special_tokens, truncation):
        assert not add_special_tokens and not truncation
        self.prompt = prompt
        return list(range(1, 13 if "LONG_DOCUMENT" in prompt else 5))


class TeacherTokenizer:
    def apply_chat_template(self, messages, **kwargs):
        return "PROMPT"

    def encode(self, text, *, add_special_tokens):
        if text == "PROMPTDecision:":
            return [1, 2, 3]
        for offset, label in enumerate("ABC"):
            if text == "PROMPTDecision: " + label:
                return [1, 2, 3, 10 + offset]
        return [1, 2, 3, 4, 5]


def example(number: int, label: str = "Entailment", *, split: str = "train", long: bool = False):
    return DecisionExample(
        f"contractnli:{split}:{number}:nda-1", str(number), None,
        ModelInput("LONG_DOCUMENT" if long else "Contract text", "A statement", LABELS), GoldTarget(label, ()),
    )


def target(item, logits=(0.1, 0.2, 0.3)):
    return {"decision_id": item.decision_id, "document_id": item.document_id,
            "status": "scored", "logits": list(logits)}


class FakeBlock(nn.Module):
    def __init__(self, width):
        super().__init__()
        self.linear = nn.Linear(width, width)

    def forward(self, hidden, residual=None, inference_params=None):
        residual = hidden if residual is None else hidden + residual
        return torch.tanh(self.linear(residual)), residual


class FakeBackbone(nn.Module):
    def __init__(self, width=8):
        super().__init__()
        self.embedding = nn.Embedding(32, width)
        self.layers = nn.ModuleList([FakeBlock(width), FakeBlock(width)])
        self.norm_f = nn.LayerNorm(width)
        self.fused_add_norm = False
        self.residual_in_fp32 = False

    def forward(self, input_ids):
        hidden, residual = self.embedding(input_ids), None
        for layer in self.layers:
            hidden, residual = layer(hidden, residual)
        residual = hidden + residual if residual is not None else hidden
        return self.norm_f(residual.to(dtype=self.norm_f.weight.dtype))


class StudentDataTests(unittest.TestCase):
    def test_full_prompt_puts_question_before_contract_without_gold(self):
        tokenizer = StudentTokenizer()
        ids = encode_student_input(tokenizer, example(1).model_input, 8)
        self.assertEqual(ids, (1, 2, 3, 4))
        self.assertLess(tokenizer.prompt.index('"statement"'), tokenizer.prompt.index('"contract"'))
        self.assertNotIn("gold_label", tokenizer.prompt)
        with self.assertRaises(ContextTooLongError):
            encode_student_input(tokenizer, example(2, long=True).model_input, 8)

    def test_joins_train_only_and_falls_back_to_gold_for_long_teacher_input(self):
        a, b, c = example(1, "Entailment"), example(2, "Contradiction"), example(3, long=True)
        targets = {a.decision_id: target(a), b.decision_id: {"decision_id": b.decision_id,
                   "document_id": b.document_id, "status": "context_too_long", "logits": None},
                   c.decision_id: target(c)}
        items, report = prepare_training_examples([a, b, c], StudentTokenizer(), 8, targets)
        self.assertEqual(len(items), 2)
        self.assertEqual(items[1].label_index, 1)
        self.assertIsNone(items[1].teacher_logits)
        self.assertEqual(report["usable_with_teacher"], 1)
        self.assertEqual(report["usable_gold_only"], 1)
        self.assertEqual(report["student_context_too_long"], 1)

    def test_rejects_dev_duplicate_missing_and_extra_teacher_records(self):
        item = example(1)
        with self.assertRaises(ValueError):
            prepare_training_examples([example(1, split="dev")], StudentTokenizer(), 8, {})
        with self.assertRaises(ValueError):
            prepare_training_examples([item, item], StudentTokenizer(), 8, {item.decision_id: target(item)})
        with self.assertRaises(ValueError):
            prepare_training_examples([item], StudentTokenizer(), 8, {})
        extra = example(2)
        with self.assertRaises(ValueError):
            prepare_training_examples([item], StudentTokenizer(), 8,
                                      {item.decision_id: target(item), extra.decision_id: target(extra)})


class TeacherTests(unittest.TestCase):
    def test_teacher_reads_only_input_and_returns_raw_class_logits(self):
        class FakeTeacher:
            def __call__(self, **kwargs):
                assert "labels" not in kwargs
                logits = torch.zeros((1, 1, 32))
                logits[0, 0, 10:13] = torch.tensor([0.1, 1.5, -0.2])
                return SimpleNamespace(logits=logits)

        model_input = ModelInput("Contract", "Statement", LABELS)
        # This object deliberately has no .target attribute.
        item = SimpleNamespace(decision_id="contractnli:train:1:nda-1", document_id="1", model_input=model_input)
        scorer = SimpleNamespace(model=FakeTeacher(), tokenizer=TeacherTokenizer(), max_input_tokens=10, device="cpu")
        result = teacher_record(scorer, item)
        self.assertEqual(result["status"], "scored")
        self.assertAlmostEqual(result["logits"][1], 1.5)
        item.decision_id = "contractnli:dev:1:nda-1"
        with self.assertRaises(ValueError):
            teacher_record(scorer, item)

    def test_generated_teacher_targets_are_immutable_train_only_chunks(self):
        class FakeTeacher:
            def __call__(self, **kwargs):
                return SimpleNamespace(logits=torch.zeros((1, 1, 32)))

        scorer = SimpleNamespace(model=FakeTeacher(), tokenizer=TeacherTokenizer(), max_input_tokens=10, device="cpu")
        examples = [example(1), example(2)]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "checkpoints" / "teacher"
            original_replace = os.replace

            def same_directory_replace(source, destination):
                self.assertEqual(Path(source).parent, Path(destination).parent)
                return original_replace(source, destination)

            with mock.patch("sova_student.teacher.os.replace", side_effect=same_directory_replace):
                records = generate_teacher_records(scorer, examples, root)
            self.assertEqual(set(records), {item.decision_id for item in examples})
            chunks = list(root.glob("*.jsonl"))
            self.assertEqual(len(chunks), 1)
            self.assertEqual(len(chunks[0].read_text(encoding="utf-8").splitlines()), 2)
            self.assertFalse(list(root.glob("*.partial")))

    def test_first_250_record_boundary_works_when_cross_mount_renames_fail(self):
        examples = [example(index) for index in range(1, 252)]
        original_replace = os.replace

        def reject_cross_directory_rename(source, destination):
            if Path(source).parent != Path(destination).parent:
                raise OSError(errno.EXDEV, "simulated cross-device link")
            return original_replace(source, destination)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "checkpoints" / "teacher"
            with mock.patch("sova_student.teacher.teacher_record", side_effect=lambda _, item: target(item)), \
                 mock.patch("sova_student.teacher.os.replace", side_effect=reject_cross_directory_rename):
                records = generate_teacher_records(None, examples, root)
            self.assertEqual(len(records), 251)
            self.assertEqual(len((root / "chunk-0001.jsonl").read_text().splitlines()), 250)
            self.assertEqual(len((root / "chunk-0002.jsonl").read_text().splitlines()), 1)
            self.assertFalse(list(root.glob("*.partial")))


class S3PreflightTests(unittest.TestCase):
    def test_multipart_roundtrip_cleans_both_model_prefixes(self):
        client = mock.Mock()
        objects = {}
        client.create_multipart_upload.side_effect = lambda **kw: {"UploadId": kw["Key"]}

        def upload_part(**kw):
            objects[kw["Key"]] = kw["Body"]
            return {"ETag": '"probe-etag"'}

        client.upload_part.side_effect = upload_part
        client.head_object.side_effect = lambda **kw: {"ContentLength": len(objects[kw["Key"]])}
        client.get_object.side_effect = lambda **kw: {"Body": io.BytesIO(objects[kw["Key"]])}
        client.delete_object.side_effect = lambda **kw: objects.pop(kw["Key"], None)
        report = verify_s3_artifact_access(client, bucket="bucket", prefix="job")
        self.assertEqual(report["variants"], ["labels_only", "distilled"])
        self.assertTrue(report["multipart_upload_and_read"])
        self.assertFalse(objects)
        keys = [call.kwargs["Key"] for call in client.create_multipart_upload.call_args_list]
        self.assertEqual(len(keys), 2)
        self.assertTrue(keys[0].startswith("job/models/labels_only/"))
        self.assertTrue(keys[1].startswith("job/models/distilled/"))
        self.assertEqual(client.complete_multipart_upload.call_count, 2)
        self.assertEqual(client.delete_object.call_count, 2)

    def test_failed_upload_aborts_and_cleans_up(self):
        client = mock.Mock()
        client.create_multipart_upload.return_value = {"UploadId": "upload-id"}
        client.upload_part.side_effect = PermissionError("upload denied")
        with self.assertRaisesRegex(PermissionError, "upload denied"):
            verify_s3_artifact_access(client, bucket="bucket", prefix="job")
        client.abort_multipart_upload.assert_called_once()
        client.delete_object.assert_called_once()
        client.complete_multipart_upload.assert_not_called()

    def test_corrupted_roundtrip_is_rejected_and_cleaned(self):
        client = mock.Mock()
        client.create_multipart_upload.return_value = {"UploadId": "upload-id"}
        client.upload_part.return_value = {"ETag": '"probe-etag"'}
        client.head_object.return_value = {"ContentLength": len(b"SOVA artifact storage preflight\n")}
        client.get_object.return_value = {"Body": io.BytesIO(b"corrupt")}
        with self.assertRaisesRegex(RuntimeError, "content does not match"):
            verify_s3_artifact_access(client, bucket="bucket", prefix="job")
        client.delete_object.assert_called_once()
        client.abort_multipart_upload.assert_not_called()


class DecisionModelTests(unittest.TestCase):
    def test_forward_matches_reference_and_checkpointed_backward_reaches_backbone(self):
        torch.manual_seed(12)
        backbone = FakeBackbone()
        model = MambaDecisionModel(backbone, 8, checkpoint_layers=True)
        ids = torch.tensor([[1, 2, 3, 4]])
        model.eval()
        self.assertTrue(torch.allclose(backbone(ids), model.encode_hidden(ids)))
        model.train()
        loss, _ = training_loss(model(ids), 1)
        loss.backward()
        self.assertEqual(tuple(model(ids).shape), (1, 3))
        self.assertIsNotNone(model.head.weight.grad)
        self.assertIsNotNone(backbone.layers[0].linear.weight.grad)
        self.assertTrue(torch.isfinite(loss).item())

    def test_distillation_uses_gold_and_soft_logits_without_suppressing_missing_targets(self):
        logits = torch.tensor([[2.0, 1.0, -1.0]], requires_grad=True)
        gold, _ = training_loss(logits, 0)
        fallback, _ = training_loss(logits, 0, teacher_logits=None, teacher_weight=0.9)
        mixed, components = training_loss(logits, 0, teacher_logits=[2.0, 1.0, -1.0],
                                          teacher_weight=0.5, temperature=2.0)
        self.assertTrue(torch.allclose(gold, fallback))
        self.assertAlmostEqual(components["distill"], 0.0, places=6)
        self.assertTrue(torch.allclose(mixed, gold * 0.5, atol=1e-6))
        mixed.backward()
        self.assertIsNotNone(logits.grad)
        with self.assertRaises(ValueError):
            training_loss(logits, 0, teacher_logits=[1.0, float("nan"), 2.0])

    def test_checkpoint_config_disallows_attention(self):
        config = {"d_model": 1024, "n_layer": 48, "ssm_cfg": {"layer": "Mamba2"}, "attn_layer_idx": []}
        validate_backbone_config(config)
        with self.assertRaises(ValueError):
            validate_backbone_config({**config, "attn_layer_idx": [0]})

    def test_saved_safetensor_student_reloads_without_changing_scores(self):
        from safetensors.torch import load_file

        model = MambaDecisionModel(FakeBackbone(), 8, checkpoint_layers=False).eval()
        inputs = torch.tensor([[1, 2, 3, 4]])
        expected = model(inputs).detach()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / "student"
            save_student(model, directory, {"test": True}, {"model_format": "test"})
            restored = MambaDecisionModel(FakeBackbone(), 8, checkpoint_layers=False).eval()
            restored.load_state_dict(load_file(str(directory / "student.safetensors")), strict=True)
            self.assertTrue(torch.allclose(expected, restored(inputs).detach()))
            self.assertFalse((directory / "student.safetensors.partial").exists())


class StudentTrainingTests(unittest.TestCase):
    def test_two_variants_start_identically_and_train_with_expected_targets(self):
        torch.manual_seed(12)
        initial = MambaDecisionModel(FakeBackbone(), 8, checkpoint_layers=True)
        gold, distilled = copy.deepcopy(initial), copy.deepcopy(initial)
        items = [StudentItem(f"contractnli:train:{i}:nda-1", str(i), (1, 2, 3), i % 3,
                             (0.1, 0.5, 0.2) if i % 2 == 0 else None) for i in range(4)]
        kwargs = dict(device="cpu", learning_rate=0.01, weight_decay=0.0, accumulation=2,
                      teacher_weight=0.5, temperature=2.0, seed=12)
        initial_head = initial.head.weight.detach().clone()
        a = train_epoch(gold, items, mode="labels_only", **kwargs)
        b = train_epoch(distilled, items, mode="distilled", **kwargs)
        self.assertEqual(a["trained_examples"], 4)
        self.assertEqual(a["examples_with_teacher"], 0)
        self.assertEqual(b["examples_with_teacher"], 2)
        self.assertFalse(torch.equal(gold.head.weight.detach(), initial_head))
        self.assertFalse(torch.equal(distilled.head.weight.detach(), initial_head))
        self.assertTrue(all(parameter.grad is None for parameter in gold.parameters()))
        self.assertTrue(all(parameter.grad is None for parameter in distilled.parameters()))


class StudentEvaluationTests(unittest.TestCase):
    def test_scorer_and_latency_keep_unscored_separate(self):
        model = MambaDecisionModel(FakeBackbone(), 8, checkpoint_layers=False)
        scorer = MeasuredStudentScorer(model, StudentTokenizer(), device="cpu", max_input_tokens=8)
        examples = [example(1, split="dev"), example(2, split="dev", long=True)]
        summary, rows = evaluate(examples, scorer)
        perf = latency_summary(rows, scorer.measurements)
        self.assertEqual(summary["scored"], 1)
        self.assertEqual(perf["context_too_long"], 1)
        self.assertEqual(perf["overall"]["examples"], 1)
        self.assertIsNone(perf["overall"]["gpu_forward_ms"]["p50"])
        matched = matched_teacher_comparison(rows, rows)
        self.assertEqual(matched["matched_examples"], 1)
        self.assertEqual(matched["student_accuracy"], matched["teacher_accuracy"])

    def test_latency_comparison_uses_only_the_same_scored_decisions(self):
        model = MambaDecisionModel(FakeBackbone(), 8, checkpoint_layers=False)
        scorer = MeasuredStudentScorer(model, StudentTokenizer(), device="cpu", max_input_tokens=8)
        examples = [example(1, split="dev"), example(2, split="dev", long=True)]
        _, rows = evaluate(examples, scorer)
        qwen = [{"model": "lora", "decision_id": row["decision_id"], "document_id": row["document_id"],
                 "status": "scored", "end_to_end_ms": 100.0} for row in rows]
        result = matched_latency_comparison(rows, scorer.measurements, qwen)
        self.assertEqual(result["matched_examples"], 1)
        self.assertEqual(result["qwen_p50_ms"], 100.0)
        with self.assertRaises(ValueError):
            matched_latency_comparison(rows, scorer.measurements, qwen + [qwen[0]])

    def test_serving_and_benchmark_scorers_return_same_decision(self):
        model = MambaDecisionModel(FakeBackbone(), 8, checkpoint_layers=False).eval()
        input_record = example(1, split="dev").model_input
        serving = StudentScorer(model, StudentTokenizer(), device="cpu", max_input_tokens=8)
        benchmark = MeasuredStudentScorer(model, StudentTokenizer(), device="cpu", max_input_tokens=8)
        direct, measured = serving.score(input_record), benchmark.score(input_record)
        self.assertEqual(direct.predicted_label, measured.predicted_label)
        for label in LABELS:
            self.assertAlmostEqual(direct.probabilities[label], measured.probabilities[label])
        self.assertFalse(direct.calibrated)
        with self.assertRaises(ContextTooLongError):
            serving.score(example(2, split="dev", long=True).model_input)


class StudentServiceTests(unittest.TestCase):
    def test_api_returns_typed_decision_and_rejects_oversize_without_truncation(self):
        from fastapi.testclient import TestClient
        from sova_student.service import create_app

        class FakeScorer:
            def score(self, model_input):
                if model_input.contract == "LONG":
                    raise ContextTooLongError("too long")
                return DecisionScores({"Entailment": 0.8, "Contradiction": 0.1, "NotMentioned": 0.1},
                                      "Entailment", 42, "cpu")

        client = TestClient(create_app(FakeScorer()))
        self.assertEqual(client.get("/health").json(), {"status": "ready"})
        response = client.post("/v1/decisions", json={"contract": "Contract", "statement": "Statement"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["decision"], "Entailment")
        self.assertFalse(response.json()["calibrated"])
        self.assertNotIn("evidence", response.json())
        self.assertEqual(client.post("/v1/decisions", json={"contract": "LONG", "statement": "S"}).status_code, 413)
        self.assertEqual(client.post("/v1/decisions", json={"contract": "  ", "statement": "S"}).status_code, 422)
        self.assertEqual(client.post("/v1/decisions", json={"contract": "C", "statement": "S", "gold": "x"}).status_code, 422)


class StudentPackageTests(unittest.TestCase):
    def test_cloud_entrypoint_imports_without_launching_a_job(self):
        from sova_student import cloud_worker
        self.assertTrue(callable(cloud_worker.main))

    def test_wheels_match_the_existing_torch_and_cuda_image(self):
        causal, mamba = kernel_wheel_urls("FALSE")
        self.assertIn("cu122torch2.1cxx11abiFALSE-cp310", causal)
        self.assertIn("cu12torch2.1cxx11abiFALSE-cp310", mamba)
        with self.assertRaises(ValueError):
            kernel_wheel_urls("unexpected")

    def test_package_includes_train_and_dev_but_not_test_decisions(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            names = ["datasets/processed/contractnli/decisions/train_clean.jsonl",
                     "datasets/processed/contractnli/decisions/dev.jsonl"]
            for name in names:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("{}\n", encoding="utf-8")
            for directory in ("sova_data", "sova_model", "sova_eval", "sova_bench", "sova_train", "sova_student"):
                (root / directory).mkdir()
                (root / directory / "__init__.py").write_text("", encoding="utf-8")
            path = root / "bundle.tar.gz"
            with mock.patch.object(submit_sagemaker, "ROOT", root), mock.patch.object(submit_sagemaker, "FILES", names):
                hashes = submit_sagemaker.package(path)
            with tarfile.open(path) as archive:
                included = archive.getnames()
            self.assertEqual(set(hashes), set(included))
            self.assertNotIn("datasets/processed/contractnli/decisions/test.jsonl", included)

    def test_collector_refuses_unexpected_archive_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "out.tar.gz"
            with tarfile.open(path, "w:gz") as archive:
                member = tarfile.TarInfo("../escape")
                member.size = 1
                archive.addfile(member, io.BytesIO(b"x"))
            with self.assertRaises(ValueError):
                read_archive(path)

    def test_collector_recomputes_matched_accuracy_and_latency_from_rows(self):
        class FakeScorer:
            def score(self, model_input):
                if model_input.contract == "LONG_DOCUMENT":
                    raise ContextTooLongError("too long")
                return DecisionScores({"Entailment": 0.8, "Contradiction": 0.1, "NotMentioned": 0.1},
                                      "Entailment", 4, "cpu")

        dev = [example(1, split="dev"), example(2, split="dev", long=True)]
        accuracy, rows = evaluate(dev, FakeScorer())
        accuracy.update({"split": "official dev", "test_examples_scored": False, "attention_layers": 0})
        timings = [{"decision_id": rows[0]["decision_id"], "status": "scored", "input_tokens": 4,
                    "end_to_end_ms": 20.0, "tokenization_ms": 1.0, "gpu_forward_ms": 18.0,
                    "gpu_peak_allocated_bytes": 100, "gpu_peak_reserved_bytes": 120},
                   {"decision_id": rows[1]["decision_id"], "status": "context_too_long"}]
        qwen = [{"model": "lora", "decision_id": row["decision_id"], "document_id": row["document_id"],
                 "status": row["status"], **({"end_to_end_ms": 30.0} if row["status"] == "scored" else {})}
                for row in rows]
        teacher_manifest = {"split": "train_clean", "scored": 1, "context_too_long": 1}
        first, second = example(1), example(2)
        targets = [target(first), {"decision_id": second.decision_id, "document_id": second.document_id,
                                   "status": "context_too_long", "logits": None}]
        data = {"total_examples": 2, "total_documents": 2, "usable_examples": 2,
                "student_context_too_long": 0, "usable_with_teacher": 1, "usable_gold_only": 1}
        job_name = "sova-mamba-student-test"
        variants, artifacts = {}, {}
        for variant, count in (("labels_only", 0), ("distilled", 1)):
            variants[variant] = {
                "accuracy": accuracy, "latency": latency_summary(rows, timings),
                "matched_teacher_accuracy": matched_teacher_comparison(rows, rows),
                "matched_qwen_latency": matched_latency_comparison(rows, timings, qwen),
                "training": {"variant": variant, "epochs": 1, "trained_examples": 2,
                             "examples_with_teacher": count},
            }
            prefix = (f"s3://{submit_sagemaker.BUCKET}/sys1/legal-student/"
                      f"{job_name}/models/{variant}/")
            artifacts[variant] = {"variant": variant, "files": {
                name: {"s3_uri": prefix + name, "bytes": 1, "sha256": "a" * 64}
                for name in ("student.safetensors", "backbone-config.json", "metadata.json")}}
        comparison = {"test_labels_loaded": False, "test_examples_scored": False,
                      "variants": variants, "model_artifacts": artifacts, "data": data,
                      "teacher": teacher_manifest, "initial_head_sha256": {"labels_only": "a", "distilled": "a"},
                      "distilled_vs_labels_only": compare_paired(rows, rows)}
        json_bytes = lambda value: json.dumps(value).encode()
        lines = lambda values: b"\n".join(json_bytes(value) for value in values) + b"\n"
        contents = {"comparison.json": json_bytes(comparison), "teacher-manifest.json": json_bytes(teacher_manifest),
                    "teacher-targets.jsonl": lines(targets), "student-data-manifest.json": json_bytes(data)}
        for variant in variants:
            contents[f"{variant}-summary.json"] = json_bytes(variants[variant])
            contents[f"{variant}-predictions.jsonl"] = lines(rows)
            contents[f"{variant}-timings.jsonl"] = lines(timings)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "teacher.jsonl").write_bytes(lines(rows))
            (root / "qwen.jsonl").write_bytes(lines(qwen))
            with mock.patch("sova_student.collect_sagemaker.ROOT", root), \
                 mock.patch("sova_student.collect_sagemaker.TEACHER_REFERENCE", "teacher.jsonl"), \
                 mock.patch("sova_student.collect_sagemaker.BENCH_REFERENCE", "qwen.jsonl"):
                verified = validate_outputs(contents, job_name=job_name, expected_train=2,
                                            expected_train_docs=2, expected_dev=2)
        self.assertEqual(verified["distilled_vs_labels_only"]["matched_scored_examples"], 1)


if __name__ == "__main__":
    unittest.main()
