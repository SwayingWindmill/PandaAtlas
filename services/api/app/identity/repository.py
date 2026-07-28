from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.identity.models import (
    AccountState,
    RequestIdentity,
    VerifiedSupabaseIdentity,
    account_state_transition_allowed,
)


class IdentityConflictError(RuntimeError):
    """Raised when an identity command conflicts with current PostgreSQL state."""


class IdentityNotFoundError(LookupError):
    """Raised when an identity command targets an unknown account or assignment."""


class IdentityRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def sync_request_identity(
        self,
        verified: VerifiedSupabaseIdentity,
        *,
        recent_auth_seconds: int,
        bootstrap_admin_emails: frozenset[str],
        correlation_id: UUID,
    ) -> RequestIdentity:
        self.session.execute(
            text(
                """
                insert into identity.accounts (
                  account_id,
                  email,
                  last_authenticated_at,
                  last_authentication_method,
                  last_session_id,
                  last_jwt_issued_at,
                  last_seen_at
                ) values (
                  :account_id,
                  :email,
                  :last_authenticated_at,
                  :last_authentication_method,
                  :last_session_id,
                  :last_jwt_issued_at,
                  now()
                )
                on conflict (account_id) do update
                set email = excluded.email,
                    last_authenticated_at = case
                      when excluded.last_authenticated_at is null
                        then identity.accounts.last_authenticated_at
                      when identity.accounts.last_authenticated_at is null
                        then excluded.last_authenticated_at
                      else greatest(
                        identity.accounts.last_authenticated_at,
                        excluded.last_authenticated_at
                      )
                    end,
                    last_authentication_method = case
                      when excluded.last_authenticated_at is null
                        then identity.accounts.last_authentication_method
                      when identity.accounts.last_authenticated_at is null
                           or excluded.last_authenticated_at >=
                              identity.accounts.last_authenticated_at
                        then excluded.last_authentication_method
                      else identity.accounts.last_authentication_method
                    end,
                    last_session_id = excluded.last_session_id,
                    last_jwt_issued_at = excluded.last_jwt_issued_at,
                    last_seen_at = now()
                """
            ),
            {
                "account_id": verified.account_id,
                "email": verified.email,
                "last_authenticated_at": verified.authenticated_at,
                "last_authentication_method": verified.authentication_method,
                "last_session_id": verified.session_id,
                "last_jwt_issued_at": verified.issued_at,
            },
        )
        self._ensure_system_role(
            verified.account_id,
            role_key="member",
            source="account-bootstrap",
            reason="Base role assigned when the Supabase account was first observed.",
            correlation_id=correlation_id,
        )
        if (
            verified.email in bootstrap_admin_emails
            and verified.authenticated_at is not None
            and not self._has_role_history(verified.account_id, "administrator")
        ):
            self._insert_role_assignment(
                account_id=verified.account_id,
                role_key="administrator",
                assigned_by_account_id=None,
                expires_at=None,
                reason="One-time administrator bootstrap from configured operator email.",
                source="bootstrap",
                correlation_id=correlation_id,
                idempotency_key=f"bootstrap:administrator:{verified.account_id}",
            )

        account = self.session.execute(
            text(
                """
                select account_id, email, state::text, last_authenticated_at,
                       last_authentication_method
                from identity.accounts
                where account_id = :account_id
                """
            ),
            {"account_id": verified.account_id},
        ).mappings().one()
        roles = frozenset(
            str(row[0])
            for row in self.session.execute(
                text(
                    """
                    select distinct assignment.role_key
                    from identity.role_assignments assignment
                    left join identity.role_assignment_revocations revocation
                      on revocation.assignment_id = assignment.assignment_id
                    where assignment.account_id = :account_id
                      and revocation.assignment_id is null
                      and (assignment.expires_at is null or assignment.expires_at > now())
                    order by assignment.role_key
                    """
                ),
                {"account_id": verified.account_id},
            ).all()
        )
        capabilities = frozenset(
            str(row[0])
            for row in self.session.execute(
                text(
                    """
                    select distinct role_capability.capability_key
                    from identity.role_assignments assignment
                    join identity.role_capabilities role_capability
                      on role_capability.role_key = assignment.role_key
                    left join identity.role_assignment_revocations revocation
                      on revocation.assignment_id = assignment.assignment_id
                    where assignment.account_id = :account_id
                      and revocation.assignment_id is null
                      and (assignment.expires_at is null or assignment.expires_at > now())
                    order by role_capability.capability_key
                    """
                ),
                {"account_id": verified.account_id},
            ).all()
        )
        self.session.commit()

        authenticated_at = account["last_authenticated_at"]
        now = datetime.now(UTC)
        recent_auth = bool(
            authenticated_at is not None
            and authenticated_at <= now
            and (now - authenticated_at).total_seconds() <= recent_auth_seconds
        )
        return RequestIdentity(
            account_id=UUID(str(account["account_id"])),
            email=str(account["email"]),
            session_id=verified.session_id,
            state=AccountState(str(account["state"])),
            roles=roles,
            capabilities=capabilities,
            authenticated_at=authenticated_at,
            authentication_method=account["last_authentication_method"],
            issued_at=verified.issued_at,
            expires_at=verified.expires_at,
            assurance_level=verified.assurance_level,
            recent_auth=recent_auth,
        )

    def grant_role(
        self,
        *,
        actor: RequestIdentity,
        account_id: UUID,
        role_key: str,
        expires_at: datetime | None,
        reason: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        if account_id == actor.account_id:
            raise IdentityConflictError("Self-assignment of roles is not allowed")
        self._require_account(account_id)
        self._require_role(role_key)
        replay = self.session.execute(
            text(
                """
                select assignment_id, account_id, role_key, assigned_by_account_id,
                       assigned_at, expires_at, reason, source, correlation_id,
                       idempotency_key
                from identity.role_assignments
                where account_id = :account_id and idempotency_key = :idempotency_key
                """
            ),
            {"account_id": account_id, "idempotency_key": idempotency_key},
        ).mappings().one_or_none()
        if replay is not None:
            if str(replay["role_key"]) != role_key:
                raise IdentityConflictError(
                    "Idempotency key was already used for another role assignment"
                )
            return dict(replay)

        existing = self.session.execute(
            text(
                """
                select assignment.assignment_id
                from identity.role_assignments assignment
                left join identity.role_assignment_revocations revocation
                  on revocation.assignment_id = assignment.assignment_id
                where assignment.account_id = :account_id
                  and assignment.role_key = :role_key
                  and revocation.assignment_id is null
                  and (assignment.expires_at is null or assignment.expires_at > now())
                limit 1
                """
            ),
            {"account_id": account_id, "role_key": role_key},
        ).scalar_one_or_none()
        if existing is not None:
            raise IdentityConflictError(
                "The account already has an active assignment for this role"
            )

        assignment = self._insert_role_assignment(
            account_id=account_id,
            role_key=role_key,
            assigned_by_account_id=actor.account_id,
            expires_at=expires_at,
            reason=reason,
            source="operator",
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )
        self.session.commit()
        return assignment

    def revoke_role(
        self,
        *,
        actor: RequestIdentity,
        assignment_id: UUID,
        reason: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        replay = self.session.execute(
            text(
                """
                select revocation_id, assignment_id, revoked_by_account_id, revoked_at,
                       reason, correlation_id, idempotency_key
                from identity.role_assignment_revocations
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": idempotency_key},
        ).mappings().one_or_none()
        if replay is not None:
            if UUID(str(replay["assignment_id"])) != assignment_id:
                raise IdentityConflictError(
                    "Idempotency key was already used for another role revocation"
                )
            return dict(replay)

        assignment = self.session.execute(
            text(
                """
                select assignment_id, account_id, role_key, assigned_at, expires_at,
                       assigned_by_account_id, reason, source, correlation_id, idempotency_key
                from identity.role_assignments
                where assignment_id = :assignment_id
                """
            ),
            {"assignment_id": assignment_id},
        ).mappings().one_or_none()
        if assignment is None:
            raise IdentityNotFoundError("Role assignment not found")
        if str(assignment["role_key"]) == "member":
            raise IdentityConflictError("The system-managed member role cannot be revoked")

        existing = self.session.execute(
            text(
                """
                select revocation_id, assignment_id, revoked_by_account_id, revoked_at,
                       reason, correlation_id, idempotency_key
                from identity.role_assignment_revocations
                where assignment_id = :assignment_id
                """
            ),
            {"assignment_id": assignment_id},
        ).mappings().one_or_none()
        if existing is not None:
            raise IdentityConflictError("The role assignment is already revoked")

        revocation_id = uuid4()
        self.session.execute(
            text(
                """
                insert into identity.role_assignment_revocations (
                  revocation_id,
                  assignment_id,
                  revoked_by_account_id,
                  reason,
                  correlation_id,
                  idempotency_key
                ) values (
                  :revocation_id,
                  :assignment_id,
                  :revoked_by_account_id,
                  :reason,
                  :correlation_id,
                  :idempotency_key
                )
                """
            ),
            {
                "revocation_id": revocation_id,
                "assignment_id": assignment_id,
                "revoked_by_account_id": actor.account_id,
                "reason": reason,
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )
        self._insert_audit(
            event_type="identity.role-revoked",
            actor_account_id=actor.account_id,
            subject_account_id=UUID(str(assignment["account_id"])),
            assignment_id=assignment_id,
            role_key=str(assignment["role_key"]),
            capability_key=None,
            outcome="revoked",
            reason=reason,
            details={},
            correlation_id=correlation_id,
        )
        self._insert_outbox(
            event_type="identity.role-revoked",
            aggregate_id=UUID(str(assignment["account_id"])),
            idempotency_key=f"role-revoked:{idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "assignment_id": str(assignment_id),
                "account_id": str(assignment["account_id"]),
                "role_key": str(assignment["role_key"]),
                "revoked_by_account_id": str(actor.account_id),
            },
        )
        self.session.commit()
        return {
            "revocation_id": revocation_id,
            "assignment_id": assignment_id,
            "revoked_by_account_id": actor.account_id,
            "revoked_at": datetime.now(UTC),
            "reason": reason,
            "correlation_id": correlation_id,
            "idempotency_key": idempotency_key,
        }

    def change_account_state(
        self,
        *,
        actor: RequestIdentity,
        account_id: UUID,
        next_state: AccountState,
        reason: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        prior_event = self.session.execute(
            text(
                """
                select event.account_id,
                       account.email,
                       event.next_state::text as state,
                       event.reason as state_reason,
                       event.occurred_at as state_changed_at
                from identity.account_state_events event
                join identity.accounts account on account.account_id = event.account_id
                where event.idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": idempotency_key},
        ).mappings().one_or_none()
        if prior_event is not None:
            if (
                UUID(str(prior_event["account_id"])) != account_id
                or str(prior_event["state"]) != next_state.value
            ):
                raise IdentityConflictError(
                    "Idempotency key was already used for another account state change"
                )
            return dict(prior_event)

        account = self.session.execute(
            text(
                """
                select account_id, email, state::text, state_reason, state_changed_at
                from identity.accounts
                where account_id = :account_id
                for update
                """
            ),
            {"account_id": account_id},
        ).mappings().one_or_none()
        if account is None:
            raise IdentityNotFoundError("Account not found")
        previous_state = AccountState(str(account["state"]))
        if previous_state == next_state:
            raise IdentityConflictError("Account is already in the requested state")
        if not account_state_transition_allowed(previous_state, next_state):
            raise IdentityConflictError(
                f"Account state cannot transition from {previous_state.value} to {next_state.value}"
            )

        self.session.execute(
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
        self.session.execute(
            text(
                """
                insert into identity.account_state_events (
                  account_id,
                  previous_state,
                  next_state,
                  actor_account_id,
                  reason,
                  correlation_id,
                  idempotency_key
                ) values (
                  :account_id,
                  cast(:previous_state as identity.account_state),
                  cast(:next_state as identity.account_state),
                  :actor_account_id,
                  :reason,
                  :correlation_id,
                  :idempotency_key
                )
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
        self._insert_audit(
            event_type="identity.account-state-changed",
            actor_account_id=actor.account_id,
            subject_account_id=account_id,
            assignment_id=None,
            role_key=None,
            capability_key="identity.account.manage",
            outcome="changed",
            reason=reason,
            details={"previous_state": previous_state.value, "next_state": next_state.value},
            correlation_id=correlation_id,
        )
        self._insert_outbox(
            event_type="identity.account-state-changed",
            aggregate_id=account_id,
            idempotency_key=f"account-state:{idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "account_id": str(account_id),
                "previous_state": previous_state.value,
                "next_state": next_state.value,
                "actor_account_id": str(actor.account_id),
            },
        )
        self.session.commit()
        return {
            "account_id": account_id,
            "email": account["email"],
            "state": next_state.value,
            "state_reason": reason,
            "state_changed_at": datetime.now(UTC),
        }

    def record_authorization_decision(
        self,
        *,
        identity: RequestIdentity,
        capability: str,
        outcome: str,
        reason: str,
        correlation_id: UUID,
    ) -> None:
        self._insert_audit(
            event_type="identity.authorization-decision",
            actor_account_id=identity.account_id,
            subject_account_id=identity.account_id,
            assignment_id=None,
            role_key=None,
            capability_key=capability,
            outcome=outcome,
            reason=reason,
            details={"account_state": identity.state.value},
            correlation_id=correlation_id,
        )
        self.session.commit()

    def _ensure_system_role(
        self,
        account_id: UUID,
        *,
        role_key: str,
        source: str,
        reason: str,
        correlation_id: UUID,
    ) -> None:
        if self._has_role_history(account_id, role_key):
            return
        self._insert_role_assignment(
            account_id=account_id,
            role_key=role_key,
            assigned_by_account_id=None,
            expires_at=None,
            reason=reason,
            source=source,
            correlation_id=correlation_id,
            idempotency_key=f"system:{role_key}:{account_id}",
        )

    def _has_role_history(self, account_id: UUID, role_key: str) -> bool:
        return bool(
            self.session.execute(
                text(
                    """
                    select exists(
                      select 1
                      from identity.role_assignments
                      where account_id = :account_id and role_key = :role_key
                    )
                    """
                ),
                {"account_id": account_id, "role_key": role_key},
            ).scalar_one()
        )

    def _insert_role_assignment(
        self,
        *,
        account_id: UUID,
        role_key: str,
        assigned_by_account_id: UUID | None,
        expires_at: datetime | None,
        reason: str,
        source: str,
        correlation_id: UUID,
        idempotency_key: str,
    ) -> dict[str, Any]:
        assignment_id = uuid4()
        row = self.session.execute(
            text(
                """
                insert into identity.role_assignments (
                  assignment_id,
                  account_id,
                  role_key,
                  assigned_by_account_id,
                  expires_at,
                  reason,
                  source,
                  correlation_id,
                  idempotency_key
                ) values (
                  :assignment_id,
                  :account_id,
                  :role_key,
                  :assigned_by_account_id,
                  :expires_at,
                  :reason,
                  :source,
                  :correlation_id,
                  :idempotency_key
                )
                on conflict (account_id, idempotency_key) do nothing
                returning assignment_id, account_id, role_key, assigned_by_account_id,
                          assigned_at, expires_at, reason, source, correlation_id,
                          idempotency_key
                """
            ),
            {
                "assignment_id": assignment_id,
                "account_id": account_id,
                "role_key": role_key,
                "assigned_by_account_id": assigned_by_account_id,
                "expires_at": expires_at,
                "reason": reason,
                "source": source,
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        ).mappings().one_or_none()
        if row is None:
            row = self.session.execute(
                text(
                    """
                    select assignment_id, account_id, role_key, assigned_by_account_id,
                           assigned_at, expires_at, reason, source, correlation_id,
                           idempotency_key
                    from identity.role_assignments
                    where account_id = :account_id and idempotency_key = :idempotency_key
                    """
                ),
                {"account_id": account_id, "idempotency_key": idempotency_key},
            ).mappings().one()
            if str(row["role_key"]) != role_key:
                raise IdentityConflictError("Idempotency key was already used for another role")
            return dict(row)

        assignment = dict(row)
        self._insert_audit(
            event_type="identity.role-assigned",
            actor_account_id=assigned_by_account_id,
            subject_account_id=account_id,
            assignment_id=UUID(str(assignment["assignment_id"])),
            role_key=role_key,
            capability_key=None,
            outcome="assigned",
            reason=reason,
            details={
                "source": source,
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
            correlation_id=correlation_id,
        )
        self._insert_outbox(
            event_type="identity.role-assigned",
            aggregate_id=account_id,
            idempotency_key=f"role-assigned:{idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "assignment_id": str(assignment["assignment_id"]),
                "account_id": str(account_id),
                "role_key": role_key,
                "assigned_by_account_id": (
                    str(assigned_by_account_id) if assigned_by_account_id else None
                ),
                "expires_at": expires_at.isoformat() if expires_at else None,
                "source": source,
            },
        )
        return assignment

    def _require_account(self, account_id: UUID) -> Any:
        account = self.session.execute(
            text(
                """
                select account_id, email, state::text, state_reason, state_changed_at
                from identity.accounts
                where account_id = :account_id
                """
            ),
            {"account_id": account_id},
        ).mappings().one_or_none()
        if account is None:
            raise IdentityNotFoundError("Account not found")
        return account

    def _require_role(self, role_key: str) -> None:
        exists = self.session.execute(
            text("select exists(select 1 from identity.roles where role_key = :role_key)"),
            {"role_key": role_key},
        ).scalar_one()
        if not exists:
            raise IdentityNotFoundError("Role not found")

    def _insert_audit(
        self,
        *,
        event_type: str,
        actor_account_id: UUID | None,
        subject_account_id: UUID | None,
        assignment_id: UUID | None,
        role_key: str | None,
        capability_key: str | None,
        outcome: str,
        reason: str | None,
        details: dict[str, Any],
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into identity.authorization_audit_events (
                  event_type,
                  actor_account_id,
                  subject_account_id,
                  assignment_id,
                  role_key,
                  capability_key,
                  outcome,
                  reason,
                  details,
                  correlation_id
                ) values (
                  :event_type,
                  :actor_account_id,
                  :subject_account_id,
                  :assignment_id,
                  :role_key,
                  :capability_key,
                  :outcome,
                  :reason,
                  cast(:details as jsonb),
                  :correlation_id
                )
                """
            ),
            {
                "event_type": event_type,
                "actor_account_id": actor_account_id,
                "subject_account_id": subject_account_id,
                "assignment_id": assignment_id,
                "role_key": role_key,
                "capability_key": capability_key,
                "outcome": outcome,
                "reason": reason,
                "details": json.dumps(details, sort_keys=True),
                "correlation_id": correlation_id,
            },
        )

    def _insert_outbox(
        self,
        *,
        event_type: str,
        aggregate_id: UUID,
        idempotency_key: str,
        correlation_id: UUID,
        payload: dict[str, Any],
    ) -> None:
        self.session.execute(
            text(
                """
                insert into integration.outbox_events (
                  event_type,
                  event_version,
                  source_context,
                  aggregate_type,
                  aggregate_id,
                  idempotency_key,
                  correlation_id,
                  occurred_at,
                  payload
                ) values (
                  :event_type,
                  1,
                  'identity-engagement',
                  'account',
                  :aggregate_id,
                  :idempotency_key,
                  :correlation_id,
                  now(),
                  cast(:payload as jsonb)
                )
                on conflict (source_context, idempotency_key) do nothing
                """
            ),
            {
                "event_type": event_type,
                "aggregate_id": str(aggregate_id),
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
                "payload": json.dumps(payload, sort_keys=True),
            },
        )
