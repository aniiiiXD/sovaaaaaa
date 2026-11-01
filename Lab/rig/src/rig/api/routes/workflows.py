from fastapi import APIRouter, Response

from rig.api.dependencies import Limit, Offset, Services
from rig.domain.models import Deployment, Id, Job
from rig.workflows.models import CycleCreate, ReleaseCreate, Workflow, WorkflowCreate, WorkflowPromotion

router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


@router.post("", response_model=Workflow, status_code=201)
def create(body: WorkflowCreate, services: Services):
    return services.workflows.create(body)


@router.get("", response_model=list[Workflow])
def listing(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("workflow", limit, offset)


@router.get("/{workflow_id}", response_model=Workflow)
def get(workflow_id: Id, services: Services):
    return services.workflows.get(workflow_id)


@router.post("/{workflow_id}/cycles", status_code=202)
def start_cycle(workflow_id: Id, body: CycleCreate, services: Services, response: Response):
    cycle, job = services.workflows.start_cycle(workflow_id, body)
    response.headers["Location"] = f"/api/v1/jobs/{job.id}"
    return {"cycle": cycle, "job": job}


@router.get("/{workflow_id}/cycles")
def cycles(workflow_id: Id, services: Services, limit: Limit = 50, offset: Offset = 0):
    services.workflows.get(workflow_id)
    return [{"cycle": row, "job": services.repository.job(row["id"])} for row in
            services.repository.related("cycle", "workflow_id", workflow_id, limit, offset)]


@router.get("/{workflow_id}/cycles/{cycle_id}")
def cycle(workflow_id: Id, cycle_id: Id, services: Services):
    return {"cycle": services.workflows.cycle(workflow_id, cycle_id),
            "job": services.repository.job(cycle_id)}


@router.get("/{workflow_id}/cycles/{cycle_id}/failures")
def failures(workflow_id: Id, cycle_id: Id, services: Services):
    return services.workflows.failures(workflow_id, cycle_id)


@router.post("/{workflow_id}/cycles/{cycle_id}/release", response_model=Job, status_code=202)
def release(workflow_id: Id, cycle_id: Id, body: ReleaseCreate, services: Services, response: Response):
    job = services.workflows.request_release(workflow_id, cycle_id, body)
    response.headers["Location"] = f"/api/v1/jobs/{job.id}"
    return job


@router.post("/{workflow_id}/cycles/{cycle_id}/promote", response_model=Deployment, status_code=201)
def promote(workflow_id: Id, cycle_id: Id, body: WorkflowPromotion, services: Services):
    return services.workflows.promote(workflow_id, cycle_id, body)


@router.get("/{workflow_id}/feedback")
def feedback(workflow_id: Id, services: Services, limit: Limit = 50, offset: Offset = 0):
    services.workflows.get(workflow_id)
    return services.repository.related("feedback", "workflow_id", workflow_id, limit, offset)
