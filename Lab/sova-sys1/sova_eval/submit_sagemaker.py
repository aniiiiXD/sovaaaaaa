"""Package and submit the fixed, one-hour-capped legal baseline job."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import secrets
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PROFILE = "passkarwado"
REGION = "us-east-2"
ACCOUNT = "169970912263"
BUCKET = "sova-finance1-artifacts-use2-169970912263"
ROLE = f"arn:aws:iam::{ACCOUNT}:role/sova-sagemaker-exec"
IMAGE = ("763104351884.dkr.ecr.us-east-2.amazonaws.com/"
         "pytorch-training:2.1.0-gpu-py310-cu121-ubuntu20.04-ec2")
DOCUMENT_FILES = [
    "datasets/processed/contractnli/statements.json",
    "datasets/processed/contractnli/documents/train_clean.jsonl",
    "datasets/processed/contractnli/documents/dev.jsonl",
    "datasets/processed/contractnli/documents/test.jsonl",
    "datasets/processed/contractnli/decisions/dev.jsonl",
]
ENTRYPOINT = (
    "mkdir -p /opt/ml/baseline && "
    "tar -xzf /opt/ml/input/data/code/bundle.tar.gz -C /opt/ml/baseline && "
    "exec bash /opt/ml/baseline/sova_eval/bootstrap.sh"
)


def aws(*args: str) -> str:
    command = ["aws", "--profile", PROFILE, "--region", REGION, *args]
    result = subprocess.run(command, check=True, text=True, capture_output=True)
    return result.stdout.strip()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package(path: Path) -> list[str]:
    files = [ROOT / name for name in DOCUMENT_FILES]
    for name in ("sova_data", "sova_model", "sova_eval"):
        files.extend(sorted((ROOT / name).glob("*.py")))
    files.append(ROOT / "sova_eval/bootstrap.sh")
    if not all(file.is_file() for file in files):
        raise FileNotFoundError("A required baseline source or data file is missing")
    names = [str(file.relative_to(ROOT)) for file in files]
    if any("/decisions/test" in name or "/decisions/train" in name for name in names):
        raise ValueError("Training or test labels must not be included in the evaluation package")
    with tarfile.open(path, "w:gz") as archive:
        for file, name in zip(files, names):
            archive.add(file, arcname=name, recursive=False)
    return names


def main() -> None:
    identity = aws("sts", "get-caller-identity", "--query", "Account", "--output", "text")
    if identity != ACCOUNT:
        raise RuntimeError("The active AWS profile is not the expected account")
    now = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    job_name = f"sova-legal-base-{now}-{secrets.token_hex(3)}"
    prefix = f"sys1/legal-baseline/{job_name}"
    s3_input = f"s3://{BUCKET}/{prefix}/input/"
    s3_output = f"s3://{BUCKET}/{prefix}/output/"
    request = {
        "TrainingJobName": job_name,
        "RoleArn": ROLE,
        "AlgorithmSpecification": {
            "TrainingImage": IMAGE, "TrainingInputMode": "File",
            "ContainerEntrypoint": ["bash", "-c", ENTRYPOINT],
        },
        "ResourceConfig": {"InstanceType": "ml.g5.2xlarge", "InstanceCount": 1, "VolumeSizeInGB": 50},
        "InputDataConfig": [{
            "ChannelName": "code",
            "DataSource": {"S3DataSource": {"S3Uri": s3_input, "S3DataType": "S3Prefix"}},
        }],
        "OutputDataConfig": {"S3OutputPath": s3_output},
        "StoppingCondition": {"MaxRuntimeInSeconds": 3600},
        "EnableManagedSpotTraining": False,
    }
    report = ROOT / "reports" / f"{job_name}-submission.json"
    report.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="sova-baseline-") as temp:
        bundle = Path(temp) / "bundle.tar.gz"
        names = package(bundle)
        package_hash = sha256(bundle)
        request_path = Path(temp) / "request.json"
        request_path.write_text(json.dumps(request), encoding="utf-8")
        receipt = {
            "status": "prepared", "job_name": job_name, "region": REGION,
            "profile": PROFILE, "input": s3_input, "output": s3_output,
            "instance_type": "ml.g5.2xlarge", "max_runtime_seconds": 3600,
            "bundle_sha256": package_hash, "bundle_files": names,
            "note": "Unquantized FP16 Qwen3-4B; only validation labels included.",
        }
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
