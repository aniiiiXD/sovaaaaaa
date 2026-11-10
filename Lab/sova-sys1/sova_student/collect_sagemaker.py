"""Collect the small experiment report and independently verify its metrics."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import tarfile
import tempfile

from sova_eval.collect_sagemaker import verify_results
from sova_eval.submit_sagemaker import BUCKET, ROOT, aws
from sova_train.decision import compare_paired
from .config import BENCH_REFERENCE, TEACHER_REFERENCE
from .evaluation import latency_summary, matched_latency_comparison, matched_teacher_comparison

REQUIRED = {
    "preflight.json", "teacher-manifest.json", "teacher-targets.jsonl", "student-data-manifest.json",
    "labels_only-summary.json", "labels_only-predictions.jsonl", "labels_only-timings.jsonl",
    "distilled-summary.json", "distilled-predictions.jsonl", "distilled-timings.jsonl", "comparison.json",
}
TOKENIZER_FILES = {"tokenizer/tokenizer.json", "tokenizer/tokenizer_config.json", "tokenizer/special_tokens_map.json",
                   "tokenizer/vocab.json", "tokenizer/merges.txt", "tokenizer/added_tokens.json"}


def read_archive(path: Path) -> dict[str, bytes]:
    result = {}
    with tarfile.open(path, "r:gz") as archive:
        for member in archive:
            name = member.name.removeprefix("./")
            if member.isdir():
                continue
            if (name not in REQUIRED | TOKENIZER_FILES or not member.isfile() or
                name in result or member.size > 50 * 1024 * 1024):
                raise ValueError(f"Unexpected student report artifact: {name}")
            stream = archive.extractfile(member)
            if stream is None:
                raise ValueError(f"Unable to read student report artifact: {name}")
            result[name] = stream.read()
    if not REQUIRED <= set(result) or "tokenizer/tokenizer.json" not in result:
        raise ValueError("Student report or tokenizer output is incomplete")
    return result


def read_jsonl(data: bytes) -> list[dict]:
    return [json.loads(line) for line in data.splitlines() if line.strip()]


def validate_outputs(contents: dict[str, bytes], *, job_name: str, expected_train: int = 7140,
                     expected_train_docs: int = 420, expected_dev: int = 1037) -> dict:
    comparison = json.loads(contents["comparison.json"])
    if comparison["test_labels_loaded"] is not False or comparison["test_examples_scored"] is not False:
        raise ValueError("The official test labels must remain untouched")
    teacher_manifest = json.loads(contents["teacher-manifest.json"])
    targets = read_jsonl(contents["teacher-targets.jsonl"])
    if (teacher_manifest["split"] != "train_clean" or len(targets) != expected_train or
        len({row["decision_id"] for row in targets}) != expected_train or
        any(not row["decision_id"].startswith("contractnli:train:") for row in targets) or
        sum(row["status"] == "scored" for row in targets) != teacher_manifest["scored"] or
        sum(row["status"] == "context_too_long" for row in targets) != teacher_manifest["context_too_long"]):
        raise ValueError("Teacher targets do not match the training-only manifest")
    for row in targets:
        if row["status"] == "scored":
            values = row.get("logits")
            if (not isinstance(values, list) or len(values) != 3 or
                any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in values)):
                raise ValueError("Invalid teacher score vector")
        elif row["status"] != "context_too_long" or row.get("logits") is not None:
            raise ValueError("Invalid unscored teacher target")
    data = json.loads(contents["student-data-manifest.json"])
    if (data["total_examples"] != expected_train or data["total_documents"] != expected_train_docs or
        data["usable_examples"] + data["student_context_too_long"] != expected_train or
        data["usable_with_teacher"] + data["usable_gold_only"] != data["usable_examples"] or
        comparison["data"] != data or comparison["teacher"] != teacher_manifest):
        raise ValueError("Student data or teacher manifest is inconsistent")
    reference = read_jsonl((ROOT / TEACHER_REFERENCE).read_bytes())
    qwen_timing = read_jsonl((ROOT / BENCH_REFERENCE).read_bytes())
    all_rows = {}
    for variant in ("labels_only", "distilled"):
        report = json.loads(contents[f"{variant}-summary.json"])
        rows = read_jsonl(contents[f"{variant}-predictions.jsonl"])
        timings = read_jsonl(contents[f"{variant}-timings.jsonl"])
        verify_results(report["accuracy"], rows, expected_examples=expected_dev)
        training = report["training"]
        expected_teacher_count = 0 if variant == "labels_only" else data["usable_with_teacher"]
        if (training["variant"] != variant or training["epochs"] != 1 or
            training["trained_examples"] != data["usable_examples"] or
            training["examples_with_teacher"] != expected_teacher_count or
            report["accuracy"]["attention_layers"] != 0):
            raise ValueError(f"{variant} training summary is inconsistent")
        if len(rows) != len(timings) or any(row["decision_id"] != timing["decision_id"]
                                             for row, timing in zip(rows, timings)):
            raise ValueError("Student timing IDs do not match predictions")
        measured = latency_summary(rows, timings)
        for key, value in measured.items():
            if report["latency"][key] != value:
                raise ValueError(f"{variant} latency summary {key} does not match its rows")
        if report["matched_teacher_accuracy"] != matched_teacher_comparison(rows, reference):
            raise ValueError(f"{variant} matched teacher accuracy is inconsistent")
        if report["matched_qwen_latency"] != matched_latency_comparison(rows, timings, qwen_timing):
            raise ValueError(f"{variant} matched latency is inconsistent")
        if comparison["variants"][variant] != report:
            raise ValueError(f"{variant} summary differs from the comparison")
        manifest = comparison["model_artifacts"][variant]
        prefix = f"s3://{BUCKET}/sys1/legal-student/{job_name}/models/{variant}/"
        if (manifest["variant"] != variant or set(manifest["files"]) !=
            {"student.safetensors", "backbone-config.json", "metadata.json"} or
            any(item["s3_uri"] != prefix + name or item["bytes"] <= 0 or len(item["sha256"]) != 64
                for name, item in manifest["files"].items())):
            raise ValueError(f"{variant} model artifact manifest is invalid")
        all_rows[variant] = rows
    if comparison["distilled_vs_labels_only"] != compare_paired(all_rows["labels_only"], all_rows["distilled"]):
        raise ValueError("Student variant comparison does not match predictions")
    hashes = comparison["initial_head_sha256"]
    if hashes["labels_only"] != hashes["distilled"]:
        raise ValueError("Student variants did not begin with the same classifier head")
    return comparison


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("job_name")
    args = parser.parse_args()
    if not args.job_name.startswith("sova-mamba-student-") or "/" in args.job_name:
        raise ValueError("Unexpected job name")
    job = json.loads(aws("sagemaker", "describe-training-job", "--training-job-name", args.job_name, "--output", "json"))
    if job["TrainingJobStatus"] != "Completed":
        raise ValueError(f"Student job did not complete: {job['TrainingJobStatus']}")
    output = ROOT / "reports" / args.job_name
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    with tempfile.TemporaryDirectory(prefix="sova-student-result-") as temporary:
        path = Path(temporary) / "model.tar.gz"
        uri = job["ModelArtifacts"]["S3ModelArtifacts"]
        aws("s3", "cp", uri, str(path), "--only-show-errors")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        contents = read_archive(path)
    comparison = validate_outputs(contents, job_name=args.job_name)
    output.mkdir(parents=True)
    for name, data in contents.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    billable = job.get("BillableTimeInSeconds")
    metadata = {
        "job_name": args.job_name, "status": job["TrainingJobStatus"], "artifact_uri": uri,
        "artifact_sha256": digest, "billable_seconds": billable, "estimated_rate_usd_per_hour": 1.515,
        "estimated_instance_cost_usd": round(billable * 1.515 / 3600, 4) if billable is not None else None,
        "note": "Estimated instance cost; storage, network and taxes may differ.",
    }
    (output / "job-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    brief = {variant: {"accuracy": comparison["variants"][variant]["accuracy"]["accuracy_scored_examples"],
                       "coverage": comparison["variants"][variant]["accuracy"]["coverage"],
                       "latency": comparison["variants"][variant]["latency"]["overall"]["end_to_end_ms"],
                       "matched_teacher": comparison["variants"][variant]["matched_teacher_accuracy"]}
             for variant in ("labels_only", "distilled")}
    print(json.dumps({"variants": brief, "job": metadata, "report_dir": str(output)}, indent=2), flush=True)


if __name__ == "__main__":
    main()
