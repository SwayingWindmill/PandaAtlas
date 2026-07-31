import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.archive_operations.models import ArchiveRollbackCommand
from app.archive_operations.service import rollback_release
from app.archive_publication.models import (
    AccountablePublishCommand,
    AccountableValidationCommand,
    ArchiveRiskLevel,
    ArchiveValidationOutcome,
)
from app.archive_publication.service import publish_change_set, validate_change_set
from app.archive_workbench.models import ArchiveCutoverCommand
from app.archive_workbench.service import cutover_control, set_cutover_control
from app.core.config import settings
from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.schemas.publication import ChangeSetCreate
from app.services.panda_service import list_pandas
from app.services.publication_service import create_change_set

ACTOR_ID = UUID("33333333-3333-4333-8333-333333333333")


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
    configure_database(database_url)
    try:
        with session_scope() as session:
            assert session is not None
            assert session.execute(
                text("select exists(select 1 from identity.accounts where account_id = :actor_id)"),
                {"actor_id": ACTOR_ID},
            ).scalar_one()
        yield
    finally:
        settings.database_url = previous_url
        settings.db_use_mock_fallback = previous_fallback
        settings.archive_single_accountable_approver_enabled = previous_archive_flag
        configure_database(previous_url)


def _identity(*, senior: bool, recent_auth: bool) -> RequestIdentity:
    now = datetime.now(UTC)
    capabilities = {
        "archive.accountable.validate",
        "archive.accountable.publish",
        "archive.accountable.rollback",
        "archive.cutover.manage",
    }
    roles = {"archive_editor"}
    if senior:
        roles.add("senior_archive_editor")
        capabilities.update(
            {
                "archive.sensitive.publish",
                "archive.sensitive.rollback",
                "archive.sensitive.correct",
                "archive.sensitive.merge_split",
                "archive.sensitive.takedown",
            }
        )
    return RequestIdentity(
        account_id=ACTOR_ID,
        email="archive-map-close@example.invalid",
        session_id=f"archive-map-close-{uuid4()}",
        state=AccountState.ACTIVE,
        roles=frozenset(roles),
        capabilities=frozenset(capabilities),
        authenticated_at=now if recent_auth else now - timedelta(hours=1),
        authentication_method="email_otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=recent_auth,
    )


def _archive_and_public_pointers() -> tuple[UUID | None, UUID | None, str]:
    with session_scope() as session:
        assert session is not None
        row = session.execute(
            text(
                """
                select
                  archive_pointer.latest_release_id,
                  public_pointer.active_batch_id,
                  coalesce(release.data_version, 'unpublished') as archive_version
                from public.archive_release_pointer archive_pointer
                cross join public.public_release_pointer public_pointer
                left join public.publication_batches release
                  on release.id = archive_pointer.latest_release_id
                where archive_pointer.singleton = true
                  and public_pointer.singleton = true
                """
            )
        ).one()
        return row[0], row[1], str(row[2])


def _draft_change_set(suffix: str) -> object:
    settings.archive_single_accountable_approver_enabled = False
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
    payload = ChangeSetCreate.model_validate(
        {
            "title": f"Accountable Archive map-close {suffix}",
            "reason": "Create a deterministic accountable Archive validation fixture.",
            "revisions": [
                {
                    "entity_type": "panda",
                    "entity_id": str(panda.id),
                    "payload": {
                        "public_record": {
                            "intro": f"Accountable Archive verification {suffix}"
                        },
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
    draft = create_change_set(payload, ACTOR_ID)
    settings.archive_single_accountable_approver_enabled = True
    return draft


def _validate_and_publish(
    *,
    suffix: str,
    risk_level: ArchiveRiskLevel,
    identity: RequestIdentity,
):
    draft = _draft_change_set(suffix)
    _, _, archive_version = _archive_and_public_pointers()
    validation_command = AccountableValidationCommand(
        expected_version=draft.governance_version,
        idempotency_key=f"validate-{suffix}",
        base_archive_version=archive_version,
        reason="Validate complete evidence against the current Archive base.",
        risk_level=risk_level,
        correlation_id=uuid4(),
    )
    validation = validate_change_set(draft.id, validation_command, identity)
    replay = validate_change_set(draft.id, validation_command, identity)
    assert validation.outcome is ArchiveValidationOutcome.READY
    assert replay.validation_result_id == validation.validation_result_id

    publish_command = AccountablePublishCommand(
        expected_version=validation.governance_version,
        idempotency_key=f"publish-{suffix}",
        reason="Publish one immutable accountable Archive Release.",
        data_version=f"archive-map-close-{suffix}",
        database_migration_version="0024",
        correlation_id=uuid4(),
    )
    release = publish_change_set(draft.id, publish_command, identity)
    replay_release = publish_change_set(draft.id, publish_command, identity)
    assert replay_release.release_id == release.release_id
    assert release.public_projection_status == "pending"
    return release


def test_accountable_archive_publication_operation_and_cutover_journey(real_db: None) -> None:
    _ = real_db
    suffix = uuid4().hex
    editor = _identity(senior=False, recent_auth=False)
    senior = _identity(senior=True, recent_auth=True)
    _, initial_public_release_id, _ = _archive_and_public_pointers()

    ordinary = _validate_and_publish(
        suffix=f"{suffix}-ordinary",
        risk_level=ArchiveRiskLevel.ORDINARY,
        identity=editor,
    )
    archive_release_id, public_release_id, _ = _archive_and_public_pointers()
    assert archive_release_id == ordinary.release_id
    assert public_release_id == initial_public_release_id

    sensitive_draft = _draft_change_set(f"{suffix}-sensitive")
    _, _, archive_version = _archive_and_public_pointers()
    sensitive_validation = validate_change_set(
        sensitive_draft.id,
        AccountableValidationCommand(
            expected_version=sensitive_draft.governance_version,
            idempotency_key=f"validate-{suffix}-sensitive",
            base_archive_version=archive_version,
            reason="Validate a sensitive accountable Archive Change Set.",
            risk_level=ArchiveRiskLevel.SENSITIVE,
            correlation_id=uuid4(),
        ),
        senior,
    )
    sensitive_publish = AccountablePublishCommand(
        expected_version=sensitive_validation.governance_version,
        idempotency_key=f"publish-{suffix}-sensitive",
        reason="Publish a sensitive Release with Senior accountability.",
        data_version=f"archive-map-close-{suffix}-sensitive",
        database_migration_version="0024",
        correlation_id=uuid4(),
    )
    with pytest.raises(HTTPException) as denied:
        publish_change_set(sensitive_draft.id, sensitive_publish, editor)
    assert denied.value.status_code == 403

    sensitive = publish_change_set(sensitive_draft.id, sensitive_publish, senior)
    assert sensitive.public_projection_status == "pending"
    archive_release_id, public_release_id, _ = _archive_and_public_pointers()
    assert archive_release_id == sensitive.release_id
    assert public_release_id == initial_public_release_id

    rollback_command = ArchiveRollbackCommand(
        expected_archive_release_id=sensitive.release_id,
        target_release_id=ordinary.release_id,
        idempotency_key=f"rollback-{suffix}",
        reason="Create a new immutable rollback Release for recovery verification.",
        data_version=f"archive-map-close-{suffix}-rollback",
        database_migration_version="0024",
        risk_level=ArchiveRiskLevel.SENSITIVE,
        correlation_id=uuid4(),
        complex_rollback=True,
    )
    rollback = rollback_release(rollback_command, senior)
    rollback_replay = rollback_release(rollback_command, senior)
    assert rollback_replay.operation_id == rollback.operation_id
    assert rollback.release_id not in {ordinary.release_id, sensitive.release_id}
    assert rollback.target_release_id == ordinary.release_id
    assert rollback.public_projection_status == "pending"

    control = cutover_control()
    hold_command = ArchiveCutoverCommand(
        expected_version=control.version,
        state="held",
        idempotency_key=f"cutover-hold-{suffix}",
        reason="Hold new publication while verifying the map-close rollback boundary.",
        correlation_id=uuid4(),
    )
    held = set_cutover_control(hold_command, senior)
    held_replay = set_cutover_control(hold_command, senior)
    assert held.state == "held"
    assert held_replay.version == held.version

    blocked_command = ArchiveRollbackCommand(
        expected_archive_release_id=rollback.release_id,
        target_release_id=sensitive.release_id,
        idempotency_key=f"blocked-rollback-{suffix}",
        reason="This operation must be blocked while publication is held.",
        data_version=f"archive-map-close-{suffix}-blocked",
        database_migration_version="0024",
        risk_level=ArchiveRiskLevel.SENSITIVE,
        correlation_id=uuid4(),
        complex_rollback=True,
    )
    with pytest.raises(HTTPException) as blocked:
        rollback_release(blocked_command, senior)
    assert blocked.value.status_code == 409
    archive_release_id, public_release_id, _ = _archive_and_public_pointers()
    assert archive_release_id == rollback.release_id
    assert public_release_id == initial_public_release_id

    resumed = set_cutover_control(
        ArchiveCutoverCommand(
            expected_version=held.version,
            state="open",
            idempotency_key=f"cutover-resume-{suffix}",
            reason="Resume publication after the cutover recovery boundary passed.",
            correlation_id=uuid4(),
        ),
        senior,
    )
    assert resumed.state == "open"

    with session_scope() as session:
        assert session is not None
        counts = session.execute(
            text(
                """
                select
                  (select count(*) from public.archive_release_evidence
                    where change_set_id in (:ordinary_id, :sensitive_id)) as releases,
                  (select count(*) from public.archive_operation_records
                    where operation_id = :operation_id) as operations,
                  (select count(*) from public.archive_cutover_audit
                    where correlation_id in (:hold_id, :resume_id)) as cutover_audit
                """
            ),
            {
                "ordinary_id": ordinary.change_set_id,
                "sensitive_id": sensitive.change_set_id,
                "operation_id": rollback.operation_id,
                "hold_id": hold_command.correlation_id,
                "resume_id": resumed.changed_by and resumed.changed_by,
            },
        ).one()
        assert int(counts[0]) == 2
        assert int(counts[1]) == 1
