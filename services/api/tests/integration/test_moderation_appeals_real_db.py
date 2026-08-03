from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.core.config import settings
from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.review_moderation.moderation_models import (
    AppealDecisionOutcome,
    ClaimAppealCommand,
    DecideAppealCommand,
    IssueModerationActionCommand,
    ModerationActionKind,
    SubmitAppealCommand,
)
from app.review_moderation.moderation_service import (
    claim_appeal,
    decide_appeal,
    issue_moderation_action,
    submit_appeal,
)


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run moderation database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def clean_moderation_data(real_db_url: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    _ = real_db_url
    monkeypatch.setattr(settings, "review_moderation_enabled", True)

    def clear() -> None:
        with session_scope() as session:
            assert session is not None
            session.execute(
                text(
                    """
                    truncate table
                      review_moderation.moderation_audit_events,
                      review_moderation.appeal_events,
                      review_moderation.appeal_cases,
                      review_moderation.moderation_actions,
                      review_moderation.moderation_subjects
                    cascade
                    """
                )
            )
            account_ids = session.execute(
                text(
                    """
                    select account_id
                    from identity.accounts
                    where email like 'moderation-test-%'
                    """
                )
            ).scalars().all()
            if account_ids:
                session.execute(
                    text(
                        """
                        delete from integration.outbox_events
                        where source_context = 'review-moderation'
                           or aggregate_id = any(:account_ids)
                        """
                    ),
                    {"account_ids": [str(account_id) for account_id in account_ids]},
                )
                session.execute(
                    text(
                        """
                        delete from identity.authorization_audit_events
                        where actor_account_id = any(:account_ids)
                           or subject_account_id = any(:account_ids)
                        """
                    ),
                    {"account_ids": account_ids},
                )
                session.execute(
                    text(
                        """
                        delete from identity.account_state_events
                        where account_id = any(:account_ids)
                           or actor_account_id = any(:account_ids)
                        """
                    ),
                    {"account_ids": account_ids},
                )
            session.execute(text("delete from identity.accounts where email like 'moderation-test-%'"))
            session.execute(text("delete from auth.users where email like 'moderation-test-%'"))
            session.commit()

    clear()
    try:
        yield
    finally:
        clear()


def _insert_account(session: object, account_id: UUID, suffix: str) -> str:
    email = f"moderation-test-{suffix}-{account_id}@example.invalid"
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
        text("insert into identity.accounts (account_id, email) values (:account_id, :email)"),
        {"account_id": account_id, "email": email},
    )
    return email


def _identity(
    account_id: UUID,
    email: str,
    *,
    capabilities: set[str] | None = None,
    state: AccountState = AccountState.ACTIVE,
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=email,
        session_id=f"session-{account_id}",
        state=state,
        roles=frozenset({"moderator"} if capabilities else {"account"}),
        capabilities=frozenset(capabilities or set()),
        authenticated_at=now,
        authentication_method="email_otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def test_moderation_suspension_appeal_and_restoration_are_atomic_and_append_only(
    real_db_url: str,
) -> None:
    _ = real_db_url
    moderator_id = uuid4()
    account_id = uuid4()
    with session_scope() as session:
        assert session is not None
        moderator_email = _insert_account(session, moderator_id, "moderator")
        account_email = _insert_account(session, account_id, "account")
        session.commit()

    moderator = _identity(
        moderator_id,
        moderator_email,
        capabilities={
            "moderation.case.read",
            "moderation.sanction.issue",
            "moderation.sanction.manage",
            "moderation.appeal.decide",
            "moderation.metrics",
        },
    )
    now = datetime.now(UTC)
    suspended = issue_moderation_action(
        account_id,
        IssueModerationActionCommand(
            idempotency_key="moderation-suspend-real-db",
            expected_version=1,
            kind=ModerationActionKind.ACCOUNT_SUSPENDED,
            scope="account",
            reason_code="abuse.investigation",
            internal_explanation="The account is suspended while a bounded abuse case is investigated.",
            user_visible_explanation="Your account is suspended while the reported activity is reviewed.",
            starts_at=now,
        ),
        moderator,
        uuid4(),
    )
    assert suspended.account_state == AccountState.SUSPENDED.value
    assert suspended.version == 2
    assert len(suspended.actions) == 1
    sanction = suspended.actions[0]
    assert sanction.effective is True

    with pytest.raises(HTTPException) as self_conflict:
        issue_moderation_action(
            moderator_id,
            IssueModerationActionCommand(
                idempotency_key="moderation-self-real-db",
                expected_version=1,
                kind=ModerationActionKind.WARNING,
                scope="account",
                reason_code="operator.conflict",
                internal_explanation="This command must be denied because it targets the actor.",
                user_visible_explanation="This action cannot be completed by the same account.",
                starts_at=now,
            ),
            moderator,
            uuid4(),
        )
    assert self_conflict.value.status_code == 403

    appellant = _identity(account_id, account_email, state=AccountState.SUSPENDED)
    submitted = submit_appeal(
        SubmitAppealCommand(
            idempotency_key="appeal-submit-real-db",
            sanction_action_id=sanction.action_id,
            appellant_message=(
                "I request review because the reported activity did not originate from my account."
            ),
        ),
        appellant,
        uuid4(),
    )
    assert submitted.state.value == "open"
    assert submitted.account_id == account_id

    claimed = claim_appeal(
        submitted.appeal_case_id,
        ClaimAppealCommand(
            idempotency_key="appeal-claim-real-db",
            expected_version=submitted.version,
        ),
        moderator,
        uuid4(),
    )
    assert claimed.state.value == "under_review"
    assert claimed.primary_assignee_id == moderator_id

    decided = decide_appeal(
        submitted.appeal_case_id,
        DecideAppealCommand(
            idempotency_key="appeal-decide-real-db",
            expected_version=claimed.version,
            outcome=AppealDecisionOutcome.OVERTURNED,
            reason_code="appeal.identity-mismatch",
            internal_resolution="The evidence links the activity to a different account.",
            user_visible_resolution="The suspension has been removed after review of the evidence.",
        ),
        moderator,
        uuid4(),
    )
    assert decided.state.value == "closed"
    assert decided.outcome is AppealDecisionOutcome.OVERTURNED

    with session_scope() as session:
        assert session is not None
        account_state = session.execute(
            text("select state::text from identity.accounts where account_id = :account_id"),
            {"account_id": account_id},
        ).scalar_one()
        action_rows = session.execute(
            text(
                """
                select kind::text, supersedes_action_id
                from review_moderation.moderation_actions
                where account_id = :account_id
                order by resulting_version
                """
            ),
            {"account_id": account_id},
        ).mappings().all()
        appeal_events = session.execute(
            text(
                """
                select event_type
                from review_moderation.appeal_events
                where appeal_case_id = :appeal_case_id
                order by occurred_at
                """
            ),
            {"appeal_case_id": submitted.appeal_case_id},
        ).scalars().all()
        moderation_audit = session.execute(
            text(
                """
                select count(*)
                from review_moderation.moderation_audit_events
                where account_id = :account_id and outcome = 'succeeded'
                """
            ),
            {"account_id": account_id},
        ).scalar_one()
        identity_events = session.execute(
            text(
                """
                select previous_state::text, next_state::text
                from identity.account_state_events
                where account_id = :account_id
                order by occurred_at
                """
            ),
            {"account_id": account_id},
        ).all()
        outbox_types = session.execute(
            text(
                """
                select event_type
                from integration.outbox_events
                where source_context = 'review-moderation'
                  and correlation_id is not null
                  and (
                    aggregate_id = :account_id_text
                    or aggregate_id = :appeal_case_id_text
                  )
                order by occurred_at
                """
            ),
            {
                "account_id_text": str(account_id),
                "appeal_case_id_text": str(submitted.appeal_case_id),
            },
        ).scalars().all()

    assert account_state == AccountState.ACTIVE.value
    assert [row["kind"] for row in action_rows] == ["account_suspended", "restoration"]
    assert action_rows[1]["supersedes_action_id"] == sanction.action_id
    assert appeal_events == ["appeal.submitted", "appeal.claimed", "appeal.decided"]
    assert moderation_audit == 4
    assert identity_events == [("active", "suspended"), ("suspended", "active")]
    assert "moderation.sanction-issued" in outbox_types
    assert "moderation.appeal-submitted" in outbox_types
    assert "moderation.appeal-decided" in outbox_types
