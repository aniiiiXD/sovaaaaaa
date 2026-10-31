import time

from rig.config import Settings
from rig.domain.models import (
    ChatRequest, Deployment, DeploymentCreate, FeedbackCreate, GenerationConfig, new_id, now,
)
from rig.domain.ports import ModelBackend
from rig.errors import Conflict, Unavailable
from rig.evaluation.service import EvaluationService
from rig.storage.locking import process_lock
from rig.storage.repository import Repository
from rig.training.service import CandidateService


class ServingService:
    def __init__(self, settings: Settings, repository: Repository, candidates: CandidateService,
                 evaluations: EvaluationService, backend: ModelBackend):
        self.settings, self.repository = settings, repository
        self.candidates, self.evaluations, self.backend = candidates, evaluations, backend

    def promote(self, request: DeploymentCreate) -> Deployment:
        report = self.evaluations.get(request.report_id)
        if not report.passed:
            raise Conflict("A deployment requires a passing evaluation report")
        self.candidates.get(report.candidate_id)
        deployment = Deployment(name=request.name, candidate_id=report.candidate_id,
                                report_id=report.id)
        self.repository.promote(deployment.model_dump(mode="json"))
        return deployment

    def chat(self, request: ChatRequest, request_id: str) -> dict:
        if not self.settings.execution_enabled:
            raise Unavailable("Inference is disabled by RIG_EXECUTION_ENABLED")
        deployment = self.repository.deployment(request.model)
        candidate = self.candidates.get(deployment["candidate_id"])
        started = time.monotonic()
        deadline = started + self.settings.generation_timeout_seconds

        def check():
            if time.monotonic() > deadline:
                raise Unavailable("Generation exceeded its deadline")

        config = GenerationConfig(max_tokens=request.max_tokens, temperature=request.temperature,
                                  top_p=request.top_p, seed=request.seed)
        conversation = [message.model_dump() for message in request.messages]
        with process_lock(self.settings.home / "device.lock",
                          self.settings.device_wait_seconds, check):
            with self.backend.session(candidate) as session:
                result = session.generate(conversation, config, check)
                check()
        duration_ms = (time.monotonic() - started) * 1000
        trace = {"id": request_id, "created_at": now(), "deployment_id": deployment["id"],
                 "candidate_id": candidate.id, "config": config.model_dump(),
                 "latency_ms": result.latency_ms, "request_duration_ms": duration_ms,
                 "prompt_tokens": result.prompt_tokens, "completion_tokens": result.completion_tokens,
                 "messages": conversation if self.settings.store_content else None,
                 "output": result.text if self.settings.store_content else None}
        self.repository.put("trace", trace)
        return {"id": f"chatcmpl-{request_id}", "object": "chat.completion",
                "created": int(time.time()), "model": request.model,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": result.text},
                             "finish_reason": result.finish_reason}],
                "usage": {"prompt_tokens": result.prompt_tokens,
                          "completion_tokens": result.completion_tokens,
                          "total_tokens": result.prompt_tokens + result.completion_tokens}}

    def feedback(self, request: FeedbackCreate) -> dict:
        self.repository.get("trace", request.request_id)
        item = {"id": new_id(), "created_at": now(), **request.model_dump()}
        self.repository.put("feedback", item)
        return item
