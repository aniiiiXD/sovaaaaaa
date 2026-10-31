import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from rig.container import Container

bearer = HTTPBearer(auto_error=False)


def get_container(request: Request) -> Container:
    return request.app.state.container


def authenticate(request: Request,
                 credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    secret = request.app.state.container.settings.api_token
    if secret is None or credentials is None or not secrets.compare_digest(
        credentials.credentials.encode(), secret.get_secret_value().encode()
    ):
        raise HTTPException(401, "Invalid bearer token", headers={"WWW-Authenticate": "Bearer"})


Services = Annotated[Container, Depends(get_container)]
Limit = Annotated[int, Query(ge=1, le=200)]
Offset = Annotated[int, Query(ge=0)]
