"""One capped job: preflight, train-only teacher, two students, dev evaluation."""

from __future__ import annotations

import gc
import hashlib
import json
import os
from pathlib import Path
import time

from sova_data import ContractNLILoader
from sova_eval.baseline import evaluate
from sova_model import ContextTooLongError, QwenDecisionModel
from sova_model.scorer import DEFAULT_MODEL, DEFAULT_REVISION
from sova_train.decision import compare_paired
from .artifacts import load_pretrained_student, save_student, snapshot_metadata
from .config import (
    BENCH_REFERENCE, EPOCHS, GRADIENT_ACCUMULATION, LEARNING_RATE, SEED, STUDENT_MAX_TOKENS,
    STUDENT_MODEL, STUDENT_REVISION, TEACHER_ADAPTER, TEACHER_MAX_TOKENS, TEACHER_REFERENCE,
    TEACHER_WEIGHT, TEMPERATURE, TOKENIZER_MODEL, TOKENIZER_REVISION, WEIGHT_DECAY,
)
from .data import encode_student_input, prepare_training_examples
from .evaluation import BUCKETS, MeasuredStudentScorer, latency_summary, matched_latency_comparison, matched_teacher_comparison
from .s3_preflight import verify_s3_artifact_access
from .teacher import generate_teacher_records
from .train import train_epoch

ROOT = Path(__file__).resolve().parents[1]
OUT = Path("/opt/ml/model")
CHECKPOINTS = Path("/opt/ml/checkpoints")
WORK = Path("/opt/ml/student-work")


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def free_gpu() -> None:
    import torch
    gc.collect()
    torch.cuda.synchronize()
    torch.cuda.empty_cache()


def preflight(snapshot: Path) -> dict:
    """Check native-forward parity and longest-context backward before the long job."""
    import torch
    import torch.nn.functional as functional

    torch.manual_seed(SEED)
    native, student, config_data = load_pretrained_student(snapshot)
    student = student.to("cuda").eval()
    native.eval()
    short = torch.arange(1, 33, device="cuda", dtype=torch.long).unsqueeze(0)
    with torch.inference_mode(), torch.autocast(device_type="cuda", dtype=torch.float16):
        reference = native.backbone(short)
        actual = student.encode_hidden(short)
    torch.cuda.synchronize()
    max_diff = float((reference.float() - actual.float()).abs().max().item())
    if not torch.allclose(reference.float(), actual.float(), atol=0.002, rtol=0.002):
        raise RuntimeError(f"SOVA and native Mamba forward differ (max abs {max_diff})")
    del reference, actual, short
    student.train()
    student.zero_grad(set_to_none=True)
    optimizer = torch.optim.AdamW(student.parameters(), lr=0.0, weight_decay=0.0, foreach=False)
    torch.cuda.reset_peak_memory_stats()
    started = time.monotonic()
    synthetic = torch.ones((1, STUDENT_MAX_TOKENS), dtype=torch.long, device="cuda")
    with torch.autocast(device_type="cuda", dtype=torch.float16):
        logits = student(synthetic)
        loss = functional.cross_entropy(logits.float(), torch.tensor([1], device="cuda"))
    (loss * 8.0).backward()
    torch.cuda.synchronize()
    if not bool(torch.isfinite(loss).item()):
        raise RuntimeError("Mamba maximum-context preflight produced non-finite loss")
    if student.head.weight.grad is None or not bool(torch.isfinite(student.head.weight.grad).all().item()):
        raise RuntimeError("Mamba maximum-context preflight did not backpropagate through the head")
    if not any(parameter.grad is not None for parameter in student.backbone.parameters()):
        raise RuntimeError("Mamba maximum-context preflight did not backpropagate through the backbone")
    torch.nn.utils.clip_grad_norm_(student.parameters(), 1.0, error_if_nonfinite=True)
    # Materialize FP32 Adam states too: a forward/backward alone can fit while
    # the first real optimizer step exceeds the GPU memory budget.
    optimizer.step()
    torch.cuda.synchronize()
    result = {
        "native_forward_max_abs_difference": max_diff, "synthetic_tokens": STUDENT_MAX_TOKENS,
        "synthetic_loss": float(loss.detach().item()), "forward_backward_seconds": time.monotonic() - started,
        "peak_gpu_allocated_bytes": torch.cuda.max_memory_allocated(),
        "peak_gpu_reserved_bytes": torch.cuda.max_memory_reserved(),
        "attention_layers": len(config_data["attn_layer_idx"]),
    }
    del native, student, synthetic, logits, loss, optimizer
    free_gpu()
    return result


def upload_student(directory: Path, *, variant: str) -> dict:
    """Upload full weights outside the small SageMaker report tar and verify lengths."""
    import boto3

    bucket = os.environ["SOVA_ARTIFACT_BUCKET"]
    prefix = os.environ["SOVA_ARTIFACT_PREFIX"].rstrip("/") + f"/models/{variant}/"
    client = boto3.client("s3")
    files = {}
    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.name not in {"student.safetensors", "backbone-config.json", "metadata.json"}:
            raise ValueError("Unexpected local student artifact")
        key = prefix + path.name
        client.upload_file(str(path), bucket, key)
        observed = client.head_object(Bucket=bucket, Key=key)["ContentLength"]
        if observed != path.stat().st_size:
            raise RuntimeError(f"Uploaded {variant} artifact length does not match")
        digest = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        files[path.name] = {"s3_uri": f"s3://{bucket}/{key}", "bytes": observed, "sha256": digest.hexdigest()}
    if set(files) != {"student.safetensors", "backbone-config.json", "metadata.json"}:
        raise RuntimeError("Student upload is incomplete")
    manifest = {"variant": variant, "files": files, "checkpoint_resumable_optimizer_state": False}
    client.put_object(Bucket=bucket, Key=prefix + "complete.json", Body=json.dumps(manifest, indent=2).encode(),
                      ContentType="application/json")
    return manifest


def evaluate_student(model, tokenizer, examples, teacher_rows, qwen_timings, name: str) -> tuple[dict, list[dict], list[dict]]:
    import torch

    scorer = MeasuredStudentScorer(model, tokenizer, device="cuda", max_input_tokens=STUDENT_MAX_TOKENS)
    warmups = {}
    for example in examples:
        try:
            ids = encode_student_input(tokenizer, example.model_input, STUDENT_MAX_TOKENS)
        except ContextTooLongError:
            continue
        for low, high in BUCKETS:
            if low <= len(ids) <= high and (low, high) not in warmups:
                warmups[(low, high)] = example
                break
    for example in warmups.values():
        scorer.score(example.model_input)
    scorer.measurements.clear()
    torch.cuda.synchronize()
    resident_allocated = torch.cuda.memory_allocated()
    resident_reserved = torch.cuda.memory_reserved()

    def progress(total: int, scored: int) -> None:
        if total % 100 == 0:
            print(f"{name} dev: {total}/{len(examples)} processed; {scored} scored", flush=True)

    summary, rows = evaluate(examples, scorer, progress)
    measurements = scorer.measurements
    perf = latency_summary(rows, measurements)
    perf.update({"warmup_requests": len(warmups), "resident_gpu_allocated_bytes": resident_allocated,
                 "resident_gpu_reserved_bytes": resident_reserved})
    summary.update({
        "dataset": "ContractNLI", "split": "official dev", "model": STUDENT_MODEL,
        "model_revision": STUDENT_REVISION, "variant": name, "score_calibrated": False,
        "student_max_input_tokens": STUDENT_MAX_TOKENS, "test_labels_loaded": False,
        "test_examples_scored": False, "attention_layers": 0,
    })
    result = {
        "accuracy": summary, "latency": perf,
        "matched_teacher_accuracy": matched_teacher_comparison(rows, teacher_rows),
        "matched_qwen_latency": matched_latency_comparison(rows, measurements, qwen_timings),
    }
    return result, rows, measurements


def main() -> None:
    os.environ["HF_HOME"] = "/opt/ml/huggingface"
    os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
    import boto3
    import torch
    from huggingface_hub import snapshot_download
    from peft import PeftModel
    from transformers import AutoTokenizer

    if not torch.cuda.is_available():
        raise RuntimeError("The student experiment requires a CUDA GPU")
    if EPOCHS != 1:
        raise RuntimeError("This controlled experiment is fixed to one epoch per student")
    OUT.mkdir(parents=True, exist_ok=True)
    CHECKPOINTS.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    print(f"GPU: {torch.cuda.get_device_name(0)}; torch {torch.__version__}", flush=True)
    storage_report = verify_s3_artifact_access(
        boto3.client("s3"), bucket=os.environ["SOVA_ARTIFACT_BUCKET"],
        prefix=os.environ["SOVA_ARTIFACT_PREFIX"],
    )
    print("S3 artifact preflight:", json.dumps(storage_report), flush=True)
    student_snapshot = Path(snapshot_download(STUDENT_MODEL, revision=STUDENT_REVISION,
                                             allow_patterns=["config.json", "pytorch_model.bin"]))
    tokenizer_snapshot = Path(snapshot_download(TOKENIZER_MODEL, revision=TOKENIZER_REVISION,
        allow_patterns=["tokenizer*.json", "vocab.json", "merges.txt", "special_tokens_map.json", "config.json"]))
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_snapshot, local_files_only=True, trust_remote_code=False)
    tokenizer.model_max_length = STUDENT_MAX_TOKENS
    tokenizer.save_pretrained(OUT / "tokenizer")
    print("Starting reference parity and maximum-context backward preflight", flush=True)
    preflight_report = preflight(student_snapshot)
    preflight_report["s3_artifact_access"] = storage_report
    write_json(OUT / "preflight.json", preflight_report)
    print("Student preflight:", json.dumps(preflight_report), flush=True)

    loader = ContractNLILoader()
    train_examples = list(loader.iter_split("train"))
    dev_examples = list(loader.iter_split("dev"))
    if (len(train_examples) != 7140 or len({x.document_id for x in train_examples}) != 420 or
        len(dev_examples) != 1037 or len({x.document_id for x in dev_examples}) != 61):
        raise RuntimeError("Unexpected ContractNLI split size")
    teacher_dev = read_jsonl(ROOT / TEACHER_REFERENCE)
    qwen_timings = read_jsonl(ROOT / BENCH_REFERENCE)
    snapshot_download(DEFAULT_MODEL, revision=DEFAULT_REVISION,
                      allow_patterns=["*.json", "*.safetensors", "merges.txt", "vocab.json"])
    base = QwenDecisionModel.load_local(device="cuda", max_input_tokens=TEACHER_MAX_TOKENS)
    teacher_model = PeftModel.from_pretrained(base.model, ROOT / TEACHER_ADAPTER, is_trainable=False)
    teacher = QwenDecisionModel(base.tokenizer, teacher_model, device="cuda", max_input_tokens=TEACHER_MAX_TOKENS)

    def teacher_progress(total: int, scored: int) -> None:
        print(f"teacher train: {total}/{len(train_examples)} processed; {scored} scored", flush=True)

    print("Generating teacher scores for training decisions only", flush=True)
    teacher_records = generate_teacher_records(teacher, train_examples, CHECKPOINTS / "teacher", on_progress=teacher_progress)
    teacher_meta = {
        "split": "train_clean", "examples": len(teacher_records),
        "scored": sum(row["status"] == "scored" for row in teacher_records.values()),
        "context_too_long": sum(row["status"] == "context_too_long" for row in teacher_records.values()),
        "teacher_model": DEFAULT_MODEL, "teacher_revision": DEFAULT_REVISION,
        "teacher_adapter": TEACHER_ADAPTER, "teacher_max_input_tokens": TEACHER_MAX_TOKENS,
        "choice_order": ["Entailment", "Contradiction", "NotMentioned"],
        "note": "Teacher was trained on these same training examples; logits may be overconfident or memorized.",
    }
    write_json(OUT / "teacher-manifest.json", teacher_meta)
    write_jsonl(OUT / "teacher-targets.jsonl", teacher_records.values())
    del teacher, teacher_model, base
    free_gpu()
    items, data_report = prepare_training_examples(train_examples, tokenizer, STUDENT_MAX_TOKENS, teacher_records)
    write_json(OUT / "student-data-manifest.json", data_report)
    print("Student training data:", json.dumps({k: v for k, v in data_report.items() if k != "student_skipped_ids"}), flush=True)
    teacher_rows = teacher_dev
    variant_results = {}
    all_rows = {}
    initial_head_hashes = {}
    uploads = {}
    for variant in ("labels_only", "distilled"):
        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        native, model, config_data = load_pretrained_student(student_snapshot)
        initial_head_hashes[variant] = hashlib.sha256(model.head.weight.detach().cpu().numpy().tobytes() +
                                                     model.head.bias.detach().cpu().numpy().tobytes()).hexdigest()
        del native
        model = model.to("cuda")
        torch.cuda.synchronize()
        torch.cuda.reset_peak_memory_stats()

        def train_progress(step: int, steps: int, count: int, total: int, loss: float) -> None:
            print(f"{variant}: step {step}/{steps}; {count}/{total} examples; mean loss {loss:.4f}", flush=True)

        training = train_epoch(model, items, mode=variant, device="cuda", learning_rate=LEARNING_RATE,
                               weight_decay=WEIGHT_DECAY, accumulation=GRADIENT_ACCUMULATION,
                               teacher_weight=TEACHER_WEIGHT, temperature=TEMPERATURE,
                               seed=SEED, on_progress=train_progress)
        training.update({"peak_gpu_allocated_bytes": torch.cuda.max_memory_allocated(),
                         "peak_gpu_reserved_bytes": torch.cuda.max_memory_reserved(),
                         "trainable_dtype": "float32", "autocast": "float16", "checkpoint_layers": True})
        if variant == "distilled" and initial_head_hashes[variant] != initial_head_hashes["labels_only"]:
            raise RuntimeError("Student variants did not start with the same classifier head")
        saved = WORK / variant
        save_student(model, saved, config_data, snapshot_metadata(config_data, variant=variant, training=training))
        # Upload each completed student before the next stage starts.
        uploads[variant] = upload_student(saved, variant=variant)
        print(f"{variant}: trained weights uploaded; starting dev evaluation", flush=True)
        free_gpu()
        result, rows, measurements = evaluate_student(model, tokenizer, dev_examples, teacher_rows, qwen_timings, variant)
        result["training"] = training
        variant_results[variant], all_rows[variant] = result, rows
        write_json(OUT / f"{variant}-summary.json", result)
        write_jsonl(OUT / f"{variant}-predictions.jsonl", rows)
        write_jsonl(OUT / f"{variant}-timings.jsonl",
                    ({"decision_id": row["decision_id"], **measurement} for row, measurement in zip(rows, measurements)))
        del model
        free_gpu()
    comparison = compare_paired(all_rows["labels_only"], all_rows["distilled"])
    result = {
        "variants": variant_results, "distilled_vs_labels_only": comparison,
        "student_model": STUDENT_MODEL, "student_revision": STUDENT_REVISION,
        "tokenizer_model": TOKENIZER_MODEL, "tokenizer_revision": TOKENIZER_REVISION,
        "initial_head_sha256": initial_head_hashes, "teacher": teacher_meta, "data": data_report,
        "preflight": preflight_report, "gpu": torch.cuda.get_device_name(0),
        "gpu_total_bytes": torch.cuda.get_device_properties(0).total_memory,
        "torch_version": torch.__version__, "cuda_version": torch.version.cuda,
        "test_labels_loaded": False, "test_examples_scored": False, "model_artifacts": uploads,
        "limitations": [
            "The teacher was trained on the same train examples it scores; teacher logits may overfit.",
            "Results use 61 dev contracts with repeated statements; the official test labels were not loaded.",
            "Different tokenizers and max lengths require reporting common-example accuracy and separate coverage.",
            "Latency is warm, batch-one, in-process and excludes PDF parsing, HTTP, networking and startup.",
            "A10G PyTorch allocator memory excludes CUDA context and allocations outside PyTorch.",
            "Long inputs are rejected rather than silently truncated; outputs are uncalibrated and include no evidence.",
            "Models are full FP32 weights with FP16 CUDA autocast; no quantization or custom serving optimization.",
        ],
    }
    write_json(OUT / "comparison.json", result)
    print("Student experiment complete:", json.dumps(result, indent=2), flush=True)


if __name__ == "__main__":
    main()
