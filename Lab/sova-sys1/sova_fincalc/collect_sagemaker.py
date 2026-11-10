"""Collect and independently check the finance evaluation's prediction rows."""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import tarfile
import tempfile

from sova_data.loader import LABELS
from sova_eval.submit_sagemaker import ROOT, aws

from .config import PRIOR_RATE_USD_PER_HOUR, SOURCE_JOB, STUDENT_FILES
from .dataset import DATA_PATH, TEST_SHA256, dataset_summary, load_test

EXPECTED = {"summary.json", "predictions.jsonl", "timings.jsonl"}


def read_archive(path: Path) -> dict[str, bytes]:
    contents: dict[str, bytes] = {}
    with tarfile.open(path, "r:gz") as archive:
        for member in archive:
            if member.isdir():
                continue
            name = member.name.removeprefix("./")
            if (name not in EXPECTED or not member.isfile() or name in contents or
                    member.size > 15 * 1024 * 1024):
                raise ValueError(f"Unexpected finance result archive member: {name}")
            stream = archive.extractfile(member)
            if stream is None:
                raise ValueError("Cannot read finance result archive member")
            contents[name] = stream.read()
    if set(contents) != EXPECTED:
        raise ValueError("Finance result archive is incomplete")
    return contents


def _jsonl(data: bytes) -> list[dict]:
    rows = [json.loads(line) for line in data.splitlines() if line.strip()]
    if any(not isinstance(row, dict) for row in rows):
        raise ValueError("A finance result row is not an object")
    return rows


def verify_outputs(contents: dict[str, bytes], records) -> dict:
    summary = json.loads(contents["summary.json"])
    rows = _jsonl(contents["predictions.jsonl"])
    timings = _jsonl(contents["timings.jsonl"])
    if (len(rows) != len(records) or len(timings) != len(records) or
            summary["dataset"]["sha256"] != TEST_SHA256 or
            summary["model"]["source_job"] != SOURCE_JOB or
            summary["model"]["variant"] != "distilled" or
            summary["model"]["weights_sha256"] != STUDENT_FILES["student.safetensors"][1]):
        raise ValueError("Finance output is not from the expected data and model")
    confusion = {gold: {prediction: 0 for prediction in (*LABELS, "Unscored")} for gold in LABELS}
    scored = correct = 0
    latencies: list[float] = []
    brier_sum = 0.0
    gold_counts: Counter = Counter()
    for record, row, timing in zip(records, rows, timings):
        example = record.example
        gold = example.target.label
        if (row.get("decision_id") != example.decision_id or row.get("document_id") != example.document_id or
                row.get("gold") != gold or timing.get("decision_id") != example.decision_id or
                timing.get("status") != row.get("status")):
            raise ValueError("Prediction or timing does not match the pinned finance input")
        gold_counts[gold] += 1
        status = row["status"]
        if status == "context_too_long":
            if row.get("prediction") is not None or row.get("scores") is not None:
                raise ValueError("Unscored finance row contains a prediction")
            confusion[gold]["Unscored"] += 1
            continue
        if status != "scored":
            raise ValueError("Unexpected finance prediction status")
        scores = row.get("scores")
        if (not isinstance(scores, dict) or set(scores) != set(LABELS) or
                any(not isinstance(scores[label], (float, int)) or isinstance(scores[label], bool) or
                    not math.isfinite(scores[label]) or not 0 <= scores[label] <= 1 for label in LABELS) or
                abs(sum(scores.values()) - 1.0) > 1e-5 or
                row.get("prediction") != max(LABELS, key=scores.__getitem__) or
                row.get("input_tokens") != timing.get("input_tokens")):
            raise ValueError("Invalid finance scores or token counts")
        for key in ("end_to_end_ms", "tokenization_ms", "gpu_forward_ms"):
            value = timing.get(key)
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0:
                raise ValueError("Invalid finance timing measurement")
        latencies.append(float(timing["end_to_end_ms"]))
        brier_sum += sum((scores[label] - float(label == gold)) ** 2 for label in LABELS)
        prediction = row["prediction"]
        confusion[gold][prediction] += 1
        scored += 1
        correct += int(prediction == gold)
    per_class = {}
    for label in LABELS:
        tp = confusion[label][label]
        support = sum(confusion[label].values())
        predicted = sum(confusion[other][label] for other in LABELS)
        precision = tp / predicted if predicted else 0.0
        recall = tp / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {"support": support, "predicted": predicted, "correct": tp,
                            "precision": precision, "recall": recall, "f1": f1}
    macro_f1 = sum(row["f1"] for row in per_class.values()) / len(LABELS)
    actual = summary["evaluation"]
    if (actual["examples"] != len(records) or actual["scored"] != scored or actual["correct"] != correct or
            actual["confusion"] != confusion or
            actual["per_class"] != per_class or
            not math.isclose(actual["accuracy_all_examples"], correct / len(records), abs_tol=1e-12) or
            not math.isclose(actual["coverage"], scored / len(records), abs_tol=1e-12) or
            not math.isclose(actual["macro_f1_all_examples"], macro_f1, abs_tol=1e-12) or
            summary["dataset"]["labels"] != dataset_summary(records)["labels"] or
            not math.isclose(summary["dataset"]["majority_baseline_accuracy"],
                             max(gold_counts.values()) / len(records), abs_tol=1e-12)):
        raise ValueError("Finance summary does not agree with individual predictions")
    if not scored:
        raise ValueError("No finance decisions were scored")
    if (not math.isclose(actual["accuracy_scored_examples"], correct / scored, abs_tol=1e-12) or
            not math.isclose(actual["brier_scored_examples"], brier_sum / scored, abs_tol=1e-12)):
        raise ValueError("Finance scored accuracy or Brier score is inconsistent")
    latencies.sort()

    def percentile(quantile: float) -> float:
        pos = (len(latencies) - 1) * quantile
        low, high = math.floor(pos), math.ceil(pos)
        return latencies[low] + (latencies[high] - latencies[low]) * (pos - low)

    timing_summary = {"mean": sum(latencies) / len(latencies), "p50": percentile(0.5), "p95": percentile(0.95)}
    reported_timing = summary["latency"]["overall"]["end_to_end_ms"]
    if any(not math.isclose(reported_timing[key], value, rel_tol=1e-9, abs_tol=1e-9)
           for key, value in timing_summary.items()):
        raise ValueError("Finance latency summary does not match individual timings")
    return {"examples": len(records), "scored": scored, "correct": correct,
            "accuracy_all_examples": correct / len(records),
            "accuracy_scored_examples": correct / scored if scored else None,
            "macro_f1_all_examples": macro_f1, "per_class": per_class, "latency_ms": timing_summary,
            "majority_baseline_accuracy": max(gold_counts.values()) / len(records),
            "confusion": confusion}


def collect(job_name: str) -> dict:
    if not re.fullmatch(r"sova-fincalc-[0-9]{8}-[0-9]{6}-[0-9a-f]{6}", job_name):
        raise ValueError("Unexpected finance job name")
    job = json.loads(aws("sagemaker", "describe-training-job", "--training-job-name", job_name, "--output", "json"))
    if job["TrainingJobStatus"] != "Completed":
        raise ValueError(f"Finance job did not complete: {job['TrainingJobStatus']}")
    output = ROOT / "reports" / job_name
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    with tempfile.TemporaryDirectory(prefix="sova-fincalc-result-") as temp:
        archive_path = Path(temp) / "model.tar.gz"
        uri = job["ModelArtifacts"]["S3ModelArtifacts"]
        aws("s3", "cp", uri, str(archive_path), "--only-show-errors")
        digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        contents = read_archive(archive_path)
    checked = verify_outputs(contents, load_test(ROOT / DATA_PATH))
    output.mkdir(parents=True)
    for name, data in contents.items():
        (output / name).write_bytes(data)
    billable = job.get("BillableTimeInSeconds")
    metadata = {"job_name": job_name, "status": job["TrainingJobStatus"], "artifact_uri": uri,
                "artifact_sha256": digest, "billable_seconds": billable,
                "estimated_instance_cost_usd": round(billable * PRIOR_RATE_USD_PER_HOUR / 3600, 4)
                if billable is not None else None,
                "note": "Prior observed rate; storage, transfer, tax and actual billing may differ."}
    (output / "job-metadata.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"verified": checked, "job": metadata, "report_dir": str(output)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job_name")
    args = parser.parse_args()
    print(json.dumps(collect(args.job_name), indent=2), flush=True)


if __name__ == "__main__":
    main()
