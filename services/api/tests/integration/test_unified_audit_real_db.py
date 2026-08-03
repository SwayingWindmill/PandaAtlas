from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.audit.models import (
    GenerateAuditIntegritySummaryCommand,
    VerifyAuditIntegritySummaryCommand,
)
from app.audit.service import AuditConflictError, AuditPayloadRejectedError, AuditService
from app.core.config import settings
from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run unified Audit database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def enable_audit(real_db_url: str, monkeypatch: pytest.MonkeyPatch) -> None:
    _ = real_db_url
    monkeypatch.setattr(settings, "unified_audit_enabled", True)


def _insert_account(session: object, account_id: UUID, role_key: str) -> RequestIdentity:
    email = f"audit-test-{account_id}@example.invalid"
    correlation_id = uuid4()
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
    session.execute(
        text(
            """
            insert into identity.role_assignments (
              account_id, role_key, assigned_by_account_id, reason, source,
              correlation_id, idempotency_key
            ) values (
              :account_id, :role_key, :account_id, 'Unified Audit integration test',
              'test', :correlation_id, :idempotency_key
            )
            """
        ),
        {
            "account_id": account_id,
            "role_key": role_key,
            "correlation_id": correlation_id,
            "idempotency_key": f"audit-role-{uuid4()}",
        },
    )
    now = datetime.now(UTC)
    capabilities = {"account.session.read", "admin.shell.access", "audit.read"}
    if role_key == "audit_exporter":
        capabilities.update({"audit.export", "audit.integrity.manage"})
    return RequestIdentity(
        account_id=account_id,
        email=email,
        session_id=f"audit-session-{uuid4()}",
        state=AccountState.ACTIVE,
        roles=frozenset({role_key}),
        capabilities=frozenset(capabilities),
        authenticated_at=now,
        authentication_method="test",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal2",
        recent_auth=True,
    )


def test_source_events_project_and_search_reads_are_audited(real_db_url: str) -> None:
    _ = real_db_url
    actor_id = uuid4()
    correlation_id = uuid4()
    source_event_id: UUID

    with session_scope() as session:
        assert session is not None
        identity = _insert_account(session, actor_id, "audit_reader")
        source_event_id = session.execute(
            text(
                """
                insert into engagement.audit_events (
                  event_type, actor_account_id, subject_account_id,
                  target_type, target_id, outcome, reason, details,
                  correlation_id, idempotency_key
                ) values (
                  'engagement.preference.read', :actor_account_id, :actor_account_id,
                  'preference', 'digest-email', 'allowed', 'Operator support review',
                  '{"private_note":"not copied","access_token":"not copied"}'::jsonb,
                  :correlation_id, :idempotency_key
                )
                returning audit_id
                """
            ),
            {
                "actor_account_id": actor_id,
                "correlation_id": correlation_id,
                "idempotency_key": f"engagement-audit-{uuid4()}",
            },
        ).scalar_one()
        projected = session.execute(
            text(
                """
                select source_context, action, target_type, target_id,
                       actor_role_snapshot, details_hash
                from audit.event_facts
                where source_context = 'engagement' and source_event_id = :source_event_id
                """
            ),
            {"source_event_id": source_event_id},
        ).mappings().one()
        assert projected["action"] == "engagement.preference.read"
        assert projected["target_id"] == "digest-email"
        assert projected["actor_role_snapshot"][0]["role_key"] == "audit_reader"
        assert len(projected["details_hash"]) == 64
        assert session.execute(
            text(
                """
                select count(*)
                from information_schema.columns
                where table_schema = 'audit' and table_name = 'event_facts'
                  and column_name in ('details', 'payload', 'email', 'token')
                """
            )
        ).scalar_one() == 0

        result = AuditService(session).search(
            identity=identity,
            correlation_id=uuid4(),
            reason="Investigate a support escalation",
            source_context="engagement",
            action="engagement.preference.read",
            actor_account_id=actor_id,
        )
        assert [item.source_event_id for item in result.items] == [source_event_id]
        assert session.execute(
            text(
                """
                select count(*)
                from audit.event_facts
                where action = 'audit.events.search'
                  and actor_account_id = :actor_account_id
                  and sensitive_read
                """
            ),
            {"actor_account_id": actor_id},
        ).scalar_one() == 1

        with pytest.raises(AuditPayloadRejectedError):
            AuditService(session).metrics(
                identity=identity,
                correlation_id=uuid4(),
                reason="Send results to audit-user@example.invalid",
            )
        assert session.execute(
            text(
                """
                select count(*) from audit.rejected_payloads
                where actor_account_id = :actor_account_id
                  and payload_hash ~ '^[0-9a-f]{64}$'
                """
            ),
            {"actor_account_id": actor_id},
        ).scalar_one() == 1
        assert session.execute(
            text(
                """
                select count(*)
                from identity.role_capabilities
                where role_key = 'audit_reader' and capability_key = 'audit.export'
                """
            )
        ).scalar_one() == 0
        session.commit()


def test_integrity_summary_detects_late_append_only_event(real_db_url: str) -> None:
    _ = real_db_url
    actor_id = uuid4()
    now = datetime.now(UTC)
    range_started_at = now - timedelta(minutes=20)
    range_ended_at = now - timedelta(minutes=5)

    with session_scope() as session:
        assert session is not None
        identity = _insert_account(session, actor_id, "audit_exporter")
        session.execute(
            text(
                """
                insert into activity.audit_events (
                  event_type, actor_account_id, target_type, target_id,
                  reason, details, correlation_id, occurred_at
                ) values (
                  'activity.projection.rebuild', :actor_account_id,
                  'activity', :target_id, 'Rebuild verified', '{}'::jsonb,
                  :correlation_id, :occurred_at
                )
                """
            ),
            {
                "actor_account_id": actor_id,
                "target_id": f"activity-{uuid4()}",
                "correlation_id": uuid4(),
                "occurred_at": now - timedelta(minutes=10),
            },
        )
        service = AuditService(session)
        with pytest.raises(AuditConflictError):
            service.generate_integrity_summary(
                identity=identity,
                correlation_id=uuid4(),
                command=GenerateAuditIntegritySummaryCommand(
                    range_started_at=now,
                    range_ended_at=now + timedelta(minutes=5),
                    reason="Reject an open Audit window",
                    idempotency_key=f"audit-summary-{uuid4()}",
                ),
            )
        summary = service.generate_integrity_summary(
            identity=identity,
            correlation_id=uuid4(),
            command=GenerateAuditIntegritySummaryCommand(
                range_started_at=range_started_at,
                range_ended_at=range_ended_at,
                reason="Seal the completed Audit window",
                idempotency_key=f"audit-summary-{uuid4()}",
            ),
        )
        first_check = service.verify_integrity_summary(
            identity=identity,
            correlation_id=uuid4(),
            summary_id=summary.summary_id,
            command=VerifyAuditIntegritySummaryCommand(
                reason="Verify the completed Audit window",
                idempotency_key=f"audit-check-{uuid4()}",
            ),
        )
        assert first_check.matched is True

        session.execute(
            text(
                """
                insert into activity.audit_events (
                  event_type, actor_account_id, target_type, target_id,
                  reason, details, correlation_id, occurred_at
                ) values (
                  'activity.projection.late_fact', :actor_account_id,
                  'activity', :target_id, 'Late evidence arrived', '{}'::jsonb,
                  :correlation_id, :occurred_at
                )
                """
            ),
            {
                "actor_account_id": actor_id,
                "target_id": f"activity-{uuid4()}",
                "correlation_id": uuid4(),
                "occurred_at": now - timedelta(minutes=8),
            },
        )
        second_check = service.verify_integrity_summary(
            identity=identity,
            correlation_id=uuid4(),
            summary_id=summary.summary_id,
            command=VerifyAuditIntegritySummaryCommand(
                reason="Verify after late evidence arrival",
                idempotency_key=f"audit-check-{uuid4()}",
            ),
        )
        assert second_check.matched is False

        event_id = session.execute(
            text("select event_id from audit.event_facts order by occurred_at limit 1")
        ).scalar_one()
        with pytest.raises(DBAPIError):
            session.execute(
                text("update audit.event_facts set result = 'changed' where event_id = :event_id"),
                {"event_id": event_id},
            )
        session.rollback()
