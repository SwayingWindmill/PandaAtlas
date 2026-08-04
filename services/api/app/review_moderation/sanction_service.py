from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import has_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.review_moderation.sanction_models import (
    AcknowledgeAppealCommand,
    AppealCaseList,
    AppealCaseRead,
    AppealDecisionOutcome,
    AppealDecisionRead,
    AppealState,
    DecideAppealCommand,
    IssueSanctionCommand,
    ModerationMetricsRead,
    ModerationNoticeRead,
    ModerationSubjectList,
    ModerationSubjectRead,
    OpenAppealCommand,
    RestoreSanctionCommand,
    SanctionKind,
    SanctionRead,
    TemporarySubmissionFreezeCommand,
)


@contextmanager
def _moderation_session() -> Iterator[Session]:
    if not settings.moderation_controls_enabled:
        raise HTTPException(status_code=404, detail={"code": "moderation_controls_disabled"})
    if not has_database():
        raise HTTPException(status_code=503, detail={"code": "authoritative_database_unavailable"})
    with session_scope() as session:
        if session is None:
            raise HTTPException(
                status_code=503,
                detail={"code": "authoritative_database_unavailable"},
            )
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def _conflict(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=409, detail={"code": code, "message": message})


def _forbidden(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=403, detail={"code": code, "message": message})


def _fingerprint(command: BaseModel) -> str:
    payload = command.model_dump(mode="json", exclude={"idempotency_key"})
    encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _scoped_key(*parts: object) -> str:
    encoded = ":".join(str(part) for part in parts).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _receipt(
    session: Session,
    *,
    actor_account_id: UUID,
    idempotency_key: str,
    command_name: str,
    fingerprint: str,
) -> tuple[str, UUID] | None:
    row = session.execute(
        text(
            """
            select command_name, result_type, result_id, request_fingerprint
            from review_moderation.moderation_command_receipts
            where actor_account_id = :actor_account_id
              and idempotency_key = :idempotency_key
            """
        ),
        {"actor_account_id": actor_account_id, "idempotency_key": idempotency_key},
    ).mappings().one_or_none()
    if row is None:
        return None
    if row["command_name"] != command_name or row["request_fingerprint"] != fingerprint:
        raise _conflict("idempotency_key_reused", "Idempotency key was reused")
    return str(row["result_type"]), UUID(str(row["result_id"]))


def _record_receipt(
    session: Session,
    *,
    actor_account_id: UUID,
    idempotency_key: str,
    command_name: str,
    result_type: str,
    result_id: UUID,
    fingerprint: str,
) -> None:
    session.execute(
        text(
            """
            insert into review_moderation.moderation_command_receipts (
              actor_account_id, idempotency_key, command_name, result_type,
              result_id, request_fingerprint
            ) values (
              :actor_account_id, :idempotency_key, :command_name, :result_type,
              :result_id, :request_fingerprint
            )
            """
        ),
        {
            "actor_account_id": actor_account_id,
            "idempotency_key": idempotency_key,
            "command_name": command_name,
            "result_type": result_type,
            "result_id": result_id,
            "request_fingerprint": fingerprint,
        },
    )


def _audit(
    session: Session,
    *,
    account_id: UUID | None,
    sanction_id: UUID | None,
    appeal_case_id: UUID | None,
    actor_account_id: UUID | None,
    event_type: str,
    outcome: str,
    reason: str | None,
    details: dict[str, Any],
    correlation_id: UUID,
    idempotency_key: str | None,
) -> None:
    session.execute(
        text(
            """
            insert into review_moderation.moderation_audit_events (
              account_id, sanction_id, appeal_case_id, actor_account_id, event_type,
              outcome, reason, details, correlation_id, idempotency_key
            ) values (
              :account_id, :sanction_id, :appeal_case_id, :actor_account_id, :event_type,
              :outcome, :reason, cast(:details as jsonb), :correlation_id, :idempotency_key
            )
            """
        ),
        {
            "account_id": account_id,
            "sanction_id": sanction_id,
            "appeal_case_id": appeal_case_id,
            "actor_account_id": actor_account_id,
            "event_type": event_type,
            "outcome": outcome,
            "reason": reason,
            "details": json.dumps(details, separators=(",", ":"), sort_keys=True),
            "correlation_id": correlation_id,
            "idempotency_key": idempotency_key,
        },
    )


def _outbox(
    session: Session,
    *,
    event_type: str,
    aggregate_type: str,
    aggregate_id: UUID,
    aggregate_version: int,
    idempotency_key: str,
    correlation_id: UUID,
    payload: dict[str, Any],
    source_context: str = "review_moderation",
) -> None:
    session.execute(
        text(
            """
            insert into integration.outbox_events (
              event_type, event_version, source_context, aggregate_type, aggregate_id,
              aggregate_version, idempotency_key, correlation_id, occurred_at, payload
            ) values (
              :event_type, 1, :source_context, :aggregate_type, :aggregate_id,
              :aggregate_version, :idempotency_key, :correlation_id, now(), cast(:payload as jsonb)
            )
            """
        ),
        {
            "event_type": event_type,
            "source_context": source_context,
            "aggregate_type": aggregate_type,
            "aggregate_id": str(aggregate_id),
            "aggregate_version": aggregate_version,
            "idempotency_key": idempotency_key,
            "correlation_id": correlation_id,
            "payload": json.dumps(payload, separators=(",", ":"), sort_keys=True),
        },
    )


def _ensure_subject(session: Session, account_id: UUID) -> None:
    inserted = session.execute(
        text(
            """
            insert into review_moderation.moderation_subjects (account_id)
            select account_id from identity.accounts where account_id = :account_id
            on conflict (account_id) do nothing
            returning account_id
            """
        ),
        {"account_id": account_id},
    ).scalar_one_or_none()
    if inserted is None:
        exists = session.execute(
            text("select 1 from identity.accounts where account_id = :account_id"),
            {"account_id": account_id},
        ).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=404, detail={"code": "account_not_found"})


def _subject_row(session: Session, account_id: UUID, *, lock: bool = False):
    _ensure_subject(session, account_id)
    locking = "for update of subject, account" if lock else ""
    return session.execute(
        text(
            f"""
            select subject.*, account.state::text as account_state, account.state_reason,
              (subject.submission_restricted and (
                subject.submission_restricted_until is null
                or subject.submission_restricted_until > now()
              )) as effective_submission_restricted,
              (subject.attachment_restricted and (
                subject.attachment_restricted_until is null
                or subject.attachment_restricted_until > now()
              )) as effective_attachment_restricted,
              (subject.notification_restricted and (
                subject.notification_restricted_until is null
                or subject.notification_restricted_until > now()
              )) as effective_notification_restricted,
              (subject.account_suspended and (
                subject.account_restricted_until is null
                or subject.account_restricted_until > now()
              )) as effective_account_suspended,
              (
                (subject.account_suspended and account.state::text <> 'suspended')
                or (not subject.account_suspended and account.state::text = 'suspended'
                  and coalesce(account.state_reason, '') like 'moderation:%')
              ) as inconsistent_account_state
            from review_moderation.moderation_subjects subject
            join identity.accounts account on account.account_id = subject.account_id
            where subject.account_id = :account_id
            {locking}
            """
        ),
        {"account_id": account_id},
    ).mappings().one()


def _sanctions(session: Session, account_id: UUID, *, include_internal: bool) -> list[SanctionRead]:
    rows = session.execute(
        text(
            """
            select sanction.*,
                   restoration.restored_at,
                   (restoration.restoration_id is null
                     and sanction.starts_at <= now()
                     and (sanction.ends_at is null or sanction.ends_at > now())
                     and (
                       sanction.sanction_id = subject.warning_sanction_id
                       or sanction.sanction_id = subject.submission_sanction_id
                       or sanction.sanction_id = subject.attachment_sanction_id
                       or sanction.sanction_id = subject.notification_sanction_id
                       or sanction.sanction_id = subject.account_sanction_id
                     )) as active,
                   (restoration.restoration_id is null
                     and sanction.starts_at <= now()
                     and (sanction.ends_at is null or sanction.ends_at > now())
                     and (
                       sanction.sanction_id = subject.warning_sanction_id
                       or sanction.sanction_id = subject.submission_sanction_id
                       or sanction.sanction_id = subject.attachment_sanction_id
                       or sanction.sanction_id = subject.notification_sanction_id
                       or sanction.sanction_id = subject.account_sanction_id
                     )
                     and not exists (
                       select 1
                       from review_moderation.appeal_cases appeal
                       where appeal.sanction_id = sanction.sanction_id
                         and appeal.state <> 'closed'
                     )) as appealable
            from review_moderation.sanctions sanction
            join review_moderation.moderation_subjects subject
              on subject.account_id = sanction.account_id
            left join review_moderation.restoration_events restoration
              on restoration.sanction_id = sanction.sanction_id
            where sanction.account_id = :account_id
            order by sanction.created_at desc, sanction.sanction_id desc
            limit 100
            """
        ),
        {"account_id": account_id},
    ).mappings().all()
    return [
        SanctionRead(
            sanction_id=row["sanction_id"],
            account_id=row["account_id"],
            kind=row["kind"],
            scope=row["scope"],
            reason_code=row["reason_code"],
            internal_explanation=row["internal_explanation"] if include_internal else None,
            user_visible_explanation=row["user_visible_explanation"],
            starts_at=row["starts_at"],
            ends_at=row["ends_at"],
            issued_by_account_id=row["issued_by_account_id"],
            subject_version_before=row["subject_version_before"],
            subject_version_after=row["subject_version_after"],
            created_at=row["created_at"],
            active=bool(row["active"]),
            appealable=bool(row["appealable"]),
            restored_at=row["restored_at"],
        )
        for row in rows
    ]


def _appeal_from_row(session: Session, row: Any, *, include_internal: bool) -> AppealCaseRead:
    decision = session.execute(
        text(
            """
            select * from review_moderation.appeal_decisions
            where appeal_case_id = :appeal_case_id
            """
        ),
        {"appeal_case_id": row["appeal_case_id"]},
    ).mappings().one_or_none()
    decision_read = None
    if decision is not None:
        decision_read = AppealDecisionRead(
            decision_id=decision["decision_id"],
            appeal_case_id=decision["appeal_case_id"],
            outcome=decision["outcome"],
            internal_explanation=(
                decision["internal_explanation"] if include_internal else None
            ),
            user_visible_explanation=decision["user_visible_explanation"],
            decided_by_account_id=decision["decided_by_account_id"],
            decided_at=decision["decided_at"],
        )
    return AppealCaseRead(
        appeal_case_id=row["appeal_case_id"],
        account_id=row["account_id"],
        sanction_id=row["sanction_id"],
        state=row["state"],
        version=row["version"],
        user_statement=row["user_statement"],
        first_response_due_at=row["first_response_due_at"],
        first_responded_at=row["first_responded_at"],
        sla_overdue=bool(row["appeal_sla_overdue"]),
        age_seconds=int(row["age_seconds"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        decision=decision_read,
    )


def _appeals(
    session: Session,
    *,
    account_id: UUID | None = None,
    state: AppealState | None = None,
    include_internal: bool,
    limit: int = 100,
) -> list[AppealCaseRead]:
    rows = session.execute(
        text(
            """
            select * from review_moderation.appeal_queue
            where (cast(:account_id as uuid) is null or account_id = cast(:account_id as uuid))
              and (cast(:state as text) is null or state::text = cast(:state as text))
            order by appeal_sla_overdue desc, first_response_due_at, created_at
            limit :limit
            """
        ),
        {"account_id": account_id, "state": None if state is None else state.value, "limit": limit},
    ).mappings().all()
    return [_appeal_from_row(session, row, include_internal=include_internal) for row in rows]


def _subject_read(
    session: Session,
    account_id: UUID,
    *,
    include_internal: bool,
) -> ModerationSubjectRead:
    row = _subject_row(session, account_id)
    return ModerationSubjectRead(
        account_id=row["account_id"],
        version=row["version"],
        account_state=row["account_state"],
        submission_restricted=bool(row["effective_submission_restricted"]),
        attachment_restricted=bool(row["effective_attachment_restricted"]),
        notification_restricted=bool(row["effective_notification_restricted"]),
        account_suspended=bool(row["effective_account_suspended"]),
        account_closed_for_abuse=bool(row["account_closed_for_abuse"]),
        submission_restricted_until=row["submission_restricted_until"],
        attachment_restricted_until=row["attachment_restricted_until"],
        notification_restricted_until=row["notification_restricted_until"],
        account_restricted_until=row["account_restricted_until"],
        repeat_abuse_count=row["repeat_abuse_count"],
        inconsistent_account_state=bool(row["inconsistent_account_state"]),
        sanctions=_sanctions(session, account_id, include_internal=include_internal),
        appeals=_appeals(
            session,
            account_id=account_id,
            include_internal=include_internal,
        ),
    )


def _require_recent(identity: RequestIdentity, capability: str) -> None:
    if not identity.recent_auth:
        raise _forbidden("recent_auth_required", "Recent authentication is required")
    if not identity.has_capability(capability):
        raise _forbidden("capability_missing", f"{capability} is required")


def _change_identity_state(
    session: Session,
    *,
    account_id: UUID,
    next_state: AccountState,
    actor: RequestIdentity,
    reason: str,
    idempotency_key: str,
    correlation_id: UUID,
) -> None:
    account = session.execute(
        text(
            """
            select state::text, state_reason
            from identity.accounts
            where account_id = :account_id
            for update
            """
        ),
        {"account_id": account_id},
    ).mappings().one()
    current = AccountState(str(account["state"]))
    if current is next_state:
        return
    if current in {AccountState.DELETING, AccountState.DELETED}:
        raise _conflict(
            "account_state_conflict",
            "Deleting or deleted accounts cannot be moderated",
        )
    if {current, next_state} != {AccountState.ACTIVE, AccountState.SUSPENDED}:
        raise _conflict("account_state_conflict", "Moderation cannot perform this state transition")
    if next_state is AccountState.ACTIVE and not str(account["state_reason"] or "").startswith(
        "moderation:"
    ):
        raise _conflict(
            "account_state_owned_elsewhere",
            "Account suspension is not owned by moderation",
        )
    session.execute(
        text(
            """
            update identity.accounts
            set state = cast(:next_state as identity.account_state),
                state_reason = :reason,
                state_changed_at = now()
            where account_id = :account_id
            """
        ),
        {"account_id": account_id, "next_state": next_state.value, "reason": reason},
    )
    state_key = _scoped_key("moderation-state", account_id, idempotency_key)
    session.execute(
        text(
            """
            insert into identity.account_state_events (
              account_id, previous_state, next_state, actor_account_id, reason,
              correlation_id, idempotency_key
            ) values (
              :account_id, cast(:previous_state as identity.account_state),
              cast(:next_state as identity.account_state), :actor_account_id, :reason,
              :correlation_id, :idempotency_key
            )
            """
        ),
        {
            "account_id": account_id,
            "previous_state": current.value,
            "next_state": next_state.value,
            "actor_account_id": actor.account_id,
            "reason": reason,
            "correlation_id": correlation_id,
            "idempotency_key": state_key,
        },
    )
    session.execute(
        text(
            """
            insert into identity.authorization_audit_events (
              event_type, actor_account_id, subject_account_id, capability_key,
              outcome, reason, details, correlation_id
            ) values (
              'identity.account-state-changed', :actor_account_id, :account_id,
              'moderation.sanction.apply', 'changed', :reason,
              cast(:details as jsonb), :correlation_id
            )
            """
        ),
        {
            "actor_account_id": actor.account_id,
            "account_id": account_id,
            "reason": reason,
            "details": json.dumps(
                {"previous_state": current.value, "next_state": next_state.value},
                separators=(",", ":"),
                sort_keys=True,
            ),
            "correlation_id": correlation_id,
        },
    )
    _outbox(
        session,
        event_type="identity.account-state-changed",
        aggregate_type="account",
        aggregate_id=account_id,
        aggregate_version=0,
        idempotency_key=state_key,
        correlation_id=correlation_id,
        payload={
            "account_id": str(account_id),
            "previous_state": current.value,
            "next_state": next_state.value,
            "actor_account_id": str(actor.account_id),
        },
        source_context="identity",
    )


def _apply_projection(
    session: Session,
    *,
    account_id: UUID,
    sanction_id: UUID,
    command: IssueSanctionCommand,
) -> None:
    updates: dict[SanctionKind, str] = {
        SanctionKind.WARNING: (
            "latest_warning_at = (select starts_at from review_moderation.sanctions "
            "where sanction_id = :sanction_id), warning_sanction_id = :sanction_id"
        ),
        SanctionKind.SUBMISSION_RESTRICTED: (
            "submission_restricted = true, submission_restricted_until = :ends_at, "
            "submission_sanction_id = :sanction_id"
        ),
        SanctionKind.ATTACHMENT_RESTRICTED: (
            "attachment_restricted = true, attachment_restricted_until = :ends_at, "
            "attachment_sanction_id = :sanction_id"
        ),
        SanctionKind.NOTIFICATION_RESTRICTED: (
            "notification_restricted = true, notification_restricted_until = :ends_at, "
            "notification_sanction_id = :sanction_id"
        ),
        SanctionKind.ACCOUNT_SUSPENDED: (
            "account_suspended = true, account_closed_for_abuse = false, "
            "account_restricted_until = :ends_at, account_sanction_id = :sanction_id"
        ),
        SanctionKind.ACCOUNT_CLOSED_FOR_ABUSE: (
            "account_suspended = true, account_closed_for_abuse = true, "
            "account_restricted_until = null, account_sanction_id = :sanction_id"
        ),
    }
    session.execute(
        text(
            f"""
            update review_moderation.moderation_subjects
            set version = version + 1,
                {updates[command.kind]},
                repeat_abuse_count = repeat_abuse_count + :repeat_increment
            where account_id = :account_id
            """
        ),
        {
            "account_id": account_id,
            "sanction_id": sanction_id,
            "ends_at": command.ends_at,
            "repeat_increment": 0 if command.kind is SanctionKind.WARNING else 1,
        },
    )


def issue_sanction(
    account_id: UUID,
    command: IssueSanctionCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
    *,
    temporary_freeze: bool = False,
) -> ModerationSubjectRead:
    capability = (
        "moderation.temporary_submission_freeze"
        if temporary_freeze
        else "moderation.sanction.apply"
    )
    _require_recent(actor, capability)
    if actor.account_id == account_id:
        raise _forbidden("self_moderation_forbidden", "Moderators cannot sanction themselves")
    now = datetime.now(UTC)
    if command.starts_at.tzinfo is None or (
        command.ends_at is not None and command.ends_at.tzinfo is None
    ):
        raise HTTPException(status_code=422, detail={"code": "timezone_required"})
    if command.starts_at > now + timedelta(minutes=5):
        raise HTTPException(status_code=422, detail={"code": "future_start_not_supported"})
    effective_starts_at = min(command.starts_at, now)
    if temporary_freeze:
        if command.kind is not SanctionKind.SUBMISSION_RESTRICTED:
            raise _forbidden("reviewer_scope_exceeded", "Reviewer may only freeze submissions")
        if command.ends_at is None or command.ends_at - effective_starts_at > timedelta(hours=24):
            raise _forbidden(
                "reviewer_duration_exceeded",
                "Reviewer submission freeze may not exceed 24 hours",
            )
    fingerprint = _fingerprint(command)
    command_name = "temporary_submission_freeze" if temporary_freeze else "issue_sanction"
    with _moderation_session() as session:
        replay = _receipt(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            command_name=command_name,
            fingerprint=fingerprint,
        )
        if replay is not None:
            return _subject_read(session, account_id, include_internal=True)
        subject = _subject_row(session, account_id, lock=True)
        if int(subject["version"]) != command.expected_version:
            raise _conflict("subject_version_conflict", "Moderation subject version does not match")
        sanction_id = uuid4()
        next_version = int(subject["version"]) + 1
        session.execute(
            text(
                """
                insert into review_moderation.sanctions (
                  sanction_id, account_id, kind, scope, reason_code, internal_explanation,
                  user_visible_explanation, starts_at, ends_at, issued_by_account_id,
                  subject_version_before, subject_version_after, correlation_id, idempotency_key
                ) values (
                  :sanction_id, :account_id, cast(:kind as review_moderation.sanction_kind),
                  cast(:scope as review_moderation.sanction_scope), :reason_code,
                  :internal_explanation, :user_visible_explanation, :starts_at, :ends_at,
                  :issued_by_account_id, :version_before, :version_after,
                  :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "sanction_id": sanction_id,
                "account_id": account_id,
                "kind": command.kind.value,
                "scope": command.scope.value,
                "reason_code": command.reason_code,
                "internal_explanation": command.internal_explanation,
                "user_visible_explanation": command.user_visible_explanation,
                "starts_at": effective_starts_at,
                "ends_at": command.ends_at,
                "issued_by_account_id": actor.account_id,
                "version_before": command.expected_version,
                "version_after": next_version,
                "correlation_id": correlation_id,
                "idempotency_key": command.idempotency_key,
            },
        )
        _apply_projection(
            session,
            account_id=account_id,
            sanction_id=sanction_id,
            command=command,
        )
        if command.kind in {
            SanctionKind.ACCOUNT_SUSPENDED,
            SanctionKind.ACCOUNT_CLOSED_FOR_ABUSE,
        }:
            _change_identity_state(
                session,
                account_id=account_id,
                next_state=AccountState.SUSPENDED,
                actor=actor,
                reason=f"moderation:{sanction_id}:{command.kind.value}",
                idempotency_key=command.idempotency_key,
                correlation_id=correlation_id,
            )
        _audit(
            session,
            account_id=account_id,
            sanction_id=sanction_id,
            appeal_case_id=None,
            actor_account_id=actor.account_id,
            event_type="moderation.sanction-issued",
            outcome="succeeded",
            reason=command.reason_code,
            details={
                "kind": command.kind.value,
                "scope": command.scope.value,
                "version": next_version,
            },
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        _outbox(
            session,
            event_type="moderation.sanction-issued",
            aggregate_type="moderation_subject",
            aggregate_id=account_id,
            aggregate_version=next_version,
            idempotency_key=_scoped_key(
                "sanction", actor.account_id, command.idempotency_key
            ),
            correlation_id=correlation_id,
            payload={
                "account_id": str(account_id),
                "sanction_id": str(sanction_id),
                "kind": command.kind.value,
                "scope": command.scope.value,
                "starts_at": effective_starts_at.isoformat(),
                "ends_at": None if command.ends_at is None else command.ends_at.isoformat(),
                "user_visible_explanation": command.user_visible_explanation,
            },
        )
        _record_receipt(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            command_name=command_name,
            result_type="sanction",
            result_id=sanction_id,
            fingerprint=fingerprint,
        )
        return _subject_read(session, account_id, include_internal=True)


def issue_temporary_submission_freeze(
    account_id: UUID,
    command: TemporarySubmissionFreezeCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> ModerationSubjectRead:
    return issue_sanction(
        account_id,
        command.as_sanction(),
        actor,
        correlation_id,
        temporary_freeze=True,
    )


def _restore_projection(
    session: Session,
    *,
    account_id: UUID,
    sanction_id: UUID,
    expected_version: int,
    reason_code: str,
    internal_explanation: str,
    user_visible_explanation: str,
    actor: RequestIdentity,
    correlation_id: UUID,
    idempotency_key: str,
) -> UUID:
    subject = _subject_row(session, account_id, lock=True)
    if int(subject["version"]) != expected_version:
        raise _conflict("subject_version_conflict", "Moderation subject version does not match")
    sanction = session.execute(
        text(
            """
            select sanction.*
            from review_moderation.sanctions sanction
            left join review_moderation.restoration_events restoration
              on restoration.sanction_id = sanction.sanction_id
            where sanction.sanction_id = :sanction_id
              and sanction.account_id = :account_id
              and restoration.restoration_id is null
            """
        ),
        {"sanction_id": sanction_id, "account_id": account_id},
    ).mappings().one_or_none()
    if sanction is None:
        raise _conflict("sanction_not_active", "Sanction is not active")
    kind = SanctionKind(str(sanction["kind"]))
    current_id_column = {
        SanctionKind.WARNING: "warning_sanction_id",
        SanctionKind.SUBMISSION_RESTRICTED: "submission_sanction_id",
        SanctionKind.ATTACHMENT_RESTRICTED: "attachment_sanction_id",
        SanctionKind.NOTIFICATION_RESTRICTED: "notification_sanction_id",
        SanctionKind.ACCOUNT_SUSPENDED: "account_sanction_id",
        SanctionKind.ACCOUNT_CLOSED_FOR_ABUSE: "account_sanction_id",
    }.get(kind)
    if current_id_column is None or subject[current_id_column] != sanction_id:
        raise _conflict(
            "sanction_superseded",
            "Only the current projected sanction can be restored",
        )
    restoration_id = uuid4()
    next_version = expected_version + 1
    session.execute(
        text(
            """
            insert into review_moderation.restoration_events (
              restoration_id, sanction_id, account_id, reason_code, internal_explanation,
              user_visible_explanation, restored_by_account_id, subject_version_before,
              subject_version_after, correlation_id, idempotency_key
            ) values (
              :restoration_id, :sanction_id, :account_id, :reason_code, :internal_explanation,
              :user_visible_explanation, :restored_by_account_id, :version_before,
              :version_after, :correlation_id, :idempotency_key
            )
            """
        ),
        {
            "restoration_id": restoration_id,
            "sanction_id": sanction_id,
            "account_id": account_id,
            "reason_code": reason_code,
            "internal_explanation": internal_explanation,
            "user_visible_explanation": user_visible_explanation,
            "restored_by_account_id": actor.account_id,
            "version_before": expected_version,
            "version_after": next_version,
            "correlation_id": correlation_id,
            "idempotency_key": idempotency_key,
        },
    )
    clearing = {
        SanctionKind.WARNING: "latest_warning_at = null, warning_sanction_id = null",
        SanctionKind.SUBMISSION_RESTRICTED: (
            "submission_restricted = false, submission_restricted_until = null, "
            "submission_sanction_id = null"
        ),
        SanctionKind.ATTACHMENT_RESTRICTED: (
            "attachment_restricted = false, attachment_restricted_until = null, "
            "attachment_sanction_id = null"
        ),
        SanctionKind.NOTIFICATION_RESTRICTED: (
            "notification_restricted = false, notification_restricted_until = null, "
            "notification_sanction_id = null"
        ),
        SanctionKind.ACCOUNT_SUSPENDED: (
            "account_suspended = false, account_closed_for_abuse = false, "
            "account_restricted_until = null, account_sanction_id = null"
        ),
        SanctionKind.ACCOUNT_CLOSED_FOR_ABUSE: (
            "account_suspended = false, account_closed_for_abuse = false, "
            "account_restricted_until = null, account_sanction_id = null"
        ),
    }[kind]
    session.execute(
        text(
            f"""
            update review_moderation.moderation_subjects
            set version = version + 1, {clearing}
            where account_id = :account_id
            """
        ),
        {"account_id": account_id},
    )
    if kind in {SanctionKind.ACCOUNT_SUSPENDED, SanctionKind.ACCOUNT_CLOSED_FOR_ABUSE}:
        _change_identity_state(
            session,
            account_id=account_id,
            next_state=AccountState.ACTIVE,
            actor=actor,
            reason=f"moderation:restored:{sanction_id}",
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
        )
    _audit(
        session,
        account_id=account_id,
        sanction_id=sanction_id,
        appeal_case_id=None,
        actor_account_id=actor.account_id,
        event_type="moderation.sanction-restored",
        outcome="succeeded",
        reason=reason_code,
        details={"restoration_id": str(restoration_id), "version": next_version},
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
    )
    _outbox(
        session,
        event_type="moderation.sanction-restored",
        aggregate_type="moderation_subject",
        aggregate_id=account_id,
        aggregate_version=next_version,
        idempotency_key=_scoped_key("restoration", actor.account_id, idempotency_key),
        correlation_id=correlation_id,
        payload={
            "account_id": str(account_id),
            "sanction_id": str(sanction_id),
            "restoration_id": str(restoration_id),
            "user_visible_explanation": user_visible_explanation,
        },
    )
    return restoration_id


def restore_sanction(
    account_id: UUID,
    sanction_id: UUID,
    command: RestoreSanctionCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> ModerationSubjectRead:
    _require_recent(actor, "moderation.sanction.restore")
    if actor.account_id == account_id:
        raise _forbidden("self_moderation_forbidden", "Moderators cannot restore themselves")
    fingerprint = _fingerprint(command)
    with _moderation_session() as session:
        replay = _receipt(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            command_name="restore_sanction",
            fingerprint=fingerprint,
        )
        if replay is not None:
            return _subject_read(session, account_id, include_internal=True)
        restoration_id = _restore_projection(
            session,
            account_id=account_id,
            sanction_id=sanction_id,
            expected_version=command.expected_version,
            reason_code=command.reason_code,
            internal_explanation=command.internal_explanation,
            user_visible_explanation=command.user_visible_explanation,
            actor=actor,
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            command_name="restore_sanction",
            result_type="restoration",
            result_id=restoration_id,
            fingerprint=fingerprint,
        )
        return _subject_read(session, account_id, include_internal=True)


def open_appeal(
    command: OpenAppealCommand,
    identity: RequestIdentity,
    correlation_id: UUID,
) -> AppealCaseRead:
    fingerprint = _fingerprint(command)
    with _moderation_session() as session:
        replay = _receipt(
            session,
            actor_account_id=identity.account_id,
            idempotency_key=command.idempotency_key,
            command_name="open_appeal",
            fingerprint=fingerprint,
        )
        if replay is not None:
            appeal_id = replay[1]
            row = session.execute(
                text("select * from review_moderation.appeal_queue where appeal_case_id = :id"),
                {"id": appeal_id},
            ).mappings().one()
            return _appeal_from_row(session, row, include_internal=False)
        subject = _subject_row(session, identity.account_id, lock=True)
        if int(subject["version"]) != command.expected_version:
            raise _conflict("subject_version_conflict", "Moderation subject version does not match")
        sanction = session.execute(
            text(
                """
                select sanction.sanction_id,
                       (restoration.restoration_id is null
                         and sanction.starts_at <= now()
                         and (sanction.ends_at is null or sanction.ends_at > now())
                         and (
                           sanction.sanction_id = subject.warning_sanction_id
                           or sanction.sanction_id = subject.submission_sanction_id
                           or sanction.sanction_id = subject.attachment_sanction_id
                           or sanction.sanction_id = subject.notification_sanction_id
                           or sanction.sanction_id = subject.account_sanction_id
                         )) as appealable
                from review_moderation.sanctions sanction
                join review_moderation.moderation_subjects subject
                  on subject.account_id = sanction.account_id
                left join review_moderation.restoration_events restoration
                  on restoration.sanction_id = sanction.sanction_id
                where sanction.sanction_id = :sanction_id
                  and sanction.account_id = :account_id
                """
            ),
            {"sanction_id": command.sanction_id, "account_id": identity.account_id},
        ).mappings().one_or_none()
        if sanction is None:
            raise HTTPException(status_code=404, detail={"code": "sanction_not_found"})
        if not bool(sanction["appealable"]):
            raise _conflict(
                "sanction_not_appealable",
                "Only a current active sanction can be appealed",
            )
        existing = session.execute(
            text(
                """
                select appeal_case_id from review_moderation.appeal_cases
                where sanction_id = :sanction_id and state <> 'closed'
                """
            ),
            {"sanction_id": command.sanction_id},
        ).scalar_one_or_none()
        if existing is not None:
            raise _conflict("appeal_already_open", "An appeal is already open for this sanction")
        appeal_id = uuid4()
        session.execute(
            text(
                """
                insert into review_moderation.appeal_cases (
                  appeal_case_id, account_id, sanction_id, user_statement
                ) values (:appeal_case_id, :account_id, :sanction_id, :user_statement)
                """
            ),
            {
                "appeal_case_id": appeal_id,
                "account_id": identity.account_id,
                "sanction_id": command.sanction_id,
                "user_statement": command.user_statement,
            },
        )
        _audit(
            session,
            account_id=identity.account_id,
            sanction_id=command.sanction_id,
            appeal_case_id=appeal_id,
            actor_account_id=identity.account_id,
            event_type="moderation.appeal-opened",
            outcome="succeeded",
            reason=None,
            details={"subject_version": command.expected_version},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        _outbox(
            session,
            event_type="moderation.appeal-opened",
            aggregate_type="appeal_case",
            aggregate_id=appeal_id,
            aggregate_version=1,
            idempotency_key=_scoped_key(
                "appeal", identity.account_id, command.idempotency_key
            ),
            correlation_id=correlation_id,
            payload={
                "appeal_case_id": str(appeal_id),
                "account_id": str(identity.account_id),
                "sanction_id": str(command.sanction_id),
            },
        )
        _record_receipt(
            session,
            actor_account_id=identity.account_id,
            idempotency_key=command.idempotency_key,
            command_name="open_appeal",
            result_type="appeal",
            result_id=appeal_id,
            fingerprint=fingerprint,
        )
        row = session.execute(
            text("select * from review_moderation.appeal_queue where appeal_case_id = :id"),
            {"id": appeal_id},
        ).mappings().one()
        return _appeal_from_row(session, row, include_internal=False)


def acknowledge_appeal(
    appeal_case_id: UUID,
    command: AcknowledgeAppealCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> AppealCaseRead:
    _require_recent(actor, "moderation.appeal.decide")
    fingerprint = _fingerprint(command)
    with _moderation_session() as session:
        replay = _receipt(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            command_name="acknowledge_appeal",
            fingerprint=fingerprint,
        )
        if replay is not None:
            row = session.execute(
                text("select * from review_moderation.appeal_queue where appeal_case_id = :id"),
                {"id": appeal_case_id},
            ).mappings().one()
            return _appeal_from_row(session, row, include_internal=True)
        appeal = session.execute(
            text(
                """
                select * from review_moderation.appeal_cases
                where appeal_case_id = :appeal_case_id
                for update
                """
            ),
            {"appeal_case_id": appeal_case_id},
        ).mappings().one_or_none()
        if appeal is None:
            raise HTTPException(status_code=404, detail={"code": "appeal_not_found"})
        if appeal["account_id"] == actor.account_id:
            raise _forbidden("appeal_conflict", "Moderator cannot handle their own appeal")
        if int(appeal["version"]) != command.expected_version:
            raise _conflict("appeal_version_conflict", "Appeal version does not match")
        if str(appeal["state"]) == AppealState.CLOSED.value:
            raise _conflict("appeal_closed", "Closed appeal cannot be acknowledged")
        next_version = command.expected_version + 1
        session.execute(
            text(
                """
                update review_moderation.appeal_cases
                set state = 'under_review', version = version + 1,
                    first_responded_at = coalesce(first_responded_at, now())
                where appeal_case_id = :appeal_case_id
                """
            ),
            {"appeal_case_id": appeal_case_id},
        )
        _audit(
            session,
            account_id=appeal["account_id"],
            sanction_id=appeal["sanction_id"],
            appeal_case_id=appeal_case_id,
            actor_account_id=actor.account_id,
            event_type="moderation.appeal-acknowledged",
            outcome="succeeded",
            reason=command.internal_note,
            details={"version": next_version},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            command_name="acknowledge_appeal",
            result_type="appeal",
            result_id=appeal_case_id,
            fingerprint=fingerprint,
        )
        row = session.execute(
            text("select * from review_moderation.appeal_queue where appeal_case_id = :id"),
            {"id": appeal_case_id},
        ).mappings().one()
        return _appeal_from_row(session, row, include_internal=True)


def decide_appeal(
    appeal_case_id: UUID,
    command: DecideAppealCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> AppealCaseRead:
    _require_recent(actor, "moderation.appeal.decide")
    fingerprint = _fingerprint(command)
    with _moderation_session() as session:
        replay = _receipt(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            command_name="decide_appeal",
            fingerprint=fingerprint,
        )
        if replay is not None:
            row = session.execute(
                text("select * from review_moderation.appeal_queue where appeal_case_id = :id"),
                {"id": appeal_case_id},
            ).mappings().one()
            return _appeal_from_row(session, row, include_internal=True)
        appeal = session.execute(
            text(
                """
                select * from review_moderation.appeal_cases
                where appeal_case_id = :appeal_case_id
                for update
                """
            ),
            {"appeal_case_id": appeal_case_id},
        ).mappings().one_or_none()
        if appeal is None:
            raise HTTPException(status_code=404, detail={"code": "appeal_not_found"})
        if appeal["account_id"] == actor.account_id:
            raise _forbidden("appeal_conflict", "Moderator cannot decide their own appeal")
        if int(appeal["version"]) != command.expected_version:
            raise _conflict("appeal_version_conflict", "Appeal version does not match")
        if str(appeal["state"]) == AppealState.CLOSED.value:
            raise _conflict("appeal_closed", "Appeal is already closed")
        decision_id = uuid4()
        session.execute(
            text(
                """
                insert into review_moderation.appeal_decisions (
                  decision_id, appeal_case_id, outcome, internal_explanation,
                  user_visible_explanation, decided_by_account_id
                ) values (
                  :decision_id, :appeal_case_id,
                  cast(:outcome as review_moderation.appeal_decision_outcome),
                  :internal_explanation, :user_visible_explanation, :decided_by_account_id
                )
                """
            ),
            {
                "decision_id": decision_id,
                "appeal_case_id": appeal_case_id,
                "outcome": command.outcome.value,
                "internal_explanation": command.internal_explanation,
                "user_visible_explanation": command.user_visible_explanation,
                "decided_by_account_id": actor.account_id,
            },
        )
        if command.outcome is AppealDecisionOutcome.OVERTURNED:
            assert command.expected_subject_version is not None
            _restore_projection(
                session,
                account_id=UUID(str(appeal["account_id"])),
                sanction_id=UUID(str(appeal["sanction_id"])),
                expected_version=command.expected_subject_version,
                reason_code="appeal_overturned",
                internal_explanation=command.internal_explanation,
                user_visible_explanation=command.user_visible_explanation,
                actor=actor,
                correlation_id=correlation_id,
                idempotency_key=_scoped_key(
                    "appeal-restore", actor.account_id, command.idempotency_key
                ),
            )
        next_version = command.expected_version + 1
        session.execute(
            text(
                """
                update review_moderation.appeal_cases
                set state = 'closed', version = version + 1,
                    first_responded_at = coalesce(first_responded_at, now()),
                    closed_at = now()
                where appeal_case_id = :appeal_case_id
                """
            ),
            {"appeal_case_id": appeal_case_id},
        )
        _audit(
            session,
            account_id=appeal["account_id"],
            sanction_id=appeal["sanction_id"],
            appeal_case_id=appeal_case_id,
            actor_account_id=actor.account_id,
            event_type="moderation.appeal-decided",
            outcome="succeeded",
            reason=command.outcome.value,
            details={"decision_id": str(decision_id), "version": next_version},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        _outbox(
            session,
            event_type="moderation.appeal-decided",
            aggregate_type="appeal_case",
            aggregate_id=appeal_case_id,
            aggregate_version=next_version,
            idempotency_key=_scoped_key(
                "appeal-decision", actor.account_id, command.idempotency_key
            ),
            correlation_id=correlation_id,
            payload={
                "appeal_case_id": str(appeal_case_id),
                "account_id": str(appeal["account_id"]),
                "sanction_id": str(appeal["sanction_id"]),
                "outcome": command.outcome.value,
                "user_visible_explanation": command.user_visible_explanation,
            },
        )
        _record_receipt(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            command_name="decide_appeal",
            result_type="appeal_decision",
            result_id=decision_id,
            fingerprint=fingerprint,
        )
        row = session.execute(
            text("select * from review_moderation.appeal_queue where appeal_case_id = :id"),
            {"id": appeal_case_id},
        ).mappings().one()
        return _appeal_from_row(session, row, include_internal=True)


def current_notice(identity: RequestIdentity) -> ModerationNoticeRead:
    with _moderation_session() as session:
        subject = _subject_read(session, identity.account_id, include_internal=False)
        return ModerationNoticeRead(
            version=subject.version,
            account_state=subject.account_state,
            submission_restricted=subject.submission_restricted,
            attachment_restricted=subject.attachment_restricted,
            notification_restricted=subject.notification_restricted,
            account_suspended=subject.account_suspended,
            account_closed_for_abuse=subject.account_closed_for_abuse,
            sanctions=subject.sanctions,
            appeals=subject.appeals,
        )


def get_subject(account_id: UUID) -> ModerationSubjectRead:
    with _moderation_session() as session:
        return _subject_read(session, account_id, include_internal=True)


def list_subjects(limit: int = 50) -> ModerationSubjectList:
    with _moderation_session() as session:
        account_ids = session.execute(
            text(
                """
                select account_id from review_moderation.moderation_subjects
                order by updated_at desc, account_id
                limit :limit
                """
            ),
            {"limit": limit},
        ).scalars().all()
        return ModerationSubjectList(
            items=[
                _subject_read(session, UUID(str(account_id)), include_internal=True)
                for account_id in account_ids
            ]
        )


def list_appeals(state: AppealState | None = None, limit: int = 100) -> AppealCaseList:
    with _moderation_session() as session:
        return AppealCaseList(
            items=_appeals(
                session,
                state=state,
                include_internal=True,
                limit=limit,
            )
        )


def moderation_metrics() -> ModerationMetricsRead:
    with _moderation_session() as session:
        row = session.execute(
            text(
                """
                with active_sanction_facts as (
                  select sanction.starts_at
                  from review_moderation.sanctions sanction
                  join review_moderation.moderation_subjects subject
                    on subject.account_id = sanction.account_id
                  left join review_moderation.restoration_events restoration
                    on restoration.sanction_id = sanction.sanction_id
                  where restoration.restoration_id is null
                    and sanction.starts_at <= now()
                    and (sanction.ends_at is null or sanction.ends_at > now())
                    and (
                      sanction.sanction_id = subject.warning_sanction_id
                      or sanction.sanction_id = subject.submission_sanction_id
                      or sanction.sanction_id = subject.attachment_sanction_id
                      or sanction.sanction_id = subject.notification_sanction_id
                      or sanction.sanction_id = subject.account_sanction_id
                    )
                )
                select
                  (select count(*) from active_sanction_facts) as active_sanctions,
                  (select coalesce(max(extract(epoch from (now() - starts_at))), 0)
                    from active_sanction_facts)::bigint
                    as oldest_active_sanction_age_seconds,
                  count(*) filter (where effective_submission_restricted)
                    as active_submission_restrictions,
                  count(*) filter (where effective_attachment_restricted)
                    as active_attachment_restrictions,
                  count(*) filter (where effective_notification_restricted)
                    as active_notification_restrictions,
                  count(*) filter (where effective_account_suspended) as suspended_accounts,
                  count(*) filter (where repeat_abuse_count >= :repeat_threshold)
                    as repeat_abuse_accounts,
                  count(*) filter (where expired_restriction_projected)
                    as expired_restriction_projected,
                  count(*) filter (where inconsistent_account_state)
                    as inconsistent_account_state
                from review_moderation.moderation_subject_status
                """
            ),
            {"repeat_threshold": settings.moderation_repeat_abuse_alert_count},
        ).mappings().one()
        appeals = session.execute(
            text(
                """
                select count(*) filter (where state <> 'closed') as open_appeals,
                       count(*) filter (where appeal_sla_overdue) as appeal_sla_overdue,
                       coalesce(max(age_seconds) filter (where state <> 'closed'), 0)
                         as oldest_appeal_age_seconds
                from review_moderation.appeal_queue
                """
            )
        ).mappings().one()
        restorations = int(
            session.execute(
                text(
                    """
                    select count(*) from review_moderation.restoration_events
                    where restored_at >= now() - interval '24 hours'
                    """
                )
            ).scalar_one()
        )
        unauthorized = int(
            session.execute(
                text(
                    """
                    select count(*) from identity.authorization_audit_events
                    where occurred_at >= now() - interval '24 hours'
                      and outcome = 'denied'
                      and capability_key like 'moderation.%'
                    """
                )
            ).scalar_one()
        )
        alerts: list[str] = []
        for key in (
            "appeal_sla_overdue",
            "repeat_abuse_accounts",
            "expired_restriction_projected",
            "inconsistent_account_state",
        ):
            source = appeals if key == "appeal_sla_overdue" else row
            if int(source[key]) > 0:
                alerts.append(key)
        if (
            int(row["oldest_active_sanction_age_seconds"])
            > settings.moderation_sanction_age_alert_seconds
        ):
            alerts.append("sanction_age")
        if (
            int(appeals["oldest_appeal_age_seconds"])
            > settings.moderation_appeal_age_alert_seconds
        ):
            alerts.append("appeal_age")
        return ModerationMetricsRead(
            active_sanctions=int(row["active_sanctions"]),
            oldest_active_sanction_age_seconds=int(
                row["oldest_active_sanction_age_seconds"]
            ),
            active_submission_restrictions=int(row["active_submission_restrictions"]),
            active_attachment_restrictions=int(row["active_attachment_restrictions"]),
            active_notification_restrictions=int(row["active_notification_restrictions"]),
            suspended_accounts=int(row["suspended_accounts"]),
            open_appeals=int(appeals["open_appeals"]),
            appeal_sla_overdue=int(appeals["appeal_sla_overdue"]),
            oldest_appeal_age_seconds=int(appeals["oldest_appeal_age_seconds"]),
            repeat_abuse_accounts=int(row["repeat_abuse_accounts"]),
            expired_restriction_projected=int(row["expired_restriction_projected"]),
            restorations_last_24h=restorations,
            unauthorized_attempts_last_24h=unauthorized,
            inconsistent_account_state=int(row["inconsistent_account_state"]),
            alerts=alerts,
        )
