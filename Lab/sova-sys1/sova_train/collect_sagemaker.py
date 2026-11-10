"""Collect and independently check a completed legal LoRA experiment."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import tarfile
import tempfile

from sova_eval.collect_sagemaker import verify_results
from sova_eval.submit_sagemaker import ROOT, aws
from sova_model.scorer import DEFAULT_REVISION
from sova_train.decision import compare_paired

BASELINE = ROOT / "reports/sova-legal-base-20261108-200636-8045d4"
REQUIRED = {
    "adapter/adapter_config.json", "adapter/adapter_model.safetensors", "adapter/sova-checkpoint.json",
    "training-manifest.json", "tuned-summary.json", "tuned-predictions.jsonl", "comparison.json",
}
OPTIONAL = {"adapter/README.md"}


def read_jsonl(data: bytes) -> list[dict]:
    return [json.loads(line) for line in data.splitlines() if line.strip()]


def collect_archive(archive_path: Path) -> dict[str, bytes]:
    contents: dict[str, bytes] = {}
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive:
            name = member.name.removeprefix("./")
            if member.isdir():
                continue
            if name not in REQUIRED | OPTIONAL or not member.isfile() or name in contents:
                raise ValueError(f"Unexpected or duplicated archive entry: {name}")
            if member.size > 500 * 1024 * 1024:
                raise ValueError(f"Unexpectedly large artifact: {name}")
            stream = archive.extractfile(member)
            if stream is None:
                raise ValueError(f"Could not read artifact: {name}")
            contents[name] = stream.read()
    if not REQUIRED <= set(contents):
        raise ValueError(f"Required artifacts are missing: {sorted(REQUIRED - set(contents))}")
    return contents


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("job_name")
    args = parser.parse_args()
    if not args.job_name.startswith("sova-legal-lora-") or "/" in args.job_name:
        raise ValueError("Unexpected job name")
    job = json.loads(aws("sagemaker", "describe-training-job", "--training-job-name", args.job_name, "--output", "json"))
    if job["TrainingJobStatus"] != "Completed":
        raise ValueError(f"Job did not complete: {job['TrainingJobStatus']}")
    output = ROOT / "reports" / args.job_name
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    with tempfile.TemporaryDirectory(prefix="sova-lora-result-") as temporary:
        archive_path = Path(temporary) / "model.tar.gz"
        uri = job["ModelArtifacts"]["S3ModelArtifacts"]
        aws("s3", "cp", uri, str(archive_path), "--only-show-errors")
        digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        contents = collect_archive(archive_path)
    summary = json.loads(contents["tuned-summary.json"])
    rows = read_jsonl(contents["tuned-predictions.jsonl"])
    verify_results(summary, rows, expected_examples=1037)
    manifest = json.loads(contents["training-manifest.json"])
    if (manifest["base_revision"] != DEFAULT_REVISION or manifest["test_labels_loaded"] is not False or
        manifest["trained_examples"] != manifest["data"]["usable_examples"]):
        raise ValueError("Training provenance or completed-example counts are inconsistent")
    baseline_rows = read_jsonl((BASELINE / "baseline-predictions.jsonl").read_bytes())
    paired = compare_paired(baseline_rows, rows)
    recorded = json.loads(contents["comparison.json"])
    for key, value in paired.items():
        if isinstance(value, float):
            if not math.isclose(value, recorded[key], rel_tol=1e-9, abs_tol=1e-9):
                raise ValueError(f"Paired comparison {key} does not match")
        elif value != recorded[key]:
            raise ValueError(f"Paired comparison {key} does not match")
    output.mkdir(parents=True)
    for name, data in contents.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    billable = job.get("BillableTimeInSeconds")
    metadata = {
        "job_name": args.job_name, "status": job["TrainingJobStatus"], "artifact_uri": uri,
        "artifact_sha256": digest, "training_seconds": job.get("TrainingTimeInSeconds"),
        "billable_seconds": billable, "estimated_rate_usd_per_hour": 1.515,
        "estimated_instance_cost_usd": round(billable * 1.515 / 3600, 4) if billable is not None else None,
        "note": "Estimated instance cost; storage, network and actual billing may differ.",
    }
    (output / "job-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"comparison": paired, "summary": summary, "job": metadata,
                      "report_dir": str(output)}, indent=2), flush=True)


if __name__ == "__main__":
    main()
