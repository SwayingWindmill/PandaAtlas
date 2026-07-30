from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_admin_token
from app.db.session import session_scope
from app.identity.security import ActiveIdentity, resolve_correlation_id
from app.notification.models import (
    DigestBatch,
    DigestQueueCommand,
    InboxCursorError,
    InboxItem,
    InboxMarkCommand,
    InboxPage,
    InboxUnreadCount,
    NotificationMetricsSnapshot,
)
from app.notification.repository import (
    NotificationAccountUnavailableError,
    NotificationConflictError,
    NotificationNotFoundError,
    NotificationRepository,
)


def require_notification_enabled() -> None:
    if not settings.notification_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


router = APIRouter(dependencies=[Depends(require_notification_enabled)])
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
            result = _repository(session).metrics()
        response.headers["Cache-Control"] = "private, no-store"
        return result
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _handle_error(error) from error
