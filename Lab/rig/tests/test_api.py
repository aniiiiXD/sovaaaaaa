from fastapi.testclient import TestClient

from rig.api.app import create_app
from rig.domain.models import DeploymentCreate, EvalRequest, Job
from rig.jobs.worker import run_worker

HEADERS = {"Authorization": "Bearer test-token-only"}


def test_auth_and_queued_only_api(services, base, dataset):
    with TestClient(create_app(services.settings, services)) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/datasets").status_code == 401
        response = client.post("/api/v1/training", headers=HEADERS, json={
            "base_candidate_id": base.id, "dataset_id": dataset.id, "batch_size": 1,
        })
        assert response.status_code == 202
        assert response.json()["state"] == "queued"
        assert response.headers["location"].endswith(response.json()["id"])
        assert services.repository.job(response.json()["id"]).state == "queued"


def test_body_limit(services):
    services.settings.max_body_bytes = 1024
    with TestClient(create_app(services.settings, services)) as client:
        response = client.post("/api/v1/datasets", headers=HEADERS, content="x" * 1025)
        assert response.status_code == 413
        assert response.headers["x-rig-request-id"]


def test_invalid_schema_does_not_echo_private_input(services):
    with TestClient(create_app(services.settings, services)) as client:
        response = client.post("/v1/chat/completions", headers=HEADERS,
                               json={"model": "fixture", "messages": [], "secret": "private-value"})
        assert response.status_code == 422
        assert "private-value" not in response.text


def test_chat_feedback_and_content_retention_default(services, base, dataset):
    job = services.repository.enqueue(Job(kind="evaluate", payload=EvalRequest(
        candidate_id=base.id, dataset_id=dataset.id).model_dump()))
    run_worker(services, once=True)
    report_id = services.repository.job(job.id).result["id"]
    services.serving.promote(DeploymentCreate(name="specialist", report_id=report_id))
    with TestClient(create_app(services.settings, services)) as client:
        response = client.post("/v1/chat/completions", headers=HEADERS, json={
            "model": "specialist", "messages": [{"role": "user", "content": "valid one"}],
        })
        assert response.status_code == 200
        assert response.json()["choices"][0]["message"]["content"] == "C"
        request_id = response.headers["x-rig-request-id"]
        trace = services.repository.get("trace", request_id)
        assert trace["messages"] is None
        assert trace["output"] is None
        feedback = client.post("/api/v1/feedback", headers=HEADERS,
                               json={"request_id": request_id, "rating": "bad", "correction": "Z"})
        assert feedback.status_code == 201
        imported = client.post("/api/v1/datasets/from-feedback", headers=HEADERS,
                               json={"name": "corrections", "feedback_ids": [feedback.json()["id"]]})
        assert imported.status_code == 409


def test_execution_disabled_does_not_call_backend(services):
    services.settings.execution_enabled = False
    with TestClient(create_app(services.settings, services)) as client:
        response = client.post("/v1/chat/completions", headers=HEADERS, json={
            "model": "anything", "messages": [{"role": "user", "content": "hello"}],
        })
        assert response.status_code == 503


def test_chat_streaming_is_explicitly_rejected(services):
    with TestClient(create_app(services.settings, services)) as client:
        response = client.post("/v1/chat/completions", headers=HEADERS, json={
            "model": "anything", "messages": [{"role": "user", "content": "hello"}], "stream": True,
        })
        assert response.status_code == 422
