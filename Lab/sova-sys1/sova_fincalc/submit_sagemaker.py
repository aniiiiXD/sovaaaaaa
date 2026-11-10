"""Prepare or submit one capped, no-training finance transfer evaluation."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import secrets
import tarfile
import tempfile
import time

from sova_eval.submit_sagemaker import ACCOUNT, BUCKET, IMAGE, PROFILE, REGION, ROLE, ROOT, aws, sha256

from .config import INSTANCE, MAX_RUNTIME_SECONDS, PRIOR_RATE_USD_PER_HOUR, STUDENT_PREFIX, TOKENIZER_DIR
from .dataset import DATA_PATH, TEST_COUNT, dataset_summary, load_test

SOURCE_DIRS = ("sova_data", "sova_model", "sova_eval", "sova_bench", "sova_student", "sova_fincalc")
ENTRYPOINT = (
    "mkdir -p /opt/ml/sova-fincalc && "
    "tar -xzf /opt/ml/input/data/code/bundle.tar.gz -C /opt/ml/sova-fincalc && "
    "cd /opt/ml/sova-fincalc && "
    "python3 -m sova_student.bootstrap && "
    "exec python3 -m sova_fincalc.worker"
)


def package(path: Path) -> dict[str, str]:
    """Include only code, the pinned tokenizer, and the finance test data."""
    load_test(ROOT / DATA_PATH)
    files = [ROOT / DATA_PATH]
    for directory in SOURCE_DIRS:
        files.extend(sorted((ROOT / directory).glob("*.py")))
    tokenizer = ROOT / TOKENIZER_DIR
    files.extend(sorted(tokenizer.glob("*.json")))
    names = [file.relative_to(ROOT).as_posix() for file in files]
    if (not all(file.is_file() for file in files) or len(names) != len(set(names)) or
            f"{TOKENIZER_DIR}/tokenizer.json" not in names):
        raise ValueError("Finance package has missing or duplicate files")
    if any(name.startswith("datasets/") and name != DATA_PATH for name in names):
        raise ValueError("No other dataset may enter this finance evaluation")
    hashes = {name: sha256(file) for name, file in zip(names, files)}
    with tarfile.open(path, "w:gz") as archive:
        for file, name in zip(files, names):
            archive.add(file, arcname=name, recursive=False)
    return hashes


def build_request(job_name: str) -> tuple[dict, str, str]:
    prefix = f"sys1/finance-transfer/{job_name}"
    s3_input = f"s3://{BUCKET}/{prefix}/input/"
    s3_output = f"s3://{BUCKET}/{prefix}/output/"
    request = {
        "TrainingJobName": job_name,
        "RoleArn": ROLE,
        "AlgorithmSpecification": {"TrainingImage": IMAGE, "TrainingInputMode": "File",
                                   "ContainerEntrypoint": ["bash", "-c", ENTRYPOINT]},
        "ResourceConfig": {"InstanceType": INSTANCE, "InstanceCount": 1, "VolumeSizeInGB": 50},
        "InputDataConfig": [
            {"ChannelName": "code", "DataSource": {"S3DataSource": {
                "S3Uri": s3_input, "S3DataType": "S3Prefix"}}},
            {"ChannelName": "student", "DataSource": {"S3DataSource": {
                "S3Uri": STUDENT_PREFIX, "S3DataType": "S3Prefix"}}},
        ],
        "OutputDataConfig": {"S3OutputPath": s3_output},
        "StoppingCondition": {"MaxRuntimeInSeconds": MAX_RUNTIME_SECONDS},
        "EnableManagedSpotTraining": False,
    }
    return request, s3_input, s3_output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-only", action="store_true", help="Inspect the exact bundle; do not contact AWS")
    parser.add_argument("--wait", action="store_true", help="Monitor the job and collect verified results")
    args = parser.parse_args()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    job_name = f"sova-fincalc-{timestamp}-{secrets.token_hex(3)}"
    request, s3_input, s3_output = build_request(job_name)
    dataset = dataset_summary(load_test(ROOT / DATA_PATH))
    if dataset["examples"] != TEST_COUNT:
        raise ValueError("Finance test set is incomplete")
    with tempfile.TemporaryDirectory(prefix="sova-fincalc-") as temp:
        bundle = Path(temp) / "bundle.tar.gz"
        hashes = package(bundle)
        receipt = {
            "status": "prepared", "job_name": job_name, "profile": PROFILE, "region": REGION,
            "input": s3_input, "output": s3_output, "student": STUDENT_PREFIX,
            "instance_type": INSTANCE, "volume_gb": 50, "max_runtime_seconds": MAX_RUNTIME_SECONDS,
            "prior_instance_rate_usd_per_hour": PRIOR_RATE_USD_PER_HOUR,
            "estimated_instance_compute_at_runtime_limit_usd": round(
                PRIOR_RATE_USD_PER_HOUR * MAX_RUNTIME_SECONDS / 3600, 4),
            "price_note": "Prior observed rate, not a live quote; storage, transfer and taxes are extra.",
            "dataset": dataset, "bundle_sha256": sha256(bundle), "file_sha256": hashes,
            "request": request,
        }
        if args.prepare_only:
            print(json.dumps(receipt, indent=2, sort_keys=True), flush=True)
            return
        if aws("sts", "get-caller-identity", "--query", "Account", "--output", "text") != ACCOUNT:
            raise RuntimeError("The selected AWS profile is not the expected account")
        report = ROOT / "reports" / f"{job_name}-submission.json"
        report.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        aws("s3", "cp", str(bundle), s3_input + "bundle.tar.gz", "--only-show-errors")
        request_path = Path(temp) / "request.json"
        request_path.write_text(json.dumps(request), encoding="utf-8")
        response = json.loads(aws("sagemaker", "create-training-job", "--cli-input-json", "file://" + str(request_path)))
        receipt.update({"status": "submitted", "job_arn": response["TrainingJobArn"]})
        report.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps(receipt, indent=2, sort_keys=True), flush=True)
    if not args.wait:
        return
    previous = None
    while True:
        job = json.loads(aws("sagemaker", "describe-training-job", "--training-job-name", job_name, "--output", "json"))
        status = job["TrainingJobStatus"]
        phase = job.get("SecondaryStatus")
        if (status, phase) != previous:
            print(json.dumps({"job_name": job_name, "status": status, "phase": phase}), flush=True)
            previous = (status, phase)
        if status == "Completed":
            from .collect_sagemaker import collect
            print(json.dumps(collect(job_name), indent=2, sort_keys=True), flush=True)
            return
        if status in ("Failed", "Stopped"):
            raise RuntimeError(f"Finance job ended as {status}: {job.get('FailureReason', 'no reason supplied')}")
        time.sleep(15)


if __name__ == "__main__":
    main()
