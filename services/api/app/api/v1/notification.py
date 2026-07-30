from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_admin_token
from app.db.session import session_scope
from app.identity.security import ActiveIdentity, resolve_correlation_id
from app.notification.delivery import (
    NotificationDeliveryRepository,
    NotificationWebhookConflictError,
)
from app.notification.models import (
    DigestBatch,
    DigestQueueCommand,
    InboxCursorError,
    InboxItem,
    InboxMarkCommand,
    InboxPage,
    InboxUnreadCount,
    NotificationMetricsSnapshot,
    NotificationWebhookReceipt,
)
from app.notification.repository import (
    NotificationAccountUnavailableError,
    NotificationConflictError,
    NotificationNotFoundError,
    NotificationRepository,
)
from app.notification.transport import verify_resend_webhook


def require_notification_enabled() -> None:
    if not settings.notification_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


router = APIRouter(dependencies=[Depends(require_notification_enabled)])
_MAX_RESEND_WEBHOOK_BYTES = 64 * 1024
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]


def _repository(session: Session) -> NotificationRepository:
    return NotificationRepository(
        session,
        cursor_signing_key=settings.notification_cursor_signing_key,
    )


def _handle_error(error: Exception) -> HTTPException:
    if isinstance(error, InboxCursorError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    if isinstance(error, NotificationAccountUnavailableError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, NotificationNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, NotificationConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Notification service is unavailable",
    )


@router.get("/me/inbox", response_model=InboxPage)
def get_inbox(
    identity: ActiveIdentity,
    response: Response,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query(min_length=8, max_length=2048)] = None,
) -> InboxPage:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Notification database is unavailable")
            result = _repository(session).list_inbox(
                identity,
                page_size=page_size,
                cursor=cursor,
            )
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
        return result
    except HTTPException:
        raise
    except (
        InboxCursorError,
        NotificationAccountUnavailableError,
        NotificationConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.get("/me/inbox/unread-count", response_model=InboxUnreadCount)
def get_unread_count(identity: ActiveIdentity, response: Response) -> InboxUnreadCount:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Notification database is unavailable")
            result = _repository(session).unread_count(identity)
        response.headers["Cache-Control"] = "private, no-store"
        return result
    except HTTPException:
        raise
    except (NotificationAccountUnavailableError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.post("/me/inbox/{inbox_item_id}/read", response_model=InboxItem)
def mark_inbox_item_read(
    inbox_item_id: UUID,
    payload: InboxMarkCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> InboxItem:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Notification database is unavailable")
            result = _repository(session).mark_read(
                identity,
                inbox_item_id,
                payload,
                correlation_id=correlation_id,
            )
        response.headers["Cache-Control"] = "private, no-store"
        return result
    except HTTPException:
        raise
    except (
        NotificationAccountUnavailableError,
        NotificationConflictError,
        NotificationNotFoundError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.post("/me/inbox/read-all", response_model=InboxUnreadCount)
def mark_all_inbox_read(
    payload: InboxMarkCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> InboxUnreadCount:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Notification database is unavailable")
            result = _repository(session).mark_all_read(
                identity,
                payload,
                correlation_id=correlation_id,
            )
        response.headers["Cache-Control"] = "private, no-store"
        return result
    except HTTPException:
        raise
    except (
        NotificationAccountUnavailableError,
        NotificationConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.post("/me/inbox/digests", response_model=DigestBatch)
def queue_digest(
    payload: DigestQueueCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> DigestBatch:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Notification database is unavailable")
            result = _repository(session).queue_digest(
                identity,
                payload,
                correlation_id=correlation_id,
            )
        response.headers["Cache-Control"] = "private, no-store"
        return result
    except HTTPException:
        raise
    except (
        NotificationAccountUnavailableError,
        NotificationConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.get(
    "/notification/metrics",
    response_model=NotificationMetricsSnapshot,
    dependencies=[Depends(require_admin_token)],
)
def get_notification_metrics(response: Response) -> NotificationMetricsSnapshot:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=503,
                    detail="Notification database is unavailable",
                )
            result = _repository(session).metrics(
                queue_alert_depth=settings.notification_queue_alert_depth,
                queue_alert_age_seconds=settings.notification_queue_alert_age_seconds,
            )
        response.headers["Cache-Control"] = "private, no-store"
        return result
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _handle_error(error) from error


@router.post(
    "/webhooks/resend",
    response_model=NotificationWebhookReceipt,
    status_code=status.HTTP_202_ACCEPTED,
)
async def receive_resend_webhook(
    request: Request,
    correlation_id: CorrelationId,
    svix_id: Annotated[str, Header(alias="svix-id", min_length=1, max_length=500)],
    svix_timestamp: Annotated[str, Header(alias="svix-timestamp", min_length=1, max_length=32)],
    svix_signature: Annotated[
        str,
        Header(alias="svix-signature", min_length=1, max_length=4096),
    ],
) -> NotificationWebhookReceipt:
    if (
        not settings.notification_email_enabled
        or settings.notification_transport != "resend"
        or not settings.resend_webhook_secret
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    body = await request.body()
    if len(body) > _MAX_RESEND_WEBHOOK_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Webhook payload is too large",
        )
    try:
        verify_resend_webhook(
            body=body,
            message_id=svix_id,
            timestamp=svix_timestamp,
            signature_header=svix_signature,
            secret=settings.resend_webhook_secret,
        )
    except ValueError as error:
        try:
            with session_scope() as session:
                if session is not None:
                    NotificationDeliveryRepository(session).record_webhook_verification_failure(
                        provider_event_id=svix_id,
                        reason=str(error),
                        correlation_id=correlation_id,
                    )
        except SQLAlchemyError:
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        ) from error
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Notification database is unavailable")
            result = NotificationDeliveryRepository(session).receive_resend_webhook(
                body=body,
                provider_event_id=svix_id,
                correlation_id=correlation_id,
            )
        return NotificationWebhookReceipt(status=result, provider_event_id=svix_id)
    except HTTPException:
        raise
    except NotificationWebhookConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Provider event ID conflict",
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload",
        ) from error
    except SQLAlchemyError as error:
        raise _handle_error(error) from error
