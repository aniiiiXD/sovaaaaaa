import json

from fastapi import APIRouter

from rig.api.dependencies import Limit, Offset, Services
from rig.domain.models import BaseModelCreate, Candidate, Id

router = APIRouter(prefix="/api/v1/candidates", tags=["candidates"])


@router.post("", response_model=Candidate, status_code=201)
def register(body: BaseModelCreate, services: Services):
    return services.candidates.register(body)


@router.get("", response_model=list[Candidate])
def listing(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("candidate", limit, offset)


@router.get("/{candidate_id}", response_model=Candidate)
def get(candidate_id: Id, services: Services):
    return services.candidates.get(candidate_id)


@router.get("/{candidate_id}/manifest")
def manifest(candidate_id: Id, services: Services):
    candidate = services.candidates.get(candidate_id)
    if candidate.manifest is None:
        return {"candidate": candidate.model_dump(), "source": "pinned_hugging_face_revision"}
    return json.loads(services.artifacts.path(candidate.manifest).read_text())
