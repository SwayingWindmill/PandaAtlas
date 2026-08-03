from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import SQLAlchemyError

from app.audit.exports import AuditExportService
from app.audit.models import (
    AuditEventList,
    AuditExportArtifactRead,
    AuditIntegrityCheckRead,
    AuditIntegritySummaryList,
    AuditIntegritySummaryRead,
    AuditMetricsRead,
    CreateAuditExportCommand,
    GenerateAuditIntegritySummaryCommand,
    VerifyAuditIntegritySummaryCommand,
)
from app.audit.service import (
    AuditConflictError,
    AuditNotFoundError,
    AuditPayloadRejectedError,
    AuditService,
    audit_session,
)
from app.identity.models import RequestIdentity
from app.identity.security import require_capability, resolve_correlation_id

router = APIRouter(prefix="/admin/audit")

AuditReader = Annotated[
    RequestIdentity,
    Depends(require_capability("audit.read")),
]
AuditIntegrityOperator = Annotated[
    RequestIdentity,
    Depends(require_capability("audit.integrity.manage", recent_auth=True)),
]
AuditExporter = Annotated[
    RequestIdentity,
    Depends(require_capability("audit.export", recent_auth=True)),
]
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]
ReasonParameter = Annotated[str, Query(min_length=3, max_length=1000)]
LimitParameter = Annotated[int, Query(ge=1, le=100)]


def _private_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["X-Content-Type-Options"] = "nosniff"


def _error(error: Exception) -> HTTPException:
    if isinstance(error, AuditConflictError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "audit_conflict", "message": str(error)},
        )
    if isinstance(error, AuditNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "audit_not_found", "message": str(error)},
        )
    if isinstance(error, AuditPayloadRejectedError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "audit_payload_rejected", "message": str(error)},
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "audit_database_unavailable"},
    )


@router.get("/events", response_model=AuditEventList)
def search_audit_events(
    response: Response,
    identity: AuditReader,
    correlation_id: CorrelationId,
    reason: ReasonParameter,
    source_context: str | None = Query(default=None, min_length=2, max_length=64),
    action: str | None = Query(default=None, min_length=3, max_length=160),
    target_type: str | None = Query(default=None, min_length=1, max_length=100),
    target_id: str | None = Query(default=None, min_length=1, max_length=255),
    actor_account_id: UUID | None = None,
    event_correlation_id: UUID | None = None,
    result: str | None = Query(default=None, min_length=1, max_length=100),
    sensitive_only: bool | None = None,
    occurred_after: datetime | None = None,
    occurred_before: datetime | None = None,
    limit: LimitParameter = 50,
) -> AuditEventList:
    _private_headers(response)
    try:
        with audit_session() as session:
            return AuditService(session).search(
                identity=identity,
                correlation_id=correlation_id,
                reason=reason,
                source_context=source_context,
                action=action,
                target_type=target_type,
                target_id=target_id,
                actor_account_id=actor_account_id,
                event_correlation_id=event_correlation_id,
                result=result,
                sensitive_only=sensitive_only,
                occurred_after=occurred_after,
                occurred_before=occurred_before,
                limit=limit,
            )
    except HTTPException:
        raise
    except (AuditPayloadRejectedError, SQLAlchemyError) as error:
        raise _error(error) from error


@router.get("/metrics", response_model=AuditMetricsRead)
def get_audit_metrics(
    response: Response,
    identity: AuditReader,
    correlation_id: CorrelationId,
    reason: ReasonParameter,
) -> AuditMetricsRead:
    _private_headers(response)
    try:
        with audit_session() as session:
            return AuditService(session).metrics(
                identity=identity,
                correlation_id=correlation_id,
                reason=reason,
            )
    except HTTPException:
        raise
    except (AuditPayloadRejectedError, SQLAlchemyError) as error:
        raise _error(error) from error


@router.get("/integrity-summaries", response_model=AuditIntegritySummaryList)
def list_audit_integrity_summaries(
    response: Response,
    identity: AuditReader,
    correlation_id: CorrelationId,
    reason: ReasonParameter,
    limit: LimitParameter = 50,
) -> AuditIntegritySummaryList:
    _private_headers(response)
    try:
        with audit_session() as session:
            return AuditService(session).list_integrity_summaries(
                identity=identity,
                correlation_id=correlation_id,
                reason=reason,
                limit=limit,
            )
    except HTTPException:
        raise
    except (AuditPayloadRejectedError, SQLAlchemyError) as error:
        raise _error(error) from error


@router.post(
    "/integrity-summaries",
    response_model=AuditIntegritySummaryRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_audit_integrity_summary(
    command: GenerateAuditIntegritySummaryCommand,
    response: Response,
    identity: AuditIntegrityOperator,
    correlation_id: CorrelationId,
) -> AuditIntegritySummaryRead:
    _private_headers(response)
    try:
        with audit_session() as session:
            return AuditService(session).generate_integrity_summary(
                identity=identity,
                correlation_id=correlation_id,
                command=command,
            )
    except HTTPException:
        raise
    except (AuditConflictError, AuditPayloadRejectedError, SQLAlchemyError) as error:
        raise _error(error) from error


@router.post(
    "/integrity-summaries/{summary_id}/verify",
    response_model=AuditIntegrityCheckRead,
)
def verify_audit_integrity_summary(
    summary_id: UUID,
    command: VerifyAuditIntegritySummaryCommand,
    response: Response,
    identity: AuditIntegrityOperator,
    correlation_id: CorrelationId,
) -> AuditIntegrityCheckRead:
    _private_headers(response)
    try:
        with audit_session() as session:
            return AuditService(session).verify_integrity_summary(
                identity=identity,
                correlation_id=correlation_id,
                summary_id=summary_id,
                command=command,
            )
    except HTTPException:
        raise
    except (
        AuditConflictError,
        AuditNotFoundError,
        AuditPayloadRejectedError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post(
    "/exports",
    response_model=AuditExportArtifactRead,
    status_code=status.HTTP_201_CREATED,
)
def create_audit_export(
    command: CreateAuditExportCommand,
    response: Response,
    identity: AuditExporter,
    correlation_id: CorrelationId,
) -> AuditExportArtifactRead:
    _private_headers(response)
    try:
        with audit_session() as session:
            return AuditExportService(session).create(
                identity=identity,
                correlation_id=correlation_id,
                command=command,
            )
    except HTTPException:
        raise
    except (AuditConflictError, AuditPayloadRejectedError, SQLAlchemyError) as error:
        raise _error(error) from error


@router.get("/exports/{artifact_id}/download", response_class=Response)
def download_audit_export(
    artifact_id: UUID,
    identity: AuditExporter,
    correlation_id: CorrelationId,
    reason: ReasonParameter,
) -> Response:
    try:
        with audit_session() as session:
            download = AuditExportService(session).download(
                identity=identity,
                correlation_id=correlation_id,
                artifact_id=artifact_id,
                reason=reason,
            )
        filename = f"audit-export-{artifact_id}.ndjson"
        return Response(
            content=download.content,
            media_type=download.artifact.content_type,
            headers={
                "Cache-Control": "no-store, private",
                "X-Robots-Tag": "noindex, nofollow",
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Audit-File-Sha256": download.artifact.file_sha256,
            },
        )
    except HTTPException:
        raise
    except (
        AuditConflictError,
        AuditNotFoundError,
        AuditPayloadRejectedError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error
