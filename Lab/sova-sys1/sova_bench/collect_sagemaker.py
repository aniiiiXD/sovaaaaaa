"""Safely collect and recalculate a completed decision benchmark."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import tarfile
import tempfile

from sova_bench.metrics import summarize
from sova_eval.submit_sagemaker import ROOT, aws

REQUIRED = {"benchmark-summary.json", "benchmark-rows.jsonl"}


def read_archive(path: Path) -> dict[str, bytes]:
    contents = {}
    with tarfile.open(path, "r:gz") as archive:
        for member in archive:
            name = member.name.removeprefix("./")
            if member.isdir():
                continue
            if name not in REQUIRED or not member.isfile() or name in contents or member.size > 20 * 1024 * 1024:
                raise ValueError(f"Unexpected benchmark artifact: {name}")
            stream = archive.extractfile(member)
            if stream is None:
                raise ValueError(f"Unable to read {name}")
            contents[name] = stream.read()
    if set(contents) != REQUIRED:
        raise ValueError("Benchmark output is incomplete")
    return contents


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("job_name")
    args = parser.parse_args()
    if not args.job_name.startswith("sova-legal-bench-") or "/" in args.job_name:
        raise ValueError("Unexpected job name")
    job = json.loads(aws("sagemaker", "describe-training-job", "--training-job-name", args.job_name, "--output", "json"))
    if job["TrainingJobStatus"] != "Completed":
        raise ValueError(f"Benchmark did not complete: {job['TrainingJobStatus']}")
    output = ROOT / "reports" / args.job_name
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    with tempfile.TemporaryDirectory(prefix="sova-benchmark-result-") as temporary:
        path = Path(temporary) / "model.tar.gz"
        uri = job["ModelArtifacts"]["S3ModelArtifacts"]
        aws("s3", "cp", uri, str(path), "--only-show-errors")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        contents = read_archive(path)
    report = json.loads(contents["benchmark-summary.json"])
    if report["split"] != "official dev" or report["test_labels_loaded"] is not False:
        raise ValueError("Unexpected evaluation split")
    rows = [json.loads(line) for line in contents["benchmark-rows.jsonl"].splitlines() if line.strip()]
    grouped = {name: [row for row in rows if row["model"] == name] for name in ("base", "lora")}
    if sum(len(group) for group in grouped.values()) != len(rows):
        raise ValueError("Unexpected model in benchmark rows")
    for name, group in grouped.items():
        measured = summarize(group)
        for key, value in measured.items():
            if value != report[name][key]:
                raise ValueError(f"{name} benchmark field {key} does not match the rows")
        if measured["requests"] != 1037 or measured["scored_requests"] != 901:
            raise ValueError("Unexpected development benchmark coverage")
    if {row["decision_id"]: row["status"] for row in grouped["base"]} != {
        row["decision_id"]: row["status"] for row in grouped["lora"]
    }:
        raise ValueError("Compared models did not process the same examples")
    output.mkdir(parents=True)
    for name, data in contents.items():
        (output / name).write_bytes(data)
    billable = job.get("BillableTimeInSeconds")
    metadata = {
        "job_name": args.job_name, "status": job["TrainingJobStatus"], "artifact_uri": uri,
        "artifact_sha256": digest, "billable_seconds": billable,
        "estimated_rate_usd_per_hour": 1.515,
        "estimated_instance_cost_usd": round(billable * 1.515 / 3600, 4) if billable is not None else None,
        "note": "Estimate excludes storage, transfer and taxes; actual billing may differ.",
    }
    (output / "job-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"summary": report, "job": metadata, "report_dir": str(output)}, indent=2), flush=True)


if __name__ == "__main__":
    main()
