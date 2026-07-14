from secrets import compare_digest
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

security_scheme = HTTPBearer(auto_error=False)
auth_credentials = Depends(security_scheme)


def require_admin_token(
    credentials: HTTPAuthorizationCredentials | None = auth_credentials,
) -> None:
    if settings.admin_api_token == "dev-admin-token" and not settings.is_local_environment():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_API_TOKEN must be set to a non-default value outside development",
        )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    if credentials.credentials != settings.admin_api_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_workflow_actor(
    actor_id: Annotated[UUID, Header(alias="X-Actor-Id")],
    credentials: HTTPAuthorizationCredentials | None = auth_credentials,
) -> UUID:
    if settings.is_local_environment():
        require_admin_token(credentials)
        return actor_id

    try:
        actor_tokens = settings.workflow_actor_tokens()
    except (ValueError, TypeError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WORKFLOW_ACTOR_TOKENS_JSON is invalid",
        ) from error

    if not actor_tokens:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WORKFLOW_ACTOR_TOKENS_JSON must configure independent staff actors",
        )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    expected_token = actor_tokens.get(actor_id)
    if expected_token is None or not compare_digest(credentials.credentials, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Workflow actor does not match bearer token",
        )
    return actor_id
