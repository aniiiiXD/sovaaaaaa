import os
from pathlib import Path
import signal
import subprocess
import time

from rig.domain.ports import Check
from rig.errors import Unavailable
from rig.storage.locking import active_lock_fds


def run_command(arguments: list[str], log: Path, check: Check) -> None:
    """No shell interpolation. Child process groups are stopped on cancel/timeout."""
    check()
    log.parent.mkdir(parents=True, exist_ok=True)
    environment = {**os.environ, "HF_HUB_OFFLINE": "1", "HF_DATASETS_OFFLINE": "1",
                   "TOKENIZERS_PARALLELISM": "false", "PYTHONUNBUFFERED": "1"}
    with log.open("xb") as output:
        process = subprocess.Popen(arguments, stdout=output, stderr=subprocess.STDOUT,
                                   env=environment, start_new_session=True, stdin=subprocess.DEVNULL,
                                   pass_fds=active_lock_fds.get())
        try:
            while process.poll() is None:
                check()
                time.sleep(0.2)
            check()
            if process.returncode != 0:
                raise Unavailable(f"MLX command exited with status {process.returncode}; "
                                  f"inspect the job's {log.name}")
        finally:
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
