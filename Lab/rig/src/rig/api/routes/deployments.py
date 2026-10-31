from fastapi import APIRouter, Response

from rig.api.dependencies import Limit, Offset, Services
from rig.domain.models import Deployment, DeploymentCreate

router = APIRouter(prefix="/api/v1/deployments", tags=["deployments"])


@router.post("", response_model=Deployment, status_code=201)
def promote(body: DeploymentCreate, services: Services):
    return services.serving.promote(body)


@router.get("", response_model=list[Deployment])
def listing(services: Services):
    return services.repository.deployments()


@router.get("/history", response_model=list[Deployment])
def history(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.list("deployment", limit, offset)


@router.get("/{name}", response_model=Deployment)
def get(name: str, services: Services):
    return services.repository.deployment(name)


@router.delete("/{name}", status_code=204)
def deactivate(name: str, services: Services):
    services.repository.deactivate(name)
    return Response(status_code=204)
