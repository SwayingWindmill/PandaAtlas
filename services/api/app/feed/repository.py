from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from time import perf_counter
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.activity.models import ActivityItem, ActivityPage
from app.activity.repository import ActivityRepository
from app.feed.metrics import feed_metrics
from app.feed.models import (
    FeedAttribution,
    FeedCursorError,
    FeedItem,
    FeedLastViewedCommand,
    FeedLastViewedState,
    FeedPage,
    decode_feed_cursor,
    encode_feed_cursor,
)
from app.identity.models import AccountState, RequestIdentity
from app.integration.events import AggregateReference, IntegrationEventEnvelope

_SOURCE_EVENT_TYPES = [
    "archive.activity.published",
    "archive.activity.snapshot_updated",
    "archive.activity.corrected",
    "archive.activity.retracted",
    "editorial.activity.published",
]


class FeedAccountUnavailableError(PermissionError):
    """Raised when an account is not allowed to read or mutate its Feed state."""


class FeedConflictError(RuntimeError):
    """Raised when a Feed command reuses an idempotency key with different content."""


class FeedRepository:
    def __init__(self, session: Session, *, cursor_signing_key: str) -> None:
        self.session = session
        self.cursor_signing_key = cursor_signing_key
        self.activity = ActivityRepository(session)

    def list_feed(
        self,
        identity: RequestIdentity,
        *,
        page_size: int = 20,
        cursor: str | None = None,
        now: datetime | None = None,
    ) -> FeedPage:
        self._require_active(identity)
        started = perf_counter()
        now = now or datetime.now(UTC)
        bounded_page_size = min(max(page_size, 1), 100)
        scope = f"account:{identity.account_id}"
        cursor_published_at: datetime | None = None
        cursor_activity_id: UUID | None = None
        if cursor is not None:
            try:
                cursor_published_at, cursor_activity_id = decode_feed_cursor(
                    cursor,
                    expected_scope=scope,
                    signing_key=self.cursor_signing_key,
                )
            except FeedCursorError:
                feed_metrics.record_cursor_error()
                raise

        last_viewed_at = self._last_viewed_at(identity.account_id)
        rows = self.session.execute(
            text(
                """
                with active_follows as (
                  select panda_id, followed_at
                  from engagement.follows
                  where account_id = :account_id and state = 'active'
                ),
                follow_rollup as (
                  select
                    item.activity_id,
                    bool_or(item.published_at >= followed.followed_at)
                      as relationship_attributed,
                    array_agg(distinct followed.panda_id order by followed.panda_id)
                      as followed_panda_ids
                  from activity.items item
                  join activity.targets target
                    on target.activity_id = item.activity_id
                   and target.target_type = 'panda'
                  join active_follows followed on followed.panda_id = target.target_id
                  where item.visibility = 'public'
                    and item.retraction_state <> 'corrected'
                    and item.published_at >= followed.followed_at - interval '90 days'
                  group by item.activity_id
                ),
                candidates as (
                  select activity_id from follow_rollup
                  union
                  select activity_id
                  from activity.items
                  where visibility = 'public'
                    and retraction_state <> 'corrected'
                    and sitewide
                    and pin_starts_at <= :now
                    and pin_ends_at > :now
                )
                select
                  item.*,
                  coalesce(follow_rollup.relationship_attributed, false)
                    as relationship_attributed,
                  coalesce(follow_rollup.followed_panda_ids, '{}'::text[])
                    as followed_panda_ids,
                  (
                    item.sitewide
                    and item.pin_starts_at <= :now
                    and item.pin_ends_at > :now
                  ) as is_current_pin
                from candidates
                join activity.items item using (activity_id)
                left join follow_rollup using (activity_id)
                where (
                  cast(:cursor_published_at as timestamptz) is null
                  or (item.published_at, item.activity_id) < (
                    :cursor_published_at,
                    cast(:cursor_activity_id as uuid)
                  )
                )
                order by item.published_at desc, item.activity_id desc
                limit :limit
                """
            ),
            {
                "account_id": identity.account_id,
                "now": now,
                "cursor_published_at": cursor_published_at,
                "cursor_activity_id": cursor_activity_id,
                "limit": bounded_page_size + 1,
            },
        ).mappings().all()
        visible_rows = rows[:bounded_page_size]
        activities = [
            _public_feed_activity(activity)
            for activity in self.activity.hydrate_rows(visible_rows)
        ]
        deleted_targets = self._deleted_targets(visible_rows)
        items: list[FeedItem] = []
        for row, activity in zip(visible_rows, activities, strict=True):
            followed_panda_ids = [str(value) for value in row["followed_panda_ids"]]
            if bool(row["relationship_attributed"]):
                attribution = FeedAttribution.FOLLOWED
            elif followed_panda_ids:
                attribution = FeedAttribution.HISTORY
            else:
                attribution = FeedAttribution.PINNED
            items.append(
                FeedItem(
                    activity=activity,
                    attribution=attribution,
                    followed_panda_ids=followed_panda_ids,
                    is_pinned=bool(row["is_current_pin"]),
                    is_new=last_viewed_at is None or activity.published_at > last_viewed_at,
                    deleted_target_ids=deleted_targets.get(activity.activity_id, []),
                )
            )

        next_cursor = None
        if len(rows) > bounded_page_size and items:
            last = items[-1].activity
            next_cursor = encode_feed_cursor(
                published_at=last.published_at,
                activity_id=last.activity_id,
                scope=scope,
                signing_key=self.cursor_signing_key,
            )
        projection_lag_seconds = self._projection_lag_seconds(now)
        latency_ms = (perf_counter() - started) * 1000
        feed_metrics.record_query(
            latency_ms=latency_ms,
            empty=not items,
            projection_lag_seconds=projection_lag_seconds,
        )
        return FeedPage(
            items=items,
            next_cursor=next_cursor,
            last_viewed_at=last_viewed_at,
            projection_stale=projection_lag_seconds > 0,
            projection_lag_seconds=projection_lag_seconds,
        )

    def list_public_activity(
        self,
        panda_id: str,
        *,
        page_size: int = 10,
        cursor: str | None = None,
    ) -> ActivityPage:
        bounded_page_size = min(max(page_size, 1), 50)
        scope = f"panda:{panda_id}"
        cursor_published_at: datetime | None = None
        cursor_activity_id: UUID | None = None
        if cursor is not None:
            try:
                cursor_published_at, cursor_activity_id = decode_feed_cursor(
                    cursor,
                    expected_scope=scope,
                    signing_key=self.cursor_signing_key,
                )
            except FeedCursorError:
                feed_metrics.record_cursor_error()
                raise
        rows = self.session.execute(
            text(
                """
                select distinct item.*
                from activity.items item
                join activity.targets target on target.activity_id = item.activity_id
                where target.target_type = 'panda'
                  and target.target_id = :panda_id
                  and item.visibility = 'public'
                  and item.retraction_state <> 'corrected'
                  and (
                    cast(:cursor_published_at as timestamptz) is null
                    or (item.published_at, item.activity_id) < (
                      :cursor_published_at,
                      cast(:cursor_activity_id as uuid)
                    )
                  )
                order by item.published_at desc, item.activity_id desc
                limit :limit
                """
            ),
            {
                "panda_id": panda_id,
                "cursor_published_at": cursor_published_at,
                "cursor_activity_id": cursor_activity_id,
                "limit": bounded_page_size + 1,
            },
        ).mappings().all()
        visible_rows = rows[:bounded_page_size]
        items = [
            _public_feed_activity(activity)
            for activity in self.activity.hydrate_rows(visible_rows)
        ]
        next_cursor = None
        if len(rows) > bounded_page_size and items:
            last = items[-1]
            next_cursor = encode_feed_cursor(
                published_at=last.published_at,
                activity_id=last.activity_id,
                scope=scope,
                signing_key=self.cursor_signing_key,
            )
        return ActivityPage(items=items, next_cursor=next_cursor)

    def mark_last_viewed(
        self,
        identity: RequestIdentity,
        command: FeedLastViewedCommand,
        *,
        correlation_id: UUID,
    ) -> FeedLastViewedState:
        self._require_active(identity)
        if command.viewed_through_at > datetime.now(UTC):
            raise FeedConflictError("Feed last-viewed time cannot be in the future")
        self.session.execute(
            text("select pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"feed:last-viewed:{identity.account_id}"},
        )
        subject_hash = self._subject_hash(identity.account_id)
        replay = (
            self.session.execute(
                text(
                    """
                    select viewed_through_at, state_version
                    from feed.last_viewed_events
                    where account_subject_hash = :subject_hash
                      and idempotency_key = :idempotency_key
                    """
                ),
                {
                    "subject_hash": subject_hash,
                    "idempotency_key": command.idempotency_key,
                },
            )
            .mappings()
            .one_or_none()
        )
        if replay is not None:
            if replay["viewed_through_at"] != command.viewed_through_at:
                self.session.rollback()
                raise FeedConflictError(
                    "Idempotency key was used for another mark-last-viewed command"
                )
            state = self._feed_state(identity.account_id)
            if state is None:
                self.session.rollback()
                raise FeedConflictError("Feed view event exists without account state")
            self.session.commit()
            return FeedLastViewedState.model_validate(state)

        current = self._feed_state(identity.account_id, for_update=True)
        if current is None:
            version = 1
            last_viewed_at = command.viewed_through_at
            state = (
                self.session.execute(
                    text(
                        """
                        insert into feed.account_state (
                          account_id, last_viewed_at, version, updated_at
                        ) values (:account_id, :last_viewed_at, :version, now())
                        returning account_id, last_viewed_at, version, updated_at
                        """
                    ),
                    {
                        "account_id": identity.account_id,
                        "last_viewed_at": last_viewed_at,
                        "version": version,
                    },
                )
                .mappings()
                .one()
            )
        else:
            last_viewed_at = max(current["last_viewed_at"], command.viewed_through_at)
            version = int(current["version"]) + (last_viewed_at > current["last_viewed_at"])
            state = (
                self.session.execute(
                    text(
                        """
                        update feed.account_state
                        set last_viewed_at = :last_viewed_at,
                            version = :version,
                            updated_at = now()
                        where account_id = :account_id
                        returning account_id, last_viewed_at, version, updated_at
                        """
                    ),
                    {
                        "account_id": identity.account_id,
                        "last_viewed_at": last_viewed_at,
                        "version": version,
                    },
                )
                .mappings()
                .one()
            )
        self.session.execute(
            text(
                """
                insert into feed.last_viewed_events (
                  account_subject_hash, viewed_through_at, state_version,
                  idempotency_key, correlation_id
                ) values (
                  :subject_hash, :viewed_through_at, :state_version,
                  :idempotency_key, :correlation_id
                )
                """
            ),
            {
                "subject_hash": subject_hash,
                "viewed_through_at": command.viewed_through_at,
                "state_version": int(state["version"]),
                "idempotency_key": command.idempotency_key,
                "correlation_id": correlation_id,
            },
        )
        self._insert_audit(identity, command, state, correlation_id)
        self._insert_outbox(identity, command, state, correlation_id)
        self.session.commit()
        return FeedLastViewedState.model_validate(state)

    def _last_viewed_at(self, account_id: UUID) -> datetime | None:
        return self.session.execute(
            text("select last_viewed_at from feed.account_state where account_id = :account_id"),
            {"account_id": account_id},
        ).scalar_one_or_none()

    def _feed_state(self, account_id: UUID, *, for_update: bool = False) -> Any | None:
        suffix = " for update" if for_update else ""
        return (
            self.session.execute(
                text(
                    """
                    select account_id, last_viewed_at, version, updated_at
                    from feed.account_state
                    where account_id = :account_id
                    """
                    + suffix
                ),
                {"account_id": account_id},
            )
            .mappings()
            .one_or_none()
        )

    def _deleted_targets(self, rows: list[Any]) -> dict[UUID, list[str]]:
        activity_ids = [UUID(str(row["activity_id"])) for row in rows]
        if not activity_ids:
            return {}
        result: dict[UUID, list[str]] = {activity_id: [] for activity_id in activity_ids}
        for row in self.session.execute(
            text(
                """
                select target.activity_id, target.target_id
                from activity.targets target
                left join public.pandas panda on panda.id::text = target.target_id
                where target.activity_id = any(:activity_ids)
                  and target.target_type = 'panda'
                  and panda.id is null
                order by target.activity_id, target.target_id
                """
            ),
            {"activity_ids": activity_ids},
        ).mappings():
            result[UUID(str(row["activity_id"]))].append(str(row["target_id"]))
        return result

    def _projection_lag_seconds(self, now: datetime) -> float:
        value = self.session.execute(
            text(
                """
                select coalesce(
                  extract(epoch from (:now - min(source.occurred_at))),
                  0
                )::double precision
                from integration.outbox_events source
                left join activity.projection_receipts receipt
                  on receipt.source_event_id = source.event_id
                where source.event_type = any(:event_types)
                  and receipt.source_event_id is null
                """
            ),
            {"now": now, "event_types": _SOURCE_EVENT_TYPES},
        ).scalar_one()
        return max(0.0, float(value))

    @staticmethod
    def _subject_hash(account_id: UUID) -> str:
        return hashlib.sha256(str(account_id).encode("utf-8")).hexdigest()

    @staticmethod
    def _require_active(identity: RequestIdentity) -> None:
        if identity.state is not AccountState.ACTIVE:
            raise FeedAccountUnavailableError("Feed is unavailable for this account state")

    def _insert_audit(
        self,
        identity: RequestIdentity,
        command: FeedLastViewedCommand,
        state: Any,
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into engagement.audit_events (
                  event_type, actor_account_id, subject_account_id,
                  target_type, target_id, outcome, reason, details,
                  correlation_id, idempotency_key
                ) values (
                  'feed.last_viewed.marked', :account_id, :account_id,
                  'feed_state', :account_id_text, 'marked', null,
                  cast(:details as jsonb), :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "account_id": identity.account_id,
                "account_id_text": str(identity.account_id),
                "details": json.dumps(
                    {
                        "viewed_through_at": command.viewed_through_at.isoformat(),
                        "version": int(state["version"]),
                    }
                ),
                "correlation_id": correlation_id,
                "idempotency_key": _scoped_idempotency_key(
                    identity.account_id,
                    command.idempotency_key,
                ),
            },
        )

    def _insert_outbox(
        self,
        identity: RequestIdentity,
        command: FeedLastViewedCommand,
        state: Any,
        correlation_id: UUID,
    ) -> None:
        event_id = uuid4()
        envelope = IntegrationEventEnvelope(
            event_id=event_id,
            event_type="feed.last_viewed.marked",
            source_context="feed",
            aggregate=AggregateReference(
                type="feed_state",
                id=str(identity.account_id),
                version=int(state["version"]),
            ),
            idempotency_key=_scoped_idempotency_key(
                identity.account_id,
                command.idempotency_key,
            ),
            correlation_id=correlation_id,
            occurred_at=state["updated_at"],
            payload={
                "account_id": str(identity.account_id),
                "viewed_through_at": command.viewed_through_at.isoformat(),
                "version": int(state["version"]),
            },
        )
        record = envelope.to_outbox_record()
        self.session.execute(
            text(
                """
                insert into integration.outbox_events (
                  event_id, schema_version, event_type, event_version, source_context,
                  aggregate_type, aggregate_id, aggregate_version, idempotency_key,
                  correlation_id, causation_id, occurred_at, payload
                ) values (
                  :event_id, :schema_version, :event_type, :event_version, :source_context,
                  :aggregate_type, :aggregate_id, :aggregate_version, :idempotency_key,
                  :correlation_id, :causation_id, :occurred_at, cast(:payload as jsonb)
                )
                """
            ),
            {**record, "payload": json.dumps(record["payload"])},
        )



def _scoped_idempotency_key(account_id: UUID, idempotency_key: str) -> str:
    digest = hashlib.sha256(f"{account_id}:{idempotency_key}".encode()).hexdigest()
    return f"feed-last-viewed:{digest}"


def _public_feed_activity(activity: ActivityItem) -> ActivityItem:
    if activity.retraction_state.value != "retracted":
        return activity
    provenance = activity.provenance.model_dump(mode="json")
    provenance["public_reference_ids"] = []
    return ActivityItem.model_validate(
        {
            **activity.model_dump(mode="json"),
            "localized_snapshots": [
                {
                    "locale": "zh-CN",
                    "title": "动态已撤回",
                    "summary": "原动态内容已从公开展示中移除。",
                },
                {
                    "locale": "en",
                    "title": "Activity retracted",
                    "summary": (
                        "The original Activity content was removed from public presentation."
                    ),
                },
            ],
            "media": None,
            "provenance": provenance,
            "notification_eligible": False,
        }
    )
