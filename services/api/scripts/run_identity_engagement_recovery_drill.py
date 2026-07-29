from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.engagement.models import EngagementAccountUnavailableError
from app.engagement.repository import EngagementRepository
from app.identity.models import AccountState, RequestIdentity

REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = Path(os.getenv("RELEASE_GATE_REPORT_DIR", REPO_ROOT / ".release-gate"))
REPORT_PATH = REPORT_DIR / "identity-engagement-recovery.json"


def _identity(account_id: UUID, state: AccountState = AccountState.ACTIVE) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email="identity-engagement-recovery@example.invalid",
        session_id="identity-engagement-recovery",
        state=state,
        roles=frozenset({"member"}),
        capabilities=frozenset({"account.session.read"}),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def _count(session: Session, sql: str, **params: Any) -> int:
    return int(session.execute(text(sql), params).scalar_one())


def _private_counts(session: Session, account_id: UUID) -> dict[str, int]:
    tables = (
        "follows",
        "notification_preferences",
        "passport_entries",
        "passport_contribution_events",
    )
    return {
        table: _count(
            session,
            f"select count(*) from engagement.{table} where account_id = :account_id",
            account_id=account_id,
        )
        for table in tables
    }


def _sha256_json(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def run_drill(database_url: str) -> dict[str, Any]:
    started = time.monotonic()
    engine = create_engine(database_url, pool_pre_ping=True)
    account_id = uuid4()
    correlation_id = uuid4()
    deletion_key = f"identity-engagement-recovery-delete-{uuid4()}"
    report: dict[str, Any] = {
        "schema_version": 1,
        "gate": "identity-engagement-recovery",
        "outcome": "failed",
        "started_at": datetime.now(UTC).isoformat(),
        "checks": [],
        "metrics": {},
        "evidence": {},
    }

    with engine.connect() as connection:
        outer_transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            email = f"identity-engagement-recovery-{account_id}@example.invalid"
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
                      '{"provider":"email","providers":["email"]}', '{}', now(), now()
                    )
                    """
                ),
                {"account_id": account_id, "email": email},
            )
            session.execute(
                text("insert into identity.accounts (account_id, email) values (:id, :email)"),
                {"id": account_id, "email": email},
            )
            panda_ids = [
                str(row[0])
                for row in session.execute(
                    text("select id::text from public.pandas order by slug limit 2")
                ).all()
            ]
            if len(panda_ids) != 2:
                raise RuntimeError("Recovery drill requires at least two seeded pandas")
            session.commit()

            repository = EngagementRepository(session)
            active_identity = _identity(account_id)
            pending = repository.create_pending_intent(
                panda_id=panda_ids[0],
                locale="zh",
                safe_return_path="https://attacker.invalid/ignored",
                existing_handle=None,
                request_id=uuid4(),
                correlation_id=correlation_id,
            )
            repository.complete_pending_follow(
                identity=active_identity,
                handle=pending.handle,
                idempotency_key=f"complete-{uuid4()}",
                correlation_id=correlation_id,
            )
            repository.set_notification_preference(
                identity=active_identity,
                category="major_activity",
                channel="email",
                enabled=True,
                idempotency_key=f"consent-{uuid4()}",
                correlation_id=correlation_id,
            )
            repository.record_passport_contribution(
                account_id=account_id,
                panda_id=panda_ids[1],
                source_event_id=uuid4(),
                occurred_at=datetime.now(UTC),
                correlation_id=correlation_id,
            )
            before = _private_counts(session, account_id)
            report["evidence"]["before_private_state_sha256"] = _sha256_json(before)
            report["metrics"]["private_rows_before_deletion"] = sum(before.values())

            session.execute(
                text("update identity.accounts set state = 'deleting' where account_id = :id"),
                {"id": account_id},
            )
            session.commit()
            deleting_identity = _identity(account_id, AccountState.DELETING)
            first = repository.delete_private_data(
                identity=deleting_identity,
                idempotency_key=deletion_key,
                reason="map-close-recovery-drill",
                correlation_id=correlation_id,
            )
            retry = repository.delete_private_data(
                identity=deleting_identity,
                idempotency_key=deletion_key,
                reason="map-close-recovery-drill",
                correlation_id=correlation_id,
            )
            if first != retry:
                raise RuntimeError("Deletion retry did not replay the original result")
            after = _private_counts(session, account_id)
            if any(after.values()):
                raise RuntimeError(f"Private engagement rows remain after deletion: {after}")
            report["checks"].append("private-data-deletion-idempotent")

            deletion_audits = _count(
                session,
                """
                select count(*) from engagement.audit_events
                where subject_account_id = :account_id
                  and event_type = 'engagement.private_data.deleted'
                  and idempotency_key = :idempotency_key
                """,
                account_id=account_id,
                idempotency_key=deletion_key,
            )
            deletion_outbox = _count(
                session,
                """
                select count(*) from integration.outbox_events
                where source_context = 'identity-engagement'
                  and event_type = 'engagement.private_data.deleted'
                  and aggregate_id = :aggregate_id
                """,
                aggregate_id=str(account_id),
            )
            retained_follow_events = _count(
                session,
                """
                select count(*) from engagement.follow_events
                where account_subject_hash = encode(digest(:account_id, 'sha256'), 'hex')
                """,
                account_id=str(account_id),
            )
            if deletion_audits != 1 or deletion_outbox != 1 or retained_follow_events < 1:
                raise RuntimeError(
                    "Deletion evidence was duplicated or anonymous aggregate facts were lost"
                )
            report["checks"].append(
                "audit-outbox-once-and-anonymous-history-preserved"
            )
            report["metrics"].update(
                {
                    "deletion_audit_events": deletion_audits,
                    "deletion_outbox_events": deletion_outbox,
                    "retained_hashed_follow_events": retained_follow_events,
                }
            )

            session.execute(
                text("update identity.accounts set state = 'deleted' where account_id = :id"),
                {"id": account_id},
            )
            session.commit()
            try:
                repository.follow(
                    identity=active_identity,
                    panda_id=panda_ids[0],
                    idempotency_key=f"blocked-after-delete-{uuid4()}",
                    correlation_id=correlation_id,
                )
            except EngagementAccountUnavailableError:
                report["checks"].append("deleted-account-remains-fail-closed")
            else:
                raise RuntimeError("Deleted account unexpectedly accepted a Follow command")
        finally:
            session.close()
            outer_transaction.rollback()

    with engine.connect() as verification:
        account_rows = int(
            verification.execute(
                text("select count(*) from identity.accounts where account_id = :id"),
                {"id": account_id},
            ).scalar_one()
        )
        auth_rows = int(
            verification.execute(
                text("select count(*) from auth.users where id = :id"),
                {"id": account_id},
            ).scalar_one()
        )
    engine.dispose()
    if account_rows or auth_rows:
        raise RuntimeError("Outer transaction restore left synthetic identity rows behind")
    report["checks"].append("outer-transaction-restore-removed-synthetic-account")
    report["metrics"]["restore_residual_identity_rows"] = account_rows + auth_rows
    report["metrics"]["duration_seconds"] = round(time.monotonic() - started, 6)
    report["evidence"]["account_subject_sha256"] = hashlib.sha256(
        str(account_id).encode()
    ).hexdigest()
    report["outcome"] = "passed"
    report["finished_at"] = datetime.now(UTC).isoformat()
    return report


def main() -> int:
    database_url = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        print("REAL_DB_URL or DATABASE_URL is required", file=sys.stderr)
        return 2
    try:
        report = run_drill(database_url)
    except Exception as error:  # noqa: BLE001 - release evidence must record every failure.
        report = {
            "schema_version": 1,
            "gate": "identity-engagement-recovery",
            "outcome": "failed",
            "finished_at": datetime.now(UTC).isoformat(),
            "error": str(error),
        }
        exit_code = 1
    else:
        exit_code = 0
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if exit_code:
        print(report["error"], file=sys.stderr)
    else:
        print(
            "Identity/engagement recovery drill passed: deletion replayed once "
            "and outer transaction restored."
        )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
