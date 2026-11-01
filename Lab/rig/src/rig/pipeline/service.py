from rig.domain.models import DatasetCreate, EvalRequest, IterationRequest, OptimizeRequest, PipelineRequest
from rig.errors import RigError
from rig.evaluation.service import comparison_failures


class PipelineService:
    def __init__(self, training, evaluations, optimization):
        self.training, self.evaluations, self.optimization = training, evaluations, optimization

    def validate(self, request: PipelineRequest) -> None:
        self.training.validate(request.training)
        self.evaluations.validate(EvalRequest(candidate_id=(request.baseline_candidate_id
                                                           or request.training.base_candidate_id),
                                              **request.evaluation.model_dump()))

    def prepare_iteration(self, request: IterationRequest):
        # Append new examples; preserve every original validation and test record.
        pipeline = request.pipeline.model_copy(deep=True)
        parent_id = pipeline.training.dataset_id
        self.training.candidates.get(pipeline.training.base_candidate_id)
        parent_records = self.training.datasets.records(parent_id)
        if len(parent_records) + len(request.new_training_records) > 100_000:
            raise RigError("An iteration cannot exceed 100,000 total records")
        child = self.training.datasets.create(DatasetCreate(
            name=request.name, parent_id=parent_id,
            records=[*parent_records, *request.new_training_records],
            description="Iteration: original holdouts preserved; new training examples appended"))
        pipeline.training.dataset_id = child.id
        if pipeline.evaluation.dataset_id == parent_id:
            pipeline.evaluation.dataset_id = child.id
        self.validate(pipeline)
        return child, pipeline

    def run(self, request: PipelineRequest, context) -> dict:
        self.validate(request)
        context.event("baseline_started")
        baseline = self.evaluations.run(EvalRequest(candidate_id=(request.baseline_candidate_id
                                                                or request.training.base_candidate_id),
                                                   **request.evaluation.model_dump()), context)
        context.event("baseline_completed", {"report_id": baseline.id})
        candidate = self.training.run(request.training, context)
        tuned = self.evaluations.run(EvalRequest(candidate_id=candidate.id,
                                                **request.evaluation.model_dump()), context,
                                      baseline=baseline)
        result = {"baseline_report_id": baseline.id, "candidate_id": candidate.id,
                  "report_id": tuned.id, "accepted": tuned.passed,
                  "score_delta": tuned.score - baseline.score,
                  "gate_failures": tuned.gate_failures}
        if not tuned.passed:
            result["stopped_at"] = "quality_gate"
            context.event("pipeline_completed", result)
            return result
        if request.optimization is not None:
            optimized = self.optimization.run(OptimizeRequest(
                baseline_report_id=tuned.id, **request.optimization.model_dump()), context)
            result["optimization"] = optimized
            # Keep the tuned, passing candidate if the optimized candidate fails.
            if optimized["accepted"]:
                final = self.evaluations.get(optimized["report_id"])
                failures = comparison_failures(baseline, final.score, final.p95_latency_ms,
                                               final.estimated_usd_per_1k, request.comparison)
                # A small regression from the tuned model must not erase the win over the incumbent.
                if failures:
                    optimized.update(accepted=False, incumbent_gate_failures=failures)
                else:
                    result.update(candidate_id=final.candidate_id, report_id=final.id,
                                  score_delta=final.score - baseline.score)
        selected = self.evaluations.get(result["report_id"])
        failures = comparison_failures(baseline, selected.score, selected.p95_latency_ms,
                                       selected.estimated_usd_per_1k, request.comparison)
        result.update(accepted=selected.passed and not failures,
                      gate_failures=[*selected.gate_failures, *failures])
        if not result["accepted"]:
            result["stopped_at"] = "incumbent_comparison"
        context.event("pipeline_completed", result)
        return result
