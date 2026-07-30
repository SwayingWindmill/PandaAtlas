from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.exc import SQLAlchemyError

from app.activity.models import ActivityPage
from app.core.config import settings
from app.core.security import require_admin_token
from app.db.session import session_scope
from app.feed.metrics import feed_metrics
from app.feed.models import (
    FeedCursorError,
    FeedLastViewedCommand,
    FeedLastViewedState,
    FeedMetricsSnapshot,
    FeedPage,
)
from app.feed.repository import (
    FeedAccountUnavailableError,
    FeedConflictError,
    FeedRepository,
)
from app.identity.security import ActiveIdentity, resolve_correlation_id


def require_feed_enabled() -> None:
    if not settings.feed_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


router = APIRouter(dependencies=[Depends(require_feed_enabled)])
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]


def _handle_error(error: Exception) -> HTTPException:
    if isinstance(error, FeedCursorError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    if isinstance(error, FeedAccountUnavailableError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, FeedConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Feed service is unavailable",
    )


@router.get("/me/feed", response_model=FeedPage)
def get_personalized_feed(
    identity: ActiveIdentity,
    response: Response,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query(min_length=8, max_length=2048)] = None,
) -> FeedPage:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Feed database is unavailable")
            result = FeedRepository(
                session,
                cursor_signing_key=settings.feed_cursor_signing_key,
            ).list_feed(identity, page_size=page_size, cursor=cursor)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
        response.headers["X-Feed-Projection-Lag"] = str(result.projection_lag_seconds)
        response.headers["Server-Timing"] = (
            f"feed_projection_lag;dur={result.projection_lag_seconds * 1000:.3f}"
        )
        return result
    except HTTPException:
        raise
    except (
        FeedCursorError,
        FeedAccountUnavailableError,
        FeedConflictError,
        SQLAlchemyError,
    ) as error:
        feed_metrics.record_failed_page_load()
        raise _handle_error(error) from error


@router.post("/me/feed/last-viewed", response_model=FeedLastViewedState)
def mark_feed_last_viewed(
    payload: FeedLastViewedCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    response: Response,
) -> FeedLastViewedState:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Feed database is unavailable")
            result = FeedRepository(
                session,
                cursor_signing_key=settings.feed_cursor_signing_key,
            ).mark_last_viewed(identity, payload, correlation_id=correlation_id)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
        return result
    except HTTPException:
        raise
    except (FeedAccountUnavailableError, FeedConflictError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.get("/pandas/{panda_id}/activity", response_model=ActivityPage)
def get_public_panda_activity(
    panda_id: Annotated[str, Path(min_length=1, max_length=255)],
    response: Response,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
    cursor: Annotated[str | None, Query(min_length=8, max_length=2048)] = None,
) -> ActivityPage:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Activity database is unavailable")
            result = FeedRepository(
                session,
                cursor_signing_key=settings.feed_cursor_signing_key,
            ).list_public_activity(panda_id, page_size=page_size, cursor=cursor)
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
        return result
    except HTTPException:
        raise
    except (FeedCursorError, SQLAlchemyError) as error:
        feed_metrics.record_failed_page_load()
        raise _handle_error(error) from error


@router.get(
    "/feed/metrics",
    response_model=FeedMetricsSnapshot,
    dependencies=[Depends(require_admin_token)],
)
def get_feed_metrics(response: Response) -> FeedMetricsSnapshot:
    response.headers["Cache-Control"] = "private, no-store"
    return feed_metrics.snapshot()
