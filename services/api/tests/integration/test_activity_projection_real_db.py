from __future__ import annotations

import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text

from app.activity.models import (
    ActivityAction,
    ActivityConflictError,
    ActivitySourceEvent,
    ActivityType,
    EditorialAnnouncementCommand,
    ProjectionOutcome,
)
from app.activity.repository import ActivityRepository
from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.integration.events import AggregateReference, IntegrationEventEnvelope
from app.schemas.publication import (
    ChangeSetCreate,
    ChangeSetReview,
    PublicationBatchCreate,
)
from app.services.publication_service import (
    create_change_set,
    create_publication_batch,
    publish_batch,
    review_change_set,
    submit_change_set,
)

_ACTIVITY_OUTBOX_EVENT_TYPES = [
    "archive.activity.published",
    "archive.activity.snapshot_updated",
    "archive.activity.corrected",
    "archive.activity.retracted",
    "editorial.activity.published",
    "activity.item.published",
    "activity.item.updated",
    "activity.item.corrected",
    "activity.item.retracted",
]


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run Activity database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def clean_activity_state(real_db_url: str) -> Iterator[None]:
    _ = real_db_url

    def clear() -> None:
        with session_scope() as session:
            assert session is not None
            session.execute(
                text(
                    """
                    truncate table
                      activity.targets,
                      activity.projection_receipts,
                      activity.items,
                      activity.projection_failures,
                      activity.editorial_announcements,
                      activity.audit_events
                    """
                )
            )
            session.execute(
                text(
                    """
                    delete from integration.outbox_events
                    where event_type = any(:event_types)
                    """
                ),
                {"event_types": _ACTIVITY_OUTBOX_EVENT_TYPES},
            )
            session.commit()

    clear()
    try:
        yield
    finally:
        clear()


def _request_identity(account_id: UUID, *capabilities: str) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=f"activity-{account_id}@example.invalid",
        session_id="activity-real-db-test",
        state=AccountState.ACTIVE,
        roles=frozenset({"editorial_publisher"}),
        capabilities=frozenset(capabilities),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def _event(
    *,
    correlation_id: UUID,
    version: int,
    action: ActivityAction,
    published_at: datetime,
) -> ActivitySourceEvent:
    activity_type = (
        ActivityType.ARCHIVE_PROFILE_CORRECTED
        if action is ActivityAction.CORRECTION
        else ActivityType.PANDA_BIRTH
    )
    values: dict[str, object] = {
        "event_id": uuid4(),
        "source_type": "archive.release",
        "source_id": "test:panda-activity:birth",
        "source_version": version,
        "action": action,
        "activity_type": activity_type,
        "targets": [{"target_type": "panda", "target_id": "test-panda"}],
        "occurred_at": datetime(2026, 7, 1, 8, 0, tzinfo=UTC),
        "published_at": published_at,
        "localization_key": (
            "activity.archive.profile_corrected"
            if action is ActivityAction.CORRECTION
            else "activity.panda.birth"
        ),
        "localization_version": version,
        "localized_snapshots": [
            {
                "locale": "zh-CN",
                "title": f"动态版本 {version}",
                "summary": f"公开安全动态版本 {version}。",
            },
            {
                "locale": "en",
                "title": f"Activity version {version}",
                "summary": f"Public-safe Activity version {version}.",
            },
        ],
        "correlation_id": correlation_id,
    }
    if action is ActivityAction.RETRACTION:
        values["retraction_reason"] = "The source release was withdrawn."
    return ActivitySourceEvent.model_validate(values)


def _insert_source_event(session: object, event: ActivitySourceEvent) -> None:
    event_type = {
        ActivityAction.PUBLISH: "archive.activity.published",
        ActivityAction.SNAPSHOT_UPDATE: "archive.activity.snapshot_updated",
        ActivityAction.CORRECTION: "archive.activity.corrected",
        ActivityAction.RETRACTION: "archive.activity.retracted",
    }[event.action]
    envelope = IntegrationEventEnvelope(
        event_id=event.event_id,
        event_type=event_type,
        source_context="archive",
        aggregate=AggregateReference(
            type="activity_source", id=event.source_id, version=event.source_version
        ),
        idempotency_key=f"test:{event.event_id}",
        correlation_id=event.correlation_id,
        occurred_at=event.published_at,
        payload=event.model_dump(mode="json"),
    )
    record = envelope.to_outbox_record()
    session.execute(
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
    session.commit()


def test_activity_projection_lifecycle_and_rebuild(real_db_url: str) -> None:
    correlation_id = uuid4()
    published_at = datetime.now(UTC) - timedelta(minutes=1)
    events = [
        _event(
            correlation_id=correlation_id,
            version=1,
            action=ActivityAction.PUBLISH,
            published_at=published_at,
        ),
        _event(
            correlation_id=correlation_id,
            version=2,
            action=ActivityAction.SNAPSHOT_UPDATE,
            published_at=published_at + timedelta(seconds=10),
        ),
        _event(
            correlation_id=correlation_id,
            version=3,
            action=ActivityAction.CORRECTION,
            published_at=published_at + timedelta(seconds=20),
        ),
        _event(
            correlation_id=correlation_id,
            version=4,
            action=ActivityAction.RETRACTION,
            published_at=published_at + timedelta(seconds=30),
        ),
    ]
    semantic_duplicate = events[0].model_copy(update={"event_id": uuid4()})

    with session_scope() as session:
        assert session is not None
        session.execute(
            text(
                "truncate table activity.targets, activity.projection_receipts, activity.items"
            )
        )
        session.execute(text("delete from activity.projection_failures"))
        session.execute(
            text("delete from integration.outbox_events where correlation_id = :correlation_id"),
            {"correlation_id": correlation_id},
        )
        session.commit()

        repository = ActivityRepository(session)
        for event in events:
            _insert_source_event(session, event)
        _insert_source_event(session, semantic_duplicate)

        published = repository.project_outbox_event(events[0].event_id)
        assert published.outcome is ProjectionOutcome.CREATED
        first_page = repository.list_public()
        assert [item.activity_id for item in first_page.items] == [published.activity_id]
        assert first_page.items[0].published_at == published_at

        replay = repository.project_outbox_event(events[0].event_id)
        assert replay.outcome is ProjectionOutcome.DUPLICATE

        semantic_replay = repository.project_outbox_event(semantic_duplicate.event_id)
        assert semantic_replay.outcome is ProjectionOutcome.DUPLICATE
        assert semantic_replay.activity_id == published.activity_id
        assert int(
            session.execute(
                text(
                    """
                    select count(*)
                    from activity.projection_receipts
                    where source_event_id = :source_event_id
                      and outcome = 'duplicate'
                    """
                ),
                {"source_event_id": semantic_duplicate.event_id},
            ).scalar_one()
        ) == 1

        updated = repository.project_outbox_event(events[1].event_id)
        assert updated.outcome is ProjectionOutcome.UPDATED
        updated_page = repository.list_public()
        assert updated_page.items[0].activity_id == published.activity_id
        assert updated_page.items[0].published_at == published_at
        assert updated_page.items[0].localized_snapshots[0].title == "动态版本 2"

        corrected = repository.project_outbox_event(events[2].event_id)
        assert corrected.outcome is ProjectionOutcome.CORRECTED
        corrected_page = repository.list_public()
        assert [item.activity_id for item in corrected_page.items] == [corrected.activity_id]
        assert corrected.activity_id != published.activity_id

        retracted = repository.project_outbox_event(events[3].event_id)
        assert retracted.outcome is ProjectionOutcome.RETRACTED
        assert repository.list_public().items == []

        metrics = repository.metrics()
        assert metrics.projected_events == 4
        assert metrics.replayed_events == 2
        assert metrics.event_type_counts[ActivityType.PANDA_BIRTH.value] == 3
        assert metrics.event_type_counts[ActivityType.ARCHIVE_PROFILE_CORRECTED.value] == 1

        downstream_before = int(
            session.execute(
                text(
                    """
                    select count(*)
                    from integration.outbox_events
                    where correlation_id = :correlation_id
                      and source_context = 'activity'
                    """
                ),
                {"correlation_id": correlation_id},
            ).scalar_one()
        )
        rebuilt = repository.rebuild()
        assert rebuilt.source_events == 5
        assert rebuilt.created_items == 1
        assert rebuilt.updated_items == 1
        assert rebuilt.corrected_items == 1
        assert rebuilt.retracted_items == 1
        assert repository.list_public().items == []
        downstream_after = int(
            session.execute(
                text(
                    """
                    select count(*)
                    from integration.outbox_events
                    where correlation_id = :correlation_id
                      and source_context = 'activity'
                    """
                ),
                {"correlation_id": correlation_id},
            ).scalar_one()
        )
        assert downstream_after == downstream_before

        session.execute(
            text(
                "truncate table activity.targets, activity.projection_receipts, activity.items"
            )
        )
        session.execute(text("delete from activity.projection_failures"))
        session.execute(
            text("delete from integration.outbox_events where correlation_id = :correlation_id"),
            {"correlation_id": correlation_id},
        )
        session.commit()



def test_archive_publication_emits_transactional_activity_event(real_db_url: str) -> None:
    _ = real_db_url
    correlation_id = uuid4()
    editor_id = uuid4()
    reviewer_id = uuid4()
    publisher_id = uuid4()
    source_id = f"test:panda-named:{uuid4().hex}"
    occurred_at = datetime.now(UTC)

    with session_scope() as session:
        assert session is not None
        panda_id = str(
            session.execute(text("select id from public.pandas order by slug limit 1")).scalar_one()
        )
        public_source_id = str(
            session.execute(
                text("select id from public.public_evidence_sources order by id limit 1")
            ).scalar_one()
        )
        media_asset_id = UUID(
            str(
                session.execute(
                    text(
                        """
                        select id
                        from public.media_assets
                        where storage_bucket = 'public-media'
                          and storage_path ~* '^https?://'
                          and license is not null
                        order by id
                        limit 1
                        """
                    )
                ).scalar_one()
            )
        )

    change_set = create_change_set(
        ChangeSetCreate.model_validate(
            {
                "title": "Publish reviewed naming Activity",
                "reason": "Prove Archive-to-Activity transactional integration",
                "revisions": [
                    {
                        "entity_type": "panda",
                        "entity_id": panda_id,
                        "payload": {
                            "public_record": {"intro": "Reviewed Activity integration release."},
                            "publication_checks": {
                                "references": [],
                                "residencies": [],
                                "translations": [],
                                "sources": [],
                                "media": [],
                            },
                            "activities": [
                                {
                                    "source_id": source_id,
                                    "activity_type": "panda.named",
                                    "targets": [
                                        {"target_type": "panda", "target_id": panda_id}
                                    ],
                                    "occurred_at": occurred_at,
                                    "localization_key": "activity.panda.named",
                                    "localization_version": 1,
                                    "provenance": {
                                        "public_reference_ids": [public_source_id]
                                    },
                                    "media": {
                                        "asset_id": media_asset_id,
                                        "variant": "profile",
                                        "alt_text": "Reviewed public panda image",
                                    },
                                    "localized_snapshots": [
                                        {
                                            "locale": "zh-CN",
                                            "title": "熊猫正式命名",
                                            "summary": "档案发布了经过审核的正式命名动态。",
                                        },
                                        {
                                            "locale": "en",
                                            "title": "Panda officially named",
                                            "summary": (
                                                "The Archive published a reviewed naming update."
                                            ),
                                        },
                                    ],
                                }
                            ],
                        },
                    }
                ],
            }
        ),
        editor_id,
    )
    submit_change_set(change_set.id, editor_id)
    review_change_set(
        change_set.id,
        ChangeSetReview(decision="approved", reason="Independent Activity review complete"),
        reviewer_id,
    )
    batch = create_publication_batch(
        PublicationBatchCreate(
            change_set_ids=[change_set.id],
            public_schema_version="1.0.0",
            data_version=f"activity-integration-{uuid4().hex}",
            reason="Publish reviewed Activity source release",
            correlation_id=correlation_id,
        ),
        publisher_id,
    )
    published_batch = publish_batch(batch.id, publisher_id)

    with session_scope() as session:
        assert session is not None
        event_id = UUID(
            str(
                session.execute(
                    text(
                        """
                        select event_id
                        from integration.outbox_events
                        where correlation_id = :correlation_id
                          and event_type = 'archive.activity.published'
                        """
                    ),
                    {"correlation_id": correlation_id},
                ).scalar_one()
            )
        )
        assert int(session.execute(text("select count(*) from activity.items")).scalar_one()) == 0

        repository = ActivityRepository(session)
        result = repository.project_outbox_event(event_id)
        assert result.outcome is ProjectionOutcome.CREATED
        item = repository.list_public(page_size=10).items[0]
        assert item.source_id == source_id
        assert item.targets[0].target_id == panda_id
        assert item.media is not None
        assert item.media.asset_id == media_asset_id
        assert item.provenance.public_reference_ids == [public_source_id]
        assert item.provenance.release_id == published_batch.id
        assert item.provenance.data_version == published_batch.data_version

        session.execute(
            text("truncate table activity.targets, activity.projection_receipts, activity.items")
        )
        session.execute(
            text("delete from integration.outbox_events where correlation_id = :correlation_id"),
            {"correlation_id": correlation_id},
        )
        session.commit()



def test_authorized_editorial_command_is_idempotent(real_db_url: str) -> None:
    _ = real_db_url
    account_id = uuid4()
    command_id = uuid4()
    correlation_id = uuid4()
    now = datetime.now(UTC)

    with session_scope() as session:
        assert session is not None
        email = f"activity-{account_id}@example.invalid"
        session.execute(
            text(
                """
                insert into auth.users (
                  instance_id, id, aud, role, email, encrypted_password,
                  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                  created_at, updated_at
                ) values (
                  '00000000-0000-0000-0000-000000000000', :account_id,
                  'authenticated', 'authenticated', :email, '', now(),
                  '{"provider":"email","providers":["email"]}'::jsonb,
                  '{}'::jsonb, now(), now()
                )
                """
            ),
            {"account_id": account_id, "email": email},
        )
        session.execute(
            text(
                """
                insert into identity.accounts (account_id, email)
                values (:account_id, :email)
                """
            ),
            {"account_id": account_id, "email": email},
        )
        panda_id = str(
            session.execute(text("select id from public.pandas order by slug limit 1")).scalar_one()
        )
        public_source_id = str(
            session.execute(
                text("select id from public.public_evidence_sources order by id limit 1")
            ).scalar_one()
        )
        media_asset_id = UUID(
            str(
                session.execute(
                    text(
                        """
                        select id
                        from public.media_assets
                        where storage_bucket = 'public-media'
                          and storage_path ~* '^https?://'
                          and license is not null
                        order by id
                        limit 1
                        """
                    )
                ).scalar_one()
            )
        )
        session.commit()

        command = EditorialAnnouncementCommand.model_validate(
            {
                "command_id": command_id,
                "source_id": f"editorial:test-{command_id.hex}",
                "correlation_id": correlation_id,
                "reason": "Reviewed editorial announcement",
                "activity_type": "editorial.announcement",
                "targets": [{"target_type": "panda", "target_id": panda_id}],
                "sitewide": True,
                "occurred_at": now,
                "localization_key": "activity.editorial.announcement",
                "localization_version": 1,
                "provenance": {"public_reference_ids": [public_source_id]},
                "media": {
                    "asset_id": media_asset_id,
                    "variant": "profile",
                    "alt_text": "Reviewed public panda image",
                },
                "localized_snapshots": [
                    {
                        "locale": "zh-CN",
                        "title": "编辑公告",
                        "summary": "经过审核的全站熊猫公告。",
                    },
                    {
                        "locale": "en",
                        "title": "Editorial announcement",
                        "summary": "A reviewed sitewide panda announcement.",
                    },
                ],
                "pin": {
                    "starts_at": now,
                    "ends_at": now + timedelta(hours=1),
                    "reason": "Reviewed one-hour editorial placement",
                },
            }
        )
        actor = _request_identity(
            account_id,
            "activity.editorial.publish",
            "activity.sitewide.publish",
            "activity.pin.manage",
        )
        repository = ActivityRepository(session)
        created = repository.publish_editorial(command, actor)
        assert created.outcome is ProjectionOutcome.CREATED

        duplicate = repository.publish_editorial(command, actor)
        assert duplicate.outcome is ProjectionOutcome.DUPLICATE
        assert duplicate.activity_id == created.activity_id

        with pytest.raises(ActivityConflictError, match="payload changed"):
            repository.publish_editorial(
                command.model_copy(update={"reason": "Changed command payload"}),
                actor,
            )
        session.rollback()

        invalid_source_command = command.model_copy(
            update={
                "command_id": uuid4(),
                "source_id": f"editorial:invalid-source-{uuid4().hex}",
                "correlation_id": uuid4(),
                "provenance": command.provenance.model_copy(
                    update={"public_reference_ids": [f"missing-{uuid4().hex}"]}
                ),
            }
        )
        with pytest.raises(ActivityConflictError, match="unpublished evidence sources"):
            repository.publish_editorial(invalid_source_command, actor)
        session.rollback()

        invalid_media_command = command.model_copy(
            update={
                "command_id": uuid4(),
                "source_id": f"editorial:invalid-media-{uuid4().hex}",
                "correlation_id": uuid4(),
                "media": command.media.model_copy(update={"asset_id": uuid4()}),
            }
        )
        with pytest.raises(ActivityConflictError, match="public rights approval"):
            repository.publish_editorial(invalid_media_command, actor)
        session.rollback()

        for _index in range(2):
            extra_pin_id = uuid4()
            extra_pin = command.model_copy(
                update={
                    "command_id": extra_pin_id,
                    "source_id": f"editorial:pin-{extra_pin_id.hex}",
                    "correlation_id": uuid4(),
                }
            )
            extra_pin_result = repository.publish_editorial(extra_pin, actor)
            assert extra_pin_result.outcome is ProjectionOutcome.CREATED

        fourth_pin_id = uuid4()
        fourth_pin = command.model_copy(
            update={
                "command_id": fourth_pin_id,
                "source_id": f"editorial:pin-{fourth_pin_id.hex}",
                "correlation_id": uuid4(),
            }
        )
        with pytest.raises(ActivityConflictError, match="At most three"):
            repository.publish_editorial(fourth_pin, actor)
        session.rollback()

        item = next(
            item
            for item in repository.list_public(page_size=100).items
            if item.activity_id == created.activity_id
        )
        assert item.source_type == "editorial.announcement"
        assert item.sitewide is True
        assert item.media is not None
        assert item.media.asset_id == media_asset_id
        assert item.provenance.public_reference_ids == [public_source_id]
        assert item.pin is not None
        assert item.pin.ends_at == now + timedelta(hours=1)

        assert int(
            session.execute(
                text(
                    """
                    select count(*)
                    from activity.editorial_announcements
                    where command_id = :command_id
                    """
                ),
                {"command_id": command_id},
            ).scalar_one()
        ) == 1
        assert int(
            session.execute(
                text(
                    """
                    select count(*)
                    from activity.audit_events
                    where correlation_id = :correlation_id
                      and event_type = 'editorial.announcement.published'
                    """
                ),
                {"correlation_id": correlation_id},
            ).scalar_one()
        ) == 1
        event_counts = {
            str(event_type): int(count)
            for event_type, count in session.execute(
                text(
                    """
                    select event_type, count(*)
                    from integration.outbox_events
                    where correlation_id = :correlation_id
                    group by event_type
                    """
                ),
                {"correlation_id": correlation_id},
            ).all()
        }
        assert event_counts["editorial.activity.published"] == 1
        assert event_counts["activity.item.published"] == 1
