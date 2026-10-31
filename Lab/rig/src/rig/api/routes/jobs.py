from fastapi import APIRouter, Response
from fastapi.responses import FileResponse

from rig.api.dependencies import Limit, Offset, Services
from rig.domain.models import EvalRequest, Id, IterationRequest, Job, OptimizeRequest, PipelineRequest, TrainRequest
from rig.errors import NotFound, RigError

router = APIRouter(prefix="/api/v1", tags=["jobs"])


def enqueue(kind, body, services, response):
    validators = {"train": services.training.validate, "evaluate": services.evaluations.validate,
                  "optimize": services.optimization.validate, "pipeline": services.pipeline.validate}
    validators[kind](body)
    job = services.repository.enqueue(Job(kind=kind, payload=body.model_dump(mode="json")))
    response.headers["Location"] = f"/api/v1/jobs/{job.id}"
    return job


@router.post("/training", response_model=Job, status_code=202)
def train(body: TrainRequest, services: Services, response: Response):
    return enqueue("train", body, services, response)


@router.post("/evaluations", response_model=Job, status_code=202)
def evaluate(body: EvalRequest, services: Services, response: Response):
    return enqueue("evaluate", body, services, response)


@router.post("/optimizations", response_model=Job, status_code=202)
def optimize(body: OptimizeRequest, services: Services, response: Response):
    return enqueue("optimize", body, services, response)


@router.post("/pipelines", response_model=Job, status_code=202)
def pipeline(body: PipelineRequest, services: Services, response: Response):
    return enqueue("pipeline", body, services, response)


@router.get("/jobs", response_model=list[Job])
def listing(services: Services, limit: Limit = 50, offset: Offset = 0):
    return services.repository.jobs(limit, offset)


@router.post("/iterations", status_code=202)
def iterate(body: IterationRequest, services: Services, response: Response):
    dataset, pipeline_request = services.pipeline.prepare_iteration(body)
    job = enqueue("pipeline", pipeline_request, services, response)
    return {"dataset": dataset, "job": job}


@router.get("/jobs/{job_id}", response_model=Job)
def get(job_id: Id, services: Services):
    return services.repository.job(job_id)


@router.post("/jobs/{job_id}/cancel", response_model=Job)
def cancel(job_id: Id, services: Services):
    return services.repository.cancel(job_id)


@router.get("/jobs/{job_id}/events")
def events(job_id: Id, services: Services, limit: Limit = 50, offset: Offset = 0):
    services.repository.job(job_id)
    return services.repository.job_events(job_id, limit, offset)


@router.get("/jobs/{job_id}/artifacts")
def artifacts(job_id: Id, services: Services):
    services.repository.job(job_id)
    root = services.artifacts.path(f"jobs/{job_id}")
    return [{"path": str(path.relative_to(root)), "bytes": path.stat().st_size}
            for path in sorted(root.rglob("*")) if path.is_file()]


@router.get("/jobs/{job_id}/artifacts/{artifact_path:path}")
def artifact(job_id: Id, artifact_path: str, services: Services):
    services.repository.job(job_id)
    root = services.artifacts.path(f"jobs/{job_id}")
    path = (root / artifact_path).resolve()
    if not path.is_relative_to(root):
        raise RigError("Artifact is outside this job")
    if not path.is_file():
        raise NotFound("Artifact does not exist")
    return FileResponse(path, media_type="application/octet-stream", filename=path.name)
