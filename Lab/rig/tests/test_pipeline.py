import pytest

from rig.domain.models import (
    DeploymentCreate, EvalConfig, EvalRequest, IterationRequest, Job, PipelineRequest,
    QualityGate, Record, TrainRequest,
)
from rig.errors import Conflict
from rig.jobs.context import JobContext
from rig.jobs.worker import run_worker


def pipeline_request(base, dataset):
    return PipelineRequest(
        training=TrainRequest(base_candidate_id=base.id, dataset_id=dataset.id,
                              batch_size=1, iterations=1),
        evaluation=EvalConfig(dataset_id=dataset.id, gate=QualityGate(min_score=1)),
    )


def test_full_pipeline_persists_lineage_and_excludes_test_from_training(services, base, dataset):
    request = pipeline_request(base, dataset)
    job = services.repository.enqueue(Job(kind="pipeline", payload=request.model_dump()))
    run_worker(services, once=True)
    finished = services.repository.job(job.id)
    assert finished.state == "succeeded"
    assert finished.result["accepted"] is True
    candidate = services.candidates.get(finished.result["candidate_id"])
    assert candidate.kind == "quantized"
    assert candidate.dataset_ids == [dataset.id]
    assert sorted(services.backend.seen_training_files) == ["train.jsonl", "valid.jsonl"]
    report = services.evaluations.get(finished.result["report_id"])
    assert report.passed
    assert report.count == 2
    assert report.estimated_usd_per_1k is None
    assert len(services.artifacts.read_jsonl(report.cases_artifact)) == 2


def test_failed_optimization_keeps_passing_tuned_candidate(services, base, dataset):
    services.backend.regress_quantized = True
    job = services.repository.enqueue(Job(kind="pipeline", payload=pipeline_request(base, dataset).model_dump()))
    run_worker(services, once=True)
    result = services.repository.job(job.id).result
    assert result["accepted"] is True
    assert result["optimization"]["accepted"] is False
    assert services.candidates.get(result["candidate_id"]).kind == "adapter"
    with pytest.raises(Conflict):
        services.serving.promote(DeploymentCreate(name="bad", report_id=result["optimization"]["report_id"]))


def test_iteration_preserves_holdouts_and_adds_only_new_training(services, base, dataset):
    child, request = services.pipeline.prepare_iteration(IterationRequest(
        name="round two", pipeline=pipeline_request(base, dataset),
        new_training_records=[Record(prompt="new training question", completion="F", split="train")]))
    assert child.parent_id == dataset.id
    assert child.counts == {"train": 3, "valid": 2, "test": 1}
    assert services.datasets.records(child.id, "test") == services.datasets.records(dataset.id, "test")
    assert request.training.dataset_id == child.id
    assert request.evaluation.dataset_id == child.id


def test_test_report_cannot_be_used_for_failure_mining(services, base, dataset):
    request = EvalRequest(candidate_id=base.id, dataset_id=dataset.id, split="test")
    job = services.repository.enqueue(Job(kind="evaluate", payload=request.model_dump()))
    claimed = services.repository.claim()
    report = services.evaluations.run(request, JobContext(claimed.id, services.repository, 30))
    with pytest.raises(Conflict, match="Test failures"):
        services.evaluations.failures(report.id)
    services.repository.finish(job.id, "succeeded", result=report.model_dump())


def test_cancelled_queued_job_is_never_claimed(services):
    job = services.repository.enqueue(Job(kind="train", payload={}))
    assert services.repository.cancel(job.id).state == "cancelled"
    assert services.repository.claim() is None


def test_cancellation_wins_a_completion_race(services):
    job = services.repository.enqueue(Job(kind="train", payload={}))
    services.repository.claim()
    services.repository.cancel(job.id)
    services.repository.finish(job.id, "succeeded", result={"candidate_id": "unused"})
    assert services.repository.job(job.id).state == "cancelled"


def test_interrupted_jobs_are_failed_not_silently_retried(services):
    job = services.repository.enqueue(Job(kind="train", payload={}))
    services.repository.claim()
    services.repository.recover_interrupted()
    assert services.repository.job(job.id).state == "failed"
    assert services.repository.claim() is None
