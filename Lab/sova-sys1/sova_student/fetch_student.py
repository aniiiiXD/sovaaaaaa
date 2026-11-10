"""Download one verified trained student from S3 after a completed job."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

from sova_eval.submit_sagemaker import BUCKET, aws


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch one SOVA student; files total approximately 1.5 GB")
    parser.add_argument("report_dir", type=Path)
    parser.add_argument("variant", choices=("labels_only", "distilled"))
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    comparison = json.loads((args.report_dir / "comparison.json").read_text(encoding="utf-8"))
    job_name = args.report_dir.name
    if not job_name.startswith("sova-mamba-student-") or "/" in job_name:
        raise ValueError("Unexpected student job name")
    files = comparison["model_artifacts"][args.variant]["files"]
    allowed = {"student.safetensors", "backbone-config.json", "metadata.json"}
    prefix = f"s3://{BUCKET}/sys1/legal-student/{job_name}/models/{args.variant}/"
    if set(files) != allowed or any(info["s3_uri"] != prefix + name for name, info in files.items()):
        raise ValueError("Student artifact URLs are not from the expected job")
    destination = args.destination.resolve()
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="sova-student-download-", dir=destination.parent) as temporary:
        staging = Path(temporary) / "student"
        staging.mkdir()
        for name, info in files.items():
            local = staging / name
            aws("s3", "cp", info["s3_uri"], str(local), "--only-show-errors")
            if local.stat().st_size != info["bytes"] or sha256(local) != info["sha256"]:
                raise ValueError(f"Downloaded student file does not match its manifest: {name}")
        os.rename(staging, destination)
    print(f"Verified {args.variant} student saved to {destination}")


if __name__ == "__main__":
    main()
