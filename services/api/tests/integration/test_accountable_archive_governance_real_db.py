from __future__ import annotations

import os
from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.archive_operations.models import (
    ArchiveCorrectionCommand,
    ArchiveEmergencyTakedownCommand,
    ArchiveEntityRef,
    ArchiveImpactPreview,
    ArchiveMergeSplitCommand,
    ArchiveOperationType,
    ArchiveRollbackCommand,
    EmergencyFollowupCommand,
)
from app.archive_operations.service import (
    complete_emergency_followup,
    correct_or_retract,
    emergency_takedown,
    merge_or_split,
    operation_metrics,
    rollback_release,
)
from app.archive_publication.models import (
    AccountablePublishCommand,
    AccountableValidationCommand,
    ArchiveRiskLevel,
)
from app.archive_publication.service import (
    publication_metrics,
    publish_change_set,
    validate_change_set,
)
from app.archive_workbench.service import rehearsal_snapshot
from app.core.config import settings
from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.schemas.publication import ChangeSetCreate
from app.services.panda_service import list_pandas
from app.services.publication_service import create_change_set

AUTHOR_ID = UUID("11111111-1111-4111-8111-111111111111")
VALIDATOR_ID = UUID("22222222-2222-4222-8222-222222222222")
PUBLISHER_ID = UUID("33333333-3333-4333-8333-333333333333")
SENIOR_ID = UUID("44444444-4444-4444-8444-444444444444")


@pytest.fixture(scope="module")
def real_db() -> Iterator[None]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run real DB integration tests")
    database_url = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("Set DATABASE_URL or REAL_DB_URL for real DB tests")

    previous_url = settings.database_url
    previous_fallback = settings.db_use_mock_fallback
    previous_archive_flag = settings.archive_single_accountable_approver_enabled
    settings.database_url = database_url
    settings.db_use_mock_fallback = False
    settings.archive_single_accountable_approver_enabled = True
    configure_database(database_url)
    with session_scope() as session:
        assert session is not None
        for account_id, email in (
            (AUTHOR_ID, "archive-author@example.test"),
            (VALIDATOR_ID, "archive-validator@example.test"),
            (PUBLISHER_ID, "archive-publisher@example.test"),
            (SENIOR_ID, "archive-senior@example.test"),
        ):
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
                    on conflict (id) do nothing
                    """
                ),
                {"account_id": account_id, "email": email},
            )
            session.execute(
                text(
                    """
                    insert into identity.accounts (account_id, email)
                    values (:account_id, :email)
                    on conflict (account_id) do nothing
                    """
                ),
                {"account_id": account_id, "email": email},
            )
        session.commit()
    try:
        yield
    finally:
        settings.database_url = previous_url
        settings.db_use_mock_fallback = previous_fallback
        settings.archive_single_accountable_approver_enabled = previous_archive_flag
        configure_database(previous_url)


def _identity(
    account_id: UUID,
    *,
    roles: tuple[str, ...],
    capabilities: tuple[str, ...],
    recent_auth: bool = True,
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=f"{account_id}@archive-governance.test",
        session_id=f"archive-governance-{account_id}",
        state=AccountState.ACTIVE,
        roles=frozenset(roles),
        capabilities=frozenset(capabilities),
        authenticated_at=now - timedelta(minutes=5),
        authentication_method="otp",
        issued_at=now - timedelta(minutes=5),
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=recent_auth,
    )


def _change_set_payload(panda_id: str, suffix: str, field: str) -> ChangeSetCreate:
    return ChangeSetCreate.model_validate(
        {
            "title": f"Accountable Archive verification {suffix}",
            "reason": "Exercise the single-accountable-approver map-close workflow",
            "revisions": [
                {
                    "entity_type": "panda",
                    "entity_id": panda_id,
                    "payload": {
                        "public_record": {field: f"map-close-{suffix}-{field}"},
                        "publication_checks": {
                            "references": [],
                            "residencies": [],
                            "translations": [],
                            "sources": [],
                            "media": [],
                        },
                    },
                }
            ],
        }
    )


def _create_legacy_draft(panda_id: str, suffix: str, field: str):
    settings.archive_single_accountable_approver_enabled = False
    try:
        return create_change_set(_change_set_payload(panda_id, suffix, field), AUTHOR_ID)
    finally:
        settings.archive_single_accountable_approver_enabled = True


def _current_archive_state() -> tuple[UUID | None, str]:
    with session_scope() as session:
        assert session is not None
        row = session.execute(
            text(
                """
                select pointer.latest_release_id, coalesce(batch.data_version, 'unpublished')
                from public.archive_release_pointer pointer
                left join public.publication_batches batch on batch.id = pointer.latest_release_id
                where pointer.singleton = true
                """
            )
        ).one()
        return row[0], str(row[1])


def _mark_projected(release_id: UUID, outbox_event_id: UUID) -> None:
    with session_scope() as session:
        assert session is not None
        session.execute(
            text(
                """
                update public.public_release_pointer
                set active_batch_id = :release_id, switched_at = now()
                where singleton = true
                """
            ),
            {"release_id": release_id},
        )
        session.execute(
            text(
                """
                update integration.outbox_events
                set published_at = now()
                where event_id = :event_id
                """
            ),
            {"event_id": outbox_event_id},
        )
        session.commit()


def test_accountable_archive_map_close_journey(real_db: None) -> None:
    _ = real_db
    suffix = uuid4().hex
    panda = list_pandas(
        page=1,
        page_size=1,
        q=None,
        status=None,
        gender=None,
        habitat_id=None,
        featured=None,
        sort="name_asc",
    ).items[0]

    validator = _identity(
        VALIDATOR_ID,
        roles=("archive_editor",),
        capabilities=("archive.accountable.validate",),
    )
    publisher = _identity(
        PUBLISHER_ID,
        roles=("archive_editor",),
        capabilities=(
            "archive.accountable.publish",
            "archive.accountable.rollback",
            "archive.accountable.correct",
            "archive.accountable.operation_metrics",
        ),
    )
    senior = _identity(
        SENIOR_ID,
        roles=("senior_archive_editor",),
        capabilities=(
            "archive.accountable.validate",
            "archive.accountable.publish",
            "archive.sensitive.publish",
            "archive.accountable.rollback",
            "archive.sensitive.rollback",
            "archive.accountable.correct",
            "archive.sensitive.correct",
            "archive.sensitive.merge_split",
            "archive.sensitive.takedown",
            "archive.accountable.operation_metrics",
        ),
    )

    ordinary = _create_legacy_draft(str(panda.id), suffix, "birthplace")
    _, base_version = _current_archive_state()
    validation_command = AccountableValidationCommand(
        expected_version=ordinary.governance_version,
        idempotency_key=f"validate-ordinary-{suffix}",
        base_archive_version=base_version,
        reason="Validated ordinary evidence and public impact",
        risk_level=ArchiveRiskLevel.ORDINARY,
        correlation_id=uuid4(),
    )
    validation = validate_change_set(ordinary.id, validation_command, validator)
    validation_replay = validate_change_set(ordinary.id, validation_command, validator)
    assert validation.outcome == "ready"
    assert validation_replay.validation_result_id == validation.validation_result_id

    publish_command = AccountablePublishCommand(
        expected_version=validation.governance_version,
        idempotency_key=f"publish-ordinary-{suffix}",
        reason="Publish the validated ordinary Archive change",
        data_version=f"accountable-{suffix}-1",
        correlation_id=uuid4(),
    )
    ordinary_release = publish_change_set(ordinary.id, publish_command, publisher)
    ordinary_replay = publish_change_set(ordinary.id, publish_command, publisher)
    assert ordinary_replay.release_id == ordinary_release.release_id
    assert ordinary_release.public_projection_status == "pending"

    with session_scope() as session:
        assert session is not None
        assert session.execute(
            text("select count(*) from public.publication_batches where id = :release_id"),
            {"release_id": ordinary_release.release_id},
        ).scalar_one() == 1
        assert session.execute(
            text(
                """
                select count(*) from integration.outbox_events
                where event_id = :event_id and event_type = 'archive.release.published'
                """
            ),
            {"event_id": ordinary_release.outbox_event_id},
        ).scalar_one() == 1

    _mark_projected(ordinary_release.release_id, ordinary_release.outbox_event_id)
    assert publish_change_set(
        ordinary.id, publish_command, publisher
    ).public_projection_status == "projected"

    sensitive = _create_legacy_draft(str(panda.id), suffix, "intro")
    _, sensitive_base = _current_archive_state()
    sensitive_validation = validate_change_set(
        sensitive.id,
        AccountableValidationCommand(
            expected_version=sensitive.governance_version,
            idempotency_key=f"validate-sensitive-{suffix}",
            base_archive_version=sensitive_base,
            reason="Validated sensitive evidence and impact",
            risk_level=ArchiveRiskLevel.SENSITIVE,
            correlation_id=uuid4(),
        ),
        senior,
    )
    sensitive_publish = AccountablePublishCommand(
        expected_version=sensitive_validation.governance_version,
        idempotency_key=f"publish-sensitive-{suffix}",
        reason="Publish a sensitive Archive change with Senior accountability",
        data_version=f"accountable-{suffix}-2",
        correlation_id=uuid4(),
    )
    with pytest.raises(HTTPException) as missing_senior:
        publish_change_set(sensitive.id, sensitive_publish, publisher)
    assert missing_senior.value.status_code == 403

    stale_senior = replace(senior, recent_auth=False)
    with pytest.raises(HTTPException) as missing_recent_auth:
        publish_change_set(sensitive.id, sensitive_publish, stale_senior)
    assert missing_recent_auth.value.status_code == 403

    sensitive_release = publish_change_set(sensitive.id, sensitive_publish, senior)
    assert sensitive_release.risk_level == ArchiveRiskLevel.SENSITIVE
    assert publication_metrics().conflict_failures >= 2

    source_id = f"archive:panda:{panda.id}:profile"
    correction = ArchiveCorrectionCommand.model_validate(
        {
            "expected_archive_release_id": str(sensitive_release.release_id),
            "idempotency_key": f"correct-{suffix}",
            "reason": "Correct the published profile from verified evidence",
            "data_version": f"accountable-{suffix}-3",
            "risk_level": "ordinary",
            "correlation_id": str(uuid4()),
            "operation_type": "targeted_correction",
            "subject": {"entity_type": "panda", "entity_id": str(panda.id)},
            "effect_payload": {"fields": ["intro"]},
            "impact_preview": {
                "activity_count": 1,
                "public_urls": [f"/zh/pandas/{panda.slug}"],
                "warnings": [],
            },
            "notification_eligible": True,
            "activity_descriptor": {
                "source_id": source_id,
                "action": "correction",
                "activity_type": "archive.profile_corrected",
                "targets": [{"target_type": "panda", "target_id": str(panda.id)}],
                "notification_eligible": True,
                "occurred_at": datetime.now(UTC).isoformat(),
                "localization_key": "archive.profile.corrected",
                "localization_version": 1,
                "localized_snapshots": [
                    {
                        "locale": "zh-CN",
                        "title": "资料已修正",
                        "summary": "已依据核实来源修正公开资料。",
                    },
                    {
                        "locale": "en",
                        "title": "Profile corrected",
                        "summary": "The public profile was corrected from verified sources.",
                    },
                ],
            },
        }
    )
    correction_release = correct_or_retract(correction, publisher)
    correction_replay = correct_or_retract(correction, publisher)
    assert correction_replay.operation_id == correction_release.operation_id
    assert correction_replay.release_id == correction_release.release_id

    with session_scope() as session:
        assert session is not None
        event_rows = session.execute(
            text(
                """
                select event_type from integration.outbox_events
                where causation_id = :operation_id
                order by event_type
                """
            ),
            {"operation_id": correction_release.operation_id},
        ).scalars().all()
        assert event_rows == ["archive.activity.corrected"]
        assert session.execute(
            text(
                """
                select count(*) from integration.outbox_events
                where aggregate_id = :operation_id
                  and event_type = 'archive.operation.targeted_correction'
                """
            ),
            {"operation_id": str(correction_release.operation_id)},
        ).scalar_one() == 1

    rollback = rollback_release(
        ArchiveRollbackCommand(
            expected_archive_release_id=correction_release.release_id,
            target_release_id=sensitive_release.release_id,
            idempotency_key=f"rollback-{suffix}",
            reason="Restore the prior immutable sensitive Release",
            data_version=f"accountable-{suffix}-4",
            risk_level=ArchiveRiskLevel.ORDINARY,
            correlation_id=uuid4(),
        ),
        publisher,
    )
    assert rollback.target_release_id == sensitive_release.release_id

    merge = merge_or_split(
        ArchiveMergeSplitCommand(
            expected_archive_release_id=rollback.release_id,
            idempotency_key=f"merge-{suffix}",
            reason="Exercise a reviewed identity merge impact preview",
            data_version=f"accountable-{suffix}-5",
            risk_level=ArchiveRiskLevel.SENSITIVE,
            correlation_id=uuid4(),
            operation_type=ArchiveOperationType.MERGE,
            source_entities=[
                ArchiveEntityRef(entity_type="panda", entity_id=f"source-a-{suffix}"),
                ArchiveEntityRef(entity_type="panda", entity_id=f"source-b-{suffix}"),
            ],
            destination_entities=[
                ArchiveEntityRef(entity_type="panda", entity_id=f"destination-{suffix}")
            ],
            alias_redirects={f"source-a-{suffix}": f"destination-{suffix}"},
            effect_payload={"identity_mapping": "reviewed"},
            impact_preview=ArchiveImpactPreview(
                follow_count=1,
                activity_count=1,
                slug_alias_count=1,
                public_urls=[f"/zh/pandas/destination-{suffix}"],
            ),
        ),
        senior,
    )
    assert merge.operation_type == ArchiveOperationType.MERGE

    split = merge_or_split(
        ArchiveMergeSplitCommand(
            expected_archive_release_id=merge.release_id,
            idempotency_key=f"split-{suffix}",
            reason="Exercise a reviewed identity split impact preview",
            data_version=f"accountable-{suffix}-6",
            risk_level=ArchiveRiskLevel.SENSITIVE,
            correlation_id=uuid4(),
            operation_type=ArchiveOperationType.SPLIT,
            source_entities=[
                ArchiveEntityRef(entity_type="panda", entity_id=f"destination-{suffix}")
            ],
            destination_entities=[
                ArchiveEntityRef(entity_type="panda", entity_id=f"split-a-{suffix}"),
                ArchiveEntityRef(entity_type="panda", entity_id=f"split-b-{suffix}"),
            ],
            effect_payload={"identity_mapping": "reviewed"},
            impact_preview=ArchiveImpactPreview(
                relationship_count=2,
                public_urls=[
                    f"/zh/pandas/split-a-{suffix}",
                    f"/zh/pandas/split-b-{suffix}",
                ],
            ),
        ),
        senior,
    )
    assert split.operation_type == ArchiveOperationType.SPLIT

    followup_change_set = _create_legacy_draft(str(panda.id), suffix, "name_en")
    _, followup_base = _current_archive_state()
    formal_followup = validate_change_set(
        followup_change_set.id,
        AccountableValidationCommand(
            expected_version=followup_change_set.governance_version,
            idempotency_key=f"validate-followup-{suffix}",
            base_archive_version=followup_base,
            reason="Validate the formal emergency follow-up Change Set",
            risk_level=ArchiveRiskLevel.SENSITIVE,
            correlation_id=uuid4(),
        ),
        senior,
    )
    assert formal_followup.outcome == "ready"

    takedown = emergency_takedown(
        ArchiveEmergencyTakedownCommand(
            expected_archive_release_id=split.release_id,
            idempotency_key=f"takedown-{suffix}",
            reason="Reduce public exposure while a formal correction is reviewed",
            data_version=f"accountable-{suffix}-7",
            risk_level=ArchiveRiskLevel.SENSITIVE,
            correlation_id=uuid4(),
            subject=ArchiveEntityRef(entity_type="panda", entity_id=str(panda.id)),
            public_scope=f"/zh/pandas/{panda.slug}",
            effect_payload={"hide_fields": ["intro"]},
            impact_preview=ArchiveImpactPreview(
                public_urls=[f"/zh/pandas/{panda.slug}"],
                warnings=["Temporary public-risk reduction"],
            ),
        ),
        senior,
    )
    assert takedown.followup_due_at is not None

    followup_command = EmergencyFollowupCommand(
        expected_operation_id=takedown.operation_id,
        followup_change_set_id=followup_change_set.id,
        idempotency_key=f"followup-{suffix}",
        reason="Link the emergency action to its formal accountable Change Set",
        correlation_id=uuid4(),
    )
    followup = complete_emergency_followup(followup_command, senior)
    followup_replay = complete_emergency_followup(followup_command, senior)
    assert followup_replay.operation_id == followup.operation_id
    assert followup.followup_change_set_id == followup_change_set.id

    metrics = operation_metrics()
    assert metrics.rollback_count >= 1
    assert metrics.targeted_correction_count >= 1
    assert metrics.merge_count >= 1
    assert metrics.split_count >= 1
    assert metrics.emergency_takedown_count >= 1

    snapshot = rehearsal_snapshot()
    assert snapshot.go is True
    assert snapshot.blockers == []
    assert len(snapshot.canonical_sha256) == 64
    assert snapshot.archive_pointer_release_id == takedown.release_id
