from fastapi import APIRouter
from fastapi.responses import FileResponse

from rig.api.dependencies import Limit, Offset, Services
from rig.domain.models import Evaluation, Id

router = APIRouter(prefix="/api/v1/evaluations", tags=["evaluations"])


@router.get("", response_model=list[Evaluation])
def listing(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("evaluation", limit, offset)


@router.get("/{report_id}", response_model=Evaluation)
def get(report_id: Id, services: Services):
    return services.evaluations.get(report_id)


@router.get("/{report_id}/cases")
def cases(report_id: Id, services: Services):
    report = services.evaluations.get(report_id)
    return FileResponse(services.artifacts.path(report.cases_artifact),
                        media_type="application/x-ndjson", filename=f"{report.id}-cases.jsonl")


@router.get("/{report_id}/failures")
def failures(report_id: Id, services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.evaluations.failures(report_id)[offset:offset + limit]
