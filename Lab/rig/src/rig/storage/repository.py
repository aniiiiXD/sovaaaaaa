from __future__ import annotations

from contextlib import contextmanager
import json
from pathlib import Path
import sqlite3

from rig.domain.models import Job, now
from rig.errors import Conflict, NotFound


class Repository:
    """Short transactions; no connection is shared across threads or processes."""

    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS records (
                    kind TEXT NOT NULL,
                    id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    body TEXT NOT NULL,
                    PRIMARY KEY(kind, id)
                );
                CREATE TABLE IF NOT EXISTS prompt_splits (
                    fingerprint TEXT PRIMARY KEY,
                    split TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    state TEXT NOT NULL,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    payload TEXT NOT NULL,
                    result TEXT,
                    error TEXT
                );
                CREATE INDEX IF NOT EXISTS job_queue ON jobs(state, created_at);
                CREATE TABLE IF NOT EXISTS deployments (
                    name TEXT PRIMARY KEY,
                    deployment_id TEXT NOT NULL
                );
            """)

    @staticmethod
    def _insert(db, kind: str, body: dict) -> None:
        db.execute("INSERT INTO records VALUES (?, ?, ?, ?)",
                   (kind, body["id"], body["created_at"], json.dumps(body, allow_nan=False)))

    def put(self, kind: str, body: dict) -> None:
        with self.connection() as db:
            self._insert(db, kind, body)

    def put_unique(self, kind: str, body: dict, field: str, value: str) -> None:
        """Used for immutable human reviews; one decision per feedback submission."""
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT 1 FROM records WHERE kind=? AND json_extract(body, ?)=?",
                          (kind, f"$.{field}", value)).fetchone():
                raise Conflict("A decision already exists; submit new feedback to supersede it")
            self._insert(db, kind, body)

    def related(self, kind: str, field: str, value: str,
                limit: int = 50, offset: int = 0) -> list[dict]:
        with self.connection() as db:
            rows = db.execute("SELECT body FROM records WHERE kind=? AND json_extract(body, ?)=? "
                              "ORDER BY created_at, id LIMIT ? OFFSET ?",
                              (kind, f"$.{field}", value, limit, offset)).fetchall()
        return [json.loads(row["body"]) for row in rows]

    def get(self, kind: str, identifier: str) -> dict:
        with self.connection() as db:
            row = db.execute("SELECT body FROM records WHERE kind=? AND id=?",
                             (kind, identifier)).fetchone()
        if row is None:
            raise NotFound(f"Unknown {kind}: {identifier}")
        return json.loads(row["body"])

    def list(self, kind: str, limit: int = 50, offset: int = 0) -> list[dict]:
        with self.connection() as db:
            rows = db.execute("SELECT body FROM records WHERE kind=? "
                              "ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                              (kind, limit, offset)).fetchall()
        return [json.loads(row["body"]) for row in rows]

    def register_dataset(self, body: dict, fingerprints: list[tuple[str, str]]) -> None:
        # One transaction protects split assignments even for concurrent imports.
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self._register_dataset(db, body, fingerprints)

    @classmethod
    def _register_dataset(cls, db, body: dict, fingerprints: list[tuple[str, str]]) -> None:
        for fingerprint, split in fingerprints:
            row = db.execute("SELECT split FROM prompt_splits WHERE fingerprint=?",
                             (fingerprint,)).fetchone()
            if row is not None and row["split"] != split:
                raise Conflict("An input already belongs to another split in this Rig "
                               "workspace; held-out inputs cannot become training data")
            db.execute("INSERT OR IGNORE INTO prompt_splits VALUES (?, ?)",
                       (fingerprint, split))
        cls._insert(db, "dataset", body)

    def enqueue(self, job: Job) -> Job:
        with self.connection() as db:
            self._insert_job(db, job)
        return job

    @staticmethod
    def _insert_job(db, job: Job) -> None:
        db.execute("INSERT INTO jobs VALUES (?, ?, ?, ?, ?, 0, ?, NULL, NULL)",
                   (job.id, job.created_at, job.updated_at, job.kind, job.state,
                    json.dumps(job.payload, allow_nan=False)))

    def enqueue_cycle(self, cycle: dict, job: Job, max_cycles: int, *,
                      dataset: dict | None = None,
                      fingerprints: list[tuple[str, str]] | None = None) -> Job:
        if (dataset is None) != (fingerprints is None):
            raise ValueError("A prepared dataset and its split fingerprints must be supplied together")
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self._workflow_idle(db, cycle["workflow_id"])
            rows = db.execute("SELECT id FROM records WHERE kind='cycle' "
                              "AND json_extract(body, '$.workflow_id')=? ORDER BY rowid",
                              (cycle["workflow_id"],)).fetchall()
            if len(rows) >= max_cycles:
                raise Conflict("Workflow cycle budget exhausted; create a reviewed workflow version")
            latest = rows[-1]["id"] if rows else None
            if cycle.get("parent_cycle_id") != latest:
                raise Conflict("Extend the latest cycle; concurrent branches are not supported")
            if dataset is not None:
                assert fingerprints is not None
                self._register_dataset(db, dataset, fingerprints)
            self._insert(db, "cycle", cycle)
            self._insert_job(db, job)
        return job

    @staticmethod
    def _workflow_idle(db, workflow_id: str) -> None:
        if db.execute("SELECT 1 FROM jobs WHERE state IN ('queued', 'running') "
                      "AND json_extract(payload, '$.workflow_id')=?", (workflow_id,)).fetchone():
            raise Conflict("This workflow already has an active cycle or release audit")

    def enqueue_release(self, job: Job) -> Job:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self._workflow_idle(db, job.payload["workflow_id"])
            if db.execute("SELECT 1 FROM jobs WHERE kind='workflow_release' "
                          "AND json_extract(payload, '$.cycle_id')=?",
                          (job.payload["cycle_id"],)).fetchone():
                raise Conflict("This cycle already has a release audit; audits are not retried silently")
            self._insert_job(db, job)
        return job

    @staticmethod
    def _job(row) -> Job:
        data = dict(row)
        data["payload"] = json.loads(data["payload"])
        data["result"] = json.loads(data["result"]) if data["result"] else None
        return Job.model_validate(data)

    def job(self, identifier: str) -> Job:
        with self.connection() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (identifier,)).fetchone()
        if row is None:
            raise NotFound(f"Unknown job: {identifier}")
        return self._job(row)

    def jobs(self, limit: int = 50, offset: int = 0) -> list[Job]:
        with self.connection() as db:
            rows = db.execute("SELECT * FROM jobs ORDER BY created_at DESC, id DESC "
                              "LIMIT ? OFFSET ?", (limit, offset)).fetchall()
        return [self._job(row) for row in rows]

    def job_events(self, identifier: str, limit: int = 50, offset: int = 0) -> list[dict]:
        with self.connection() as db:
            rows = db.execute("SELECT body FROM records WHERE kind='event' "
                              "AND json_extract(body, '$.job_id')=? "
                              "ORDER BY created_at, id LIMIT ? OFFSET ?",
                              (identifier, limit, offset)).fetchall()
        return [json.loads(row["body"]) for row in rows]

    def claim(self) -> Job | None:
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM jobs WHERE state='queued' "
                             "ORDER BY created_at, id LIMIT 1").fetchone()
            if row is None:
                return None
            db.execute("UPDATE jobs SET state='running', updated_at=? WHERE id=?",
                       (now(), row["id"]))
            result = dict(row)
            result.update(state="running", updated_at=now())
        return self._job(result)

    def cancel(self, identifier: str) -> Job:
        with self.connection() as db:
            db.execute("UPDATE jobs SET cancel_requested=1, updated_at=?, "
                       "state=CASE WHEN state='queued' THEN 'cancelled' ELSE state END "
                       "WHERE id=? AND state IN ('queued', 'running')", (now(), identifier))
        return self.job(identifier)

    def finish(self, identifier: str, state: str, result: dict | None = None,
               error: str | None = None) -> None:
        with self.connection() as db:
            # Cancellation racing with successful completion must not become success.
            db.execute("UPDATE jobs SET state=CASE WHEN cancel_requested=1 THEN 'cancelled' "
                       "ELSE ? END, result=?, error=?, updated_at=? "
                       "WHERE id=? AND state='running'",
                       (state, json.dumps(result) if result is not None else None,
                        error, now(), identifier))

    def recover_interrupted(self) -> None:
        """Only called while holding the exclusive worker process lock."""
        with self.connection() as db:
            db.execute("UPDATE jobs SET state=CASE WHEN cancel_requested=1 THEN 'cancelled' "
                       "ELSE 'failed' END, error='Worker interrupted; submit a new job', "
                       "updated_at=? WHERE state='running'", (now(),))

    def promote(self, body: dict) -> None:
        with self.connection() as db:
            self._insert(db, "deployment", body)
            db.execute("INSERT INTO deployments VALUES (?, ?) ON CONFLICT(name) DO UPDATE "
                       "SET deployment_id=excluded.deployment_id", (body["name"], body["id"]))

    def deployment(self, name: str) -> dict:
        with self.connection() as db:
            row = db.execute("SELECT r.body FROM deployments d JOIN records r "
                             "ON r.id=d.deployment_id AND r.kind='deployment' "
                             "WHERE d.name=?", (name,)).fetchone()
        if row is None:
            raise NotFound(f"No active deployment named {name}")
        return json.loads(row["body"])

    def deployments(self) -> list[dict]:
        with self.connection() as db:
            rows = db.execute("SELECT r.body FROM deployments d JOIN records r "
                              "ON r.id=d.deployment_id AND r.kind='deployment' "
                              "ORDER BY d.name").fetchall()
        return [json.loads(row["body"]) for row in rows]

    def deactivate(self, name: str) -> None:
        with self.connection() as db:
            if db.execute("DELETE FROM deployments WHERE name=?", (name,)).rowcount == 0:
                raise NotFound(f"No active deployment named {name}")
