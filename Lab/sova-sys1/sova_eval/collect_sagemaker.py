"""Collect and independently check a completed SageMaker baseline report."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tarfile
import tempfile

from sova_data.loader import LABELS

from .submit_sagemaker import ROOT, aws


def verify_results(summary: dict, rows: list[dict], *, expected_examples: int | None = None) -> None:
    if summary.get("split") != "official dev" or summary.get("test_examples_scored") is not False:
        raise ValueError("Unexpected split or test-set use in report")
    if len(rows) != summary.get("examples") or len({row["decision_id"] for row in rows}) != len(rows):
        raise ValueError("Prediction count or decision IDs are inconsistent")
    if expected_examples is not None and len(rows) != expected_examples:
        raise ValueError("The validation pass did not cover the expected number of examples")
    if len({row["document_id"] for row in rows}) != summary.get("documents"):
        raise ValueError("Document count is inconsistent")
    scored = 0
    correct = 0
    brier = 0.0
    confusion = {gold: {prediction: 0 for prediction in (*LABELS, "Unscored")} for gold in LABELS}
    for row in rows:
        gold = row["gold"]
        if gold not in LABELS or not row["decision_id"].startswith("contractnli:dev:"):
            raise ValueError("An invalid or non-development example appears in the report")
        if row["status"] == "context_too_long":
            if row["prediction"] is not None or row["scores"] is not None:
                raise ValueError("Unscored row contains a prediction")
            confusion[gold]["Unscored"] += 1
            continue
        if row["status"] != "scored" or set(row["scores"]) != set(LABELS):
            raise ValueError("Invalid scored row")
        probabilities = row["scores"]
        if any(not math.isfinite(probabilities[label]) or not 0 <= probabilities[label] <= 1 for label in LABELS):
            raise ValueError("Invalid probability value")
        if not math.isclose(sum(probabilities.values()), 1.0, abs_tol=1e-5):
            raise ValueError("Probabilities do not sum to one")
        prediction = max(LABELS, key=probabilities.__getitem__)
        if row["prediction"] != prediction:
            raise ValueError("Prediction does not match recorded probabilities")
        scored += 1
        correct += int(prediction == gold)
        confusion[gold][prediction] += 1
        brier += sum((probabilities[label] - float(label == gold)) ** 2 for label in LABELS)
    if not rows or scored == 0:
        raise ValueError("No scored validation examples")
    if (scored != summary["scored"] or correct != summary["correct"] or
        len(rows) - scored != summary["unscored_context_too_long"] or confusion != summary["confusion"]):
        raise ValueError("Report counts do not match prediction rows")
    for field, actual in (
        ("coverage", scored / len(rows)),
        ("accuracy_all_examples", correct / len(rows)),
        ("accuracy_scored_examples", correct / scored),
        ("brier_scored_examples", brier / scored),
    ):
        if not math.isclose(summary[field], actual, rel_tol=1e-9, abs_tol=1e-9):
            raise ValueError(f"Reported {field} does not match prediction rows")
    f1_values = []
    for label in LABELS:
        tp = confusion[label][label]
        support = sum(confusion[label].values())
        predicted = sum(confusion[other][label] for other in LABELS)
        precision = tp / predicted if predicted else 0.0
        recall = tp / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        expected = {"support": support, "predicted": predicted, "correct": tp,
                    "precision": precision, "recall": recall, "f1": f1}
        for field, value in expected.items():
            if not math.isclose(summary["per_class"][label][field], value, rel_tol=1e-9, abs_tol=1e-9):
                raise ValueError(f"Per-class {field} for {label} does not match prediction rows")
        f1_values.append(f1)
    if not math.isclose(summary["macro_f1_all_examples"], sum(f1_values) / len(f1_values), rel_tol=1e-9, abs_tol=1e-9):
        raise ValueError("Macro-F1 does not match prediction rows")


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect a completed SOVA legal baseline")
    parser.add_argument("job_name")
    args = parser.parse_args()
    job = json.loads(aws("sagemaker", "describe-training-job", "--training-job-name", args.job_name, "--output", "json"))
    if job["TrainingJobStatus"] != "Completed":
        raise ValueError(f"Job is not completed: {job['TrainingJobStatus']}")
    output = ROOT / "reports" / args.job_name
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    uri = job["ModelArtifacts"]["S3ModelArtifacts"]
    with tempfile.TemporaryDirectory(prefix="sova-baseline-result-") as temporary:
        archive_path = Path(temporary) / "model.tar.gz"
        aws("s3", "cp", uri, str(archive_path), "--only-show-errors")
        archive_sha = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        wanted = {"baseline-summary.json", "baseline-predictions.jsonl"}
        contents: dict[str, bytes] = {}
        with tarfile.open(archive_path, "r:gz") as archive:
            for member in archive:
                name = member.name.removeprefix("./")
                if name in wanted and member.isfile():
                    if name in contents or member.size > 50 * 1024 * 1024:
                        raise ValueError("Duplicate or unexpectedly large output file")
                    stream = archive.extractfile(member)
                    if stream is None:
                        raise ValueError("Could not read output file")
                    contents[name] = stream.read()
        if set(contents) != wanted:
            raise ValueError("SageMaker output is missing expected report files")
        summary = json.loads(contents["baseline-summary.json"])
        rows = [json.loads(line) for line in contents["baseline-predictions.jsonl"].splitlines() if line.strip()]
        verify_results(summary, rows, expected_examples=1037)
    output.mkdir(parents=True)
    for name, data in contents.items():
        (output / name).write_bytes(data)
    job_metadata = {
        "job_name": args.job_name,
        "status": job["TrainingJobStatus"],
        "artifact_uri": uri,
        "artifact_sha256": archive_sha,
        "training_seconds": job.get("TrainingTimeInSeconds"),
        "billable_seconds": job.get("BillableTimeInSeconds"),
        "previously_observed_instance_rate_usd_per_hour": 1.515,
        "note": "The previous rate is an estimate; storage, network and actual billing may differ.",
    }
    (output / "job-metadata.json").write_text(json.dumps(job_metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"summary": summary, "job": job_metadata, "report_dir": str(output)}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        print(f"Collection failed: {exc}")
        raise SystemExit(1) from exc
