from fastapi import APIRouter
from fastapi.responses import FileResponse

from rig.api.dependencies import Limit, Offset, Services
from rig.domain.models import Dataset, DatasetCreate, FeedbackDatasetCreate, Id

router = APIRouter(prefix="/api/v1/datasets", tags=["datasets"])


@router.post("", response_model=Dataset, status_code=201)
def create(body: DatasetCreate, services: Services):
    return services.datasets.create(body)


@router.post("/from-feedback", response_model=Dataset, status_code=201)
def from_feedback(body: FeedbackDatasetCreate, services: Services):
    return services.datasets.from_feedback(body)


@router.get("", response_model=list[Dataset])
def listing(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("dataset", limit, offset)


@router.get("/{dataset_id}", response_model=Dataset)
def get(dataset_id: Id, services: Services):
    return services.datasets.get(dataset_id)


@router.get("/{dataset_id}/records")
def records(dataset_id: Id, services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.datasets.records(dataset_id)[offset:offset + limit]


@router.get("/{dataset_id}/export")
def export(dataset_id: Id, services: Services):
    dataset = services.datasets.get(dataset_id)
    services.datasets.records(dataset_id)  # Verify digest before returning the artifact.
    return FileResponse(services.artifacts.path(dataset.artifact), media_type="application/x-ndjson",
                        filename=f"{dataset.id}.jsonl")
