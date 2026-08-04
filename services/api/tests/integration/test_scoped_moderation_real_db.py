from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.community_intake.repository import (
    CommunityIntakeForbiddenError,
    CommunityIntakeRepository,
)
from app.core.config import settings
from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.integration.events import AggregateReference, IntegrationEventEnvelope
from app.notification.repository import NotificationRepository
from app.review_moderation.sanction_models import (
    AcknowledgeAppealCommand,
    AppealDecisionOutcome,
    DecideAppealCommand,
    IssueSanctionCommand,
    OpenAppealCommand,
    RestoreSanctionCommand,
    SanctionKind,
    SanctionScope,
)
from app.review_moderation.sanction_service import (
    acknowledge_appeal,
    current_notice,
    decide_appeal,
    get_subject,
    issue_sanction,
    open_appeal,
    restore_sanction,
)

_TEST_EMAIL_PREFIX = "moderation-real-db-"


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run scoped moderation database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def clean_moderation_data(
    real_db_url: str,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[None]:
    _ = real_db_url
    monkeypatch.setattr(settings, "moderation_controls_enabled", True)

    def clear() -> None:
        with session_scope() as session:
            assert session is not None
            account_ids = session.execute(
                text(
                    """
                    select account_id from identity.accounts
                    where email like :email_prefix
                    """
                ),
                {"email_prefix": f"{_TEST_EMAIL_PREFIX}%"},
            ).scalars().all()
            session.execute(
                text(
                    """
                    truncate table
                      review_moderation.moderation_command_receipts,
                      review_moderation.moderation_audit_events,
                      review_moderation.appeal_decisions,
                      review_moderation.appeal_cases,
                      review_moderation.restoration_events,
                      review_moderation.moderation_subjects,
                      review_moderation.sanctions,
                      audit.event_facts,
                      identity.authorization_audit_events,
                      identity.account_state_events
                    cascade
                    """
                )
            )
            if account_ids:
                account_id_strings = [str(account_id) for account_id in account_ids]
                session.execute(
                    text(
                        """
                        delete from integration.outbox_events
                        where aggregate_id = any(:account_ids)
                           or payload->>'account_id' = any(:account_ids)
                        """
                    ),
                    {"account_ids": account_id_strings},
                )
                session.execute(
                    text("delete from identity.accounts where account_id = any(:account_ids)"),
                    {"account_ids": account_ids},
                )
                session.execute(
                    text("delete from auth.users where id = any(:account_ids)"),
                    {"account_ids": account_ids},
                )
            session.commit()

    clear()
    try:
        yield
    finally:
        clear()


def _insert_account(account_id: UUID, suffix: str) -> None:
    email = f"{_TEST_EMAIL_PREFIX}{suffix}@example.invalid"
    with session_scope() as session:
        assert session is not None
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
        session.commit()


def _identity(
    account_id: UUID,
    *,
    state: AccountState = AccountState.ACTIVE,
    capabilities: frozenset[str] = frozenset(),
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=f"{_TEST_EMAIL_PREFIX}{account_id}@example.invalid",
        session_id=f"session-{account_id}",
        state=state,
        roles=frozenset({"moderator"}) if capabilities else frozenset({"member"}),
        capabilities=capabilities,
        authenticated_at=now,
        authentication_method="email",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal2",
        recent_auth=True,
    )


def _moderator(account_id: UUID) -> RequestIdentity:
    return _identity(
        account_id,
        capabilities=frozenset(
            {
                "moderation.sanction.read",
                "moderation.sanction.apply",
                "moderation.sanction.restore",
                "moderation.appeal.read",
                "moderation.appeal.decide",
                "moderation.metrics",
            }
        ),
    )


def _sanction_command(
    *,
    expected_version: int,
    kind: SanctionKind,
    scope: SanctionScope,
    idempotency_key: str,
    ends_at: datetime | None,
) -> IssueSanctionCommand:
    return IssueSanctionCommand(
        idempotency_key=idempotency_key,
        expected_version=expected_version,
        kind=kind,
        scope=scope,
        reason_code="confirmed_abuse",
        internal_explanation="The moderation evidence confirms repeated abusive behavior.",
        user_visible_explanation="This account feature is restricted because of confirmed abuse.",
        starts_at=datetime.now(UTC),
        ends_at=ends_at,
    )


def _restore_command(expected_version: int, key: str) -> RestoreSanctionCommand:
    return RestoreSanctionCommand(
        idempotency_key=key,
        expected_version=expected_version,
        reason_code="restriction_restored",
        internal_explanation="The restriction no longer applies after evidence review.",
        user_visible_explanation="The restriction was removed after a new review.",
    )


def test_superseded_sanction_cannot_open_an_appeal(
    real_db_url: str,
) -> None:
    _ = real_db_url
    moderator_id = uuid4()
    subject_id = uuid4()
    _insert_account(moderator_id, "superseded-moderator")
    _insert_account(subject_id, "superseded-subject")
    moderator = _moderator(moderator_id)

    first = issue_sanction(
        subject_id,
        _sanction_command(
            expected_version=1,
            kind=SanctionKind.WARNING,
            scope=SanctionScope.ACCOUNT,
            idempotency_key="superseded-warning-first",
            ends_at=None,
        ),
        moderator,
        uuid4(),
    )
    first_warning_id = next(
        sanction.sanction_id
        for sanction in first.sanctions
        if sanction.kind is SanctionKind.WARNING
    )
    issue_sanction(
        subject_id,
        _sanction_command(
            expected_version=2,
            kind=SanctionKind.WARNING,
            scope=SanctionScope.ACCOUNT,
            idempotency_key="superseded-warning-second",
            ends_at=None,
        ),
        moderator,
        uuid4(),
    )

    with pytest.raises(HTTPException) as error:
        open_appeal(
            OpenAppealCommand(
                idempotency_key="superseded-warning-appeal",
                expected_version=3,
                sanction_id=first_warning_id,
                user_statement=(
                    "I am requesting review of a warning that is no longer the current sanction."
                ),
            ),
            _identity(subject_id),
            uuid4(),
        )

    assert error.value.status_code == 409
    assert error.value.detail == {
        "code": "sanction_not_appealable",
        "message": "Only a current active sanction can be appealed",
    }


def test_warning_projection_supersedes_and_can_be_overturned(
    real_db_url: str,
) -> None:
    _ = real_db_url
    moderator_id = uuid4()
    subject_id = uuid4()
    _insert_account(moderator_id, "warning-moderator")
    _insert_account(subject_id, "warning-subject")
    moderator = _moderator(moderator_id)

    first = issue_sanction(
        subject_id,
        _sanction_command(
            expected_version=1,
            kind=SanctionKind.WARNING,
            scope=SanctionScope.ACCOUNT,
            idempotency_key="warning-first-1",
            ends_at=None,
        ),
        moderator,
        uuid4(),
    )
    first_warning_id = next(
        sanction.sanction_id
        for sanction in first.sanctions
        if sanction.kind is SanctionKind.WARNING
    )
    assert first.version == 2
    assert first.sanctions[0].active is True
    assert first.sanctions[0].appealable is True

    second = issue_sanction(
        subject_id,
        _sanction_command(
            expected_version=2,
            kind=SanctionKind.WARNING,
            scope=SanctionScope.ACCOUNT,
            idempotency_key="warning-second-1",
            ends_at=None,
        ),
        moderator,
        uuid4(),
    )
    second_warning_id = next(
        sanction.sanction_id
        for sanction in second.sanctions
        if sanction.kind is SanctionKind.WARNING and sanction.active
    )
    assert second.version == 3
    assert first_warning_id != second_warning_id
    assert {
        sanction.sanction_id
        for sanction in second.sanctions
        if sanction.kind is SanctionKind.WARNING and sanction.active
    } == {second_warning_id}
    second_warnings = {
        sanction.sanction_id: sanction
        for sanction in second.sanctions
        if sanction.kind is SanctionKind.WARNING
    }
    assert second_warnings[first_warning_id].appealable is False
    assert second_warnings[second_warning_id].appealable is True

    appeal = open_appeal(
        OpenAppealCommand(
            idempotency_key="warning-appeal-1",
            expected_version=3,
            sanction_id=second_warning_id,
            user_statement=(
                "I believe the current warning relies on duplicate evidence and should be removed."
            ),
        ),
        _identity(subject_id),
        uuid4(),
    )
    appealed = get_subject(subject_id)
    current_warning = next(
        sanction
        for sanction in appealed.sanctions
        if sanction.sanction_id == second_warning_id
    )
    assert current_warning.appealable is False

    decided = decide_appeal(
        appeal.appeal_case_id,
        DecideAppealCommand(
            idempotency_key="warning-decision-1",
            expected_version=1,
            expected_subject_version=3,
            outcome=AppealDecisionOutcome.OVERTURNED,
            internal_explanation=(
                "Independent review confirmed that the warning relied on duplicate evidence."
            ),
            user_visible_explanation=(
                "Your appeal was accepted and the current warning was removed."
            ),
        ),
        moderator,
        uuid4(),
    )
    assert decided.state.value == "closed"
    assert decided.decision is not None
    assert decided.decision.outcome is AppealDecisionOutcome.OVERTURNED

    restored = get_subject(subject_id)
    warnings = {
        sanction.sanction_id: sanction
        for sanction in restored.sanctions
        if sanction.kind is SanctionKind.WARNING
    }
    assert restored.version == 4
    assert warnings[first_warning_id].active is False
    assert warnings[first_warning_id].appealable is False
    assert warnings[second_warning_id].active is False
    assert warnings[second_warning_id].appealable is False
    assert warnings[second_warning_id].restored_at is not None

    with session_scope() as session:
        assert session is not None
        projection = session.execute(
            text(
                """
                select latest_warning_at, warning_sanction_id
                from review_moderation.moderation_subjects
                where account_id = :account_id
                """
            ),
            {"account_id": subject_id},
        ).mappings().one()
        assert projection["latest_warning_at"] is None
        assert projection["warning_sanction_id"] is None


def test_sanction_appeal_overturn_and_scope_enforcement_are_transactional(
    real_db_url: str,
) -> None:
    _ = real_db_url
    moderator_id = uuid4()
    subject_id = uuid4()
    _insert_account(moderator_id, "moderator")
    _insert_account(subject_id, "subject")
    moderator = _moderator(moderator_id)
    correlation_id = uuid4()

    suspended = issue_sanction(
        subject_id,
        _sanction_command(
            expected_version=1,
            kind=SanctionKind.ACCOUNT_SUSPENDED,
            scope=SanctionScope.ACCOUNT,
            idempotency_key="suspend-account-1",
            ends_at=datetime.now(UTC) + timedelta(days=2),
        ),
        moderator,
        correlation_id,
    )
    sanction_id = suspended.sanctions[0].sanction_id
    assert suspended.version == 2
    assert suspended.account_suspended is True
    assert suspended.account_state == AccountState.SUSPENDED.value

    notice = current_notice(
        _identity(subject_id, state=AccountState.SUSPENDED)
    )
    assert notice.account_suspended is True
    assert notice.sanctions[0].internal_explanation is None
    assert "confirmed abuse" in notice.sanctions[0].user_visible_explanation

    appeal = open_appeal(
        OpenAppealCommand(
            idempotency_key="open-appeal-1",
            expected_version=2,
            sanction_id=sanction_id,
            user_statement=(
                "I believe the restriction relied on duplicate reports and request another review."
            ),
        ),
        _identity(subject_id, state=AccountState.SUSPENDED),
        uuid4(),
    )
    assert appeal.version == 1
    assert appeal.first_response_due_at > datetime.now(UTC) + timedelta(days=4)

    acknowledged = acknowledge_appeal(
        appeal.appeal_case_id,
        AcknowledgeAppealCommand(
            idempotency_key="ack-appeal-1",
            expected_version=1,
            internal_note="The appeal was assigned for an independent evidence review.",
        ),
        moderator,
        uuid4(),
    )
    assert acknowledged.version == 2
    assert acknowledged.first_responded_at is not None

    decided = decide_appeal(
        appeal.appeal_case_id,
        DecideAppealCommand(
            idempotency_key="decide-appeal-1",
            expected_version=2,
            expected_subject_version=2,
            outcome=AppealDecisionOutcome.OVERTURNED,
            internal_explanation="Independent review found the original evidence insufficient.",
            user_visible_explanation="Your appeal was accepted and the restriction was removed.",
        ),
        moderator,
        uuid4(),
    )
    assert decided.state.value == "closed"
    assert decided.decision is not None
    assert decided.decision.outcome is AppealDecisionOutcome.OVERTURNED

    restored = get_subject(subject_id)
    assert restored.version == 3
    assert restored.account_suspended is False
    assert restored.account_state == AccountState.ACTIVE.value
    assert restored.sanctions[0].active is False
    assert restored.sanctions[0].restored_at is not None

    submission_restricted = issue_sanction(
        subject_id,
        _sanction_command(
            expected_version=3,
            kind=SanctionKind.SUBMISSION_RESTRICTED,
            scope=SanctionScope.SUBMISSION,
            idempotency_key="submission-restriction-1",
            ends_at=datetime.now(UTC) + timedelta(hours=12),
        ),
        moderator,
        uuid4(),
    )
    submission_sanction_id = next(
        sanction.sanction_id
        for sanction in submission_restricted.sanctions
        if sanction.kind is SanctionKind.SUBMISSION_RESTRICTED
    )
    with session_scope() as session:
        assert session is not None
        repository = CommunityIntakeRepository(session, storage=object())  # type: ignore[arg-type]
        with pytest.raises(CommunityIntakeForbiddenError, match="submission access"):
            repository._require_not_restricted(_identity(subject_id), "submission")

    restored_submission = restore_sanction(
        subject_id,
        submission_sanction_id,
        _restore_command(4, "restore-submission-1"),
        moderator,
        uuid4(),
    )
    assert restored_submission.version == 5

    notification_restricted = issue_sanction(
        subject_id,
        _sanction_command(
            expected_version=5,
            kind=SanctionKind.NOTIFICATION_RESTRICTED,
            scope=SanctionScope.NOTIFICATION,
            idempotency_key="notification-restriction-1",
            ends_at=datetime.now(UTC) + timedelta(hours=12),
        ),
        moderator,
        uuid4(),
    )
    first_notification_sanction_id = next(
        sanction.sanction_id
        for sanction in notification_restricted.sanctions
        if sanction.kind is SanctionKind.NOTIFICATION_RESTRICTED
    )
    superseded = issue_sanction(
        subject_id,
        _sanction_command(
            expected_version=6,
            kind=SanctionKind.NOTIFICATION_RESTRICTED,
            scope=SanctionScope.NOTIFICATION,
            idempotency_key="notification-restriction-2",
            ends_at=datetime.now(UTC) + timedelta(hours=24),
        ),
        moderator,
        uuid4(),
    )
    active_notification_ids = {
        sanction.sanction_id
        for sanction in superseded.sanctions
        if sanction.kind is SanctionKind.NOTIFICATION_RESTRICTED and sanction.active
    }
    assert superseded.notification_restricted is True
    assert first_notification_sanction_id not in active_notification_ids
    assert len(active_notification_ids) == 1

    event = IntegrationEventEnvelope(
        event_id=uuid4(),
        schema_version=1,
        event_type="identity.account-state-changed",
        event_version=1,
        source_context="identity",
        aggregate=AggregateReference(type="account", id=str(subject_id), version=1),
        idempotency_key="notification-audience-test",
        correlation_id=uuid4(),
        occurred_at=datetime.now(UTC),
        payload={"account_id": str(subject_id)},
    )
    with session_scope() as session:
        assert session is not None
        repository = NotificationRepository(session, cursor_signing_key="x" * 32)
        assert repository._audience(event, mandatory=False) == []
        mandatory = repository._audience(event, mandatory=True)
        assert [row["account_id"] for row in mandatory] == [subject_id]

    with session_scope() as session:
        assert session is not None
        identity_state = session.execute(
            text("select state::text from identity.accounts where account_id = :account_id"),
            {"account_id": subject_id},
        ).scalar_one()
        restoration_count = session.execute(
            text(
                """
                select count(*) from review_moderation.restoration_events
                where account_id = :account_id
                """
            ),
            {"account_id": subject_id},
        ).scalar_one()
        outbox_types = set(
            session.execute(
                text(
                    """
                    select event_type from integration.outbox_events
                    where aggregate_id in (:account_id, :appeal_id)
                    """
                ),
                {
                    "account_id": str(subject_id),
                    "appeal_id": str(appeal.appeal_case_id),
                },
            ).scalars()
        )
        assert identity_state == AccountState.ACTIVE.value
        assert int(restoration_count) == 2
        assert {
            "identity.account-state-changed",
            "moderation.sanction-issued",
            "moderation.sanction-restored",
            "moderation.appeal-opened",
            "moderation.appeal-decided",
        } <= outbox_types

    with session_scope() as session:
        assert session is not None
        with pytest.raises(DBAPIError, match="append-only"):
            session.execute(
                text(
                    """
                    update review_moderation.sanctions
                    set user_visible_explanation = 'Mutation must fail.'
                    where sanction_id = :sanction_id
                    """
                ),
                {"sanction_id": sanction_id},
            )
        session.rollback()
