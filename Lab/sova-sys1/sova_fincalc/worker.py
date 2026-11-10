"""Score the pinned FinCalc-NLI test set using the unchanged legal student."""

from __future__ import annotations

from collections import Counter
import hashlib
import json
from pathlib import Path
import time

from sova_data.loader import LABELS
from sova_eval.baseline import evaluate
from sova_student.artifacts import load_saved_student
from sova_student.evaluation import MeasuredStudentScorer, latency_summary

from .config import SOURCE_JOB, STUDENT_FILES, STUDENT_PREFIX, TOKENIZER_DIR
from .dataset import DATA_PATH, dataset_summary, load_test

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = Path("/opt/ml/input/data/student")
OUTPUT = Path("/opt/ml/model")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_model(directory: Path) -> dict:
    for name, (size, expected_hash) in STUDENT_FILES.items():
        path = directory / name
        if not path.is_file() or path.stat().st_size != size or file_sha256(path) != expected_hash:
            raise ValueError(f"Saved student artifact does not match the recorded run: {name}")
    metadata = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
    if (metadata.get("variant") != "distilled" or metadata.get("attention_layers") != 0 or
            metadata.get("labels") != list(LABELS) or metadata.get("student_max_input_tokens") != 8192):
        raise ValueError("The input is not the expected distilled legal student")
    return metadata


def group_accuracy(records, predictions: list[dict], field: str) -> dict:
    """Include unscored decisions in the denominator for each group."""
    if len(records) != len(predictions):
        raise ValueError("Finance records and predictions have different lengths")
    groups: dict[str, Counter] = {}
    for record, row in zip(records, predictions):
        if row["decision_id"] != record.example.decision_id:
            raise ValueError("Finance prediction order does not match the input")
        name = getattr(record, field)
        counter = groups.setdefault(name, Counter())
        counter["examples"] += 1
        counter["scored"] += int(row["status"] == "scored")
        counter["correct"] += int(row["status"] == "scored" and row["prediction"] == row["gold"])
    return {
        name: {"examples": c["examples"], "scored": c["scored"], "correct": c["correct"],
               "accuracy_all_examples": c["correct"] / c["examples"]}
        for name, c in sorted(groups.items())
    }


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def main() -> None:
    import torch
    from transformers import AutoTokenizer

    if not torch.cuda.is_available():
        raise RuntimeError("This benchmark requires the pinned CUDA student runtime")
    model_metadata = verify_model(MODEL_DIR)
    records = load_test(ROOT / DATA_PATH)
    tokenizer = AutoTokenizer.from_pretrained(ROOT / TOKENIZER_DIR, local_files_only=True, trust_remote_code=False)
    tokenizer.model_max_length = model_metadata["student_max_input_tokens"]
    model, loaded_metadata = load_saved_student(MODEL_DIR, device="cuda")
    if loaded_metadata != model_metadata:
        raise RuntimeError("Student metadata changed during loading")
    scorer = MeasuredStudentScorer(model, tokenizer, device="cuda", max_input_tokens=8192)

    # Warm the existing inference path; the model sees no gold labels or tags.
    for record in records[:3]:
        scorer.score(record.example.model_input)
    scorer.measurements.clear()
    torch.cuda.synchronize()
    started = time.monotonic()

    def progress(total: int, scored: int) -> None:
        if total % 250 == 0 or total == len(records):
            print(f"FinCalc zero-shot: {total}/{len(records)} processed; {scored} scored", flush=True)

    accuracy, predictions = evaluate((record.example for record in records), scorer, progress)
    measured = scorer.measurements
    latency = latency_summary(predictions, measured)
    timings = [{"decision_id": row["decision_id"], **measurement}
               for row, measurement in zip(predictions, measured)]
    summary = {
        "dataset": dataset_summary(records),
        "model": {"source_job": SOURCE_JOB, "variant": "distilled", "source": STUDENT_PREFIX,
                  "weights_sha256": STUDENT_FILES["student.safetensors"][1], "attention_layers": 0},
        "evaluation": accuracy,
        "latency": latency,
        "accuracy_by_metric": group_accuracy(records, predictions, "metric"),
        "accuracy_by_kind": group_accuracy(records, predictions, "kind"),
        "gpu": torch.cuda.get_device_name(0),
        "torch_version": torch.__version__,
        "cuda_version": torch.version.cuda,
        "scoring_seconds": time.monotonic() - started,
        "warmup_examples": 3,
        "limitations": [
            "FinCalc-NLI is synthetic; its test split does not measure real customer outcomes.",
            "The contract-trained prompt and model are unchanged; this is zero-shot finance transfer.",
            "Neutral is approximated as NotMentioned; annotation definitions may differ.",
            "Scores are uncalibrated and do not provide evidence or verified calculations.",
            "Latency is warm, in-process, batch one and excludes PDF parsing, HTTP and network.",
        ],
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    write_json(OUTPUT / "summary.json", summary)
    write_jsonl(OUTPUT / "predictions.jsonl", predictions)
    write_jsonl(OUTPUT / "timings.jsonl", timings)
    print(json.dumps({"accuracy": accuracy, "latency": latency["overall"],
                      "majority_baseline": summary["dataset"]["majority_baseline_accuracy"]}), flush=True)


if __name__ == "__main__":
    main()
