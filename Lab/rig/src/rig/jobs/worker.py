import logging
import signal
import time

from rig.domain.models import EvalRequest, OptimizeRequest, PipelineRequest, TrainRequest
from rig.errors import Cancelled, RigError
from rig.jobs.context import JobContext
from rig.storage.locking import process_lock
from rig.training.imports import LocalModelImport
from rig.workflows.models import CycleJob, ReleaseJob

logger = logging.getLogger(__name__)


def run_worker(container, once: bool = False) -> None:
    settings = container.settings
    if not settings.execution_enabled:
        raise RigError("Execution is disabled. RIG_EXECUTION_ENABLED must be true to run a worker")
    stop = False

    def request_stop(signum, frame):
        nonlocal stop
        stop = True

    previous = {sig: signal.signal(sig, request_stop) for sig in (signal.SIGINT, signal.SIGTERM)}
    handlers = {
        "train": (TrainRequest, container.training.run),
        "evaluate": (EvalRequest, container.evaluations.run),
        "optimize": (OptimizeRequest, container.optimization.run),
        "pipeline": (PipelineRequest, container.pipeline.run),
        "workflow_cycle": (CycleJob, container.workflows.run_cycle),
        "workflow_release": (ReleaseJob, container.workflows.run_release),
        "import_model": (LocalModelImport, container.model_imports.run),
    }
    try:
        with process_lock(settings.home / "worker.lock"):
            container.repository.recover_interrupted()
            while not stop:
                job = container.repository.claim()
                if job is None:
                    if once:
                        break
                    time.sleep(0.5)
                    continue
                context = JobContext(job.id, container.repository, settings.job_timeout_seconds,
                                     lambda: stop)
                try:
                    request_type, handler = handlers[job.kind]
                    with process_lock(settings.home / "device.lock",
                                      settings.job_timeout_seconds, context.check):
                        context.event("job_started", {"kind": job.kind})
                        result = handler(request_type.model_validate(job.payload), context)
                        context.check()
                    if hasattr(result, "model_dump"):
                        result = result.model_dump(mode="json")
                    container.repository.finish(job.id, "succeeded", result=result)
                except Cancelled as exc:
                    container.repository.finish(job.id, "cancelled", error=str(exc))
                except Exception as exc:
                    logger.exception("Job %s failed", job.id)
                    # Provider exception details belong in local worker logs, not API responses.
                    message = str(exc) if isinstance(exc, RigError) else "Execution failed; inspect worker logs"
                    container.repository.finish(job.id, "failed", error=message)
                if once:
                    break
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)
