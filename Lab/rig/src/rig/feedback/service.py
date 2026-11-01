from typing import Literal

from pydantic import Field, model_validator

from rig.domain.models import Contract, Name, Record, new_id, now
from rig.errors import Conflict, RigError


class ReviewCreate(Contract):
    decision: Literal["approve", "reject"]
    reviewer: Name
    reason: str = Field(min_length=1, max_length=2000)
    correction: str | None = Field(default=None, min_length=1, max_length=100_000)

    @model_validator(mode="after")
    def correction_required(self):
        if self.decision == "approve" and (not self.correction or not self.correction.strip()):
            raise ValueError("Approval requires the reviewer to supply the target answer")
        return self


class FeedbackService:
    def __init__(self, repository):
        self.repository = repository

    def review(self, feedback_id: str, request: ReviewCreate) -> dict:
        feedback = self.repository.get("feedback", feedback_id)
        trace = self.repository.get("trace", feedback["request_id"])
        item = {"id": new_id(), "created_at": now(), "feedback_id": feedback_id,
                "request_id": feedback["request_id"], "workflow_id": trace.get("workflow_id"),
                **request.model_dump()}
        if request.decision == "approve":
            self.record(item)  # Fail before recording approval if the input cannot be recovered.
        self.repository.put_unique("feedback_review", item, "feedback_id", feedback_id)
        return item

    def record(self, review: dict, workflow_id: str | None = None) -> Record:
        if review["decision"] != "approve":
            raise Conflict("Rejected feedback cannot become training data")
        if workflow_id is not None and review.get("workflow_id") != workflow_id:
            raise Conflict("Feedback belongs to a different workflow or an unscoped deployment")
        trace = self.repository.get("trace", review["request_id"])
        conversation = trace.get("messages")
        if not conversation:
            raise Conflict("Input retention was disabled; no training example can be recovered")
        users = [m for m in conversation if m["role"] == "user"]
        systems = [m for m in conversation if m["role"] == "system"]
        if len(users) != 1 or len(systems) > 1 or any(m["role"] == "assistant" for m in conversation):
            raise RigError("Reviewed feedback currently supports single-turn examples only")
        return Record(id=review["id"], prompt=users[0]["content"],
                      system=systems[0]["content"] if systems else None,
                      completion=review["correction"], split="train")
