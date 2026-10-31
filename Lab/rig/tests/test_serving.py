import pytest

from rig.domain.models import (
    ChatRequest, DeploymentCreate, EvalRequest, FeedbackCreate, FeedbackDatasetCreate,
    Job, Message, new_id,
)
from rig.errors import Conflict, NotFound
from rig.jobs.worker import run_worker


def release(services, base, dataset):
    job = services.repository.enqueue(Job(kind="evaluate", payload=EvalRequest(
        candidate_id=base.id, dataset_id=dataset.id).model_dump()))
    run_worker(services, once=True)
    report_id = services.repository.job(job.id).result["id"]
    return services.serving.promote(DeploymentCreate(name="specialist", report_id=report_id))


def test_retained_test_prompt_cannot_be_laundered_through_feedback(services, base, dataset):
    services.settings.store_content = True
    release(services, base, dataset)
    identifier = new_id()
    services.serving.chat(ChatRequest(model="specialist", messages=[
        Message(role="user", content="test one")]), identifier)
    feedback = services.serving.feedback(FeedbackCreate(request_id=identifier, rating="bad", correction="F"))
    with pytest.raises(Conflict, match="another split"):
        services.datasets.from_feedback(FeedbackDatasetCreate(name="leak", feedback_ids=[feedback["id"]]))


def test_reviewed_new_production_case_can_become_training_data(services, base, dataset):
    services.settings.store_content = True
    release(services, base, dataset)
    identifier = new_id()
    services.serving.chat(ChatRequest(model="specialist", messages=[
        Message(role="user", content="previously unseen production case")]), identifier)
    feedback = services.serving.feedback(FeedbackCreate(request_id=identifier, rating="bad", correction="F"))
    created = services.datasets.from_feedback(FeedbackDatasetCreate(
        name="reviewed", feedback_ids=[feedback["id"]]))
    assert created.counts == {"train": 1}
    assert services.datasets.records(created.id)[0].completion == "F"


def test_promotion_history_and_deactivation(services, base, dataset):
    first = release(services, base, dataset)
    second = services.serving.promote(DeploymentCreate(name="specialist", report_id=first.report_id))
    assert services.repository.deployment("specialist")["id"] == second.id
    assert len(services.repository.list("deployment")) == 2
    services.repository.deactivate("specialist")
    with pytest.raises(NotFound):
        services.repository.deployment("specialist")
    assert len(services.repository.list("deployment")) == 2
