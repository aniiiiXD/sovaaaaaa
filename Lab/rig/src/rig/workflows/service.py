from rig.domain.models import DatasetCreate, Deployment, EvalRequest, Job
from rig.errors import Conflict, RigError
from rig.workflows.models import (
    Cycle, CycleCreate, CycleJob, ReleaseCreate, ReleaseJob, Workflow, WorkflowCreate,
    WorkflowPromotion,
)


class WorkflowService:
    """Owns the lifecycle; ML operations remain in the existing stage services."""

    def __init__(self, repository, datasets, candidates, pipeline, evaluations, feedback):
        self.repository, self.datasets, self.candidates = repository, datasets, candidates
        self.pipeline, self.evaluations, self.feedback = pipeline, evaluations, feedback

    def get(self, identifier: str) -> Workflow:
        return Workflow.model_validate(self.repository.get("workflow", identifier))

    def cycle(self, workflow_id: str, cycle_id: str) -> Cycle:
        cycle = Cycle.model_validate(self.repository.get("cycle", cycle_id))
        if cycle.workflow_id != workflow_id:
            raise Conflict("Cycle does not belong to this workflow")
        return cycle

    def create(self, request: WorkflowCreate) -> Workflow:
        self.pipeline.validate(request.pipeline)
        if not self.datasets.get(request.pipeline.evaluation.dataset_id).counts.get("test"):
            raise RigError("A workflow needs a reserved test split for its release audit")
        gate = request.pipeline.comparison
        if (gate.max_estimated_cost_ratio is not None
                and request.pipeline.evaluation.estimated_hourly_usd is None):
            raise RigError("An estimated-cost comparison requires an hourly cost assumption")
        workflow = Workflow(**request.model_dump())
        # Resolve the implicit baseline once, and persist it as part of this workflow version.
        if workflow.pipeline.baseline_candidate_id is None:
            workflow.pipeline.baseline_candidate_id = workflow.pipeline.training.base_candidate_id
        self.repository.put("workflow", workflow.model_dump(mode="json"))
        return workflow

    def start_cycle(self, workflow_id: str, request: CycleCreate) -> tuple[Cycle, Job]:
        workflow = self.get(workflow_id)
        pipeline = workflow.pipeline.model_copy(deep=True)
        prepared = None
        if request.parent_cycle_id:
            parent = self.cycle(workflow_id, request.parent_cycle_id)
            parent_job = self.repository.job(parent.id)
            if parent_job.state not in ("succeeded", "failed", "cancelled"):
                raise Conflict("Wait for the preceding cycle to finish or cancel it")
            pipeline = parent.pipeline.model_copy(deep=True)
            additions = list(request.new_training_records)
            for identifier in request.feedback_review_ids:
                review = self.repository.get("feedback_review", identifier)
                additions.append(self.feedback.record(review, workflow_id))
            if additions:
                # Validate the registered parent before preparing an unpublished child.
                # Appending train-only records preserves its validation counts and all gates.
                self.pipeline.validate(pipeline)
                parent_dataset_id = pipeline.training.dataset_id
                records = self.datasets.records(parent_dataset_id)
                if len(records) + len(additions) > 100_000:
                    raise RigError("A workflow dataset cannot exceed 100,000 records")
                prepared = self.datasets.prepare(DatasetCreate(
                    name=workflow.name, parent_id=parent_dataset_id,
                    records=[*records, *additions],
                    description="Workflow cycle: reviewed additions; original holdouts unchanged"))
                pipeline.training.dataset_id = prepared.dataset.id
                pipeline.evaluation.dataset_id = prepared.dataset.id
            elif parent_job.state == "succeeded":
                raise RigError("A completed cycle needs new examples; unchanged retries are for failed jobs")
        try:
            if prepared is None:
                self.pipeline.validate(pipeline)
            cycle = Cycle(workflow_id=workflow_id, parent_cycle_id=request.parent_cycle_id,
                          pipeline=pipeline, feedback_review_ids=request.feedback_review_ids)
            job = Job(id=cycle.id, kind="workflow_cycle",
                      payload=CycleJob(cycle_id=cycle.id, workflow_id=workflow_id).model_dump())
            # Registration, split assignment and queue insertion either all commit or all roll back.
            self.repository.enqueue_cycle(
                cycle.model_dump(mode="json"), job, workflow.max_cycles,
                dataset=prepared.dataset.model_dump(mode="json") if prepared else None,
                fingerprints=prepared.fingerprints if prepared else None)
        except Exception:
            if prepared is not None:
                self.datasets.discard_prepared(prepared)
            raise
        return cycle, job

    def run_cycle(self, request: CycleJob, context) -> dict:
        cycle = self.cycle(request.workflow_id, request.cycle_id)
        if context.id != cycle.id:
            raise Conflict("Cycle job identity does not match its persisted definition")
        context.event("workflow_cycle_started", {"workflow_id": cycle.workflow_id,
                                                 "dataset_id": cycle.pipeline.training.dataset_id})
        result = self.pipeline.run(cycle.pipeline, context)
        result.update(workflow_id=cycle.workflow_id, cycle_id=cycle.id,
                      next_action="request_release_audit" if result["accepted"] else "review_failures")
        context.event("workflow_cycle_completed", {"accepted": result["accepted"],
                                                   "next_action": result["next_action"]})
        return result

    def _accepted_cycle(self, workflow_id: str, cycle_id: str):
        cycle = self.cycle(workflow_id, cycle_id)
        job = self.repository.job(cycle.id)
        if job.state != "succeeded" or not job.result or not job.result.get("accepted"):
            raise Conflict("Release requires a completed, accepted workflow cycle")
        return cycle, job.result

    def request_release(self, workflow_id: str, cycle_id: str, request: ReleaseCreate) -> Job:
        self._accepted_cycle(workflow_id, cycle_id)
        payload = ReleaseJob(workflow_id=workflow_id, cycle_id=cycle_id, **request.model_dump())
        return self.repository.enqueue_release(Job(kind="workflow_release", payload=payload.model_dump()))

    def run_release(self, request: ReleaseJob, context) -> dict:
        cycle, selected = self._accepted_cycle(request.workflow_id, request.cycle_id)
        config = cycle.pipeline.evaluation.model_copy(update={"split": "test"})
        context.event("release_audit_started", {"cycle_id": cycle.id})
        baseline = self.evaluations.run(EvalRequest(
            candidate_id=cycle.pipeline.baseline_candidate_id or cycle.pipeline.training.base_candidate_id,
            **config.model_dump()), context)
        report = self.evaluations.run(EvalRequest(candidate_id=selected["candidate_id"],
                                                  **config.model_dump()), context,
                                      baseline=baseline, comparison=cycle.pipeline.comparison)
        result = {"workflow_id": cycle.workflow_id, "cycle_id": cycle.id,
                  "candidate_id": report.candidate_id, "report_id": report.id,
                  "baseline_report_id": baseline.id, "accepted": report.passed,
                  "gate_failures": report.gate_failures,
                  "next_action": "promote_explicitly" if report.passed else "release_blocked"}
        context.event("release_audit_completed", result)
        return result

    def promote(self, workflow_id: str, cycle_id: str, request: WorkflowPromotion) -> Deployment:
        self.cycle(workflow_id, cycle_id)
        job = self.repository.job(request.release_job_id)
        if (job.kind != "workflow_release" or job.state != "succeeded" or not job.result
                or not job.result.get("accepted") or job.result.get("workflow_id") != workflow_id
                or job.result.get("cycle_id") != cycle_id):
            raise Conflict("Promotion requires this cycle's completed, passing release audit")
        report = self.evaluations.get(job.result["report_id"])
        if not report.passed or report.config.split != "test":
            raise Conflict("Release audit must be a passing test report")
        self.candidates.get(report.candidate_id)
        deployment = Deployment(name=request.name, candidate_id=report.candidate_id,
                                report_id=report.id, workflow_id=workflow_id, cycle_id=cycle_id)
        self.repository.promote(deployment.model_dump(mode="json"))
        return deployment

    def failures(self, workflow_id: str, cycle_id: str) -> list[dict]:
        self.cycle(workflow_id, cycle_id)
        job = self.repository.job(cycle_id)
        if job.state != "succeeded" or not job.result:
            raise Conflict("No completed validation report is available for this cycle")
        return self.evaluations.failures(job.result["report_id"])
