"""Send one local progress notification for a SageMaker training job.

Designed for short periodic launchd invocations; no process waits in the
background between checks and the job's AWS resources are read-only here.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time


def aws(*args: str, profile: str, region: str) -> dict:
    command = ["/opt/homebrew/bin/aws", "--profile", profile, "--region", region,
               "--cli-connect-timeout", "5", "--cli-read-timeout", "15",
               "--no-cli-pager", *args, "--output", "json"]
    environment = {**os.environ, "AWS_EC2_METADATA_DISABLED": "true", "AWS_PAGER": ""}
    result = subprocess.run(command, check=True, capture_output=True, text=True,
                            timeout=30, env=environment)
    return json.loads(result.stdout)


def progress_message(events: list[dict]) -> str:
    progress = None
    for event in events:
        message = event.get("message", "")
        teacher = re.match(r"teacher train: (\d+)/(\d+) processed; (\d+) scored", message)
        train = re.match(r"(labels_only|distilled): step (\d+)/(\d+); (\d+)/(\d+) examples", message)
        evaluate = re.match(r"(labels_only|distilled) dev: (\d+)/(\d+) processed; (\d+) scored", message)
        uploaded = re.match(r"(labels_only|distilled): trained weights uploaded", message)
        if teacher:
            count, total, scored = map(int, teacher.groups())
            progress = f"Teacher scoring: {count:,}/{total:,} decisions processed; {scored:,} scored."
        elif train:
            variant, step, steps, count, total = train.groups()
            name = "Labels-only" if variant == "labels_only" else "Distilled"
            progress = f"{name} student training: step {int(step):,}/{int(steps):,}; {int(count):,}/{int(total):,} examples."
        elif evaluate:
            variant, count, total, scored = evaluate.groups()
            name = "Labels-only" if variant == "labels_only" else "Distilled"
            progress = f"{name} evaluation: {int(count):,}/{int(total):,} decisions; {int(scored):,} scored."
        elif uploaded:
            name = "Labels-only" if uploaded.group(1) == "labels_only" else "Distilled"
            progress = f"{name} student weights uploaded; development evaluation is starting."
    return progress or "The worker is running; waiting for its next progress report."


def notify(message: str) -> None:
    script = 'on run argv\n display notification (item 1 of argv) with title "SOVA training"\nend run'
    subprocess.run(["/usr/bin/osascript", "-e", script, message], check=True,
                   capture_output=True, text=True, timeout=15)


def retire_agent(agent_file: Path, agent_label: str) -> None:
    if agent_file.name != agent_label + ".plist":
        raise ValueError("Monitor agent path and label do not match")
    agent_file.unlink(missing_ok=True)
    subprocess.Popen(["/bin/launchctl", "bootout", f"gui/{os.getuid()}/{agent_label}"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-name", required=True)
    parser.add_argument("--stream", required=True)
    parser.add_argument("--profile", required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--state-file", type=Path, required=True)
    parser.add_argument("--agent-label", required=True)
    parser.add_argument("--agent-file", type=Path, required=True)
    args = parser.parse_args()
    try:
        job = aws("sagemaker", "describe-training-job", "--training-job-name", args.job_name,
                  profile=args.profile, region=args.region)
        status = job["TrainingJobStatus"]
        terminal = status in {"Completed", "Failed", "Stopped"}
        if status == "Completed":
            message = "Training job completed. The model results are ready to collect."
        elif status == "Failed":
            message = "Training job failed: " + str(job.get("FailureReason", "Unknown reason"))[:150]
        elif status == "Stopped":
            message = "Training job stopped. Check the job report for details."
        else:
            logs = aws("logs", "get-log-events", "--log-group-name", "/aws/sagemaker/TrainingJobs",
                       "--log-stream-name", args.stream, "--limit", "100", "--no-paginate",
                       profile=args.profile, region=args.region)
            message = progress_message(logs.get("events", []))
        now = datetime.now(timezone.utc)
        previous = {}
        if args.state_file.exists():
            try:
                previous = json.loads(args.state_file.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pass
        record = {"checked_at_utc": now.isoformat(), "job_name": args.job_name,
                  "status": status, "phase": job.get("SecondaryStatus"), "message": message}
        args.state_file.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.state_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        temporary.replace(args.state_file)
        # Avoid two identical notifications when launchd immediately verifies
        # the same status that the installation smoke check just reported.
        try:
            age = (now - datetime.fromisoformat(previous.get("checked_at_utc", ""))).total_seconds()
        except (TypeError, ValueError):
            age = None
        if terminal or previous.get("message") != message or age is None or age >= 90:
            notify(message)
        print(json.dumps(record), flush=True)
        if terminal:
            # Remove only this job's generated agent, then ask launchd to unload
            # it. The user receives the terminal notification before cleanup.
            retire_agent(args.agent_file, args.agent_label)
    except Exception as error:
        # Avoid an orphaned monitor sending retry alerts forever if the AWS
        # account or credentials remain unreachable beyond the job's 12h cap.
        try:
            expired = time.time() - args.agent_file.stat().st_mtime > 16 * 60 * 60
        except OSError:
            expired = False
        try:
            notify("Monitoring stopped after 16 hours: AWS status unavailable; please check the job." if expired else
                   "Could not check the AWS job right now; will retry in 10 minutes.")
        except Exception:
            pass
        if expired:
            retire_agent(args.agent_file, args.agent_label)
        print(f"Progress check failed: {type(error).__name__}: {error}", file=sys.stderr, flush=True)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
