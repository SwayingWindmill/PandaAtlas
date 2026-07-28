from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import session_scope
from app.identity.models import RequestIdentity
from app.identity.repository import (
    IdentityConflictError,
    IdentityNotFoundError,
    IdentityRepository,
)
from app.identity.security import (
    ActiveIdentity,
    AdminShellIdentity,
    require_capability,
    resolve_correlation_id,
)
from app.schemas.identity import (
    AccountStateChange,
    AccountStateRead,
    IdentitySessionRead,
    RoleAssignmentCreate,
    RoleAssignmentRead,
    RoleAssignmentRevoke,
    RoleRevocationRead,
)

router = APIRouter(prefix="/identity")
admin_router = APIRouter(prefix="/admin")

RoleManager = Annotated[
    RequestIdentity,
    Depends(require_capability("identity.role.manage", recent_auth=True)),
]
AccountManager = Annotated[
    RequestIdentity,
    Depends(require_capability("identity.account.manage", recent_auth=True)),
]
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]


@router.get("/session", response_model=IdentitySessionRead)
def get_identity_session(identity: ActiveIdentity) -> IdentitySessionRead:
    return IdentitySessionRead.from_identity(identity)


@admin_router.get("/session", response_model=IdentitySessionRead)
def get_admin_session(identity: AdminShellIdentity) -> IdentitySessionRead:
    return IdentitySessionRead.from_identity(identity)


@admin_router.post(
    "/role-assignments",
    response_model=RoleAssignmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_role_assignment(
    payload: RoleAssignmentCreate,
    actor: RoleManager,
    correlation_id: CorrelationId,
) -> RoleAssignmentRead:
    if payload.account_id == actor.account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-assignment of roles is not allowed",
        )
    if payload.expires_at is not None and payload.expires_at <= datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expires_at must be in the future",
        )
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Identity database is unavailable",
                )
            assignment = IdentityRepository(session).grant_role(
                actor=actor,
                account_id=payload.account_id,
                role_key=payload.role_key,
                expires_at=payload.expires_at,
                reason=payload.reason,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
            return RoleAssignmentRead.model_validate(assignment)
    except HTTPException:
        raise
    except IdentityNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found") from error
    except IdentityConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Identity role assignment failed",
        ) from error


@admin_router.post(
    "/role-assignments/{assignment_id}/revoke",
    response_model=RoleRevocationRead,
)
def revoke_role_assignment(
    assignment_id: UUID,
    payload: RoleAssignmentRevoke,
    actor: RoleManager,
    correlation_id: CorrelationId,
) -> RoleRevocationRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Identity database is unavailable",
                )
            revocation = IdentityRepository(session).revoke_role(
                actor=actor,
                assignment_id=assignment_id,
                reason=payload.reason,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
            return RoleRevocationRead.model_validate(revocation)
    except HTTPException:
        raise
    except IdentityNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found") from error
    except IdentityConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Identity role revocation failed",
        ) from error


@admin_router.post(
    "/accounts/{account_id}/state",
    response_model=AccountStateRead,
)
def change_account_state(
    account_id: UUID,
    payload: AccountStateChange,
    actor: AccountManager,
    correlation_id: CorrelationId,
) -> AccountStateRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Identity database is unavailable",
                )
            account = IdentityRepository(session).change_account_state(
                actor=actor,
                account_id=account_id,
                next_state=payload.state,
                reason=payload.reason,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
            return AccountStateRead.model_validate(account)
    except HTTPException:
        raise
    except IdentityNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found") from error
    except IdentityConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Identity account state change failed",
        ) from error
