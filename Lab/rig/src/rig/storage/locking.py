from contextlib import contextmanager
from contextvars import ContextVar
import fcntl
from pathlib import Path
import time

from rig.errors import Unavailable

active_lock_fds: ContextVar[tuple[int, ...]] = ContextVar("rig_lock_fds", default=())


@contextmanager
def process_lock(path: Path, timeout: float = 0, check=lambda: None):
    """Single-host POSIX lock. Lock files are never unlinked (avoids inode races)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        deadline = time.monotonic() + timeout
        while True:
            check()
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError as exc:
                if time.monotonic() >= deadline:
                    raise Unavailable("Rig resource is busy; retry later") from exc
                time.sleep(0.1)
        token = active_lock_fds.set((*active_lock_fds.get(), handle.fileno()))
        try:
            yield
        finally:
            active_lock_fds.reset(token)
            fcntl.flock(handle, fcntl.LOCK_UN)
