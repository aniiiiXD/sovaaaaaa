"""Small checks for finance label plumbing and the submitted artifact boundary."""

from __future__ import annotations

import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from sova_data.loader import LABELS
from sova_eval.baseline import evaluate
from sova_model import DecisionScores
from sova_fincalc.collect_sagemaker import read_archive, verify_outputs
from sova_fincalc.config import INSTANCE, MAX_RUNTIME_SECONDS, SOURCE_JOB, STUDENT_FILES, STUDENT_PREFIX
from sova_fincalc.dataset import DATA_PATH, TEST_COUNT, dataset_summary, load_test, parse_records
from sova_fincalc.submit_sagemaker import ROOT, build_request, package
from sova_student.data import encode_student_input


def fixture(label: int, *, premise: str = "Income rose from 100 to 120.") -> bytes:
    return json.dumps({"premise": premise, "hypothesis": "Income rose 20%.", "label": label,
                       "metric": "FIXTURE_METRIC", "kind": "GOLD_ONLY_SENTINEL"}).encode()


class CaptureTokenizer:
    def __init__(self) -> None:
        self.text = ""

    def encode(self, text, *, add_special_tokens, truncation):
        self.text = text
        assert not add_special_tokens and not truncation
        return [1, 2, 3]


class FinanceDatasetTests(unittest.TestCase):
    def test_finance_labels_are_mapped_and_gold_stays_out_of_the_prompt(self):
        examples = parse_records(b"\n".join(fixture(label) for label in (0, 1, 2)))
        self.assertEqual([item.example.target.label for item in examples],
                         ["Contradiction", "Entailment", "NotMentioned"])
        tokenizer = CaptureTokenizer()
        encode_student_input(tokenizer, examples[0].example.model_input, 8192)
        self.assertNotIn("GOLD_ONLY_SENTINEL", tokenizer.text)
        self.assertNotIn("FIXTURE_METRIC", tokenizer.text)
        self.assertIn("Income rose from 100 to 120.", tokenizer.text)
        self.assertEqual(len({item.example.document_id for item in examples}), 1)
        self.assertEqual(len({item.example.decision_id for item in examples}), 3)

    def test_rejects_invalid_labels_and_empty_inputs(self):
        with self.assertRaises(ValueError):
            parse_records(fixture(True))
        with self.assertRaises(ValueError):
            parse_records(fixture(3))
        with self.assertRaises(ValueError):
            parse_records(fixture(0, premise="  "))

    def test_existing_evaluator_scores_finance_labels_without_target_access(self):
        records = parse_records(b"\n".join(fixture(label) for label in (0, 1, 2)))

        class ContradictionScorer:
            def score(self, value):
                self.assert_no_gold(value)
                return DecisionScores({"Entailment": 0.1, "Contradiction": 0.8, "NotMentioned": 0.1},
                                      "Contradiction", 3, "cpu")

            def assert_no_gold(self, value):
                if hasattr(value, "target") or set(value.as_dict()) != {"contract", "statement", "choices"}:
                    raise AssertionError("Gold data leaked into the model input")

        summary, rows = evaluate((item.example for item in records), ContradictionScorer())
        self.assertEqual((summary["correct"], summary["examples"]), (1, 3))
        self.assertEqual([row["gold"] for row in rows], ["Contradiction", "Entailment", "NotMentioned"])

    def test_pinned_finance_split_and_majority_baseline(self):
        records = load_test(ROOT / DATA_PATH)
        self.assertEqual(len(records), TEST_COUNT)
        stats = dataset_summary(records)
        self.assertEqual(stats["labels"], {"Entailment": 1512, "Contradiction": 1853, "NotMentioned": 635})
        self.assertAlmostEqual(stats["majority_baseline_accuracy"], 1853 / 4000)


class FinanceJobTests(unittest.TestCase):
    def test_request_is_eval_only_and_has_bounded_runtime(self):
        request, _, _ = build_request("sova-fincalc-test")
        self.assertEqual(request["ResourceConfig"]["InstanceType"], INSTANCE)
        self.assertEqual(request["StoppingCondition"]["MaxRuntimeInSeconds"], MAX_RUNTIME_SECONDS)
        self.assertEqual(request["InputDataConfig"][1]["DataSource"]["S3DataSource"]["S3Uri"], STUDENT_PREFIX)
        command = request["AlgorithmSpecification"]["ContainerEntrypoint"][-1]
        self.assertIn("sova_fincalc.worker", command)
        self.assertNotIn("sova_student.cloud_worker", command)

    def test_bundle_contains_only_the_intended_dataset(self):
        with tempfile.TemporaryDirectory() as temp:
            archive_path = Path(temp) / "bundle.tar.gz"
            hashes = package(archive_path)
            with tarfile.open(archive_path, "r:gz") as archive:
                names = archive.getnames()
        self.assertEqual(set(names), set(hashes))
        self.assertEqual([name for name in names if name.startswith("datasets/")], [DATA_PATH])
        self.assertIn("sova_fincalc/worker.py", names)

    def test_collector_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "bad.tar.gz"
            with tarfile.open(path, "w:gz") as archive:
                member = tarfile.TarInfo("../outside")
                member.size = 1
                archive.addfile(member, io.BytesIO(b"x"))
            with self.assertRaises(ValueError):
                read_archive(path)

    def test_collector_recomputes_accuracy_and_rejects_tampered_gold(self):
        records = parse_records(b"\n".join(fixture(label) for label in (0, 1, 2)))

        class Scorer:
            def score(self, value):
                return DecisionScores({"Entailment": 0.1, "Contradiction": 0.8, "NotMentioned": 0.1},
                                      "Contradiction", 3, "cpu")

        evaluation, rows = evaluate((item.example for item in records), Scorer())
        timings = [{"decision_id": row["decision_id"], "status": "scored", "input_tokens": 3,
                    "end_to_end_ms": value, "tokenization_ms": 1.0, "gpu_forward_ms": value - 1.0}
                   for row, value in zip(rows, (12.0, 20.0, 40.0))]
        summary = {"dataset": dataset_summary(records),
                   "model": {"source_job": SOURCE_JOB, "variant": "distilled",
                             "weights_sha256": STUDENT_FILES["student.safetensors"][1]},
                   "evaluation": evaluation,
                   "latency": {"overall": {"end_to_end_ms": {"mean": 24.0, "p50": 20.0, "p95": 38.0}}}}

        def contents():
            return {"summary.json": json.dumps(summary).encode(),
                    "predictions.jsonl": b"\n".join(json.dumps(row).encode() for row in rows),
                    "timings.jsonl": b"\n".join(json.dumps(row).encode() for row in timings)}

        verified = verify_outputs(contents(), records)
        self.assertEqual((verified["correct"], verified["examples"]), (1, 3))
        self.assertAlmostEqual(verified["latency_ms"]["p95"], 38.0)
        rows[0]["gold"] = "Entailment"
        with self.assertRaises(ValueError):
            verify_outputs(contents(), records)


if __name__ == "__main__":
    unittest.main()
