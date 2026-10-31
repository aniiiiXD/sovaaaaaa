from fastapi import APIRouter

from rig.api.dependencies import Limit, Offset, Services
from rig.domain.models import FeedbackCreate, Id

router = APIRouter(prefix="/api/v1", tags=["feedback"])


@router.post("/feedback", status_code=201)
def create(body: FeedbackCreate, services: Services):
    return services.serving.feedback(body)


@router.get("/feedback")
def listing(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("feedback", limit, offset)


@router.get("/traces")
def traces(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("trace", limit, offset)


@router.get("/traces/{request_id}")
def trace(request_id: Id, services: Services):
    return services.repository.get("trace", request_id)
