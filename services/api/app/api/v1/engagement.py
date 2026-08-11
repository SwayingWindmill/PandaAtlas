from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import session_scope
from app.engagement.fan_games import FanGameRepository
from app.engagement.fan_library import FanLibraryRepository
from app.engagement.fan_memory import FanMemoryRepository
from app.engagement.models import (
    EngagementAccountUnavailableError,
    EngagementConflictError,
    EngagementNotFoundError,
    NotificationChannel,
)
from app.engagement.repository import EngagementRepository
from app.identity.models import AccountState, RequestIdentity
from app.identity.security import ActiveIdentity, get_request_identity, resolve_correlation_id
from app.notification.models import (
    NotificationCategory,
    NotificationPreferenceCommand,
)
from app.notification.models import (
    NotificationChannel as OrchestrationChannel,
)
from app.notification.repository import (
    NotificationAccountUnavailableError,
    NotificationConflictError,
    NotificationRepository,
)
from app.schemas.engagement import (
    CollectionCreate,
    CollectionDeletedRead,
    CollectionRead,
    CollectionsRead,
    CollectionUpdate,
    EngagementDataDelete,
    EngagementDataDeleteRead,
    FavoriteRead,
    FavoriteRemovedRead,
    FavoritesRead,
    FollowCommand,
    FollowRead,
    GameAttemptCreate,
    GameAttemptDeletedRead,
    GameAttemptRead,
    GameAttemptsRead,
    LocationCheckinCreate,
    LocationCheckinDeletedRead,
    LocationCheckinRead,
    LocationCheckinsRead,
    NotificationPreferenceChange,
    NotificationPreferenceRead,
    PassportEntryRead,
    PassportRead,
    PendingFollowCompletionRead,
    PendingFollowCreate,
    PendingFollowCurrentRead,
    PendingFollowHandleCommand,
    PendingFollowHandleRead,
    SeenPandaDeletedRead,
    SeenPandaRead,
    SeenPandasRead,
    SeenPandaUpsert,
)


def require_engagement_enabled() -> None:
    if not settings.engagement_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


router = APIRouter(dependencies=[Depends(require_engagement_enabled)])
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]


def _repository() -> EngagementRepository:
    raise RuntimeError("Repository dependency must be used inside session_scope")


def _follow_read(row: dict) -> FollowRead:
    return FollowRead.model_validate(row)


def _handle_error(error: Exception) -> HTTPException:
    if isinstance(error, EngagementNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if isinstance(error, EngagementAccountUnavailableError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, EngagementConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Engagement service is unavailable",
    )


@router.post(
    "/follow-intents",
    response_model=PendingFollowHandleRead,
    status_code=status.HTTP_201_CREATED,
)
def create_pending_follow_intent(
    payload: PendingFollowCreate,
    correlation_id: CorrelationId,
) -> PendingFollowHandleRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            result = EngagementRepository(
                session,
                pending_ttl_seconds=settings.pending_follow_ttl_seconds,
            ).create_pending_intent(
                panda_id=payload.panda_id,
                locale=payload.locale,
                safe_return_path=payload.return_path,
                existing_handle=payload.existing_handle,
                request_id=payload.request_id,
                correlation_id=correlation_id,
            )
            return PendingFollowHandleRead.model_validate(result, from_attributes=True)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.get("/follow-intents/current", response_model=PendingFollowCurrentRead)
def get_pending_follow_intent(
    correlation_id: CorrelationId,
    handle: Annotated[str, Header(alias="X-Pending-Follow-Handle", min_length=20, max_length=512)],
) -> PendingFollowCurrentRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = EngagementRepository(session).get_pending_intent(
                handle,
                correlation_id=correlation_id,
            )
            return PendingFollowCurrentRead.model_validate(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.post("/follow-intents/cancel", response_model=PendingFollowCurrentRead)
def cancel_pending_follow_intent(
    payload: PendingFollowHandleCommand,
    correlation_id: CorrelationId,
) -> PendingFollowCurrentRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = EngagementRepository(session).cancel_pending_intent(
                handle=payload.handle,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
            return PendingFollowCurrentRead.model_validate(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.post(
    "/me/follows/complete-pending",
    response_model=PendingFollowCompletionRead,
)
def complete_pending_follow(
    payload: PendingFollowHandleCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
) -> PendingFollowCompletionRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            result = EngagementRepository(session).complete_pending_follow(
                identity=identity,
                handle=payload.handle,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
            follow = None
            if result.follow_id is not None:
                follow = FollowRead(
                    follow_id=result.follow_id,
                    panda_id=result.panda_id,
                    state=result.follow_state,
                    first_followed_at=result.first_followed_at,
                    followed_at=result.followed_at,
                    unfollowed_at=None,
                    version=result.version,
                )
            return PendingFollowCompletionRead(
                intent_id=result.intent_id,
                panda_id=result.panda_id,
                status=result.status,
                outcome=result.outcome,
                follow=follow,
            )
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


# Direct Follow commands are not exposed; Favorite is the single saved-panda API.
def follow_panda(
    panda_id: str,
    payload: FollowCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
) -> FollowRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = EngagementRepository(session).follow(
                identity=identity,
                panda_id=panda_id,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
            return _follow_read(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


# Internal helper retained for the Favorite command path.
def unfollow_panda(
    panda_id: str,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=255)],
) -> FollowRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = EngagementRepository(session).unfollow(
                identity=identity,
                panda_id=panda_id,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
            )
            return _follow_read(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


# Internal read helper retained for repository-level diagnostics.
def get_follow(
    panda_id: str,
    identity: ActiveIdentity,
) -> FollowRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            return _follow_read(
                EngagementRepository(session).get_follow(identity.account_id, panda_id)
            )
    except HTTPException:
        raise
    except (EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.get("/me/favorites", response_model=FavoritesRead)
def list_favorites(identity: ActiveIdentity) -> FavoritesRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            rows = FanLibraryRepository(session).list_favorites(identity.account_id)
            return FavoritesRead(items=[FavoriteRead.model_validate(row) for row in rows])
    except HTTPException:
        raise
    except (EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.get("/me/favorites/{panda_id}", response_model=FavoriteRead)
def get_favorite(panda_id: str, identity: ActiveIdentity) -> FavoriteRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanLibraryRepository(session).get_favorite(identity.account_id, panda_id)
            return FavoriteRead.model_validate(row)
    except HTTPException:
        raise
    except (EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.post("/me/favorites/{panda_id}", response_model=FavoriteRead)
def favorite_panda(
    panda_id: str,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
) -> FavoriteRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanLibraryRepository(session).favorite(
                identity=identity,
                panda_id=panda_id,
                idempotency_key=f"favorite-{correlation_id}",
                correlation_id=correlation_id,
            )
            return FavoriteRead.model_validate(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.delete("/me/favorites/{panda_id}", response_model=FavoriteRemovedRead)
def unfavorite_panda(
    panda_id: str,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
) -> FavoriteRemovedRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanLibraryRepository(session).unfavorite(
                identity=identity,
                panda_id=panda_id,
                idempotency_key=f"unfavorite-{correlation_id}",
                correlation_id=correlation_id,
            )
            return FavoriteRemovedRead.model_validate(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.get("/me/collections", response_model=CollectionsRead)
def list_collections(identity: ActiveIdentity) -> CollectionsRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            rows = FanLibraryRepository(session).list_collections(identity.account_id)
            return CollectionsRead(items=[CollectionRead.model_validate(row) for row in rows])
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _handle_error(error) from error


@router.post("/me/collections", response_model=CollectionRead, status_code=status.HTTP_201_CREATED)
def create_collection(payload: CollectionCreate, identity: ActiveIdentity) -> CollectionRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanLibraryRepository(session).create_collection(
                identity=identity,
                name=payload.name,
            )
            return CollectionRead.model_validate(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.patch("/me/collections/{collection_id}", response_model=CollectionRead)
def rename_collection(
    collection_id: UUID,
    payload: CollectionUpdate,
    identity: ActiveIdentity,
) -> CollectionRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanLibraryRepository(session).rename_collection(
                identity=identity,
                collection_id=collection_id,
                name=payload.name,
            )
            return CollectionRead.model_validate(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.delete("/me/collections/{collection_id}", response_model=CollectionDeletedRead)
def delete_collection(collection_id: UUID, identity: ActiveIdentity) -> CollectionDeletedRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            deleted_id = FanLibraryRepository(session).delete_collection(
                identity=identity,
                collection_id=collection_id,
            )
            return CollectionDeletedRead(collection_id=deleted_id)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.post("/me/collections/{collection_id}/pandas/{panda_id}", response_model=CollectionRead)
def add_panda_to_collection(
    collection_id: UUID,
    panda_id: str,
    identity: ActiveIdentity,
) -> CollectionRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanLibraryRepository(session).add_panda(
                identity=identity,
                collection_id=collection_id,
                panda_id=panda_id,
            )
            return CollectionRead.model_validate(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.delete("/me/collections/{collection_id}/pandas/{panda_id}", response_model=CollectionRead)
def remove_panda_from_collection(
    collection_id: UUID,
    panda_id: str,
    identity: ActiveIdentity,
) -> CollectionRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanLibraryRepository(session).remove_panda(
                identity=identity,
                collection_id=collection_id,
                panda_id=panda_id,
            )
            return CollectionRead.model_validate(row)
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementNotFoundError,
        EngagementConflictError,
        SQLAlchemyError,
    ) as error:
        raise _handle_error(error) from error


@router.get(
    "/me/notification-preferences",
    response_model=list[NotificationPreferenceRead],
)
def list_notification_preferences(identity: ActiveIdentity) -> list[NotificationPreferenceRead]:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            rows = NotificationRepository(
                session,
                cursor_signing_key=settings.notification_cursor_signing_key,
            ).list_preferences(identity)
            return [NotificationPreferenceRead.model_validate(row.model_dump()) for row in rows]
    except HTTPException:
        raise
    except (NotificationAccountUnavailableError, SQLAlchemyError) as error:
        if isinstance(error, NotificationAccountUnavailableError):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
        raise _handle_error(error) from error


@router.put(
    "/me/notification-preferences/{category}/{channel}",
    response_model=NotificationPreferenceRead,
)
def set_notification_preference(
    category: NotificationCategory,
    channel: NotificationChannel,
    payload: NotificationPreferenceChange,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
) -> NotificationPreferenceRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            result = NotificationRepository(
                session,
                cursor_signing_key=settings.notification_cursor_signing_key,
            ).set_preference(
                identity,
                category=category,
                channel=OrchestrationChannel(channel.value),
                command=NotificationPreferenceCommand(
                    enabled=payload.enabled,
                    idempotency_key=payload.idempotency_key,
                ),
                correlation_id=correlation_id,
            )
            return NotificationPreferenceRead.model_validate(result.model_dump())
    except HTTPException:
        raise
    except (
        EngagementAccountUnavailableError,
        EngagementConflictError,
        NotificationAccountUnavailableError,
        NotificationConflictError,
        ValueError,
        SQLAlchemyError,
    ) as error:
        if isinstance(error, (NotificationConflictError, ValueError)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
        if isinstance(error, NotificationAccountUnavailableError):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
        raise _handle_error(error) from error


@router.get("/me/passport", response_model=PassportRead)
def get_passport(identity: ActiveIdentity) -> PassportRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            entries = [
                PassportEntryRead.model_validate(row)
                for row in EngagementRepository(session).get_passport(identity.account_id)
            ]
            return PassportRead(account_id=identity.account_id, entries=entries)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _handle_error(error) from error


@router.post("/me/passport/rebuild", response_model=PassportRead)
def rebuild_passport(
    payload: FollowCommand,
    identity: ActiveIdentity,
    correlation_id: CorrelationId,
) -> PassportRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            rows = EngagementRepository(session).rebuild_passport(
                identity=identity,
                idempotency_key=payload.idempotency_key,
                correlation_id=correlation_id,
            )
            return PassportRead(
                account_id=identity.account_id,
                entries=[PassportEntryRead.model_validate(row) for row in rows],
                rebuilt=True,
            )
    except HTTPException:
        raise
    except (EngagementAccountUnavailableError, EngagementConflictError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


def require_engagement_deletion_identity(
    identity: Annotated[RequestIdentity, Depends(get_request_identity)],
) -> RequestIdentity:
    if identity.state is not AccountState.DELETING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account deletion is not active"
        )
    if not identity.recent_auth:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication within the last 15 minutes is required",
        )
    return identity


DeletionIdentity = Annotated[RequestIdentity, Depends(require_engagement_deletion_identity)]


@router.get("/me/checkins", response_model=LocationCheckinsRead)
def list_checkins(identity: ActiveIdentity) -> LocationCheckinsRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            rows = FanMemoryRepository(session).list_checkins(identity.account_id)
            return LocationCheckinsRead(
                items=[LocationCheckinRead.model_validate(row) for row in rows]
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _handle_error(error) from error


@router.post("/me/checkins", response_model=LocationCheckinRead)
def create_checkin(payload: LocationCheckinCreate, identity: ActiveIdentity) -> LocationCheckinRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanMemoryRepository(session).create_checkin(
                identity=identity,
                place_id=payload.place_id,
                visited_on=payload.visited_on,
                note=payload.note,
            )
            return LocationCheckinRead.model_validate(row)
    except HTTPException:
        raise
    except (EngagementAccountUnavailableError, EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.delete("/me/checkins/{checkin_id}", response_model=LocationCheckinDeletedRead)
def delete_checkin(checkin_id: UUID, identity: ActiveIdentity) -> LocationCheckinDeletedRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            deleted_id = FanMemoryRepository(session).delete_checkin(
                identity=identity,
                checkin_id=checkin_id,
            )
            return LocationCheckinDeletedRead(checkin_id=deleted_id)
    except HTTPException:
        raise
    except (EngagementAccountUnavailableError, EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.get("/me/seen-pandas", response_model=SeenPandasRead)
def list_seen_pandas(identity: ActiveIdentity) -> SeenPandasRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            rows = FanMemoryRepository(session).list_seen_pandas(identity.account_id)
            return SeenPandasRead(items=[SeenPandaRead.model_validate(row) for row in rows])
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _handle_error(error) from error


@router.get("/me/seen-pandas/{panda_id}", response_model=SeenPandaRead)
def get_seen_panda(panda_id: str, identity: ActiveIdentity) -> SeenPandaRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanMemoryRepository(session).get_seen_panda(identity.account_id, panda_id)
            return SeenPandaRead.model_validate(row)
    except HTTPException:
        raise
    except (EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.put("/me/seen-pandas/{panda_id}", response_model=SeenPandaRead)
def save_seen_panda(
    panda_id: str,
    payload: SeenPandaUpsert,
    identity: ActiveIdentity,
) -> SeenPandaRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanMemoryRepository(session).save_seen_panda(
                identity=identity,
                panda_id=panda_id,
                seen_on=payload.seen_on,
                place_id=payload.place_id,
                note=payload.note,
            )
            return SeenPandaRead.model_validate(row)
    except HTTPException:
        raise
    except (EngagementAccountUnavailableError, EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.delete("/me/seen-pandas/{panda_id}", response_model=SeenPandaDeletedRead)
def delete_seen_panda(panda_id: str, identity: ActiveIdentity) -> SeenPandaDeletedRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            deleted_id = FanMemoryRepository(session).delete_seen_panda(
                identity=identity,
                panda_id=panda_id,
            )
            return SeenPandaDeletedRead(panda_id=deleted_id)
    except HTTPException:
        raise
    except (EngagementAccountUnavailableError, EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.get("/me/game-attempts", response_model=GameAttemptsRead)
def list_game_attempts(identity: ActiveIdentity) -> GameAttemptsRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            rows = FanGameRepository(session).list_attempts(identity.account_id)
            return GameAttemptsRead(items=[GameAttemptRead.model_validate(row) for row in rows])
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _handle_error(error) from error


@router.post(
    "/me/game-attempts",
    response_model=GameAttemptRead,
    status_code=status.HTTP_201_CREATED,
)
def save_game_attempt(payload: GameAttemptCreate, identity: ActiveIdentity) -> GameAttemptRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            row = FanGameRepository(session).save_attempt(
                identity=identity,
                target_panda_id=payload.target_panda_id,
                selected_panda_id=payload.selected_panda_id,
                public_release_version=payload.public_release_version,
            )
            return GameAttemptRead.model_validate(row)
    except HTTPException:
        raise
    except (EngagementAccountUnavailableError, EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.delete("/me/game-attempts/{attempt_id}", response_model=GameAttemptDeletedRead)
def delete_game_attempt(attempt_id: UUID, identity: ActiveIdentity) -> GameAttemptDeletedRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            deleted_id = FanGameRepository(session).delete_attempt(
                identity=identity,
                attempt_id=attempt_id,
            )
            return GameAttemptDeletedRead(attempt_id=deleted_id)
    except HTTPException:
        raise
    except (EngagementAccountUnavailableError, EngagementNotFoundError, SQLAlchemyError) as error:
        raise _handle_error(error) from error


@router.post("/me/engagement-data/delete", response_model=EngagementDataDeleteRead)
def delete_engagement_data(
    payload: EngagementDataDelete,
    identity: DeletionIdentity,
    correlation_id: CorrelationId,
) -> EngagementDataDeleteRead:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(status_code=503, detail="Engagement database is unavailable")
            result = EngagementRepository(session).delete_private_data(
                identity=identity,
                idempotency_key=payload.idempotency_key,
                reason=payload.reason,
                correlation_id=correlation_id,
            )
            return EngagementDataDeleteRead.model_validate(result)
    except HTTPException:
        raise
    except (EngagementAccountUnavailableError, EngagementConflictError, SQLAlchemyError) as error:
        raise _handle_error(error) from error
