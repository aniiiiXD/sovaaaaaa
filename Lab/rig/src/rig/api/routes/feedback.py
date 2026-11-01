from fastapi import APIRouter

from rig.api.dependencies import Limit, Offset, Services
from rig.domain.models import FeedbackCreate, Id
from rig.feedback.service import ReviewCreate

router = APIRouter(prefix="/api/v1", tags=["feedback"])


@router.post("/feedback", status_code=201)
def create(body: FeedbackCreate, services: Services):
    return services.serving.feedback(body)


@router.get("/feedback")
def listing(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("feedback", limit, offset)


@router.post("/feedback/{feedback_id}/review", status_code=201)
def review(feedback_id: Id, body: ReviewCreate, services: Services):
    return services.feedback.review(feedback_id, body)


@router.get("/feedback/{feedback_id}/reviews")
def reviews(feedback_id: Id, services: Services):
    services.repository.get("feedback", feedback_id)
    return services.repository.related("feedback_review", "feedback_id", feedback_id)


@router.get("/traces")
def traces(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("trace", limit, offset)


@router.get("/traces/{request_id}")
def trace(request_id: Id, services: Services):
    return services.repository.get("trace", request_id)
