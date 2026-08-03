from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, Iterator
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import has_database, session_scope
from app.identity.models import AccountState, RequestIdentity, account_state_transition_allowed
from app.review_moderation.moderation_models import (
    AccountModerationRead,
    AppealCaseRead,
    AppealCaseState,
    AppealDecisionOutcome,
    AppealQueueRead,
    ClaimAppealCommand,
    DecideAppealCommand,
    IssueModerationActionCommand,
    ModerationActionKind,
    ModerationActionRead,
    ModerationMetricsRead,
    RestoreModerationActionCommand,
    SubmitAppealCommand,
)

_BLOCKING_ACTIONS = {
    ModerationActionKind.ACCOUNT_SUSPENDED,
    ModerationActionKind.ACCOUNT_CLOSED_FOR_ABUSE,
}


@contextmanager
def _moderation_session() -> Iterator[Session]:
    if not settings.review_moderation_enabled:
        raise HTTPException(status_code=404, detail={"code": "moderation_disabled"})
    if not has_database():
        raise HTTPException(status_code=503, detail={"code": "authoritative_database_unavailable"})
    with session_scope() as session:
        if session is None:
            raise HTTPException(status_code=503, detail={"code": "authoritative_database_unavailable"})
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def _deny(status_code: int, code: str, message: str) -> None:
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _audit(
    session: Session,
    *,
    account_id: UUID,
    actor_account_id: UUID,
    event_type: str,
    outcome: str,
    reason: str | None,
    correlation_id: UUID,
    idempotency_key: str | None,
    action_id: UUID | None = None,
    appeal_case_id: UUID | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    session.execute(
        text(
            """
            insert into review_moderation.moderation_audit_events (
              account_id, action_id, appeal_case_id, actor_account_id, event_type,
              outcome, reason, details, correlation_id, idempotency_key
            ) values (
              :account_id, :action_id, :appeal_case_id, :actor_account_id, :event_type,
              :outcome, :reason, cast(:details as jsonb), :correlation_id, :idempotency_key
            )
            """
        ),
        {
            "account_id": account_id,
            "action_id": action_id,
            "appeal_case_id": appeal_case_id,
            "actor_account_id": actor_account_id,
            "event_type": event_type,
            "outcome": outcome,
            "reason": reason,
            "details": json.dumps(details or {}, sort_keys=True),
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
    idempotency_key: str,
    correlation_id: UUID,
    payload: dict[str, Any],
) -> None:
    session.execute(
        text(
            """
            insert into integration.outbox_events (
              event_type, event_version, source_context, aggregate_type, aggregate_id,
              idempotency_key, correlation_id, occurred_at, payload
            ) values (
              :event_type, 1, 'review-moderation', :aggregate_type, :aggregate_id,
              :idempotency_key, :correlation_id, now(), cast(:payload as jsonb)
            )
            on conflict (source_context, idempotency_key) do nothing
            """
        ),
        {
            "event_type": event_type,
            "aggregate_type": aggregate_type,
            "aggregate_id": str(aggregate_id),
            "idempotency_key": idempotency_key,
            "correlation_id": correlation_id,
            "payload": json.dumps(payload, sort_keys=True),
        },
    )


def _ensure_subject(session: Session, account_id: UUID, *, lock: bool = False):
    account_exists = session.execute(
        text("select exists(select 1 from identity.accounts where account_id = :account_id)"),
        {"account_id": account_id},
    ).scalar_one()
    if not account_exists:
        _deny(404, "moderation_account_not_found", "Account not found")
    session.execute(
        text(
            """
            insert into review_moderation.moderation_subjects (account_id)
            values (:account_id)
            on conflict (account_id) do nothing
            """
        ),
        {"account_id": account_id},
    )
    lock_sql = " for update of subject, account" if lock else ""
    return session.execute(
        text(
            f"""
            select subject.account_id, subject.version, account.state::text as account_state
            from review_moderation.moderation_subjects subject
            join identity.accounts account on account.account_id = subject.account_id
            where subject.account_id = :account_id{lock_sql}
            """
        ),
        {"account_id": account_id},
    ).mappings().one()


def _check_version(actual: int, expected: int, *, aggregate: str) -> None:
    if actual != expected:
        _deny(409, f"{aggregate}_version_conflict", f"{aggregate.replace('_', ' ').title()} version is stale")


def _load_action(session: Session, action_id: UUID, *, lock: bool = False):
    lock_sql = " for update" if lock else ""
    row = session.execute(
        text(
            f"""
            select *
            from review_moderation.moderation_actions
            where action_id = :action_id{lock_sql}
            """
        ),
        {"action_id": action_id},
    ).mappings().one_or_none()
    if row is None:
        _deny(404, "moderation_action_not_found", "Moderation action not found")
    return row


def _is_effective(session: Session, action_id: UUID) -> bool:
    return bool(
        session.execute(
            text(
                """
                select exists(
                  select 1
                  from review_moderation.effective_sanctions
                  where action_id = :action_id
                )
                """
            ),
            {"action_id": action_id},
        ).scalar_one()
    )


def _action_read(session: Session, row) -> ModerationActionRead:
    return ModerationActionRead(
        action_id=row["action_id"],
        account_id=row["account_id"],
        kind=ModerationActionKind(str(row["kind"])),
        scope=str(row["scope"]),
        reason_code=str(row["reason_code"]),
        internal_explanation=str(row["internal_explanation"]),
        user_visible_explanation=str(row["user_visible_explanation"]),
        starts_at=row["starts_at"],
        ends_at=row["ends_at"],
        actor_account_id=row["actor_account_id"],
        expected_version=row["expected_version"],
        resulting_version=row["resulting_version"],
        supersedes_action_id=row["supersedes_action_id"],
        correlation_id=row["correlation_id"],
        created_at=row["created_at"],
        effective=_is_effective(session, UUID(str(row["action_id"]))),
    )


def _account_read(session: Session, account_id: UUID) -> AccountModerationRead:
    subject = _ensure_subject(session, account_id)
    rows = session.execute(
        text(
            """
            select *
            from review_moderation.moderation_actions
            where account_id = :account_id
            order by created_at, action_id
            """
        ),
        {"account_id": account_id},
    ).mappings().all()
    return AccountModerationRead(
        account_id=account_id,
        version=subject["version"],
        account_state=str(subject["account_state"]),
        actions=[_action_read(session, row) for row in rows],
    )


def _append_action(
    session: Session,
    *,
    account_id: UUID,
    kind: ModerationActionKind,
    scope: str,
    reason_code: str,
    internal_explanation: str,
    user_visible_explanation: str,
    starts_at: datetime,
    ends_at: datetime | None,
    actor: RequestIdentity,
    expected_version: int,
    idempotency_key: str,
    correlation_id: UUID,
    supersedes_action_id: UUID | None = None,
) -> UUID:
    resulting_version = expected_version + 1
    updated_version = session.execute(
        text(
            """
            update review_moderation.moderation_subjects
            set version = :resulting_version
            where account_id = :account_id and version = :expected_version
            returning version
            """
        ),
        {
            "account_id": account_id,
            "expected_version": expected_version,
            "resulting_version": resulting_version,
        },
    ).scalar_one_or_none()
    if updated_version is None:
        _deny(409, "moderation_version_conflict", "Moderation subject version is stale")

    action_id = uuid4()
    session.execute(
        text(
            """
            insert into review_moderation.moderation_actions (
              action_id, account_id, kind, scope, reason_code, internal_explanation,
              user_visible_explanation, starts_at, ends_at, actor_account_id,
              expected_version, resulting_version, supersedes_action_id,
              correlation_id, idempotency_key
            ) values (
              :action_id, :account_id,
              cast(:kind as review_moderation.moderation_action_kind),
              :scope, :reason_code, :internal_explanation, :user_visible_explanation,
              :starts_at, :ends_at, :actor_account_id, :expected_version,
              :resulting_version, :supersedes_action_id, :correlation_id, :idempotency_key
            )
            """
        ),
        {
            "action_id": action_id,
            "account_id": account_id,
            "kind": kind.value,
            "scope": scope,
            "reason_code": reason_code,
            "internal_explanation": internal_explanation,
            "user_visible_explanation": user_visible_explanation,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "actor_account_id": actor.account_id,
            "expected_version": expected_version,
            "resulting_version": resulting_version,
            "supersedes_action_id": supersedes_action_id,
            "correlation_id": correlation_id,
            "idempotency_key": idempotency_key,
        },
    )
    return action_id


def _set_account_state(
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
            select state::text
            from identity.accounts
            where account_id = :account_id
            for update
            """
        ),
        {"account_id": account_id},
    ).mappings().one()
    previous_state = AccountState(str(account["state"]))
    if previous_state is next_state:
        return
    if not account_state_transition_allowed(previous_state, next_state):
        _deny(
            409,
            "account_state_conflict",
            f"Account cannot transition from {previous_state.value} to {next_state.value}",
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
            on conflict (idempotency_key) do nothing
            """
        ),
        {
            "account_id": account_id,
            "previous_state": previous_state.value,
            "next_state": next_state.value,
            "actor_account_id": actor.account_id,
            "reason": reason,
            "correlation_id": correlation_id,
            "idempotency_key": idempotency_key,
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
              'moderation.sanction.manage', 'changed', :reason,
              cast(:details as jsonb), :correlation_id
            )
            """
        ),
        {
            "actor_account_id": actor.account_id,
            "account_id": account_id,
            "reason": reason,
            "details": json.dumps(
                {"previous_state": previous_state.value, "next_state": next_state.value},
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
        idempotency_key=f"identity-state:{idempotency_key}",
        correlation_id=correlation_id,
        payload={
            "account_id": str(account_id),
            "previous_state": previous_state.value,
            "next_state": next_state.value,
            "actor_account_id": str(actor.account_id),
        },
    )


def _has_blocking_sanction(session: Session, account_id: UUID) -> bool:
    return bool(
        session.execute(
            text(
                """
                select exists(
                  select 1
                  from review_moderation.effective_sanctions
                  where account_id = :account_id
                    and kind in ('account_suspended', 'account_closed_for_abuse')
                )
                """
            ),
            {"account_id": account_id},
        ).scalar_one()
    )


def _appeal_read(session: Session, appeal_case_id: UUID, *, account_id: UUID | None = None):
    row = session.execute(
        text(
            """
            select *
            from review_moderation.appeal_queue
            where appeal_case_id = :appeal_case_id
              and (:account_id is null or account_id = :account_id)
            """
        ),
        {"appeal_case_id": appeal_case_id, "account_id": account_id},
    ).mappings().one_or_none()
    if row is None:
        _deny(404, "appeal_case_not_found", "Appeal case not found")
    return AppealCaseRead(
        appeal_case_id=row["appeal_case_id"],
        account_id=row["account_id"],
        sanction_action_id=row["sanction_action_id"],
        state=AppealCaseState(str(row["state"])),
        version=row["version"],
        appellant_message=str(row["appellant_message"]),
        primary_assignee_id=row["primary_assignee_id"],
        first_response_due_at=row["first_response_due_at"],
        first_responded_at=row["first_responded_at"],
        outcome=AppealDecisionOutcome(str(row["outcome"])) if row["outcome"] else None,
        user_visible_resolution=row["user_visible_resolution"],
        internal_resolution=row["internal_resolution"],
        closed_at=row["closed_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        sanction_kind=ModerationActionKind(str(row["sanction_kind"])),
        sanction_scope=str(row["sanction_scope"]),
        sanction_user_visible_explanation=str(row["sanction_user_visible_explanation"]),
        sla_overdue=bool(row["sla_overdue"]),
        queue_age_seconds=row["queue_age_seconds"],
    )


def _appeal_event_replay(
    session: Session,
    *,
    actor_account_id: UUID,
    idempotency_key: str,
    expected_event_type: str,
    appeal_case_id: UUID,
) -> bool:
    row = session.execute(
        text(
            """
            select appeal_case_id, event_type
            from review_moderation.appeal_events
            where actor_account_id = :actor_account_id
              and idempotency_key = :idempotency_key
            """
        ),
        {"actor_account_id": actor_account_id, "idempotency_key": idempotency_key},
    ).mappings().one_or_none()
    if row is None:
        return False
    if UUID(str(row["appeal_case_id"])) != appeal_case_id or str(row["event_type"]) != expected_event_type:
        _deny(409, "idempotency_key_reused", "Idempotency key was reused")
    return True


def get_account_moderation(account_id: UUID) -> AccountModerationRead:
    with _moderation_session() as session:
        return _account_read(session, account_id)


def issue_moderation_action(
    account_id: UUID,
    command: IssueModerationActionCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> AccountModerationRead:
    with _moderation_session() as session:
        replay = session.execute(
            text(
                """
                select account_id, kind::text
                from review_moderation.moderation_actions
                where actor_account_id = :actor_account_id
                  and idempotency_key = :idempotency_key
                """
            ),
            {"actor_account_id": actor.account_id, "idempotency_key": command.idempotency_key},
        ).mappings().one_or_none()
        if replay is not None:
            if UUID(str(replay["account_id"])) != account_id or str(replay["kind"]) != command.kind.value:
                _deny(409, "idempotency_key_reused", "Idempotency key was reused")
            return _account_read(session, account_id)

        if account_id == actor.account_id:
            _deny(403, "moderation_self_conflict", "Staff cannot sanction their own account")
        subject = _ensure_subject(session, account_id, lock=True)
        _check_version(subject["version"], command.expected_version, aggregate="moderation")
        if str(subject["account_state"]) in {AccountState.DELETING.value, AccountState.DELETED.value}:
            _deny(409, "account_state_conflict", "Deleting or deleted accounts cannot be sanctioned")

        if not actor.has_capability("moderation.sanction.manage"):
            if command.kind is not ModerationActionKind.SUBMISSION_RESTRICTED or command.scope != "submission":
                _deny(403, "moderation_scope_forbidden", "Reviewer may issue only a submission freeze")
            if command.ends_at is None or command.ends_at - command.starts_at > timedelta(hours=24):
                _deny(403, "moderation_duration_forbidden", "Reviewer freeze may not exceed 24 hours")

        action_id = _append_action(
            session,
            account_id=account_id,
            kind=command.kind,
            scope=command.scope,
            reason_code=command.reason_code,
            internal_explanation=command.internal_explanation,
            user_visible_explanation=command.user_visible_explanation,
            starts_at=command.starts_at,
            ends_at=command.ends_at,
            actor=actor,
            expected_version=command.expected_version,
            idempotency_key=command.idempotency_key,
            correlation_id=correlation_id,
        )
        if command.kind in _BLOCKING_ACTIONS:
            _set_account_state(
                session,
                account_id=account_id,
                next_state=AccountState.SUSPENDED,
                actor=actor,
                reason=command.user_visible_explanation,
                idempotency_key=f"moderation:{command.idempotency_key}",
                correlation_id=correlation_id,
            )
        _audit(
            session,
            account_id=account_id,
            action_id=action_id,
            actor_account_id=actor.account_id,
            event_type="moderation.sanction.issued",
            outcome="succeeded",
            reason=command.reason_code,
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
            details={"kind": command.kind.value, "scope": command.scope},
        )
        _outbox(
            session,
            event_type="moderation.sanction-issued",
            aggregate_type="account",
            aggregate_id=account_id,
            idempotency_key=f"sanction-issued:{command.idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "action_id": str(action_id),
                "account_id": str(account_id),
                "kind": command.kind.value,
                "scope": command.scope,
                "starts_at": command.starts_at.isoformat(),
                "ends_at": command.ends_at.isoformat() if command.ends_at else None,
            },
        )
        return _account_read(session, account_id)


def restore_moderation_action(
    action_id: UUID,
    command: RestoreModerationActionCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> AccountModerationRead:
    with _moderation_session() as session:
        replay = session.execute(
            text(
                """
                select account_id, kind::text, supersedes_action_id
                from review_moderation.moderation_actions
                where actor_account_id = :actor_account_id
                  and idempotency_key = :idempotency_key
                """
            ),
            {"actor_account_id": actor.account_id, "idempotency_key": command.idempotency_key},
        ).mappings().one_or_none()
        if replay is not None:
            if str(replay["kind"]) != ModerationActionKind.RESTORATION.value or UUID(
                str(replay["supersedes_action_id"])
            ) != action_id:
                _deny(409, "idempotency_key_reused", "Idempotency key was reused")
            return _account_read(session, UUID(str(replay["account_id"])))

        action = _load_action(session, action_id, lock=True)
        action_kind = ModerationActionKind(str(action["kind"]))
        if action_kind is ModerationActionKind.RESTORATION:
            _deny(409, "moderation_action_conflict", "A restoration cannot be restored")
        if not _is_effective(session, action_id):
            _deny(409, "moderation_action_inactive", "Moderation action is no longer effective")

        account_id = UUID(str(action["account_id"]))
        subject = _ensure_subject(session, account_id, lock=True)
        _check_version(subject["version"], command.expected_version, aggregate="moderation")
        restoration_id = _append_action(
            session,
            account_id=account_id,
            kind=ModerationActionKind.RESTORATION,
            scope=str(action["scope"]),
            reason_code=command.reason_code,
            internal_explanation=command.internal_explanation,
            user_visible_explanation=command.user_visible_explanation,
            starts_at=datetime.now(UTC),
            ends_at=None,
            actor=actor,
            expected_version=command.expected_version,
            idempotency_key=command.idempotency_key,
            correlation_id=correlation_id,
            supersedes_action_id=action_id,
        )
        if action_kind in _BLOCKING_ACTIONS and not _has_blocking_sanction(session, account_id):
            _set_account_state(
                session,
                account_id=account_id,
                next_state=AccountState.ACTIVE,
                actor=actor,
                reason=command.user_visible_explanation,
                idempotency_key=f"moderation:{command.idempotency_key}",
                correlation_id=correlation_id,
            )
        _audit(
            session,
            account_id=account_id,
            action_id=restoration_id,
            actor_account_id=actor.account_id,
            event_type="moderation.sanction.restored",
            outcome="succeeded",
            reason=command.reason_code,
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
            details={"supersedes_action_id": str(action_id)},
        )
        _outbox(
            session,
            event_type="moderation.sanction-restored",
            aggregate_type="account",
            aggregate_id=account_id,
            idempotency_key=f"sanction-restored:{command.idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "restoration_action_id": str(restoration_id),
                "supersedes_action_id": str(action_id),
                "account_id": str(account_id),
            },
        )
        return _account_read(session, account_id)


def submit_appeal(
    command: SubmitAppealCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> AppealCaseRead:
    with _moderation_session() as session:
        replay = session.execute(
            text(
                """
                select appeal_case_id, sanction_action_id
                from review_moderation.appeal_cases
                where account_id = :account_id and idempotency_key = :idempotency_key
                """
            ),
            {"account_id": actor.account_id, "idempotency_key": command.idempotency_key},
        ).mappings().one_or_none()
        if replay is not None:
            if UUID(str(replay["sanction_action_id"])) != command.sanction_action_id:
                _deny(409, "idempotency_key_reused", "Idempotency key was reused")
            return _appeal_read(session, UUID(str(replay["appeal_case_id"])), account_id=actor.account_id)

        action = _load_action(session, command.sanction_action_id)
        if UUID(str(action["account_id"])) != actor.account_id:
            _deny(404, "moderation_action_not_found", "Moderation action not found")
        if ModerationActionKind(str(action["kind"])) is ModerationActionKind.RESTORATION:
            _deny(409, "appeal_action_conflict", "Restoration actions cannot be appealed")
        open_appeal = session.execute(
            text(
                """
                select appeal_case_id
                from review_moderation.appeal_cases
                where sanction_action_id = :sanction_action_id and state <> 'closed'
                """
            ),
            {"sanction_action_id": command.sanction_action_id},
        ).scalar_one_or_none()
        if open_appeal is not None:
            return _appeal_read(session, UUID(str(open_appeal)), account_id=actor.account_id)

        appeal_case_id = uuid4()
        session.execute(
            text(
                """
                insert into review_moderation.appeal_cases (
                  appeal_case_id, account_id, sanction_action_id, appellant_message,
                  idempotency_key
                ) values (
                  :appeal_case_id, :account_id, :sanction_action_id, :appellant_message,
                  :idempotency_key
                )
                """
            ),
            {
                "appeal_case_id": appeal_case_id,
                "account_id": actor.account_id,
                "sanction_action_id": command.sanction_action_id,
                "appellant_message": command.appellant_message,
                "idempotency_key": command.idempotency_key,
            },
        )
        session.execute(
            text(
                """
                insert into review_moderation.appeal_events (
                  appeal_case_id, event_type, actor_account_id, reason,
                  correlation_id, idempotency_key
                ) values (
                  :appeal_case_id, 'appeal.submitted', :actor_account_id, :reason,
                  :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "appeal_case_id": appeal_case_id,
                "actor_account_id": actor.account_id,
                "reason": command.appellant_message,
                "correlation_id": correlation_id,
                "idempotency_key": f"appeal-event:{command.idempotency_key}",
            },
        )
        _audit(
            session,
            account_id=actor.account_id,
            appeal_case_id=appeal_case_id,
            actor_account_id=actor.account_id,
            event_type="moderation.appeal.submitted",
            outcome="succeeded",
            reason="appeal-submitted",
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
            details={"sanction_action_id": str(command.sanction_action_id)},
        )
        _outbox(
            session,
            event_type="moderation.appeal-submitted",
            aggregate_type="appeal-case",
            aggregate_id=appeal_case_id,
            idempotency_key=f"appeal-submitted:{command.idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "appeal_case_id": str(appeal_case_id),
                "account_id": str(actor.account_id),
                "sanction_action_id": str(command.sanction_action_id),
            },
        )
        return _appeal_read(session, appeal_case_id, account_id=actor.account_id)


def get_appeal(appeal_case_id: UUID, *, account_id: UUID | None = None) -> AppealCaseRead:
    with _moderation_session() as session:
        return _appeal_read(session, appeal_case_id, account_id=account_id)


def list_appeals(state: AppealCaseState | str = "all", limit: int = 100) -> AppealQueueRead:
    state_value = state.value if isinstance(state, AppealCaseState) else state
    with _moderation_session() as session:
        rows = session.execute(
            text(
                """
                select appeal_case_id
                from review_moderation.appeal_queue
                where (:state = 'all' or state::text = :state)
                order by case when state = 'closed' then 1 else 0 end,
                         first_response_due_at, created_at
                limit :limit
                """
            ),
            {"state": state_value, "limit": limit},
        ).scalars().all()
        return AppealQueueRead(
            items=[_appeal_read(session, UUID(str(appeal_case_id))) for appeal_case_id in rows],
            state=state_value,
        )


def claim_appeal(
    appeal_case_id: UUID,
    command: ClaimAppealCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> AppealCaseRead:
    with _moderation_session() as session:
        if _appeal_event_replay(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            expected_event_type="appeal.claimed",
            appeal_case_id=appeal_case_id,
        ):
            return _appeal_read(session, appeal_case_id)
        row = session.execute(
            text(
                """
                select *
                from review_moderation.appeal_cases
                where appeal_case_id = :appeal_case_id
                for update
                """
            ),
            {"appeal_case_id": appeal_case_id},
        ).mappings().one_or_none()
        if row is None:
            _deny(404, "appeal_case_not_found", "Appeal case not found")
        if UUID(str(row["account_id"])) == actor.account_id:
            _deny(403, "appeal_self_conflict", "Moderator cannot handle their own appeal")
        _check_version(row["version"], command.expected_version, aggregate="appeal_case")
        if str(row["state"]) == AppealCaseState.CLOSED.value:
            _deny(409, "appeal_case_closed", "Appeal case is closed")
        if row["primary_assignee_id"] not in (None, actor.account_id):
            _deny(409, "appeal_case_assigned", "Appeal case is assigned to another moderator")
        session.execute(
            text(
                """
                update review_moderation.appeal_cases
                set state = 'under_review', primary_assignee_id = :actor_account_id,
                    first_responded_at = coalesce(first_responded_at, now()),
                    version = version + 1
                where appeal_case_id = :appeal_case_id
                """
            ),
            {"appeal_case_id": appeal_case_id, "actor_account_id": actor.account_id},
        )
        session.execute(
            text(
                """
                insert into review_moderation.appeal_events (
                  appeal_case_id, event_type, actor_account_id, reason,
                  correlation_id, idempotency_key
                ) values (
                  :appeal_case_id, 'appeal.claimed', :actor_account_id,
                  'Appeal claimed for review.', :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "appeal_case_id": appeal_case_id,
                "actor_account_id": actor.account_id,
                "correlation_id": correlation_id,
                "idempotency_key": command.idempotency_key,
            },
        )
        _audit(
            session,
            account_id=UUID(str(row["account_id"])),
            appeal_case_id=appeal_case_id,
            actor_account_id=actor.account_id,
            event_type="moderation.appeal.claimed",
            outcome="succeeded",
            reason="appeal-claimed",
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        return _appeal_read(session, appeal_case_id)


def decide_appeal(
    appeal_case_id: UUID,
    command: DecideAppealCommand,
    actor: RequestIdentity,
    correlation_id: UUID,
) -> AppealCaseRead:
    with _moderation_session() as session:
        if _appeal_event_replay(
            session,
            actor_account_id=actor.account_id,
            idempotency_key=command.idempotency_key,
            expected_event_type="appeal.decided",
            appeal_case_id=appeal_case_id,
        ):
            return _appeal_read(session, appeal_case_id)
        appeal = session.execute(
            text(
                """
                select *
                from review_moderation.appeal_cases
                where appeal_case_id = :appeal_case_id
                for update
                """
            ),
            {"appeal_case_id": appeal_case_id},
        ).mappings().one_or_none()
        if appeal is None:
            _deny(404, "appeal_case_not_found", "Appeal case not found")
        if UUID(str(appeal["account_id"])) == actor.account_id:
            _deny(403, "appeal_self_conflict", "Moderator cannot decide their own appeal")
        _check_version(appeal["version"], command.expected_version, aggregate="appeal_case")
        if str(appeal["state"]) == AppealCaseState.CLOSED.value:
            _deny(409, "appeal_case_closed", "Appeal case is closed")
        if appeal["primary_assignee_id"] != actor.account_id:
            _deny(409, "appeal_case_not_assigned", "Appeal case is not assigned to this moderator")

        sanction = _load_action(session, UUID(str(appeal["sanction_action_id"])), lock=True)
        account_id = UUID(str(appeal["account_id"]))
        subject = _ensure_subject(session, account_id, lock=True)
        subject_version = int(subject["version"])
        replacement_action_id: UUID | None = None

        if (
            command.outcome in {AppealDecisionOutcome.MODIFIED, AppealDecisionOutcome.OVERTURNED}
            and _is_effective(session, UUID(str(sanction["action_id"])))
        ):
            _append_action(
                session,
                account_id=account_id,
                kind=ModerationActionKind.RESTORATION,
                scope=str(sanction["scope"]),
                reason_code=command.reason_code,
                internal_explanation=command.internal_resolution,
                user_visible_explanation=command.user_visible_resolution,
                starts_at=datetime.now(UTC),
                ends_at=None,
                actor=actor,
                expected_version=subject_version,
                idempotency_key=f"appeal-lift:{command.idempotency_key}",
                correlation_id=correlation_id,
                supersedes_action_id=UUID(str(sanction["action_id"])),
            )
            subject_version += 1

        if command.outcome is AppealDecisionOutcome.MODIFIED:
            replacement_action_id = _append_action(
                session,
                account_id=account_id,
                kind=command.replacement_kind or ModerationActionKind.WARNING,
                scope=command.replacement_scope or str(sanction["scope"]),
                reason_code=command.reason_code,
                internal_explanation=command.internal_resolution,
                user_visible_explanation=command.user_visible_resolution,
                starts_at=command.replacement_starts_at or datetime.now(UTC),
                ends_at=command.replacement_ends_at,
                actor=actor,
                expected_version=subject_version,
                idempotency_key=f"appeal-replacement:{command.idempotency_key}",
                correlation_id=correlation_id,
            )

        if _has_blocking_sanction(session, account_id):
            _set_account_state(
                session,
                account_id=account_id,
                next_state=AccountState.SUSPENDED,
                actor=actor,
                reason=command.user_visible_resolution,
                idempotency_key=f"appeal-state:{command.idempotency_key}",
                correlation_id=correlation_id,
            )
        else:
            current_state = session.execute(
                text("select state::text from identity.accounts where account_id = :account_id"),
                {"account_id": account_id},
            ).scalar_one()
            if str(current_state) == AccountState.SUSPENDED.value:
                _set_account_state(
                    session,
                    account_id=account_id,
                    next_state=AccountState.ACTIVE,
                    actor=actor,
                    reason=command.user_visible_resolution,
                    idempotency_key=f"appeal-state:{command.idempotency_key}",
                    correlation_id=correlation_id,
                )

        session.execute(
            text(
                """
                update review_moderation.appeal_cases
                set state = 'closed',
                    outcome = cast(:outcome as review_moderation.appeal_decision_outcome),
                    user_visible_resolution = :user_visible_resolution,
                    internal_resolution = :internal_resolution,
                    first_responded_at = coalesce(first_responded_at, now()),
                    closed_at = now(), version = version + 1
                where appeal_case_id = :appeal_case_id
                """
            ),
            {
                "appeal_case_id": appeal_case_id,
                "outcome": command.outcome.value,
                "user_visible_resolution": command.user_visible_resolution,
                "internal_resolution": command.internal_resolution,
            },
        )
        session.execute(
            text(
                """
                insert into review_moderation.appeal_events (
                  appeal_case_id, event_type, actor_account_id, outcome, reason,
                  details, correlation_id, idempotency_key
                ) values (
                  :appeal_case_id, 'appeal.decided', :actor_account_id,
                  cast(:outcome as review_moderation.appeal_decision_outcome), :reason,
                  cast(:details as jsonb), :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "appeal_case_id": appeal_case_id,
                "actor_account_id": actor.account_id,
                "outcome": command.outcome.value,
                "reason": command.internal_resolution,
                "details": json.dumps(
                    {
                        "replacement_action_id": (
                            str(replacement_action_id) if replacement_action_id else None
                        )
                    },
                    sort_keys=True,
                ),
                "correlation_id": correlation_id,
                "idempotency_key": command.idempotency_key,
            },
        )
        _audit(
            session,
            account_id=account_id,
            appeal_case_id=appeal_case_id,
            actor_account_id=actor.account_id,
            event_type="moderation.appeal.decided",
            outcome="succeeded",
            reason=command.reason_code,
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
            details={"outcome": command.outcome.value},
        )
        _outbox(
            session,
            event_type="moderation.appeal-decided",
            aggregate_type="appeal-case",
            aggregate_id=appeal_case_id,
            idempotency_key=f"appeal-decided:{command.idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "appeal_case_id": str(appeal_case_id),
                "account_id": str(account_id),
                "outcome": command.outcome.value,
                "replacement_action_id": (
                    str(replacement_action_id) if replacement_action_id else None
                ),
            },
        )
        return _appeal_read(session, appeal_case_id)


def moderation_metrics() -> ModerationMetricsRead:
    with _moderation_session() as session:
        row = session.execute(
            text(
                """
                select
                  (select count(*) from review_moderation.effective_sanctions) as active_sanctions,
                  (select count(*) from identity.accounts where state = 'suspended') as suspended_accounts,
                  (select count(*) from review_moderation.appeal_queue where state <> 'closed') as open_appeals,
                  (select count(*) from review_moderation.appeal_queue where sla_overdue) as overdue_appeals,
                  coalesce((
                    select max(queue_age_seconds)
                    from review_moderation.appeal_queue
                    where state <> 'closed'
                  ), 0) as oldest_open_appeal_age_seconds
                """
            )
        ).mappings().one()
        return ModerationMetricsRead(**row)
