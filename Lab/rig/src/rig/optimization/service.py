from rig.domain.models import Candidate, EvalRequest, OptimizeRequest
from rig.domain.ports import ModelBackend
from rig.errors import Conflict, RigError
from rig.evaluation.service import EvaluationService
from rig.storage.artifacts import Artifacts
from rig.training.service import CandidateService


class OptimizationService:
    def __init__(self, candidates: CandidateService, evaluations: EvaluationService,
                 backend: ModelBackend, artifacts: Artifacts):
        self.candidates, self.evaluations = candidates, evaluations
        self.backend, self.artifacts = backend, artifacts

    def validate(self, request: OptimizeRequest) -> None:
        baseline = self.evaluations.get(request.baseline_report_id)
        if not baseline.passed:
            raise Conflict("Optimization requires a passing baseline")
        if baseline.config.split != "valid":
            raise Conflict("Optimize against validation results, not the held-out test audit")
        candidate = self.candidates.get(baseline.candidate_id)
        if request.strategy == "fuse" and not candidate.spec.adapter_path:
            raise RigError("Fusion requires an adapter candidate")

    def run(self, request: OptimizeRequest, context) -> dict:
        self.validate(request)
        prior = self.evaluations.get(request.baseline_report_id)
        parent = self.candidates.get(prior.candidate_id)
        # Refresh the comparison on this machine immediately before optimizing.
        baseline = self.evaluations.run(EvalRequest(candidate_id=parent.id,
                                                   **prior.config.model_dump()), context)
        if not baseline.passed:
            return {"accepted": False, "reason": "refreshed_baseline_failed",
                    "baseline_report_id": baseline.id}
        context.event("optimization_started", {"strategy": request.strategy})
        candidate = Candidate(name=request.name, kind="fused" if request.strategy == "fuse"
                              else "quantized", parent_id=parent.id,
                              dataset_ids=parent.dataset_ids, spec=parent.spec)
        output = self.artifacts.path(f"jobs/{context.id}/{candidate.id}/output")
        candidate.spec = self.backend.optimize(parent, request.strategy, request.bits,
                                               request.group_size, output, context.check)
        self.candidates.save(candidate, {"job_id": context.id, "optimization": request.model_dump(),
                                        "baseline_report_id": baseline.id}, output, context.check)
        report = self.evaluations.run(EvalRequest(candidate_id=candidate.id,
                                                 **baseline.config.model_dump()), context,
                                      baseline=baseline, max_score_drop=request.max_score_drop,
                                      max_latency_ratio=request.max_latency_ratio)
        context.event("optimization_completed", {"candidate_id": candidate.id, "accepted": report.passed})
        return {"candidate_id": candidate.id, "report_id": report.id,
                "baseline_report_id": baseline.id, "accepted": report.passed,
                "gate_failures": report.gate_failures}
