from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import session_scope
from app.identity.models import AccountState, RequestIdentity
from app.identity.security import get_request_identity, require_capability, resolve_correlation_id
from app.privacy_operations.exports import (
    PrivacyExportCipher,
    PrivacyExportDecryptionError,
    PrivacyExportDownloadSigner,
    PrivacyExportReferenceError,
    PrivacyExportService,
)
from app.privacy_operations.models import (
    CreatePrivacyHoldCommand,
    CreatePrivacyRequestCommand,
    DeletionTombstoneRead,
    DownloadPrivacyExportCommand,
    ExecutePrivateDeletionCommand,
    GeneratePrivacyExportCommand,
    PrivacyExportAccessRead,
    PrivacyExportRead,
    PrivacyHoldList,
    PrivacyHoldRead,
    PrivacyRequestList,
    PrivacyRequestRead,
    ReleasePrivacyHoldCommand,
    ReplayDeletionTombstoneCommand,
    UpdatePrivacyContextCommand,
    UserPrivacyContextRead,
    UserPrivacyRequestList,
    UserPrivacyRequestRead,
    VerifyPrivacyRequestCommand,
)
from app.privacy_operations.service import (
    PrivacyOperationsConflictError,
    PrivacyOperationsForbiddenError,
    PrivacyOperationsNotFoundError,
    PrivacyOperationsService,
)


def require_privacy_operations_enabled() -> None:
    if not settings.privacy_operations_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


router = APIRouter(
    prefix="/privacy",
    dependencies=[Depends(require_privacy_operations_enabled)],
)
admin_router = APIRouter(
    prefix="/admin/privacy",
    dependencies=[Depends(require_privacy_operations_enabled)],
)
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]
PrivacyOperator = Annotated[
    RequestIdentity,
    Depends(require_capability("privacy.operate", recent_auth=True)),
]


def require_recent_privacy_requester(
    identity: Annotated[RequestIdentity, Depends(get_request_identity)],
) -> RequestIdentity:
    if identity.state is not AccountState.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is unavailable")
    if not identity.recent_auth:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication within the last 15 minutes is required",
        )
    return identity


def require_privacy_status_identity(
    identity: Annotated[RequestIdentity, Depends(get_request_identity)],
) -> RequestIdentity:
    if identity.state not in {AccountState.ACTIVE, AccountState.DELETING}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is unavailable")
    if not identity.recent_auth:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication within the last 15 minutes is required",
        )
    return identity


PrivacyRequester = Annotated[RequestIdentity, Depends(require_recent_privacy_requester)]
PrivacyStatusIdentity = Annotated[RequestIdentity, Depends(require_privacy_status_identity)]


def _export_service(session: Session) -> PrivacyExportService:
    return PrivacyExportService(
        session,
        cipher=PrivacyExportCipher(settings.privacy_export_master_key),
        signer=PrivacyExportDownloadSigner(
            signing_key=settings.privacy_export_download_signing_key,
            ttl_seconds=settings.privacy_export_download_ttl_seconds,
        ),
        artifact_ttl_seconds=settings.privacy_export_artifact_ttl_seconds,
    )


def _private_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"


def _user_read(value: PrivacyRequestRead) -> UserPrivacyRequestRead:
    return UserPrivacyRequestRead(
        request_id=value.request_id,
        kind=value.kind,
        state=value.state,
        version=value.version,
        requested_at=value.requested_at,
        completed_at=value.completed_at,
        contexts=[
            UserPrivacyContextRead(
                context_key=context.context_key,
                state=context.state,
                attempts=context.attempts,
                updated_at=context.updated_at,
            )
            for context in value.contexts
        ],
    )


def _error(error: Exception) -> HTTPException:
    if isinstance(error, (PrivacyOperationsNotFoundError, PrivacyExportReferenceError)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if isinstance(error, PrivacyExportDecryptionError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Privacy export is unavailable",
        )
    if isinstance(error, PrivacyOperationsForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, PrivacyOperationsConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Privacy Operations service is unavailable",
    )


@router.post(
    "/requests",
    response_model=UserPrivacyRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_privacy_request(
    payload: CreatePrivacyRequestCommand,
    response: Response,
    identity: PrivacyRequester,
    correlation_id: CorrelationId,
) -> UserPrivacyRequestRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            value = PrivacyOperationsService(session).create_request(
                identity=identity,
                kind=payload.kind,
                reason=payload.reason,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
            return _user_read(value)
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.get("/requests", response_model=UserPrivacyRequestList)
def list_my_privacy_requests(
    response: Response,
    identity: PrivacyStatusIdentity,
    correlation_id: CorrelationId,
) -> UserPrivacyRequestList:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            values = PrivacyOperationsService(session).list_for_account_audited(
                actor=identity,
                correlation_id=correlation_id,
            )
            return UserPrivacyRequestList(items=[_user_read(value) for value in values])
    except HTTPException:
        raise
    except (PrivacyOperationsNotFoundError, SQLAlchemyError) as error:
        raise _error(error) from error


@router.get("/requests/{request_id}", response_model=UserPrivacyRequestRead)
def get_my_privacy_request(
    request_id: UUID,
    response: Response,
    identity: PrivacyStatusIdentity,
    correlation_id: CorrelationId,
) -> UserPrivacyRequestRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            value = PrivacyOperationsService(session).get_for_account_audited(
                actor=identity,
                request_id=request_id,
                correlation_id=correlation_id,
            )
            return _user_read(value)
    except HTTPException:
        raise
    except (PrivacyOperationsNotFoundError, SQLAlchemyError) as error:
        raise _error(error) from error


@router.get("/requests/{request_id}/export", response_model=PrivacyExportRead)
def get_my_privacy_export(
    request_id: UUID,
    response: Response,
    identity: PrivacyRequester,
    correlation_id: CorrelationId,
) -> PrivacyExportRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return _export_service(session).get_for_account_audited(
                actor=identity,
                request_id=request_id,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        PrivacyExportReferenceError,
        PrivacyExportDecryptionError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post("/requests/{request_id}/export-access", response_model=PrivacyExportAccessRead)
def create_my_privacy_export_access(
    request_id: UUID,
    response: Response,
    identity: PrivacyRequester,
    correlation_id: CorrelationId,
) -> PrivacyExportAccessRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return _export_service(session).issue_access(
                actor=identity,
                request_id=request_id,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        PrivacyExportReferenceError,
        PrivacyExportDecryptionError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post("/exports/download")
def download_my_privacy_export(
    payload: DownloadPrivacyExportCommand,
    identity: PrivacyRequester,
    correlation_id: CorrelationId,
) -> Response:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            content, filename = _export_service(session).download(
                actor=identity,
                reference=payload.reference,
                correlation_id=correlation_id,
            )
        return Response(
            content=content,
            media_type="application/json",
            headers={
                "Cache-Control": "private, no-store",
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Content-Type-Options": "nosniff",
                "X-Robots-Tag": "noindex, nofollow",
            },
        )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        PrivacyExportReferenceError,
        PrivacyExportDecryptionError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@admin_router.get("/requests", response_model=PrivacyRequestList)
def list_privacy_requests(
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyRequestList:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyRequestList(
                items=PrivacyOperationsService(session).list_for_operator(
                    actor=actor,
                    correlation_id=correlation_id,
                )
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _error(error) from error


@admin_router.get("/requests/{request_id}", response_model=PrivacyRequestRead)
def get_privacy_request(
    request_id: UUID,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyRequestRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyOperationsService(session).get_for_operator(
                actor=actor,
                request_id=request_id,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (PrivacyOperationsNotFoundError, SQLAlchemyError) as error:
        raise _error(error) from error


@admin_router.post("/requests/{request_id}/verify", response_model=PrivacyRequestRead)
def verify_privacy_request(
    request_id: UUID,
    payload: VerifyPrivacyRequestCommand,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyRequestRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyOperationsService(session).verify_request(
                actor=actor,
                request_id=request_id,
                expected_version=payload.expected_version,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@admin_router.post(
    "/requests/{request_id}/contexts/{context_key}",
    response_model=PrivacyRequestRead,
)
def update_privacy_request_context(
    request_id: UUID,
    context_key: str,
    payload: UpdatePrivacyContextCommand,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyRequestRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyOperationsService(session).update_context(
                actor=actor,
                request_id=request_id,
                context_key=context_key,
                expected_version=payload.expected_version,
                next_state=payload.state,
                internal_error_code=payload.internal_error_code,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@admin_router.post(
    "/requests/{request_id}/generate-export",
    response_model=PrivacyExportRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_privacy_export(
    request_id: UUID,
    payload: GeneratePrivacyExportCommand,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyExportRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return _export_service(session).generate(
                actor=actor,
                request_id=request_id,
                expected_context_versions=payload.expected_context_versions,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        PrivacyExportReferenceError,
        PrivacyExportDecryptionError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@admin_router.post(
    "/requests/{request_id}/execute-private-deletion",
    response_model=PrivacyRequestRead,
)
def execute_private_deletion(
    request_id: UUID,
    payload: ExecutePrivateDeletionCommand,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyRequestRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyOperationsService(session).execute_private_deletion(
                actor=actor,
                request_id=request_id,
                expected_context_versions=payload.expected_context_versions,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@admin_router.get("/requests/{request_id}/holds", response_model=PrivacyHoldList)
def list_privacy_holds(
    request_id: UUID,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyHoldList:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyHoldList(
                items=PrivacyOperationsService(session).list_holds(
                    actor=actor,
                    request_id=request_id,
                    correlation_id=correlation_id,
                )
            )
    except HTTPException:
        raise
    except (PrivacyOperationsNotFoundError, SQLAlchemyError) as error:
        raise _error(error) from error


@admin_router.post(
    "/requests/{request_id}/holds/{context_key}",
    response_model=PrivacyHoldRead,
    status_code=status.HTTP_201_CREATED,
)
def create_privacy_hold(
    request_id: UUID,
    context_key: str,
    payload: CreatePrivacyHoldCommand,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyHoldRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyOperationsService(session).create_hold(
                actor=actor,
                request_id=request_id,
                context_key=context_key,
                expected_context_version=payload.expected_context_version,
                basis=payload.basis,
                review_due_at=payload.review_due_at,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@admin_router.post("/holds/{hold_id}/release", response_model=PrivacyHoldRead)
def release_privacy_hold(
    hold_id: UUID,
    payload: ReleasePrivacyHoldCommand,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> PrivacyHoldRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyOperationsService(session).release_hold(
                actor=actor,
                hold_id=hold_id,
                expected_hold_version=payload.expected_hold_version,
                expected_context_version=payload.expected_context_version,
                reason=payload.reason,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@admin_router.post(
    "/tombstones/{account_id}/{context_key}/replay",
    response_model=DeletionTombstoneRead,
)
def replay_privacy_tombstone(
    account_id: UUID,
    context_key: str,
    payload: ReplayDeletionTombstoneCommand,
    response: Response,
    actor: PrivacyOperator,
    correlation_id: CorrelationId,
) -> DeletionTombstoneRead:
    _private_headers(response)
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Privacy Operations database is unavailable",
                )
            return PrivacyOperationsService(session).replay_tombstone(
                actor=actor,
                account_id=account_id,
                context_key=context_key,
                expected_version=payload.expected_version,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except (
        PrivacyOperationsConflictError,
        PrivacyOperationsForbiddenError,
        PrivacyOperationsNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error
