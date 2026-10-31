from datetime import datetime

from fastapi import APIRouter, Request

from rig.api.dependencies import Services
from rig.domain.models import ChatRequest

router = APIRouter(prefix="/v1", tags=["inference"])


@router.get("/models")
def models(services: Services):
    return {"object": "list", "data": [
        {"id": deployment["name"], "object": "model", "owned_by": "sova",
         "created": int(datetime.fromisoformat(deployment["created_at"]).timestamp())}
        for deployment in services.repository.deployments()
    ]}


@router.post("/chat/completions")
def chat(body: ChatRequest, request: Request, services: Services):
    return services.serving.chat(body, request.state.request_id)
