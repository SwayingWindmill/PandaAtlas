from __future__ import annotations

import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.audit.exports import AuditExportService
from app.audit.models import (
    AuditExportScope,
    CreateAuditExportCommand,
    GenerateAuditIntegritySummaryCommand,
    VerifyAuditIntegritySummaryCommand,
)
from app.audit.service import (
    AuditConflictError,
    AuditNotFoundError,
    AuditPayloadRejectedError,
    AuditService,
)
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


def test_encrypted_export_and_attachment_reads_are_audited(real_db_url: str) -> None:
    _ = real_db_url
    actor_id = uuid4()
    submission_id = uuid4()
    attachment_id = uuid4()

    with session_scope() as session:
        assert session is not None
        identity = _insert_account(session, actor_id, "audit_exporter")
        source_event_id = session.execute(
            text(
                """
                insert into activity.audit_events (
                  event_type, actor_account_id, target_type, target_id,
                  reason, details, correlation_id
                ) values (
                  'activity.export.fixture', :actor_account_id,
                  'activity', :target_id, 'Prepare restricted export evidence',
                  '{"private_note":"never-export-raw","internal_marker":"not-copied"}'::jsonb,
                  :correlation_id
                )
                returning event_id
                """
            ),
            {
                "actor_account_id": actor_id,
                "target_id": f"activity-{uuid4()}",
                "correlation_id": uuid4(),
            },
        ).scalar_one()
        command = CreateAuditExportCommand(
            scope=AuditExportScope(
                source_context="activity",
                actor_account_id=actor_id,
            ),
            reason="Export activity evidence for a bounded investigation",
            expires_in_seconds=3600,
            idempotency_key=f"audit-export-{uuid4()}",
        )
        service = AuditExportService(session)
        artifact = service.create(
            identity=identity,
            correlation_id=uuid4(),
            command=command,
        )
        stored = session.execute(
            text(
                """
                select encrypted_payload, nonce, file_sha256, expires_at - created_at as lifetime
                from audit.export_artifacts
                where artifact_id = :artifact_id
                """
            ),
            {"artifact_id": artifact.artifact_id},
        ).mappings().one()
        ciphertext = bytes(stored["encrypted_payload"])
        assert b"activity.export.fixture" not in ciphertext
        assert b"never-export-raw" not in ciphertext
        assert len(bytes(stored["nonce"])) == 12
        assert stored["lifetime"] <= timedelta(hours=24)

        replay = service.create(
            identity=identity,
            correlation_id=uuid4(),
            command=command,
        )
        assert replay.artifact_id == artifact.artifact_id
        with pytest.raises(AuditConflictError):
            service.create(
                identity=identity,
                correlation_id=uuid4(),
                command=command.model_copy(update={"reason": "A different export purpose"}),
            )

        download = service.download(
            identity=identity,
            correlation_id=uuid4(),
            artifact_id=artifact.artifact_id,
            reason="Download the bounded investigation export",
        )
        assert sha256(download.content).hexdigest() == artifact.file_sha256
        exported = [json.loads(line) for line in download.content.splitlines()]
        assert [row["source_event_id"] for row in exported] == [str(source_event_id)]
        assert "details" not in exported[0]
        assert "payload" not in exported[0]
        assert exported[0]["details_hash"]
        assert b"never-export-raw" not in download.content
        assert session.execute(
            text(
                """
                select count(*) from audit.event_facts
                where actor_account_id = :actor_account_id
                  and event_class = 'export'
                  and action in ('audit.export.generate', 'audit.export.download')
                """
            ),
            {"actor_account_id": actor_id},
        ).scalar_one() == 2

        other_actor_id = uuid4()
        other_identity = _insert_account(session, other_actor_id, "audit_exporter")
        with pytest.raises(AuditNotFoundError):
            service.download(
                identity=other_identity,
                correlation_id=uuid4(),
                artifact_id=artifact.artifact_id,
                reason="Attempt a cross-account export download",
            )
        assert session.execute(
            text(
                """
                select count(*) from audit.event_facts
                where actor_account_id = :actor_account_id
                  and action = 'audit.export.download'
                  and result = 'denied'
                """
            ),
            {"actor_account_id": other_actor_id},
        ).scalar_one() == 1

        session.execute(
            text(
                """
                insert into community_intake.submissions (
                  submission_id, account_id, contributor_subject_hash,
                  submission_type, target_type, target_id, public_version_seen
                ) values (
                  :submission_id, :account_id, :subject_hash,
                  'sourced_information', 'panda', 'panda-test', 'test-release'
                )
                """
            ),
            {
                "submission_id": submission_id,
                "account_id": actor_id,
                "subject_hash": "a" * 64,
            },
        )
        session.execute(
            text(
                """
                insert into community_intake.attachments (
                  attachment_id, submission_id, storage_object_key,
                  original_filename, media_type, byte_size, state
                ) values (
                  :attachment_id, :submission_id, :storage_object_key,
                  'evidence.pdf', 'application/pdf', 10, 'clean'
                )
                """
            ),
            {
                "attachment_id": attachment_id,
                "submission_id": submission_id,
                "storage_object_key": f"audit-test/{attachment_id}",
            },
        )
        read_event_id = session.execute(
            text(
                """
                insert into community_intake.sensitive_read_events (
                  attachment_id, actor_subject_hash, purpose, outcome,
                  reference_jti_hash, reference_expires_at, correlation_id
                ) values (
                  :attachment_id, :actor_subject_hash, 'Review raw evidence', 'granted',
                  :reference_jti_hash, now() + interval '5 minutes', :correlation_id
                )
                returning read_event_id
                """
            ),
            {
                "attachment_id": attachment_id,
                "actor_subject_hash": "b" * 64,
                "reference_jti_hash": "c" * 64,
                "correlation_id": uuid4(),
            },
        ).scalar_one()
        projected = session.execute(
            text(
                """
                select action, target_id, sensitive_read, actor_subject_hash, details_hash
                from audit.event_facts
                where source_context = 'community_intake_evidence'
                  and source_event_id = :source_event_id
                """
            ),
            {"source_event_id": read_event_id},
        ).mappings().one()
        assert projected["action"] == "community.attachment.access"
        assert projected["target_id"] == str(attachment_id)
        assert projected["sensitive_read"] is True
        assert projected["actor_subject_hash"] == "b" * 64
        assert len(projected["details_hash"]) == 64
        session.commit()
