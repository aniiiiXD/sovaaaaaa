#!/usr/bin/env python3
"""Launch the reviewed Sova endpoint for one bounded, explicitly approved session.

Run with caffeinate on macOS. No model computation happens on this machine.
This process must remain alive; the deadline is not a cloud-side scheduler.
"""
import argparse
import json
from pathlib import Path
import signal
import subprocess
import time

PROFILE = "passkarwado"
REGION = "ap-south-1"
ACCOUNT = "169970912263"
NAME = "sova-fin-o1-14b-bd4b97b8"
BUCKET = "passkarwado"
PREFIX = "sova/fin-o1-14b/bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d/"
RATE_USD = 3.365825
HERE = Path(__file__).resolve().parent
WEIGHTS = HERE.parents[2] / "models" / "Fin-o1-14B"


def call(*args, check=True):
    result = subprocess.run(
        ["aws", *args, "--profile", PROFILE, "--region", REGION,
         "--output", "json", "--cli-connect-timeout", "10", "--cli-read-timeout", "30"],
        capture_output=True, text=True, timeout=90,
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result


def data(*args):
    return json.loads(call(*args).stdout or "{}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--minutes", type=int, choices=range(10, 61), default=60)
    parser.add_argument("--check-only", action="store_true", help="Validate preparation without launching an endpoint")
    args = parser.parse_args()
    identity = data("sts", "get-caller-identity")
    if identity["Account"] != ACCOUNT:
        raise RuntimeError("Unexpected AWS account; refusing launch.")
    expected = json.loads((HERE / "endpoint-config.json").read_text())
    actual = data("sagemaker", "describe-endpoint-config", "--endpoint-config-name", NAME)
    if actual["ProductionVariants"] != expected["ProductionVariants"]:
        raise RuntimeError("Remote endpoint configuration differs from reviewed configuration.")
    model = data("sagemaker", "describe-model", "--model-name", NAME)
    spec = json.loads((HERE / "model.json").read_text())
    for key in ["PrimaryContainer", "ExecutionRoleArn", "EnableNetworkIsolation"]:
        if model[key] != spec[key]:
            raise RuntimeError(f"Remote model {key} differs from reviewed configuration.")
    objects = data("s3api", "list-objects-v2", "--bucket", BUCKET, "--prefix", PREFIX)
    sizes = {item["Key"][len(PREFIX):]: item["Size"] for item in objects.get("Contents", [])}
    local = {p.name: p.stat().st_size for p in WEIGHTS.iterdir() if p.is_file() and p.name != ".gitattributes"}
    if len([name for name in local if name.endswith(".safetensors")]) != 6 or sizes != local:
        raise RuntimeError("S3 upload is incomplete or differs from the local checkpoint; no GPU launched.")
    existing = call("sagemaker", "describe-endpoint", "--endpoint-name", NAME, check=False)
    if existing.returncode == 0:
        raise RuntimeError("Endpoint already exists; refusing to take ownership or overwrite it.")
    if "could not find endpoint" not in existing.stderr.lower():
        raise RuntimeError(existing.stderr.strip())
    if args.check_only:
        print("All launch preflight checks passed. No endpoint launched.")
        return

    def interrupt(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupt)
    signal.signal(signal.SIGINT, interrupt)
    started = time.time()
    deadline = started + args.minutes * 60
    last = None
    try:
        print(f"Launching {NAME} in {REGION}; cleanup deadline in {args.minutes} minutes.", flush=True)
        call("sagemaker", "create-endpoint", "--endpoint-name", NAME,
             "--endpoint-config-name", NAME, "--tags", "Key=Project,Value=Sova")
        while time.time() < deadline:
            endpoint = data("sagemaker", "describe-endpoint", "--endpoint-name", NAME)
            status = endpoint["EndpointStatus"]
            if status != last:
                print(json.dumps({"endpoint": NAME, "status": status}), flush=True)
                last = status
            if status == "Failed":
                raise RuntimeError(endpoint.get("FailureReason", "Endpoint creation failed."))
            time.sleep(min(15, max(0, deadline - time.time())))
    finally:
        # Cleanup is independent of API request streams and runs on normal exit,
        # errors and handled termination signals. SIGKILL/laptop shutdown can
        # prevent it: use the documented manual delete command if interrupted.
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        removed = call("sagemaker", "delete-endpoint", "--endpoint-name", NAME, check=False)
        if removed.returncode and "could not find endpoint" not in removed.stderr.lower():
            print("CLEANUP FAILED: " + removed.stderr.strip(), flush=True)
            raise RuntimeError("Delete the SageMaker endpoint manually now.")
        for _ in range(80):
            check = call("sagemaker", "describe-endpoint", "--endpoint-name", NAME, check=False)
            if check.returncode and "could not find endpoint" in check.stderr.lower():
                elapsed = time.time() - started
                print(json.dumps({"deleted": NAME, "elapsedSeconds": round(elapsed),
                    "elapsedTimeCostEstimateUSD": round(elapsed / 3600 * RATE_USD, 2),
                    "actualBilledCost": "pending AWS billing; estimate excludes storage, transfer and tax"}), flush=True)
                break
            if check.returncode:
                raise RuntimeError("Unable to verify deletion: " + check.stderr.strip())
            time.sleep(15)
        else:
            raise RuntimeError("Deletion has not completed; inspect the endpoint immediately.")


if __name__ == "__main__":
    main()
