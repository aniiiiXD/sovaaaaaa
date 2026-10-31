from contextlib import asynccontextmanager
import logging

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from rig import __version__
from rig.api.dependencies import authenticate
from rig.api.middleware import RequestBoundary
from rig.api.routes import candidates, datasets, deployments, evaluations, feedback, jobs, serving
from rig.config import Settings
from rig.container import Container
from rig.errors import RigError


def create_app(settings: Settings | None = None, container: Container | None = None) -> FastAPI:
    settings = settings or Settings()
    container = container or Container(settings)

    @asynccontextmanager
    async def lifespan(app):
        if settings.api_token is None or not settings.api_token.get_secret_value().strip():
            raise RuntimeError("Set RIG_API_TOKEN before starting the API")
        container.initialize()
        yield

    app = FastAPI(title="Sova Rig", version=__version__, lifespan=lifespan,
                  description="Data → post-train → evaluate → iterate → optimize → serve")
    app.state.container = container
    app.add_middleware(RequestBoundary, max_body_bytes=settings.max_body_bytes)

    def error(request, status, code, message, headers=None):
        response_headers = dict(headers or {})
        response_headers["X-Rig-Request-Id"] = getattr(request.state, "request_id", "unknown")
        return JSONResponse(status_code=status, headers=response_headers, content={"error": {
            "code": code, "message": message, "request_id": getattr(request.state, "request_id", None)}})

    @app.exception_handler(RigError)
    async def rig_error(request: Request, exc: RigError):
        return error(request, exc.status_code, exc.code, str(exc))

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return error(request, exc.status_code, "http_error", str(exc.detail), exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # Pydantic's default response echoes submitted values; return locations and messages only.
        detail = "; ".join(f"{'.'.join(map(str, item['loc']))}: {item['msg']}"
                           for item in exc.errors())
        return error(request, 422, "validation_error", detail)

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception):
        logging.getLogger(__name__).error("Unhandled request error", exc_info=exc)
        return error(request, 500, "internal_error", "Request failed; inspect local server logs")

    @app.get("/health", tags=["system"])
    def health():
        return {"status": "ok", "version": __version__, "execution_enabled": settings.execution_enabled}

    for router in (datasets.router, candidates.router, jobs.router, evaluations.router,
                   deployments.router, feedback.router, serving.router):
        app.include_router(router, dependencies=[Depends(authenticate)])
    return app
