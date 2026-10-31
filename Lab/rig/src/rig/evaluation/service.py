from importlib.metadata import PackageNotFoundError, version
import platform
import sys

from rig.data.service import DatasetService, messages
from rig.domain.models import CaseResult, EvalConfig, Evaluation, EvalRequest
from rig.domain.ports import ModelBackend
from rig.errors import Conflict, RigError
from rig.evaluation.metrics import gate_failures, percentile, score
from rig.storage.artifacts import Artifacts
from rig.storage.repository import Repository
from rig.training.service import CandidateService


def environment_info() -> dict[str, str]:
    environment = {"python": sys.version.split()[0], "platform": platform.platform(),
                   "machine": platform.machine(), "host": platform.node()}
    for package in ("mlx", "mlx-lm", "sova-rig"):
        try:
            environment[package] = version(package)
        except PackageNotFoundError:
            environment[package] = "not-installed"
    return environment


class EvaluationService:
    def __init__(self, repository: Repository, artifacts: Artifacts, datasets: DatasetService,
                 candidates: CandidateService, backend: ModelBackend):
        self.repository, self.artifacts = repository, artifacts
        self.datasets, self.candidates, self.backend = datasets, candidates, backend

    def get(self, identifier: str) -> Evaluation:
        return Evaluation.model_validate(self.repository.get("evaluation", identifier))

    def validate(self, request: EvalRequest) -> None:
        self.candidates.get(request.candidate_id)
        if not self.datasets.get(request.dataset_id).counts.get(request.split):
            raise RigError(f"Dataset has no {request.split} records")

    def run(self, request: EvalRequest, context, *, baseline: Evaluation | None = None,
            max_score_drop: float = 0, max_latency_ratio: float | None = None) -> Evaluation:
        self.validate(request)
        config = EvalConfig.model_validate(request.model_dump(exclude={"candidate_id"}))
        dataset = self.datasets.get(request.dataset_id)
        candidate = self.candidates.get(request.candidate_id)
        records = self.datasets.records(dataset.id, config.split)
        environment = environment_info()
        if baseline is not None:
            if baseline.config != config or baseline.dataset_sha256 != dataset.sha256:
                raise Conflict("Comparisons need the same dataset, split and evaluation configuration")
            if baseline.environment != environment:
                raise Conflict("Re-evaluate the baseline in this environment before comparing")
        context.event("evaluation_started", {"candidate_id": candidate.id, "split": config.split})
        cases = []
        with self.backend.session(candidate) as session:
            context.check()
            # One excluded warm-up. Reports measure warm, serialized generation;
            # model loading, HTTP overhead and queue wait are not in these latencies.
            session.generate(messages(records[0]), config.generation, context.check)
            for record in records:
                context.check()
                generated = session.generate(messages(record), config.generation, context.check)
                cases.append(CaseResult(record_id=record.id, generation=generated,
                                        score=score(generated.text, record.completion, config)))
        count = len(cases)
        quality = sum(case.score for case in cases) / count
        latencies = [case.generation.latency_ms for case in cases]
        ttfts = [case.generation.ttft_ms for case in cases if case.generation.ttft_ms is not None]
        total_seconds = sum(latencies) / 1000
        estimated_cost = (total_seconds / count / 3600 * config.estimated_hourly_usd * 1000
                          if config.estimated_hourly_usd is not None else None)
        p95 = percentile(latencies, 0.95)
        failures = gate_failures(config.gate, quality, p95, estimated_cost)
        if baseline is not None:
            if quality + max_score_drop < baseline.score:
                failures.append("quality_regression_exceeds_budget")
            if max_latency_ratio is not None and p95 > baseline.p95_latency_ms * max_latency_ratio:
                failures.append("latency_regression_exceeds_budget")
        report = Evaluation(candidate_id=candidate.id, config=config, dataset_sha256=dataset.sha256,
                            count=count, score=quality, p50_latency_ms=percentile(latencies, 0.5),
                            p95_latency_ms=p95, p50_ttft_ms=percentile(ttfts, 0.5) if ttfts else None,
                            output_tokens_per_second=(sum(c.generation.completion_tokens for c in cases)
                                                      / total_seconds if total_seconds > 0 else 0),
                            estimated_usd_per_1k=estimated_cost, passed=not failures,
                            gate_failures=failures, cases_artifact="", environment=environment,
                            baseline_report_id=baseline.id if baseline else None)
        report.cases_artifact = f"evaluations/{report.id}/cases.jsonl"
        self.artifacts.write_jsonl(report.cases_artifact,
                                  [case.model_dump(mode="json") for case in cases])
        self.artifacts.write_json(f"evaluations/{report.id}/summary.json", report.model_dump(mode="json"))
        context.check()
        self.repository.put("evaluation", report.model_dump(mode="json"))
        context.event("evaluation_completed", {"report_id": report.id, "passed": report.passed})
        return report

    def failures(self, identifier: str) -> list[dict]:
        report = self.get(identifier)
        if report.config.split == "test":
            raise Conflict("Test failures cannot feed the iteration endpoint; use a validation report")
        records = {row.id: row for row in self.datasets.records(report.config.dataset_id, "valid")}
        return [{"record": records[case["record_id"]].model_dump(), "result": case}
                for case in self.artifacts.read_jsonl(report.cases_artifact) if case["score"] < 1]
