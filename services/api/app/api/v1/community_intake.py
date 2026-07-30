from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.community_intake.journey_models import (
    ContributorCommandResult,
    ContributorCreateDraftCommand,
    ContributorSubmissionAnalytics,
    ContributorSubmissionPage,
    ContributorSubmissionView,
    ContributorSubmitCommand,
    ContributorUpdateDraftCommand,
    ContributorWithdrawCommand,
    ProjectContributorStatusCommand,
    RespondInformationRequestCommand,
)
from app.community_intake.journey_repository import (
    ContributorJourneyRepository,
    submission_etag,
)
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
from app.community_intake.storage import StorageWriteError
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
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        ),
    )


def _journey_repository(session: Session) -> ContributorJourneyRepository:
    return ContributorJourneyRepository(
        session,
        storage=default_storage(
            settings.community_intake_storage_signing_key,
            settings.community_intake_storage_reference_ttl_seconds,
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
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


def _submission_headers(response: Response, submission: ContributorSubmissionView) -> None:
    _private_headers(response)
    response.headers["ETag"] = submission_etag(submission.submission_id, submission.version)


@router.post(
    "/me/submissions/drafts",
    response_model=ContributorCommandResult,
    status_code=201,
)
def create_contributor_draft(
    payload: ContributorCreateDraftCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> ContributorCommandResult:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).create_contributor_draft(
                identity, payload, correlation_id=correlation_id
            )
        _submission_headers(response, result.submission)
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


@router.get("/me/submissions", response_model=ContributorSubmissionPage)
def list_contributor_submissions(
    identity: ActiveIdentity,
    response: Response,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=2048),
) -> ContributorSubmissionPage:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).list_contributor_submissions(
                identity, limit=limit, cursor=cursor
            )
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error


@router.get("/me/contribution-analytics", response_model=ContributorSubmissionAnalytics)
def get_contributor_analytics(
    identity: ActiveIdentity,
    response: Response,
) -> ContributorSubmissionAnalytics:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).contributor_analytics(identity)
        _private_headers(response)
        return result
    except HTTPException:
        raise
    except (CommunityIntakeForbiddenError, SQLAlchemyError) as error:
        raise _error(error) from error


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


@router.get(
    "/me/submissions/{submission_id}",
    response_model=ContributorSubmissionView,
)
def get_submission(
    submission_id: UUID,
    identity: ActiveIdentity,
    response: Response,
) -> ContributorSubmissionView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).get_contributor_submission(
                identity, submission_id
            )
        _submission_headers(response, result)
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
    "/me/submissions/{submission_id}/commands/save-draft",
    response_model=ContributorCommandResult,
)
def save_contributor_draft(
    submission_id: UUID,
    payload: ContributorUpdateDraftCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
    if_match: str = Header(alias="If-Match"),
) -> ContributorCommandResult:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).update_contributor_draft(
                identity,
                submission_id,
                payload,
                if_match=if_match,
                correlation_id=correlation_id,
            )
        _submission_headers(response, result.submission)
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
    "/me/submissions/{submission_id}/commands/submit",
    response_model=ContributorCommandResult,
)
def submit_contributor_submission(
    submission_id: UUID,
    payload: ContributorSubmitCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
    if_match: str = Header(alias="If-Match"),
) -> ContributorCommandResult:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).submit_contributor(
                identity,
                submission_id,
                payload,
                if_match=if_match,
                correlation_id=correlation_id,
                responding=False,
            )
        _submission_headers(response, result.submission)
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
    "/me/submissions/{submission_id}/commands/respond-information-request",
    response_model=ContributorCommandResult,
)
def respond_to_information_request(
    submission_id: UUID,
    payload: RespondInformationRequestCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
    if_match: str = Header(alias="If-Match"),
) -> ContributorCommandResult:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).submit_contributor(
                identity,
                submission_id,
                payload,
                if_match=if_match,
                correlation_id=correlation_id,
                responding=True,
            )
        _submission_headers(response, result.submission)
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
    "/me/submissions/{submission_id}/commands/withdraw",
    response_model=ContributorCommandResult,
)
def withdraw_contributor_submission(
    submission_id: UUID,
    payload: ContributorWithdrawCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
    if_match: str = Header(alias="If-Match"),
) -> ContributorCommandResult:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).withdraw_contributor(
                identity,
                submission_id,
                payload,
                if_match=if_match,
                correlation_id=correlation_id,
            )
        _submission_headers(response, result.submission)
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
    "/me/submissions/{submission_id}/commands/prepare-attachment",
    response_model=AttachmentUploadReservation,
    status_code=201,
)
def prepare_contributor_attachment(
    submission_id: UUID,
    payload: PrepareAttachmentUploadCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
    if_match: str = Header(alias="If-Match"),
) -> AttachmentUploadReservation:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).prepare_contributor_attachment(
                identity,
                submission_id,
                payload,
                if_match=if_match,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        response.headers["ETag"] = if_match
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
    "/me/attachments/{attachment_id}/content",
    response_model=AttachmentView,
)
async def upload_contributor_attachment(
    attachment_id: UUID,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
    file: Annotated[UploadFile, File()],
    idempotency_key: Annotated[str, Form(min_length=8, max_length=255)],
    upload_reference: Annotated[str, Form(min_length=32, max_length=4096)],
    if_match: Annotated[str, Header(alias="If-Match")],
) -> AttachmentView:
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Attachment exceeds 10 MiB")
    media_type = (file.content_type or "").strip().lower()
    original_filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).upload_contributor_attachment(
                identity,
                attachment_id,
                idempotency_key=idempotency_key,
                upload_reference=upload_reference,
                original_filename=original_filename,
                media_type=media_type,
                content=content,
                if_match=if_match,
                correlation_id=correlation_id,
            )
        _private_headers(response)
        response.headers["ETag"] = if_match
        return result
    except HTTPException:
        raise
    except (
        CommunityIntakeConflictError,
        CommunityIntakeForbiddenError,
        CommunityIntakeNotFoundError,
        StorageWriteError,
        SQLAlchemyError,
    ) as error:
        raise _error(error) from error
    finally:
        await file.close()


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
    "/community-intake/submissions/{submission_id}/contributor-status",
    response_model=ContributorSubmissionView,
)
def project_contributor_status(
    submission_id: UUID,
    payload: ProjectContributorStatusCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> ContributorSubmissionView:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Database unavailable")
            result = _journey_repository(session).project_contributor_status(
                identity, submission_id, payload, correlation_id=correlation_id
            )
        _submission_headers(response, result)
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
