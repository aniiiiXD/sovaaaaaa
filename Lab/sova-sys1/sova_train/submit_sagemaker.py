"""Submit the fixed eight-hour-capped legal LoRA training and dev evaluation."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import secrets
import subprocess
import sys
import tarfile
import tempfile

from sova_eval.submit_sagemaker import ACCOUNT, BUCKET, IMAGE, PROFILE, REGION, ROLE, ROOT, aws, sha256

FILES = (
    "datasets/processed/contractnli/statements.json",
    "datasets/processed/contractnli/documents/train_clean.jsonl",
    "datasets/processed/contractnli/documents/dev.jsonl",
    "datasets/processed/contractnli/documents/test.jsonl",
    "datasets/processed/contractnli/decisions/train_clean.jsonl",
    "datasets/processed/contractnli/decisions/dev.jsonl",
    "reports/sova-legal-base-20261108-200636-8045d4/baseline-summary.json",
    "reports/sova-legal-base-20261108-200636-8045d4/baseline-predictions.jsonl",
    "sova_train/bootstrap.sh",
)
ENTRYPOINT = (
    "mkdir -p /opt/ml/sova-train && "
    "tar -xzf /opt/ml/input/data/code/bundle.tar.gz -C /opt/ml/sova-train && "
    "exec bash /opt/ml/sova-train/sova_train/bootstrap.sh"
)


def package(path: Path) -> dict[str, str]:
    files = [ROOT / name for name in FILES]
    for name in ("sova_data", "sova_model", "sova_eval", "sova_train"):
        files.extend(sorted((ROOT / name).glob("*.py")))
    if not all(file.is_file() for file in files):
        raise FileNotFoundError("A required source, dataset, or baseline file is missing")
    names = [file.relative_to(ROOT).as_posix() for file in files]
    if len(names) != len(set(names)):
        raise ValueError("Duplicate package paths")
    if "datasets/processed/contractnli/decisions/test.jsonl" in names:
        raise ValueError("Official test labels cannot enter the training package")
    hashes = {name: sha256(file) for name, file in zip(names, files)}
    with tarfile.open(path, "w:gz") as archive:
        for file, name in zip(files, names):
            archive.add(file, arcname=name, recursive=False)
    return hashes


def main() -> None:
    account = aws("sts", "get-caller-identity", "--query", "Account", "--output", "text")
    if account != ACCOUNT:
        raise RuntimeError("The active AWS profile is not the expected account")
    now = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    job_name = f"sova-legal-lora-{now}-{secrets.token_hex(3)}"
    prefix = f"sys1/legal-lora/{job_name}"
    s3_input = f"s3://{BUCKET}/{prefix}/input/"
    s3_output = f"s3://{BUCKET}/{prefix}/output/"
    s3_checkpoints = f"s3://{BUCKET}/{prefix}/checkpoints/"
    request = {
        "TrainingJobName": job_name, "RoleArn": ROLE,
        "AlgorithmSpecification": {
            "TrainingImage": IMAGE, "TrainingInputMode": "File",
            "ContainerEntrypoint": ["bash", "-c", ENTRYPOINT],
        },
        "ResourceConfig": {"InstanceType": "ml.g5.2xlarge", "InstanceCount": 1, "VolumeSizeInGB": 50},
        "InputDataConfig": [{"ChannelName": "code", "DataSource": {
            "S3DataSource": {"S3Uri": s3_input, "S3DataType": "S3Prefix"}}}],
        "OutputDataConfig": {"S3OutputPath": s3_output},
        "CheckpointConfig": {"S3Uri": s3_checkpoints, "LocalPath": "/opt/ml/checkpoints"},
        "StoppingCondition": {"MaxRuntimeInSeconds": 28800},
        "EnableManagedSpotTraining": False,
    }
    report = ROOT / "reports" / f"{job_name}-submission.json"
    with tempfile.TemporaryDirectory(prefix="sova-lora-") as temporary:
        bundle = Path(temporary) / "bundle.tar.gz"
        files = package(bundle)
        request_path = Path(temporary) / "request.json"
        request_path.write_text(json.dumps(request), encoding="utf-8")
        receipt = {
            "status": "prepared", "job_name": job_name, "region": REGION, "profile": PROFILE,
            "input": s3_input, "output": s3_output, "checkpoints": s3_checkpoints,
            "instance_type": "ml.g5.2xlarge", "max_runtime_seconds": 28800,
            "estimated_instance_rate_usd_per_hour": 1.515,
            "estimated_compute_cap_usd": 12.12,
            "note": "Estimate excludes storage, network and taxes. Partial checkpoints are adapters only.",
            "bundle_sha256": sha256(bundle), "file_sha256": files,
        }
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        aws("s3", "cp", str(bundle), s3_input + "bundle.tar.gz", "--only-show-errors")
        result = json.loads(aws("sagemaker", "create-training-job", "--cli-input-json", "file://" + str(request_path)))
    receipt.update({"status": "submitted", "job_arn": result["TrainingJobArn"]})
    report.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2), flush=True)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f"AWS command failed: {exc.stderr.strip()}", file=sys.stderr)
        raise SystemExit(1) from exc
