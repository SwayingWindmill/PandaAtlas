from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.activity.models import (
    ActivityAction,
    ActivityConflictError,
    ActivityItem,
    ActivityPage,
    ActivityProjectionMetrics,
    ActivityProjectionResult,
    ActivityRebuildResult,
    ActivitySourceEvent,
    ActivitySourceNotFoundError,
    EditorialAnnouncementCommand,
    ProjectionOutcome,
    activity_id_for,
    decode_activity_cursor,
    encode_activity_cursor,
)
from app.activity.validation import validate_public_activity_dependencies
from app.identity.models import AccountState, RequestIdentity
from app.integration.events import AggregateReference, IntegrationEventEnvelope

_SOURCE_EVENT_TYPES = frozenset(
    {
        "archive.activity.published",
        "archive.activity.snapshot_updated",
        "archive.activity.corrected",
        "archive.activity.retracted",
        "editorial.activity.published",
    }
)


class ActivityRepository:
    """Own Activity projection, rebuild, editorial publication, and base public ordering."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def project(self, event: ActivitySourceEvent) -> ActivityProjectionResult:
        try:
            result = self._project(event, emit_downstream=not event.is_backfill)
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise
        return result

    def project_outbox_event(self, source_event_id: UUID) -> ActivityProjectionResult:
        row = (
            self.session.execute(
                text(
                    """
                    select event_type, payload
                    from integration.outbox_events
                    where event_id = :event_id
                    """
                ),
                {"event_id": source_event_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ActivitySourceNotFoundError("Activity source event was not found")
        event_type = str(row["event_type"])
        if event_type not in _SOURCE_EVENT_TYPES:
            raise ActivityConflictError("Outbox event is not an Activity source event")
        try:
            event = ActivitySourceEvent.model_validate(_json_value(row["payload"]))
            return self.project(event)
        except (ActivityConflictError, ActivitySourceNotFoundError, ValidationError) as error:
            self.session.rollback()
            self.session.execute(
                text(
                    """
                    insert into activity.projection_failures (
                      source_event_id, event_type, error_code
                    ) values (:source_event_id, :event_type, :error_code)
                    """
                ),
                {
                    "source_event_id": source_event_id,
                    "event_type": event_type,
                    "error_code": type(error).__name__,
                },
            )
            self.session.commit()
            raise

    def publish_editorial(
        self,
        command: EditorialAnnouncementCommand,
        actor: RequestIdentity,
    ) -> ActivityProjectionResult:
        if actor.state != AccountState.ACTIVE:
            raise PermissionError("Only active accounts may publish editorial Activity")
        if not actor.has_capability("activity.editorial.publish"):
            raise PermissionError("Editorial Activity publication capability is required")
        if command.sitewide and not actor.has_capability("activity.sitewide.publish"):
            raise PermissionError("Sitewide Activity publication capability is required")
        if command.pin is not None and not actor.has_capability("activity.pin.manage"):
            raise PermissionError("Activity pin capability is required")

        command_payload_sha256 = _editorial_command_sha256(command)
        self._lock_source("editorial.command", str(command.command_id))
        existing = (
            self.session.execute(
                text(
                    """
                    select source_event_id, actor_account_id, command_payload_sha256
                    from activity.editorial_announcements
                    where command_id = :command_id
                    """
                ),
                {"command_id": command.command_id},
            )
            .mappings()
            .one_or_none()
        )
        if existing is not None:
            if UUID(str(existing["actor_account_id"])) != actor.account_id:
                self.session.rollback()
                raise ActivityConflictError("Editorial command belongs to a different actor")
            if existing["command_payload_sha256"] != command_payload_sha256:
                self.session.rollback()
                raise ActivityConflictError("Editorial command payload changed after publication")
            receipt = self._receipt_for_event(UUID(str(existing["source_event_id"])))
            if receipt is None:
                self.session.rollback()
                raise ActivityConflictError("Editorial command exists without projection receipt")
            self.session.commit()
            return ActivityProjectionResult(
                outcome=ProjectionOutcome.DUPLICATE,
                activity_id=UUID(str(receipt["activity_id"])),
                source_event_id=UUID(str(existing["source_event_id"])),
            )

        try:
            validate_public_activity_dependencies(self.session, [command])
        except ActivityConflictError:
            self.session.rollback()
            raise
        self._lock_source("editorial.announcement", command.source_id)
        if command.pin is not None:
            self._ensure_pin_capacity(command)
        source_version = int(
            self.session.execute(
                text(
                    """
                    select coalesce(max(source_version), 0) + 1
                    from activity.editorial_announcements
                    where source_id = :source_id
                    """
                ),
                {"source_id": command.source_id},
            ).scalar_one()
        )
        source_event_id = uuid4()
        published_at = datetime.now(UTC)
        event = ActivitySourceEvent.model_validate(
            {
                **command.model_dump(mode="json", exclude={"command_id", "reason"}),
                "event_id": source_event_id,
                "source_type": "editorial.announcement",
                "source_version": source_version,
                "action": ActivityAction.PUBLISH,
                "published_at": published_at,
                "causation_id": command.command_id,
                "is_backfill": False,
            }
        )
        self.session.execute(
            text(
                """
                insert into activity.editorial_announcements (
                  command_id, source_id, source_version, source_event_id,
                  actor_account_id, correlation_id, reason, command_payload_sha256,
                  public_content, published_at
                ) values (
                  :command_id, :source_id, :source_version, :source_event_id,
                  :actor_account_id, :correlation_id, :reason, :command_payload_sha256,
                  cast(:public_content as jsonb), :published_at
                )
                """
            ),
            {
                "command_id": command.command_id,
                "source_id": command.source_id,
                "source_version": source_version,
                "source_event_id": source_event_id,
                "actor_account_id": actor.account_id,
                "correlation_id": command.correlation_id,
                "reason": command.reason,
                "command_payload_sha256": command_payload_sha256,
                "public_content": json.dumps(event.model_dump(mode="json")),
                "published_at": published_at,
            },
        )
        self._insert_source_outbox("editorial.activity.published", event)
        self._audit_editorial(command, actor, source_event_id)
        result = self._project(event, emit_downstream=True)
        self.session.commit()
        return result

    def rebuild(self, *, mark_as_backfill: bool = False) -> ActivityRebuildResult:
        rows = self.session.execute(
            text(
                """
                select event_id, payload
                from integration.outbox_events
                where event_type = any(:event_types)
                order by
                  aggregate_type,
                  aggregate_id,
                  aggregate_version,
                  occurred_at,
                  created_at,
                  event_id
                """
            ),
            {"event_types": list(_SOURCE_EVENT_TYPES)},
        ).mappings().all()
        events = []
        for row in rows:
            event = ActivitySourceEvent.model_validate(_json_value(row["payload"]))
            if mark_as_backfill:
                event = event.model_copy(update={"is_backfill": True})
            events.append(event)

        self.session.execute(
            text(
                """
                truncate table
                  activity.targets,
                  activity.projection_receipts,
                  activity.items
                """
            )
        )
        counts: Counter[ProjectionOutcome] = Counter()
        for event in events:
            result = self._project(event, emit_downstream=False)
            counts[result.outcome] += 1
        self.session.commit()
        return ActivityRebuildResult(
            source_events=len(events),
            created_items=counts[ProjectionOutcome.CREATED],
            updated_items=counts[ProjectionOutcome.UPDATED],
            corrected_items=counts[ProjectionOutcome.CORRECTED],
            retracted_items=counts[ProjectionOutcome.RETRACTED],
        )

    def list_public(self, *, page_size: int = 20, cursor: str | None = None) -> ActivityPage:
        bounded_page_size = min(max(page_size, 1), 100)
        cursor_published_at: datetime | None = None
        cursor_activity_id: UUID | None = None
        if cursor is not None:
            cursor_published_at, cursor_activity_id = decode_activity_cursor(cursor)
        rows = self.session.execute(
            text(
                """
                select *
                from activity.items
                where visibility = 'public'
                  and retraction_state = 'active'
                  and (
                    cast(:cursor_published_at as timestamptz) is null
                    or (published_at, activity_id) < (
                      :cursor_published_at,
                      cast(:cursor_activity_id as uuid)
                    )
                  )
                order by published_at desc, activity_id desc
                limit :limit
                """
            ),
            {
                "cursor_published_at": cursor_published_at,
                "cursor_activity_id": cursor_activity_id,
                "limit": bounded_page_size + 1,
            },
        ).mappings().all()
        visible_rows = rows[:bounded_page_size]
        targets_by_activity = self._targets_for_rows(visible_rows)
        items = [
            self._item_from_row(row, targets_by_activity.get(UUID(str(row["activity_id"])), []))
            for row in visible_rows
        ]
        next_cursor = None
        if len(rows) > bounded_page_size and items:
            last = items[-1]
            next_cursor = encode_activity_cursor(last.published_at, last.activity_id)
        return ActivityPage(items=items, next_cursor=next_cursor)

    def metrics(self) -> ActivityProjectionMetrics:
        row = self.session.execute(
            text(
                """
                select
                  count(*) filter (where outcome <> 'duplicate')::integer
                    as projected_events,
                  (
                    coalesce(sum(replay_count), 0)
                    + count(*) filter (where outcome = 'duplicate')
                  )::integer as replayed_events,
                  count(*) filter (
                    where is_backfill and outcome <> 'duplicate'
                  )::integer as backfilled_events,
                  coalesce(max(projection_lag_seconds), 0)::double precision
                    as maximum_projection_lag_seconds
                from activity.projection_receipts
                """
            )
        ).mappings().one()
        failure_count = int(
            self.session.execute(
                text(
                    "select count(distinct source_event_id) from activity.projection_failures"
                )
            ).scalar_one()
        )
        event_counts = {
            str(result[0]): int(result[1])
            for result in self.session.execute(
                text(
                    """
                    select activity_type, count(*)
                    from activity.projection_receipts
                    where outcome <> 'duplicate'
                    group by activity_type
                    order by activity_type
                    """
                )
            ).all()
        }
        return ActivityProjectionMetrics(
            projected_events=int(row["projected_events"]),
            replayed_events=int(row["replayed_events"]),
            backfilled_events=int(row["backfilled_events"]),
            failed_events=failure_count,
            maximum_projection_lag_seconds=float(row["maximum_projection_lag_seconds"]),
            event_type_counts=event_counts,
        )

    def _project(
        self,
        event: ActivitySourceEvent,
        *,
        emit_downstream: bool,
    ) -> ActivityProjectionResult:
        self._lock_source(event.source_type, event.source_id)
        payload_sha256 = _source_payload_sha256(event)
        existing_receipt = self._receipt_for_event(event.event_id)
        if existing_receipt is not None:
            if existing_receipt["source_payload_sha256"] != payload_sha256:
                raise ActivityConflictError("Activity event payload changed after consumption")
            self.session.execute(
                text(
                    """
                    update activity.projection_receipts
                    set replay_count = replay_count + 1
                    where source_event_id = :source_event_id
                    """
                ),
                {"source_event_id": event.event_id},
            )
            return ActivityProjectionResult(
                outcome=ProjectionOutcome.DUPLICATE,
                activity_id=UUID(str(existing_receipt["activity_id"])),
                source_event_id=event.event_id,
            )

        canonical_receipt = (
            self.session.execute(
                text(
                    """
                    select source_event_id, activity_id, outcome, source_payload_sha256
                    from activity.projection_receipts
                    where source_type = :source_type
                      and source_id = :source_id
                      and source_version = :source_version
                      and action = :action
                      and outcome <> 'duplicate'
                    for update
                    """
                ),
                {
                    "source_type": event.source_type,
                    "source_id": event.source_id,
                    "source_version": event.source_version,
                    "action": event.action.value,
                },
            )
            .mappings()
            .one_or_none()
        )
        if canonical_receipt is not None:
            if canonical_receipt["source_payload_sha256"] != payload_sha256:
                raise ActivityConflictError(
                    "Activity source version was reused with different public content"
                )
            self._insert_duplicate_receipt(
                event,
                canonical_source_event_id=UUID(str(canonical_receipt["source_event_id"])),
                activity_id=UUID(str(canonical_receipt["activity_id"])),
                payload_sha256=payload_sha256,
            )
            return ActivityProjectionResult(
                outcome=ProjectionOutcome.DUPLICATE,
                activity_id=UUID(str(canonical_receipt["activity_id"])),
                source_event_id=event.event_id,
            )

        latest = self._latest_source_item(event.source_type, event.source_id)
        if event.action == ActivityAction.PUBLISH:
            if latest is not None:
                raise ActivityConflictError("publish requires a new Activity source")
            activity_id = self._insert_item(event)
            outcome = ProjectionOutcome.CREATED
        else:
            if latest is None:
                raise ActivitySourceNotFoundError(
                    f"{event.action.value} requires an existing Activity source"
                )
            if event.source_version <= int(latest["source_version"]):
                raise ActivityConflictError("Activity source versions must increase monotonically")
            if event.action == ActivityAction.SNAPSHOT_UPDATE:
                activity_id = UUID(str(latest["activity_id"]))
                self._update_item(activity_id, event)
                outcome = ProjectionOutcome.UPDATED
            elif event.action == ActivityAction.CORRECTION:
                activity_id = self._insert_item(event)
                self.session.execute(
                    text(
                        """
                        update activity.items
                        set retraction_state = 'corrected',
                            correction_activity_id = :correction_activity_id,
                            updated_at = :updated_at
                        where activity_id = :activity_id
                        """
                    ),
                    {
                        "correction_activity_id": activity_id,
                        "updated_at": event.published_at,
                        "activity_id": latest["activity_id"],
                    },
                )
                outcome = ProjectionOutcome.CORRECTED
            else:
                activity_id = UUID(str(latest["activity_id"]))
                self.session.execute(
                    text(
                        """
                        update activity.items
                        set source_version = :source_version,
                            source_event_id = :source_event_id,
                            retraction_state = 'retracted',
                            retracted_at = :retracted_at,
                            retraction_reason = :retraction_reason,
                            updated_at = :updated_at
                        where activity_id = :activity_id
                        """
                    ),
                    {
                        "source_version": event.source_version,
                        "source_event_id": event.event_id,
                        "retracted_at": event.published_at,
                        "retraction_reason": event.retraction_reason,
                        "updated_at": event.published_at,
                        "activity_id": activity_id,
                    },
                )
                outcome = ProjectionOutcome.RETRACTED

        projected_at = datetime.now(UTC)
        lag_seconds = max(0.0, (projected_at - event.published_at).total_seconds())
        self.session.execute(
            text(
                """
                insert into activity.projection_receipts (
                  source_event_id, canonical_source_event_id,
                  source_type, source_id, source_version,
                  action, activity_type, activity_id, outcome, source_payload_sha256,
                  source_published_at, projected_at, projection_lag_seconds, is_backfill
                ) values (
                  :source_event_id, null,
                  :source_type, :source_id, :source_version,
                  :action, :activity_type, :activity_id, :outcome, :source_payload_sha256,
                  :source_published_at, :projected_at, :projection_lag_seconds, :is_backfill
                )
                """
            ),
            {
                "source_event_id": event.event_id,
                "source_type": event.source_type,
                "source_id": event.source_id,
                "source_version": event.source_version,
                "action": event.action.value,
                "activity_type": event.activity_type.value,
                "activity_id": activity_id,
                "outcome": outcome.value,
                "source_payload_sha256": payload_sha256,
                "source_published_at": event.published_at,
                "projected_at": projected_at,
                "projection_lag_seconds": lag_seconds,
                "is_backfill": event.is_backfill,
            },
        )
        if emit_downstream:
            self._emit_downstream(event, activity_id, outcome)
        return ActivityProjectionResult(
            outcome=outcome,
            activity_id=activity_id,
            source_event_id=event.event_id,
        )

    def _insert_item(self, event: ActivitySourceEvent) -> UUID:
        activity_id = activity_id_for(event)
        pin = event.pin
        self.session.execute(
            text(
                """
                insert into activity.items (
                  activity_id, source_type, source_id, source_version, source_event_id,
                  activity_type, importance, importance_override_reason, visibility,
                  sitewide, notification_eligible, occurred_at, occurred_precision,
                  occurred_end_at, published_at, updated_at, localization_key,
                  localization_version, localized_snapshots, media, provenance,
                  pin_starts_at, pin_ends_at, pin_reason, is_backfill
                ) values (
                  :activity_id, :source_type, :source_id, :source_version, :source_event_id,
                  :activity_type, :importance, :importance_override_reason, :visibility,
                  :sitewide, :notification_eligible, :occurred_at, :occurred_precision,
                  :occurred_end_at, :published_at, :updated_at, :localization_key,
                  :localization_version, cast(:localized_snapshots as jsonb),
                  cast(:media as jsonb), cast(:provenance as jsonb),
                  :pin_starts_at, :pin_ends_at, :pin_reason, :is_backfill
                )
                """
            ),
            self._item_parameters(activity_id, event, pin),
        )
        self._replace_targets(activity_id, event)
        return activity_id

    def _update_item(self, activity_id: UUID, event: ActivitySourceEvent) -> None:
        pin = event.pin
        parameters = self._item_parameters(activity_id, event, pin)
        self.session.execute(
            text(
                """
                update activity.items
                set source_version = :source_version,
                    source_event_id = :source_event_id,
                    activity_type = :activity_type,
                    importance = :importance,
                    importance_override_reason = :importance_override_reason,
                    visibility = :visibility,
                    sitewide = :sitewide,
                    notification_eligible = :notification_eligible,
                    occurred_at = :occurred_at,
                    occurred_precision = :occurred_precision,
                    occurred_end_at = :occurred_end_at,
                    updated_at = :updated_at,
                    localization_key = :localization_key,
                    localization_version = :localization_version,
                    localized_snapshots = cast(:localized_snapshots as jsonb),
                    media = cast(:media as jsonb),
                    provenance = cast(:provenance as jsonb),
                    pin_starts_at = :pin_starts_at,
                    pin_ends_at = :pin_ends_at,
                    pin_reason = :pin_reason,
                    is_backfill = :is_backfill
                where activity_id = :activity_id
                """
            ),
            parameters,
        )
        self._replace_targets(activity_id, event)

    def _item_parameters(
        self,
        activity_id: UUID,
        event: ActivitySourceEvent,
        pin: object,
    ) -> dict[str, object]:
        pin_starts_at = getattr(pin, "starts_at", None)
        pin_ends_at = getattr(pin, "ends_at", None)
        pin_reason = getattr(pin, "reason", None)
        return {
            "activity_id": activity_id,
            "source_type": event.source_type,
            "source_id": event.source_id,
            "source_version": event.source_version,
            "source_event_id": event.event_id,
            "activity_type": event.activity_type.value,
            "importance": event.effective_importance.value,
            "importance_override_reason": event.importance_override_reason,
            "visibility": event.visibility.value,
            "sitewide": event.sitewide,
            "notification_eligible": event.notification_eligible,
            "occurred_at": event.occurred_at,
            "occurred_precision": event.occurred_precision.value,
            "occurred_end_at": event.occurred_end_at,
            "published_at": event.published_at,
            "updated_at": event.published_at,
            "localization_key": event.localization_key,
            "localization_version": event.localization_version,
            "localized_snapshots": json.dumps(
                [snapshot.model_dump(mode="json") for snapshot in event.localized_snapshots]
            ),
            "media": json.dumps(event.media.model_dump(mode="json")) if event.media else None,
            "provenance": json.dumps(event.provenance.model_dump(mode="json")),
            "pin_starts_at": pin_starts_at,
            "pin_ends_at": pin_ends_at,
            "pin_reason": pin_reason,
            "is_backfill": event.is_backfill,
        }

    def _replace_targets(self, activity_id: UUID, event: ActivitySourceEvent) -> None:
        self.session.execute(
            text("delete from activity.targets where activity_id = :activity_id"),
            {"activity_id": activity_id},
        )
        for target in event.targets:
            self.session.execute(
                text(
                    """
                    insert into activity.targets (activity_id, target_type, target_id)
                    values (:activity_id, :target_type, :target_id)
                    """
                ),
                {
                    "activity_id": activity_id,
                    "target_type": target.target_type,
                    "target_id": target.target_id,
                },
            )

    def _ensure_pin_capacity(self, command: EditorialAnnouncementCommand) -> None:
        pin = command.pin
        if pin is None:
            return
        self._lock_source("activity.pin-capacity", "global")
        overlapping_pins = int(
            self.session.execute(
                text(
                    """
                    select count(*)
                    from activity.items
                    where retraction_state = 'active'
                      and pin_starts_at is not null
                      and tstzrange(pin_starts_at, pin_ends_at, '[)')
                        && tstzrange(:starts_at, :ends_at, '[)')
                    """
                ),
                {"starts_at": pin.starts_at, "ends_at": pin.ends_at},
            ).scalar_one()
        )
        if overlapping_pins >= 3:
            self.session.rollback()
            raise ActivityConflictError("At most three Activity pins may overlap")

    def _lock_source(self, source_type: str, source_id: str) -> None:
        self.session.execute(
            text("select pg_advisory_xact_lock(hashtextextended(:source_key, 0))"),
            {"source_key": f"{source_type}:{source_id}"},
        )

    def _insert_duplicate_receipt(
        self,
        event: ActivitySourceEvent,
        *,
        canonical_source_event_id: UUID,
        activity_id: UUID,
        payload_sha256: str,
    ) -> None:
        projected_at = datetime.now(UTC)
        lag_seconds = max(0.0, (projected_at - event.published_at).total_seconds())
        self.session.execute(
            text(
                """
                insert into activity.projection_receipts (
                  source_event_id, canonical_source_event_id,
                  source_type, source_id, source_version,
                  action, activity_type, activity_id, outcome, source_payload_sha256,
                  source_published_at, projected_at, projection_lag_seconds, is_backfill
                ) values (
                  :source_event_id, :canonical_source_event_id,
                  :source_type, :source_id, :source_version,
                  :action, :activity_type, :activity_id, 'duplicate', :source_payload_sha256,
                  :source_published_at, :projected_at, :projection_lag_seconds, :is_backfill
                )
                """
            ),
            {
                "source_event_id": event.event_id,
                "canonical_source_event_id": canonical_source_event_id,
                "source_type": event.source_type,
                "source_id": event.source_id,
                "source_version": event.source_version,
                "action": event.action.value,
                "activity_type": event.activity_type.value,
                "activity_id": activity_id,
                "source_payload_sha256": payload_sha256,
                "source_published_at": event.published_at,
                "projected_at": projected_at,
                "projection_lag_seconds": lag_seconds,
                "is_backfill": event.is_backfill,
            },
        )

    def _receipt_for_event(self, source_event_id: UUID) -> Any | None:
        return (
            self.session.execute(
                text(
                    """
                    select source_event_id, activity_id, outcome, source_payload_sha256
                    from activity.projection_receipts
                    where source_event_id = :source_event_id
                    for update
                    """
                ),
                {"source_event_id": source_event_id},
            )
            .mappings()
            .one_or_none()
        )

    def _latest_source_item(self, source_type: str, source_id: str) -> Any | None:
        return (
            self.session.execute(
                text(
                    """
                    select activity_id, source_version, retraction_state
                    from activity.items
                    where source_type = :source_type and source_id = :source_id
                    order by source_version desc
                    limit 1
                    for update
                    """
                ),
                {"source_type": source_type, "source_id": source_id},
            )
            .mappings()
            .one_or_none()
        )

    def _targets_for_rows(self, rows: list[Any]) -> dict[UUID, list[dict[str, str]]]:
        activity_ids = [UUID(str(row["activity_id"])) for row in rows]
        if not activity_ids:
            return {}
        targets: dict[UUID, list[dict[str, str]]] = {
            activity_id: [] for activity_id in activity_ids
        }
        for row in self.session.execute(
            text(
                """
                select activity_id, target_type, target_id
                from activity.targets
                where activity_id = any(:activity_ids)
                order by activity_id, target_type, target_id
                """
            ),
            {"activity_ids": activity_ids},
        ).mappings():
            targets[UUID(str(row["activity_id"]))].append(
                {"target_type": str(row["target_type"]), "target_id": str(row["target_id"])}
            )
        return targets

    def _item_from_row(self, row: Any, targets: list[dict[str, str]]) -> ActivityItem:
        pin = None
        if row["pin_starts_at"] is not None:
            pin = {
                "starts_at": row["pin_starts_at"],
                "ends_at": row["pin_ends_at"],
                "reason": row["pin_reason"],
            }
        return ActivityItem.model_validate(
            {
                "activity_id": row["activity_id"],
                "source_type": row["source_type"],
                "source_id": row["source_id"],
                "source_version": row["source_version"],
                "source_event_id": row["source_event_id"],
                "activity_type": row["activity_type"],
                "targets": targets,
                "importance": row["importance"],
                "importance_override_reason": row["importance_override_reason"],
                "visibility": row["visibility"],
                "sitewide": row["sitewide"],
                "notification_eligible": row["notification_eligible"],
                "occurred_at": row["occurred_at"],
                "occurred_precision": row["occurred_precision"],
                "occurred_end_at": row["occurred_end_at"],
                "published_at": row["published_at"],
                "updated_at": row["updated_at"],
                "localization_key": row["localization_key"],
                "localization_version": row["localization_version"],
                "localized_snapshots": _json_value(row["localized_snapshots"]),
                "media": _json_value(row["media"]) if row["media"] is not None else None,
                "provenance": _json_value(row["provenance"]),
                "pin": pin,
                "retraction_state": row["retraction_state"],
                "retracted_at": row["retracted_at"],
                "retraction_reason": row["retraction_reason"],
                "correction_activity_id": row["correction_activity_id"],
                "is_backfill": row["is_backfill"],
            }
        )

    def _insert_source_outbox(self, event_type: str, event: ActivitySourceEvent) -> None:
        envelope = IntegrationEventEnvelope(
            event_id=event.event_id,
            event_type=event_type,
            source_context="activity",
            aggregate=AggregateReference(
                type="editorial_announcement",
                id=event.source_id,
                version=event.source_version,
            ),
            idempotency_key=f"{event.source_id}:{event.source_version}:{event.action.value}",
            correlation_id=event.correlation_id,
            causation_id=event.causation_id,
            occurred_at=event.published_at,
            payload=event.model_dump(mode="json"),
        )
        self._insert_outbox(envelope)

    def _emit_downstream(
        self,
        event: ActivitySourceEvent,
        activity_id: UUID,
        outcome: ProjectionOutcome,
    ) -> None:
        event_type = {
            ProjectionOutcome.CREATED: "activity.item.published",
            ProjectionOutcome.UPDATED: "activity.item.updated",
            ProjectionOutcome.CORRECTED: "activity.item.corrected",
            ProjectionOutcome.RETRACTED: "activity.item.retracted",
        }[outcome]
        envelope = IntegrationEventEnvelope(
            event_type=event_type,
            source_context="activity",
            aggregate=AggregateReference(
                type="activity_item",
                id=str(activity_id),
                version=event.source_version,
            ),
            idempotency_key=f"activity:{event.event_id}:{outcome.value}",
            correlation_id=event.correlation_id,
            causation_id=event.event_id,
            occurred_at=datetime.now(UTC),
            payload={
                "activity_id": str(activity_id),
                "activity_type": event.activity_type.value,
                "target_panda_ids": [
                    target.target_id for target in event.targets if target.target_type == "panda"
                ],
                "target_institution_ids": [
                    target.target_id
                    for target in event.targets
                    if target.target_type == "institution"
                ],
                "importance": event.effective_importance.value,
                "visibility": event.visibility.value,
                "sitewide": event.sitewide,
                "notification_eligible": event.notification_eligible,
                "published_at": event.published_at.isoformat(),
                "is_backfill": event.is_backfill,
                "outcome": outcome.value,
            },
        )
        self._insert_outbox(envelope)

    def _insert_outbox(self, envelope: IntegrationEventEnvelope) -> None:
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

    def _audit_editorial(
        self,
        command: EditorialAnnouncementCommand,
        actor: RequestIdentity,
        source_event_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into activity.audit_events (
                  event_type, actor_account_id, target_type, target_id,
                  reason, details, correlation_id
                ) values (
                  'editorial.announcement.published', :actor_account_id,
                  'editorial_announcement', :target_id, :reason,
                  cast(:details as jsonb), :correlation_id
                )
                """
            ),
            {
                "actor_account_id": actor.account_id,
                "target_id": command.source_id,
                "reason": command.reason,
                "details": json.dumps(
                    {
                        "source_event_id": str(source_event_id),
                        "importance": command.effective_importance.value,
                        "importance_override_reason": command.importance_override_reason,
                        "sitewide": command.sitewide,
                        "pin": command.pin.model_dump(mode="json") if command.pin else None,
                    }
                ),
                "correlation_id": command.correlation_id,
            },
        )


def _editorial_command_sha256(command: EditorialAnnouncementCommand) -> str:
    payload = json.dumps(
        command.model_dump(mode="json"),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _source_payload_sha256(event: ActivitySourceEvent) -> str:
    payload = json.dumps(
        event.model_dump(mode="json", exclude={"event_id", "is_backfill"}),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _json_value(value: object) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value
