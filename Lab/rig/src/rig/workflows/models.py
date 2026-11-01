from pydantic import Field, model_validator

from rig.domain.models import Contract, Id, Name, PipelineRequest, Record, new_id, now


class WorkflowCreate(Contract):
    name: Name
    task: str = Field(min_length=1, max_length=4000)
    owner: Name
    acceptance_criteria: str = Field(min_length=1, max_length=4000)
    pipeline: PipelineRequest
    max_cycles: int = Field(default=10, ge=1, le=100)

    @model_validator(mode="after")
    def single_dataset(self):
        if self.pipeline.training.dataset_id != self.pipeline.evaluation.dataset_id:
            raise ValueError("A workflow uses one versioned dataset with train, valid and test splits")
        return self


class Workflow(WorkflowCreate):
    id: Id = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now)


class CycleCreate(Contract):
    parent_cycle_id: Id | None = None
    new_training_records: list[Record] = Field(default_factory=list, max_length=100_000)
    feedback_review_ids: list[Id] = Field(default_factory=list, max_length=10_000)

    @model_validator(mode="after")
    def additions(self):
        if any(row.split != "train" for row in self.new_training_records):
            raise ValueError("Cycles may add training records only; holdouts are preserved")
        if len(set(self.feedback_review_ids)) != len(self.feedback_review_ids):
            raise ValueError("Feedback review IDs must be unique")
        if self.parent_cycle_id is None and (self.new_training_records or self.feedback_review_ids):
            raise ValueError("The first cycle uses the workflow's original dataset")
        return self


class Cycle(Contract):
    # The cycle and its job share an ID; job state is the source of truth.
    id: Id = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now)
    workflow_id: Id
    parent_cycle_id: Id | None = None
    pipeline: PipelineRequest
    feedback_review_ids: list[Id] = Field(default_factory=list)


class CycleJob(Contract):
    cycle_id: Id
    workflow_id: Id


class ReleaseCreate(Contract):
    reviewer: Name
    note: str = Field(min_length=1, max_length=2000)


class ReleaseJob(CycleJob, ReleaseCreate):
    """An explicit request to audit a selected candidate on the test split."""


class WorkflowPromotion(Contract):
    release_job_id: Id
    name: str = Field(pattern=r"^[a-z][a-z0-9-]{0,62}$")
