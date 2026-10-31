import time

from rig.domain.models import new_id, now
from rig.errors import Cancelled, Unavailable


class JobContext:
    def __init__(self, identifier, repository, timeout_seconds, stop_requested=lambda: False):
        self.id, self.repository = identifier, repository
        self.deadline = time.monotonic() + timeout_seconds
        self.stop_requested = stop_requested

    def check(self) -> None:
        if self.stop_requested():
            raise Cancelled("Worker stopping")
        if self.repository.job(self.id).cancel_requested:
            raise Cancelled("Job cancelled")
        if time.monotonic() > self.deadline:
            raise Unavailable("Job exceeded its execution deadline")

    def event(self, name: str, detail: dict | None = None) -> None:
        self.check()
        self.repository.put("event", {"id": new_id(), "created_at": now(), "job_id": self.id,
                                      "name": name, "detail": detail or {}})
