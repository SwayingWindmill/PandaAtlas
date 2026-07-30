from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.community_intake.models import (
    AttachmentAccessCommand,
    AttachmentScanCommand,
    AttachmentUploadReservation,
    AttachmentView,
    CommunityIntakeMetrics,
    CompleteAttachmentUploadCommand,
    CreateDraftCommand,
    PrepareAttachmentUploadCommand,
    RetentionResult,
    SignedStorageReference,
    SubmissionView,
    SubmitRevisionCommand,
    UpdateDraftCommand,
    WithdrawSubmissionCommand,
)
from app.community_intake.repository import (
    CommunityIntakeConflictError,
    CommunityIntakeForbiddenError,
    CommunityIntakeNotFoundError,
    CommunityIntakeRepository,
    default_storage,
)
from app.core.config import settings
from app.core.security import require_admin_token
from app.db.session import session_scope
from app.identity.security import ActiveIdentity, resolve_correlation_id


def require_community_intake_enabled() -> None:
    if not settings.community_intake_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


router = APIRouter(dependencies=[Depends(require_community_intake_enabled)])
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]


def _repository(session: Session) -> CommunityIntakeRepository:
    return CommunityIntakeRepository(
        session,
        storage=default_storage(
            settings.community_intake_storage_signing_key,
            settings.community_intake_storage_reference_ttl_seconds,
        ),
    )


def _error(error: Exception) -> HTTPException:
    if isinstance(error, CommunityIntakeNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, CommunityIntakeForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, CommunityIntakeConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Community Intake service is unavailable",
    )


def _private_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"


@router.post("/me/submissions", response_model=SubmissionView, status_code=201)
def create_draft(
    payload: CreateDraftCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> SubmissionView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).create_draft(
                identity,
                payload,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.get("/me/submissions/{submission_id}", response_model=SubmissionView)
def get_submission(
    submission_id: UUID,
    identity: ActiveIdentity,
    response: Response,
) -> SubmissionView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).get_submission(identity, submission_id)
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (CommunityIntakeNotFoundError, SQLAlchemyError) as error:
        raise _error(error) from error


@router.patch("/me/submissions/{submission_id}/draft", response_model=SubmissionView)
def update_draft(
    submission_id: UUID,
    payload: UpdateDraftCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> SubmissionView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).update_draft(
                identity,
                submission_id,
                payload,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post("/me/submissions/{submission_id}/revisions", response_model=SubmissionView)
def submit_revision(
    submission_id: UUID,
    payload: SubmitRevisionCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> SubmissionView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).submit_revision(
                identity,
                submission_id,
                payload,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post("/me/submissions/{submission_id}/withdraw", response_model=SubmissionView)
def withdraw_submission(
    submission_id: UUID,
    payload: WithdrawSubmissionCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> SubmissionView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).withdraw(
                identity,
                submission_id,
                payload,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post(
    "/me/submissions/{submission_id}/attachments/uploads",
    response_model=AttachmentUploadReservation,
    status_code=201,
)
def prepare_attachment_upload(
    submission_id: UUID,
    payload: PrepareAttachmentUploadCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> AttachmentUploadReservation:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).prepare_attachment_upload(
                identity,
                submission_id,
                payload,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post(
    "/me/attachments/{attachment_id}/complete",
    response_model=AttachmentView,
)
def complete_attachment_upload(
    attachment_id: UUID,
    payload: CompleteAttachmentUploadCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> AttachmentView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).complete_attachment_upload(
                identity,
                attachment_id,
                payload,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post(
    "/community-intake/attachments/{attachment_id}/scan",
    response_model=AttachmentView,
)
def record_attachment_scan(
    attachment_id: UUID,
    payload: AttachmentScanCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> AttachmentView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).record_scan_result(
                identity,
                attachment_id,
                payload,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post(
    "/community-intake/attachments/{attachment_id}/access",
    response_model=SignedStorageReference,
)
def create_attachment_access(
    attachment_id: UUID,
    payload: AttachmentAccessCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> SignedStorageReference:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).create_attachment_access(
                identity,
                attachment_id,
                payload,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.post(
    "/community-intake/retention/run",
    response_model=RetentionResult,
    dependencies=[Depends(require_admin_token)],
)
def run_retention(correlation_id: CorrelationId, response: Response) -> RetentionResult:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).expire_and_repair(
                correlation_id=correlation_id,
                max_scan_attempts=settings.community_intake_max_scan_attempts,
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _error(error) from error


@router.get(
    "/community-intake/metrics",
    response_model=CommunityIntakeMetrics,
    dependencies=[Depends(require_admin_token)],
)
def get_metrics(response: Response) -> CommunityIntakeMetrics:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _repository(session).metrics()
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _error(error) from error
