from collections import Counter
from hashlib import sha256
import unicodedata

from rig.domain.models import Dataset, DatasetCreate, FeedbackDatasetCreate, Record
from rig.errors import Conflict, RigError
from rig.storage.artifacts import Artifacts
from rig.storage.repository import Repository


def fingerprint(record: Record) -> str:
    # Ignore system text deliberately: changing instructions must not launder a test question.
    normalized = " ".join(unicodedata.normalize("NFKC", record.prompt).casefold().split())
    return sha256(normalized.encode()).hexdigest()


def messages(record: Record, include_answer: bool = False) -> list[dict[str, str]]:
    output = []
    if record.system:
        output.append({"role": "system", "content": record.system})
    output.append({"role": "user", "content": record.prompt})
    if include_answer:
        output.append({"role": "assistant", "content": record.completion})
    return output


class DatasetService:
    def __init__(self, repository: Repository, artifacts: Artifacts):
        self.repository = repository
        self.artifacts = artifacts

    def get(self, identifier: str) -> Dataset:
        return Dataset.model_validate(self.repository.get("dataset", identifier))

    def records(self, identifier: str, split: str | None = None) -> list[Record]:
        dataset = self.get(identifier)
        records = [Record.model_validate(row) for row in
                   self.artifacts.read_jsonl(dataset.artifact, dataset.sha256)]
        return [row for row in records if split is None or row.split == split]

    def create(self, request: DatasetCreate) -> Dataset:
        if request.parent_id:
            self.get(request.parent_id)
        seen_ids, seen_prompts = set(), set()
        fingerprints = []
        for row in request.records:
            if not row.prompt.strip() or not row.completion.strip():
                raise RigError("Prompts and completions cannot be blank")
            key = fingerprint(row)
            if row.id in seen_ids or key in seen_prompts:
                raise Conflict("Duplicate record ID or normalized input in dataset")
            seen_ids.add(row.id)
            seen_prompts.add(key)
            fingerprints.append((key, row.split))
        dataset = Dataset(name=request.name, parent_id=request.parent_id,
                          description=request.description, sha256="", artifact="",
                          counts=dict(Counter(row.split for row in request.records)))
        dataset.artifact = f"datasets/{dataset.id}/records.jsonl"
        dataset.sha256 = self.artifacts.write_jsonl(
            dataset.artifact, [row.model_dump(mode="json") for row in request.records])
        try:
            self.repository.register_dataset(dataset.model_dump(mode="json"), fingerprints)
        except Exception:
            # Only the new, unregistered dataset artifact is removed on transaction failure.
            self.artifacts.path(dataset.artifact).unlink(missing_ok=True)
            raise
        return dataset

    def export_training(self, identifier: str, relative: str):
        dataset = self.get(identifier)
        if not dataset.counts.get("train") or not dataset.counts.get("valid"):
            raise RigError("Training requires nonempty train and valid splits")
        for split in ("train", "valid"):
            self.artifacts.write_jsonl(f"{relative}/{split}.jsonl", [
                {"messages": messages(row, include_answer=True)}
                for row in self.records(identifier, split)
            ])
        # Test data is never copied to a training job's directory.
        return self.artifacts.path(relative)

    def from_feedback(self, request: FeedbackDatasetCreate) -> Dataset:
        if len(set(request.feedback_ids)) != len(request.feedback_ids):
            raise RigError("Feedback IDs must be unique")
        rows = []
        for identifier in request.feedback_ids:
            feedback = self.repository.get("feedback", identifier)
            if not feedback["correction"]:
                raise RigError("Every selected feedback item needs a human correction")
            trace = self.repository.get("trace", feedback["request_id"])
            conversation = trace.get("messages")
            if not conversation:
                raise Conflict("This request did not retain content; cannot build training data")
            users = [m for m in conversation if m["role"] == "user"]
            systems = [m for m in conversation if m["role"] == "system"]
            if len(users) != 1 or len(systems) > 1 or any(
                m["role"] == "assistant" for m in conversation
            ):
                raise RigError("Feedback import currently accepts single-turn conversations only")
            rows.append(Record(prompt=users[0]["content"], completion=feedback["correction"],
                               system=systems[0]["content"] if systems else None, split="train"))
        return self.create(DatasetCreate(name=request.name, records=rows,
                                        description="Human-selected production corrections"))
