from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from rig.api.app import create_app
from rig.domain.models import (
    ChatRequest, ComparisonGate, EvalConfig, FeedbackCreate, Message, PipelineRequest,
    QualityGate, Record, TrainRequest, new_id,
)
from rig.errors import Conflict, RigError
from rig.feedback.service import ReviewCreate
from rig.jobs.worker import run_worker
from rig.workflows.models import CycleCreate, ReleaseCreate, WorkflowCreate, WorkflowPromotion


def workflow(services, base, dataset, **overrides):
    request = WorkflowCreate(
        name="support routing", task="Classify a support request or escalate it",
        owner="support engineering", acceptance_criteria="No quality loss on held-out cases",
        pipeline=PipelineRequest(
            training=TrainRequest(base_candidate_id=base.id, dataset_id=dataset.id,
                                  iterations=1, batch_size=1),
            evaluation=EvalConfig(dataset_id=dataset.id, gate=QualityGate(min_score=1)),
        ), **overrides)
    return services.workflows.create(request)


def completed_cycle(services, work):
    cycle, job = services.workflows.start_cycle(work.id, CycleCreate())
    assert services.repository.job(job.id).state == "queued"
    run_worker(services, once=True)
    assert services.repository.job(job.id).state == "succeeded"
    return cycle


def released(services, work):
    cycle = completed_cycle(services, work)
    audit = services.workflows.request_release(work.id, cycle.id, ReleaseCreate(
        reviewer="task owner", note="Validation reviewed; run the reserved test audit"))
    run_worker(services, once=True)
    deployment = services.workflows.promote(work.id, cycle.id, WorkflowPromotion(
        release_job_id=audit.id, name="support"))
    return cycle, audit, deployment


def test_cycle_does_not_deploy_and_release_uses_test(services, base, dataset):
    work = workflow(services, base, dataset)
    cycle = completed_cycle(services, work)
    assert services.repository.deployments() == []
    result = services.repository.job(cycle.id).result
    assert services.evaluations.get(result["report_id"]).config.split == "valid"
    audit = services.workflows.request_release(work.id, cycle.id, ReleaseCreate(
        reviewer="owner", note="Ready for final audit"))
    with pytest.raises(Conflict):
        services.workflows.promote(work.id, cycle.id, WorkflowPromotion(
            release_job_id=audit.id, name="support"))
    run_worker(services, once=True)
    report = services.evaluations.get(services.repository.job(audit.id).result["report_id"])
    assert report.config.split == "test"
    assert report.baseline_report_id
    assert services.repository.deployments() == []
    deployment = services.workflows.promote(work.id, cycle.id, WorkflowPromotion(
        release_job_id=audit.id, name="support"))
    assert deployment.workflow_id == work.id
    assert deployment.cycle_id == cycle.id


def test_reviewed_production_failure_closes_loop_without_changing_holdouts(services, base, dataset):
    services.settings.store_content = True
    work = workflow(services, base, dataset)
    cycle, _, _ = released(services, work)
    request_id = new_id()
    services.serving.chat(ChatRequest(model="support", messages=[
        Message(role="user", content="new production input")]), request_id)
    feedback = services.serving.feedback(FeedbackCreate(request_id=request_id, rating="bad"))
    assert feedback["workflow_id"] == work.id
    review = services.feedback.review(feedback["id"], ReviewCreate(
        decision="approve", reviewer="domain expert", reason="Verified the intended route", correction="A"))
    child, job = services.workflows.start_cycle(work.id, CycleCreate(
        parent_cycle_id=cycle.id, feedback_review_ids=[review["id"]]))
    new_dataset = child.pipeline.training.dataset_id
    assert services.datasets.get(new_dataset).parent_id == dataset.id
    assert services.datasets.get(new_dataset).counts["train"] == dataset.counts["train"] + 1
    for split in ("valid", "test"):
        assert services.datasets.records(new_dataset, split) == services.datasets.records(dataset.id, split)
    run_worker(services, once=True)
    assert services.repository.job(job.id).result["accepted"]
    # A new successful cycle does not silently replace the deployed model.
    assert services.repository.deployment("support")["cycle_id"] == cycle.id


def test_feedback_cannot_move_a_heldout_prompt_into_training(services, base, dataset):
    services.settings.store_content = True
    work = workflow(services, base, dataset)
    cycle, _, _ = released(services, work)
    identifier = new_id()
    services.serving.chat(ChatRequest(model="support", messages=[
        Message(role="user", content="test one")]), identifier)
    feedback = services.serving.feedback(FeedbackCreate(request_id=identifier, rating="bad"))
    review = services.feedback.review(feedback["id"], ReviewCreate(
        decision="approve", reviewer="expert", reason="Correction", correction="A"))
    with pytest.raises(Conflict, match="another split"):
        services.workflows.start_cycle(work.id, CycleCreate(
            parent_cycle_id=cycle.id, feedback_review_ids=[review["id"]]))


def test_feedback_rejects_wrong_workflow_and_second_review(services, base, dataset):
    services.settings.store_content = True
    work = workflow(services, base, dataset)
    released(services, work)
    identifier = new_id()
    services.serving.chat(ChatRequest(model="support", messages=[
        Message(role="user", content="new case")]), identifier)
    feedback = services.serving.feedback(FeedbackCreate(request_id=identifier, rating="bad"))
    request = ReviewCreate(decision="approve", reviewer="expert", reason="Checked", correction="A")
    review = services.feedback.review(feedback["id"], request)
    with pytest.raises(Conflict, match="different workflow"):
        services.feedback.record(review, new_id())
    with pytest.raises(Conflict, match="already exists"):
        services.feedback.review(feedback["id"], request)


def test_retention_off_prevents_feedback_approval(services, base, dataset):
    work = workflow(services, base, dataset)
    released(services, work)
    identifier = new_id()
    services.serving.chat(ChatRequest(model="support", messages=[
        Message(role="user", content="new case")]), identifier)
    feedback = services.serving.feedback(FeedbackCreate(request_id=identifier, rating="bad"))
    with pytest.raises(Conflict, match="retention"):
        services.feedback.review(feedback["id"], ReviewCreate(
            decision="approve", reviewer="expert", reason="Checked", correction="A"))
    assert services.repository.list("feedback_review") == []


def test_only_one_active_cycle_and_latest_parent(services, base, dataset):
    work = workflow(services, base, dataset)
    first, _ = services.workflows.start_cycle(work.id, CycleCreate())
    with pytest.raises(Conflict, match="active"):
        services.workflows.start_cycle(work.id, CycleCreate())
    run_worker(services, once=True)
    with pytest.raises(Conflict, match="latest cycle"):
        services.workflows.start_cycle(work.id, CycleCreate())
    with pytest.raises(RigError, match="new examples"):
        services.workflows.start_cycle(work.id, CycleCreate(parent_cycle_id=first.id))


def test_cycle_budget_is_enforced(services, base, dataset):
    work = workflow(services, base, dataset, max_cycles=1)
    first = completed_cycle(services, work)
    with pytest.raises(Conflict, match="budget"):
        services.workflows.start_cycle(work.id, CycleCreate(parent_cycle_id=first.id,
            new_training_records=[Record(prompt="new", completion="A", split="train")]))


def test_release_cannot_be_repeated_or_promoted_for_another_cycle(services, base, dataset):
    work = workflow(services, base, dataset)
    cycle, audit, _ = released(services, work)
    with pytest.raises(Conflict, match="already has a release audit"):
        services.workflows.request_release(work.id, cycle.id, ReleaseCreate(reviewer="owner", note="Again"))
    second, _ = services.workflows.start_cycle(work.id, CycleCreate(parent_cycle_id=cycle.id,
        new_training_records=[Record(prompt="new", completion="A", split="train")]))
    with pytest.raises(Conflict):
        services.workflows.promote(work.id, second.id, WorkflowPromotion(release_job_id=audit.id, name="bad"))


def test_gain_gate_rejects_a_tie_even_when_absolute_quality_passes(services, base, dataset):
    work_request = workflow(services, base, dataset).model_dump(exclude={"id", "created_at"})
    work_request["pipeline"]["comparison"] = ComparisonGate(min_score_gain=0.01).model_dump()
    work = services.workflows.create(WorkflowCreate.model_validate(work_request))
    cycle = completed_cycle(services, work)
    result = services.repository.job(cycle.id).result
    assert not result["accepted"]
    assert "required_quality_gain_not_met" in result["gate_failures"]
    with pytest.raises(Conflict, match="accepted"):
        services.workflows.request_release(work.id, cycle.id, ReleaseCreate(reviewer="owner", note="Try"))


def test_workflow_routes_authenticate_and_only_enqueue(services, base, dataset):
    work = workflow(services, base, dataset)
    with TestClient(create_app(services.settings, services)) as client:
        path = f"/api/v1/workflows/{work.id}/cycles"
        assert client.post(path, json={}).status_code == 401
        response = client.post(path, json={}, headers={"Authorization": "Bearer test-token-only"})
        assert response.status_code == 202
        assert response.json()["job"]["state"] == "queued"
        assert services.repository.deployments() == []


def test_failed_test_audit_cannot_promote(services, base, dataset, monkeypatch):
    work = workflow(services, base, dataset)
    cycle = completed_cycle(services, work)
    original_session = services.backend.session

    @contextmanager
    def regress_only_selected_model_on_test(candidate):
        with original_session(candidate) as session:
            original_generate = session.generate

            def generate(messages, config, check):
                result = original_generate(messages, config, check)
                if candidate.id != base.id and messages[-1]["content"] == "test one":
                    return result.model_copy(update={"text": "wrong"})
                return result

            session.generate = generate
            yield session

    monkeypatch.setattr(services.backend, "session", regress_only_selected_model_on_test)
    audit = services.workflows.request_release(work.id, cycle.id, ReleaseCreate(
        reviewer="owner", note="Audit selected candidate"))
    run_worker(services, once=True)
    result = services.repository.job(audit.id).result
    assert not result["accepted"]
    assert result["next_action"] == "release_blocked"
    with pytest.raises(Conflict):
        services.workflows.promote(work.id, cycle.id, WorkflowPromotion(
            release_job_id=audit.id, name="must-not-deploy"))
    assert services.repository.deployments() == []


def test_speed_gate_can_be_met_by_optimization_after_training(services, base, dataset, monkeypatch):
    request = workflow(services, base, dataset).model_dump(exclude={"id", "created_at"})
    request["pipeline"]["comparison"]["max_latency_ratio"] = 0.75
    work = services.workflows.create(WorkflowCreate.model_validate(request))
    original_session = services.backend.session

    @contextmanager
    def faster_quantized(candidate):
        with original_session(candidate) as session:
            original_generate = session.generate

            def generate(messages, config, check):
                result = original_generate(messages, config, check)
                return result.model_copy(update={"latency_ms": 5}) if candidate.kind == "quantized" else result

            session.generate = generate
            yield session

    monkeypatch.setattr(services.backend, "session", faster_quantized)
    cycle = completed_cycle(services, work)
    result = services.repository.job(cycle.id).result
    assert result["accepted"]
    assert services.candidates.get(result["candidate_id"]).kind == "quantized"
