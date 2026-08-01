from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.engagement.repository import EngagementRepository
from app.identity.models import AccountState, RequestIdentity
from app.privacy_operations.models import (
    DeletionTombstoneRead,
    PrivacyContextRead,
    PrivacyContextState,
    PrivacyHoldBasis,
    PrivacyHoldRead,
    PrivacyHoldReleaseReason,
    PrivacyHoldState,
    PrivacyRequestKind,
    PrivacyRequestRead,
    PrivacyRequestState,
)


class PrivacyOperationsConflictError(RuntimeError):
    """Raised when a privacy command conflicts with current workflow state."""


class PrivacyOperationsForbiddenError(PermissionError):
    """Raised when a privacy command is not allowed for the current account."""


class PrivacyOperationsNotFoundError(LookupError):
    """Raised when a privacy request or context cannot be found."""


_REQUEST_CONTEXTS: dict[PrivacyRequestKind, tuple[str, ...]] = {
    PrivacyRequestKind.ACCESS_EXPORT: (
        "identity_profile",
        "engagement",
        "community_intake",
        "notification",
    ),
    PrivacyRequestKind.ACCOUNT_DELETION: (
        "identity_access",
        "engagement",
        "community_intake",
        "notification",
        "archive_provenance",
        "backup_tombstone",
    ),
}

def _scoped_key(*parts: object) -> str:
    return ":".join(str(part) for part in parts)


_PRIVATE_DELETION_CONTEXTS = (
    "engagement",
    "community_intake",
    "notification",
)


_ALLOWED_CONTEXT_TRANSITIONS: dict[PrivacyContextState, frozenset[PrivacyContextState]] = {
    PrivacyContextState.PENDING: frozenset(
        {
            PrivacyContextState.PROCESSING,
            PrivacyContextState.HELD,
            PrivacyContextState.NOT_APPLICABLE,
        }
    ),
    PrivacyContextState.PROCESSING: frozenset(
        {
            PrivacyContextState.COMPLETED,
            PrivacyContextState.FAILED,
            PrivacyContextState.HELD,
        }
    ),
    PrivacyContextState.FAILED: frozenset(
        {PrivacyContextState.PROCESSING, PrivacyContextState.HELD}
    ),
    PrivacyContextState.HELD: frozenset({PrivacyContextState.PENDING}),
    PrivacyContextState.COMPLETED: frozenset(),
    PrivacyContextState.NOT_APPLICABLE: frozenset(),
}


class PrivacyOperationsService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_request(
        self,
        *,
        identity: RequestIdentity,
        kind: PrivacyRequestKind,
        reason: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PrivacyRequestRead:
        replay = self.session.execute(
            text(
                """
                select request_id, kind::text, requested_reason
                from privacy.requests
                where account_id = :account_id and idempotency_key = :idempotency_key
                """
            ),
            {"account_id": identity.account_id, "idempotency_key": idempotency_key},
        ).mappings().one_or_none()
        if replay is not None:
            if replay["kind"] != kind.value or replay["requested_reason"] != reason:
                raise PrivacyOperationsConflictError(
                    "Idempotency key was already used with different request data"
                )
            return self.get_request(
                UUID(str(replay["request_id"])),
                account_id=identity.account_id,
            )

        account_state = self.session.execute(
            text(
                """
                select state::text
                from identity.accounts
                where account_id = :account_id
                for update
                """
            ),
            {"account_id": identity.account_id},
        ).scalar_one_or_none()
        if account_state is None:
            raise PrivacyOperationsNotFoundError("Account not found")
        if account_state != AccountState.ACTIVE.value:
            raise PrivacyOperationsForbiddenError("Account is not active")

        existing = self.session.execute(
            text(
                """
                select request_id
                from privacy.requests
                where account_id = :account_id
                  and kind = cast(:kind as privacy.request_kind)
                  and state in ('requested', 'verified', 'processing')
                limit 1
                """
            ),
            {"account_id": identity.account_id, "kind": kind.value},
        ).scalar_one_or_none()
        if existing is not None:
            raise PrivacyOperationsConflictError(
                "An open privacy request of this kind already exists"
            )

        request_id = uuid4()
        command_scope = _scoped_key("privacy-request", identity.account_id, idempotency_key)
        self.session.execute(
            text(
                """
                insert into privacy.requests (
                  request_id, account_id, kind, requested_reason,
                  idempotency_key, correlation_id
                ) values (
                  :request_id, :account_id, cast(:kind as privacy.request_kind), :reason,
                  :idempotency_key, :correlation_id
                )
                """
            ),
            {
                "request_id": request_id,
                "account_id": identity.account_id,
                "kind": kind.value,
                "reason": reason,
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
            },
        )
        for context_key in _REQUEST_CONTEXTS[kind]:
            self.session.execute(
                text(
                    """
                    insert into privacy.request_contexts (request_id, context_key)
                    values (:request_id, :context_key)
                    """
                ),
                {"request_id": request_id, "context_key": context_key},
            )

        self._insert_request_event(
            request_id=request_id,
            event_type="privacy.request.created",
            previous_state=None,
            next_state=PrivacyRequestState.REQUESTED,
            actor_account_id=identity.account_id,
            details={"kind": kind.value},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_scope, "created"),
        )
        self._insert_audit(
            event_type="privacy.request.created",
            actor_account_id=identity.account_id,
            subject_account_id=identity.account_id,
            request_id=request_id,
            outcome="requested",
            reason="user-requested",
            details={"kind": kind.value},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_scope, "audit"),
        )
        if kind is PrivacyRequestKind.ACCOUNT_DELETION:
            self._block_account_access(
                identity=identity,
                request_id=request_id,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
            )
        self._insert_outbox(
            event_type="privacy.request.created",
            request_id=request_id,
            idempotency_key=_scoped_key(command_scope, "outbox"),
            correlation_id=correlation_id,
            payload={
                "request_id": str(request_id),
                "account_id": str(identity.account_id),
                "kind": kind.value,
            },
        )
        self.session.commit()
        return self.get_request(request_id, account_id=identity.account_id)

    def list_for_account(self, account_id: UUID) -> list[PrivacyRequestRead]:
        request_ids = self.session.execute(
            text(
                """
                select request_id
                from privacy.requests
                where account_id = :account_id
                order by requested_at desc, request_id desc
                limit 100
                """
            ),
            {"account_id": account_id},
        ).scalars()
        return [
            self.get_request(UUID(str(request_id)), account_id=account_id)
            for request_id in request_ids
        ]

    def list_for_account_audited(
        self,
        *,
        actor: RequestIdentity,
        correlation_id: UUID,
    ) -> list[PrivacyRequestRead]:
        values = self.list_for_account(actor.account_id)
        self._insert_audit(
            event_type="privacy.self-queue.read",
            actor_account_id=actor.account_id,
            subject_account_id=actor.account_id,
            request_id=None,
            outcome="read",
            reason="self-read",
            details={"request_count": len(values)},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-self-queue-read",
                actor.account_id,
                uuid4(),
            ),
        )
        self.session.commit()
        return values

    def list_for_operator(
        self,
        *,
        actor: RequestIdentity,
        correlation_id: UUID,
    ) -> list[PrivacyRequestRead]:
        request_ids = self.session.execute(
            text(
                """
                select request_id
                from privacy.requests
                order by
                  case state
                    when 'requested' then 0
                    when 'verified' then 1
                    when 'processing' then 2
                    else 3
                  end,
                  requested_at,
                  request_id
                limit 100
                """
            )
        ).scalars()
        values = [self.get_request(UUID(str(request_id))) for request_id in request_ids]
        self._insert_audit(
            event_type="privacy.operator-queue.read",
            actor_account_id=actor.account_id,
            subject_account_id=None,
            request_id=None,
            outcome="read",
            reason="operator-read",
            details={"request_count": len(values), "limit": 100},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-operator-queue-read",
                actor.account_id,
                uuid4(),
            ),
        )
        self.session.commit()
        return values

    def get_request(
        self,
        request_id: UUID,
        *,
        account_id: UUID | None = None,
    ) -> PrivacyRequestRead:
        row = self.session.execute(
            text(
                """
                select request_id, account_id, kind::text, state::text, requested_reason,
                       requested_at, verified_by_account_id, verified_at,
                       processing_started_at, completed_at, failed_at, failure_code, version
                from privacy.requests
                where request_id = :request_id
                  and (
                    cast(:account_id as uuid) is null
                    or account_id = cast(:account_id as uuid)
                  )
                """
            ),
            {"request_id": request_id, "account_id": account_id},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy request not found")
        context_rows = self.session.execute(
            text(
                """
                select context_key, state::text, attempts, last_error_code, version, updated_at
                from privacy.request_contexts
                where request_id = :request_id
                order by context_key
                """
            ),
            {"request_id": request_id},
        ).mappings()
        contexts = [
            PrivacyContextRead(
                context_key=str(context["context_key"]),
                state=PrivacyContextState(str(context["state"])),
                attempts=int(context["attempts"]),
                last_error_code=context["last_error_code"],
                version=int(context["version"]),
                updated_at=context["updated_at"],
            )
            for context in context_rows
        ]
        return PrivacyRequestRead(
            request_id=UUID(str(row["request_id"])),
            account_id=UUID(str(row["account_id"])),
            kind=PrivacyRequestKind(str(row["kind"])),
            state=PrivacyRequestState(str(row["state"])),
            requested_reason=str(row["requested_reason"]),
            requested_at=row["requested_at"],
            verified_by_account_id=(
                UUID(str(row["verified_by_account_id"]))
                if row["verified_by_account_id"] is not None
                else None
            ),
            verified_at=row["verified_at"],
            processing_started_at=row["processing_started_at"],
            completed_at=row["completed_at"],
            failed_at=row["failed_at"],
            failure_code=row["failure_code"],
            version=int(row["version"]),
            contexts=contexts,
        )

    def get_for_account_audited(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        correlation_id: UUID,
    ) -> PrivacyRequestRead:
        value = self.get_request(request_id, account_id=actor.account_id)
        self._insert_audit(
            event_type="privacy.self-request.read",
            actor_account_id=actor.account_id,
            subject_account_id=actor.account_id,
            request_id=request_id,
            outcome="read",
            reason="self-read",
            details={},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-self-request-read",
                request_id,
                uuid4(),
            ),
        )
        self.session.commit()
        return value

    def get_for_operator(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        correlation_id: UUID,
    ) -> PrivacyRequestRead:
        value = self.get_request(request_id)
        self._insert_audit(
            event_type="privacy.operator-request.read",
            actor_account_id=actor.account_id,
            subject_account_id=value.account_id,
            request_id=request_id,
            outcome="read",
            reason="operator-read",
            details={},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-operator-request-read",
                request_id,
                actor.account_id,
                uuid4(),
            ),
        )
        self.session.commit()
        return value

    def verify_request(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        expected_version: int,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PrivacyRequestRead:
        command_key = _scoped_key("privacy-request", request_id, "verify", idempotency_key)
        replay_request_id = self.session.execute(
            text(
                """
                select request_id
                from privacy.request_events
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command_key},
        ).scalar_one_or_none()
        if replay_request_id is not None:
            return self.get_request(request_id)

        row = self.session.execute(
            text(
                """
                select account_id, state::text, version
                from privacy.requests
                where request_id = :request_id
                for update
                """
            ),
            {"request_id": request_id},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy request not found")
        subject_account_id = UUID(str(row["account_id"]))
        if actor.account_id == subject_account_id:
            raise PrivacyOperationsForbiddenError(
                "Privacy Operators cannot verify their own requests"
            )
        if int(row["version"]) != expected_version:
            raise PrivacyOperationsConflictError("Privacy request version conflict")
        if row["state"] != PrivacyRequestState.REQUESTED.value:
            raise PrivacyOperationsConflictError("Privacy request is not awaiting verification")

        self.session.execute(
            text(
                """
                update privacy.requests
                set state = 'verified', verified_by_account_id = :actor_account_id,
                    verified_at = now(), version = version + 1
                where request_id = :request_id
                """
            ),
            {"request_id": request_id, "actor_account_id": actor.account_id},
        )
        self._insert_request_event(
            request_id=request_id,
            event_type="privacy.request.verified",
            previous_state=PrivacyRequestState.REQUESTED,
            next_state=PrivacyRequestState.VERIFIED,
            actor_account_id=actor.account_id,
            details={},
            correlation_id=correlation_id,
            idempotency_key=command_key,
        )
        self._insert_audit(
            event_type="privacy.request.verified",
            actor_account_id=actor.account_id,
            subject_account_id=subject_account_id,
            request_id=request_id,
            outcome="verified",
            reason="operator-verified",
            details={},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_key, "audit"),
        )
        self._insert_outbox(
            event_type="privacy.request.verified",
            request_id=request_id,
            idempotency_key=_scoped_key(command_key, "outbox"),
            correlation_id=correlation_id,
            payload={"request_id": str(request_id), "account_id": str(subject_account_id)},
        )
        self.session.commit()
        return self.get_request(request_id)

    def update_context(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        context_key: str,
        expected_version: int,
        next_state: PrivacyContextState,
        internal_error_code: str | None,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PrivacyRequestRead:
        command_key = _scoped_key(
            "privacy-context",
            request_id,
            context_key,
            idempotency_key,
        )
        replay = self.session.execute(
            text(
                """
                select request_id, context_key, next_state::text
                from privacy.context_events
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command_key},
        ).mappings().one_or_none()
        if replay is not None:
            if replay["next_state"] != next_state.value:
                raise PrivacyOperationsConflictError(
                    "Idempotency key was already used with a different context state"
                )
            return self.get_request(request_id)

        row = self.session.execute(
            text(
                """
                select context.state::text as context_state, context.version as context_version,
                       request.state::text as request_state, request.kind::text as request_kind,
                       request.account_id
                from privacy.request_contexts context
                join privacy.requests request on request.request_id = context.request_id
                where context.request_id = :request_id and context.context_key = :context_key
                for update of context, request
                """
            ),
            {"request_id": request_id, "context_key": context_key},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy request context not found")
        subject_account_id = UUID(str(row["account_id"]))
        if actor.account_id == subject_account_id:
            raise PrivacyOperationsForbiddenError(
                "Privacy Operators cannot process their own requests"
            )
        if int(row["context_version"]) != expected_version:
            raise PrivacyOperationsConflictError("Privacy context version conflict")
        request_state = PrivacyRequestState(str(row["request_state"]))
        if request_state not in {PrivacyRequestState.VERIFIED, PrivacyRequestState.PROCESSING}:
            raise PrivacyOperationsConflictError("Privacy request is not ready for processing")
        previous_state = PrivacyContextState(str(row["context_state"]))
        request_kind = PrivacyRequestKind(str(row["request_kind"]))
        if (
            request_kind is PrivacyRequestKind.ACCOUNT_DELETION
            and context_key in _PRIVATE_DELETION_CONTEXTS
            and next_state is PrivacyContextState.COMPLETED
        ):
            raise PrivacyOperationsConflictError(
                "Private deletion contexts must complete through the deletion executor"
            )
        if next_state not in _ALLOWED_CONTEXT_TRANSITIONS[previous_state]:
            raise PrivacyOperationsConflictError(
                "Privacy context cannot transition from "
                f"{previous_state.value} to {next_state.value}"
            )
        if next_state is PrivacyContextState.FAILED and not internal_error_code:
            raise PrivacyOperationsConflictError("Failed privacy contexts require an error code")
        if next_state is not PrivacyContextState.FAILED and internal_error_code:
            raise PrivacyOperationsConflictError(
                "Error codes are only valid for failed privacy contexts"
            )

        self.session.execute(
            text(
                """
                update privacy.request_contexts
                set state = cast(:next_state as privacy.context_state),
                    attempts = attempts + case when :next_state = 'processing' then 1 else 0 end,
                    last_error_code = :internal_error_code,
                    version = version + 1
                where request_id = :request_id and context_key = :context_key
                """
            ),
            {
                "request_id": request_id,
                "context_key": context_key,
                "next_state": next_state.value,
                "internal_error_code": internal_error_code,
            },
        )
        self.session.execute(
            text(
                """
                insert into privacy.context_events (
                  request_id, context_key, previous_state, next_state,
                  actor_account_id, internal_error_code,
                  correlation_id, idempotency_key
                ) values (
                  :request_id, :context_key,
                  cast(:previous_state as privacy.context_state),
                  cast(:next_state as privacy.context_state),
                  :actor_account_id, :internal_error_code,
                  :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "request_id": request_id,
                "context_key": context_key,
                "previous_state": previous_state.value,
                "next_state": next_state.value,
                "actor_account_id": actor.account_id,
                "internal_error_code": internal_error_code,
                "correlation_id": correlation_id,
                "idempotency_key": command_key,
            },
        )

        if (
            PrivacyRequestKind(str(row["request_kind"]))
            is PrivacyRequestKind.ACCOUNT_DELETION
            and next_state is PrivacyContextState.COMPLETED
        ):
            self._apply_deletion_tombstone(
                account_id=subject_account_id,
                request_id=request_id,
                context_key=context_key,
            )

        if request_state is PrivacyRequestState.VERIFIED:
            self.session.execute(
                text(
                    """
                    update privacy.requests
                    set state = 'processing',
                        processing_started_at = coalesce(processing_started_at, now()),
                        version = version + 1
                    where request_id = :request_id
                    """
                ),
                {"request_id": request_id},
            )
            self._insert_request_event(
                request_id=request_id,
                event_type="privacy.request.processing",
                previous_state=PrivacyRequestState.VERIFIED,
                next_state=PrivacyRequestState.PROCESSING,
                actor_account_id=actor.account_id,
                details={"context_key": context_key},
                correlation_id=correlation_id,
                idempotency_key=_scoped_key(command_key, "request-processing"),
            )

        incomplete = int(
            self.session.execute(
                text(
                    """
                    select count(*)
                    from privacy.request_contexts
                    where request_id = :request_id
                      and state not in ('completed', 'not_applicable')
                    """
                ),
                {"request_id": request_id},
            ).scalar_one()
        )
        if incomplete == 0:
            self.session.execute(
                text(
                    """
                    update privacy.requests
                    set state = 'completed', completed_at = now(), version = version + 1
                    where request_id = :request_id
                    """
                ),
                {"request_id": request_id},
            )
            self._insert_request_event(
                request_id=request_id,
                event_type="privacy.request.completed",
                previous_state=PrivacyRequestState.PROCESSING,
                next_state=PrivacyRequestState.COMPLETED,
                actor_account_id=actor.account_id,
                details={},
                correlation_id=correlation_id,
                idempotency_key=_scoped_key(command_key, "request-completed"),
            )

        self._insert_audit(
            event_type="privacy.context.updated",
            actor_account_id=actor.account_id,
            subject_account_id=subject_account_id,
            request_id=request_id,
            outcome=next_state.value,
            reason="operator-updated-context",
            details={
                "context_key": context_key,
                "previous_state": previous_state.value,
                "next_state": next_state.value,
                "error_code": internal_error_code,
            },
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_key, "audit"),
        )
        self._insert_outbox(
            event_type="privacy.context.updated",
            request_id=request_id,
            idempotency_key=_scoped_key(command_key, "outbox"),
            correlation_id=correlation_id,
            payload={
                "request_id": str(request_id),
                "account_id": str(subject_account_id),
                "context_key": context_key,
                "state": next_state.value,
            },
        )
        self.session.commit()
        return self.get_request(request_id)

    def execute_private_deletion(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        expected_context_versions: dict[str, int],
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PrivacyRequestRead:
        if set(expected_context_versions) != set(_PRIVATE_DELETION_CONTEXTS):
            raise PrivacyOperationsConflictError(
                "Private deletion requires exact engagement, community_intake, "
                "and notification versions"
            )
        if any(version < 1 for version in expected_context_versions.values()):
            raise PrivacyOperationsConflictError("Privacy context versions must be positive")

        command_key = _scoped_key("privacy-private-deletion", request_id, idempotency_key)
        replay = self.session.execute(
            text(
                """
                select details
                from privacy.audit_events
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command_key},
        ).mappings().one_or_none()
        if replay is not None:
            replay_versions = dict(replay["details"]).get("expected_context_versions")
            if replay_versions != expected_context_versions:
                raise PrivacyOperationsConflictError(
                    "Idempotency key was already used with different context versions"
                )
            return self.get_request(request_id)

        request_row = self.session.execute(
            text(
                """
                select account_id, kind::text, state::text
                from privacy.requests
                where request_id = :request_id
                for update
                """
            ),
            {"request_id": request_id},
        ).mappings().one_or_none()
        if request_row is None:
            raise PrivacyOperationsNotFoundError("Privacy request not found")
        subject_account_id = UUID(str(request_row["account_id"]))
        if actor.account_id == subject_account_id:
            raise PrivacyOperationsForbiddenError(
                "Privacy Operators cannot execute their own deletion requests"
            )
        if request_row["kind"] != PrivacyRequestKind.ACCOUNT_DELETION.value:
            raise PrivacyOperationsConflictError("Privacy request is not an account deletion")
        request_state = PrivacyRequestState(str(request_row["state"]))
        if request_state not in {
            PrivacyRequestState.VERIFIED,
            PrivacyRequestState.PROCESSING,
        }:
            raise PrivacyOperationsConflictError(
                "Privacy deletion request is not ready for processing"
            )

        context_rows = self.session.execute(
            text(
                """
                select context_key, state::text, version
                from privacy.request_contexts
                where request_id = :request_id
                  and context_key = any(cast(:context_keys as text[]))
                for update
                """
            ),
            {
                "request_id": request_id,
                "context_keys": list(_PRIVATE_DELETION_CONTEXTS),
            },
        ).mappings().all()
        by_key = {str(row["context_key"]): row for row in context_rows}
        if set(by_key) != set(_PRIVATE_DELETION_CONTEXTS):
            raise PrivacyOperationsConflictError("Privacy deletion contexts are incomplete")
        for context_key in _PRIVATE_DELETION_CONTEXTS:
            row = by_key[context_key]
            if int(row["version"]) != expected_context_versions[context_key]:
                raise PrivacyOperationsConflictError(
                    f"Privacy context version conflict for {context_key}"
                )
            state = PrivacyContextState(str(row["state"]))
            if state not in {
                PrivacyContextState.PENDING,
                PrivacyContextState.PROCESSING,
                PrivacyContextState.FAILED,
            }:
                raise PrivacyOperationsConflictError(
                    f"Privacy context {context_key} cannot execute from {state.value}"
                )

        deletion_result = EngagementRepository(
            self.session
        ).delete_private_data_for_account(
            account_id=subject_account_id,
            actor_account_id=actor.account_id,
            idempotency_key=command_key,
            reason="privacy-account-deletion-requested",
            correlation_id=correlation_id,
            commit=False,
        )
        counts = {
            key: int(value)
            for key, value in deletion_result.items()
            if key.endswith("_deleted")
        }

        if request_state is PrivacyRequestState.VERIFIED:
            self.session.execute(
                text(
                    """
                    update privacy.requests
                    set state = 'processing',
                        processing_started_at = coalesce(processing_started_at, now()),
                        version = version + 1
                    where request_id = :request_id
                    """
                ),
                {"request_id": request_id},
            )
            self._insert_request_event(
                request_id=request_id,
                event_type="privacy.request.processing",
                previous_state=PrivacyRequestState.VERIFIED,
                next_state=PrivacyRequestState.PROCESSING,
                actor_account_id=actor.account_id,
                details={"execution": "private-deletion"},
                correlation_id=correlation_id,
                idempotency_key=_scoped_key(command_key, "request-processing"),
            )

        for context_key in _PRIVATE_DELETION_CONTEXTS:
            previous_state = PrivacyContextState(str(by_key[context_key]["state"]))
            version_increment = 1 if previous_state is PrivacyContextState.PROCESSING else 2
            attempt_increment = 0 if previous_state is PrivacyContextState.PROCESSING else 1
            self.session.execute(
                text(
                    """
                    update privacy.request_contexts
                    set state = 'completed', last_error_code = null,
                        attempts = attempts + :attempt_increment,
                        version = version + :version_increment
                    where request_id = :request_id and context_key = :context_key
                    """
                ),
                {
                    "request_id": request_id,
                    "context_key": context_key,
                    "attempt_increment": attempt_increment,
                    "version_increment": version_increment,
                },
            )
            if previous_state is not PrivacyContextState.PROCESSING:
                self.session.execute(
                    text(
                        """
                        insert into privacy.context_events (
                          request_id, context_key, previous_state, next_state,
                          actor_account_id, correlation_id, idempotency_key
                        ) values (
                          :request_id, :context_key,
                          cast(:previous_state as privacy.context_state), 'processing',
                          :actor_account_id, :correlation_id, :idempotency_key
                        )
                        """
                    ),
                    {
                        "request_id": request_id,
                        "context_key": context_key,
                        "previous_state": previous_state.value,
                        "actor_account_id": actor.account_id,
                        "correlation_id": correlation_id,
                        "idempotency_key": _scoped_key(
                            command_key,
                            context_key,
                            "processing",
                        ),
                    },
                )
            self.session.execute(
                text(
                    """
                    insert into privacy.context_events (
                      request_id, context_key, previous_state, next_state,
                      actor_account_id, correlation_id, idempotency_key
                    ) values (
                      :request_id, :context_key, 'processing', 'completed',
                      :actor_account_id, :correlation_id, :idempotency_key
                    )
                    """
                ),
                {
                    "request_id": request_id,
                    "context_key": context_key,
                    "actor_account_id": actor.account_id,
                    "correlation_id": correlation_id,
                    "idempotency_key": _scoped_key(
                        command_key,
                        context_key,
                        "completed",
                    ),
                },
            )
            self._apply_deletion_tombstone(
                account_id=subject_account_id,
                request_id=request_id,
                context_key=context_key,
            )

        self._insert_audit(
            event_type="privacy.private-data.deleted",
            actor_account_id=actor.account_id,
            subject_account_id=subject_account_id,
            request_id=request_id,
            outcome="completed",
            reason="privacy-account-deletion-requested",
            details={
                "expected_context_versions": expected_context_versions,
                "counts": counts,
            },
            correlation_id=correlation_id,
            idempotency_key=command_key,
        )
        self._insert_outbox(
            event_type="privacy.private-data.deleted",
            request_id=request_id,
            idempotency_key=_scoped_key(command_key, "outbox"),
            correlation_id=correlation_id,
            payload={
                "request_id": str(request_id),
                "account_id": str(subject_account_id),
                "contexts": list(_PRIVATE_DELETION_CONTEXTS),
                "counts": counts,
            },
        )
        self._complete_request_if_ready(
            request_id=request_id,
            actor_account_id=actor.account_id,
            correlation_id=correlation_id,
            idempotency_key=command_key,
        )
        self.session.commit()
        return self.get_request(request_id)

    def create_hold(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        context_key: str,
        expected_context_version: int,
        basis: PrivacyHoldBasis,
        review_due_at: datetime,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PrivacyHoldRead:
        if review_due_at.tzinfo is None or review_due_at <= datetime.now(UTC):
            raise PrivacyOperationsConflictError("Hold review time must be in the future")
        command_key = _scoped_key(
            "privacy-hold",
            request_id,
            context_key,
            idempotency_key,
        )
        replay = self.session.execute(
            text(
                """
                select hold.hold_id, hold.basis, hold.review_due_at
                from privacy.hold_events event
                join privacy.holds hold on hold.hold_id = event.hold_id
                where event.idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command_key},
        ).mappings().one_or_none()
        if replay is not None:
            if (
                replay["basis"] != basis.value
                or replay["review_due_at"] != review_due_at
            ):
                raise PrivacyOperationsConflictError(
                    "Idempotency key was already used with different hold data"
                )
            return self.get_hold(UUID(str(replay["hold_id"])))

        row = self.session.execute(
            text(
                """
                select request.account_id, request.state::text as request_state,
                       context.state::text as context_state,
                       context.version as context_version
                from privacy.requests request
                join privacy.request_contexts context
                  on context.request_id = request.request_id
                where request.request_id = :request_id
                  and context.context_key = :context_key
                for update of request, context
                """
            ),
            {"request_id": request_id, "context_key": context_key},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy request context not found")
        subject_account_id = UUID(str(row["account_id"]))
        if actor.account_id == subject_account_id:
            raise PrivacyOperationsForbiddenError(
                "Privacy Operators cannot hold their own requests"
            )
        if int(row["context_version"]) != expected_context_version:
            raise PrivacyOperationsConflictError("Privacy context version conflict")
        request_state = PrivacyRequestState(str(row["request_state"]))
        if request_state not in {PrivacyRequestState.VERIFIED, PrivacyRequestState.PROCESSING}:
            raise PrivacyOperationsConflictError("Privacy request is not ready for a hold")
        previous_state = PrivacyContextState(str(row["context_state"]))
        if previous_state not in {
            PrivacyContextState.PENDING,
            PrivacyContextState.PROCESSING,
            PrivacyContextState.FAILED,
        }:
            raise PrivacyOperationsConflictError("Privacy context cannot be held")
        active_hold = self.session.execute(
            text(
                """
                select hold_id
                from privacy.holds
                where account_id = :account_id
                  and context_key = :context_key
                  and state = 'active'
                """
            ),
            {"account_id": subject_account_id, "context_key": context_key},
        ).scalar_one_or_none()
        if active_hold is not None:
            raise PrivacyOperationsConflictError(
                "An active hold already exists for this account context"
            )

        hold_id = uuid4()
        self.session.execute(
            text(
                """
                insert into privacy.holds (
                  hold_id, account_id, request_id, context_key, basis,
                  created_by_account_id, review_due_at
                ) values (
                  :hold_id, :account_id, :request_id, :context_key, :basis,
                  :actor_account_id, :review_due_at
                )
                """
            ),
            {
                "hold_id": hold_id,
                "account_id": subject_account_id,
                "request_id": request_id,
                "context_key": context_key,
                "basis": basis.value,
                "actor_account_id": actor.account_id,
                "review_due_at": review_due_at,
            },
        )
        self.session.execute(
            text(
                """
                update privacy.request_contexts
                set state = 'held', last_error_code = null, version = version + 1
                where request_id = :request_id and context_key = :context_key
                """
            ),
            {"request_id": request_id, "context_key": context_key},
        )
        self.session.execute(
            text(
                """
                insert into privacy.context_events (
                  request_id, context_key, previous_state, next_state,
                  actor_account_id, correlation_id, idempotency_key
                ) values (
                  :request_id, :context_key,
                  cast(:previous_state as privacy.context_state), 'held',
                  :actor_account_id, :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "request_id": request_id,
                "context_key": context_key,
                "previous_state": previous_state.value,
                "actor_account_id": actor.account_id,
                "correlation_id": correlation_id,
                "idempotency_key": _scoped_key(command_key, "context"),
            },
        )
        self.session.execute(
            text(
                """
                insert into privacy.hold_events (
                  hold_id, event_type, actor_account_id, details,
                  correlation_id, idempotency_key
                ) values (
                  :hold_id, 'privacy.hold.created', :actor_account_id,
                  cast(:details as jsonb), :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "hold_id": hold_id,
                "actor_account_id": actor.account_id,
                "details": json.dumps(
                    {
                        "basis": basis.value,
                        "context_key": context_key,
                        "review_due_at": review_due_at.isoformat(),
                    },
                    sort_keys=True,
                ),
                "correlation_id": correlation_id,
                "idempotency_key": command_key,
            },
        )
        self._insert_audit(
            event_type="privacy.hold.created",
            actor_account_id=actor.account_id,
            subject_account_id=subject_account_id,
            request_id=request_id,
            outcome="held",
            reason=basis.value,
            details={"hold_id": str(hold_id), "context_key": context_key},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_key, "audit"),
        )
        self._insert_outbox(
            event_type="privacy.hold.created",
            request_id=request_id,
            idempotency_key=_scoped_key(command_key, "outbox"),
            correlation_id=correlation_id,
            payload={
                "hold_id": str(hold_id),
                "request_id": str(request_id),
                "account_id": str(subject_account_id),
                "context_key": context_key,
                "basis": basis.value,
            },
        )
        self.session.commit()
        return self.get_hold(hold_id)

    def list_holds(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        correlation_id: UUID,
    ) -> list[PrivacyHoldRead]:
        request = self.get_request(request_id)
        hold_ids = self.session.execute(
            text(
                """
                select hold_id
                from privacy.holds
                where request_id = :request_id
                order by created_at desc, hold_id desc
                limit 100
                """
            ),
            {"request_id": request_id},
        ).scalars()
        values = [self.get_hold(UUID(str(hold_id))) for hold_id in hold_ids]
        self._insert_audit(
            event_type="privacy.operator-holds.read",
            actor_account_id=actor.account_id,
            subject_account_id=request.account_id,
            request_id=request_id,
            outcome="read",
            reason="operator-read",
            details={"hold_count": len(values), "limit": 100},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-operator-holds-read",
                request_id,
                actor.account_id,
                uuid4(),
            ),
        )
        self.session.commit()
        return values

    def get_hold(self, hold_id: UUID) -> PrivacyHoldRead:
        row = self.session.execute(
            text(
                """
                select hold_id, request_id, account_id, context_key, basis,
                       state::text, version, created_by_account_id, created_at,
                       review_due_at, released_by_account_id, released_at, release_reason
                from privacy.holds
                where hold_id = :hold_id
                """
            ),
            {"hold_id": hold_id},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy hold not found")
        return PrivacyHoldRead(
            hold_id=UUID(str(row["hold_id"])),
            request_id=UUID(str(row["request_id"])),
            account_id=UUID(str(row["account_id"])),
            context_key=str(row["context_key"]),
            basis=PrivacyHoldBasis(str(row["basis"])),
            state=PrivacyHoldState(str(row["state"])),
            version=int(row["version"]),
            created_by_account_id=UUID(str(row["created_by_account_id"])),
            created_at=row["created_at"],
            review_due_at=row["review_due_at"],
            released_by_account_id=(
                UUID(str(row["released_by_account_id"]))
                if row["released_by_account_id"] is not None
                else None
            ),
            released_at=row["released_at"],
            release_reason=(
                PrivacyHoldReleaseReason(str(row["release_reason"]))
                if row["release_reason"] is not None
                else None
            ),
        )

    def release_hold(
        self,
        *,
        actor: RequestIdentity,
        hold_id: UUID,
        expected_hold_version: int,
        expected_context_version: int,
        reason: PrivacyHoldReleaseReason,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PrivacyHoldRead:
        command_key = _scoped_key("privacy-hold-release", hold_id, idempotency_key)
        replay = self.session.execute(
            text(
                """
                select hold_id, details ->> 'release_reason' as release_reason
                from privacy.hold_events
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command_key},
        ).mappings().one_or_none()
        if replay is not None:
            if replay["release_reason"] != reason.value:
                raise PrivacyOperationsConflictError(
                    "Idempotency key was already used with a different release reason"
                )
            return self.get_hold(UUID(str(replay["hold_id"])))

        row = self.session.execute(
            text(
                """
                select hold.account_id, hold.request_id, hold.context_key,
                       hold.state::text as hold_state, hold.version as hold_version,
                       context.state::text as context_state,
                       context.version as context_version
                from privacy.holds hold
                join privacy.request_contexts context
                  on context.request_id = hold.request_id
                 and context.context_key = hold.context_key
                where hold.hold_id = :hold_id
                for update of hold, context
                """
            ),
            {"hold_id": hold_id},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy hold not found")
        subject_account_id = UUID(str(row["account_id"]))
        request_id = UUID(str(row["request_id"]))
        context_key = str(row["context_key"])
        if actor.account_id == subject_account_id:
            raise PrivacyOperationsForbiddenError(
                "Privacy Operators cannot release holds on their own requests"
            )
        if int(row["hold_version"]) != expected_hold_version:
            raise PrivacyOperationsConflictError("Privacy hold version conflict")
        if int(row["context_version"]) != expected_context_version:
            raise PrivacyOperationsConflictError("Privacy context version conflict")
        if row["hold_state"] != PrivacyHoldState.ACTIVE.value:
            raise PrivacyOperationsConflictError("Privacy hold is not active")
        if row["context_state"] != PrivacyContextState.HELD.value:
            raise PrivacyOperationsConflictError("Privacy context is not held")

        self.session.execute(
            text(
                """
                update privacy.holds
                set state = 'released', version = version + 1,
                    released_by_account_id = :actor_account_id,
                    released_at = now(), release_reason = :release_reason
                where hold_id = :hold_id
                """
            ),
            {
                "hold_id": hold_id,
                "actor_account_id": actor.account_id,
                "release_reason": reason.value,
            },
        )
        self.session.execute(
            text(
                """
                update privacy.request_contexts
                set state = 'pending', version = version + 1
                where request_id = :request_id and context_key = :context_key
                """
            ),
            {"request_id": request_id, "context_key": context_key},
        )
        self.session.execute(
            text(
                """
                insert into privacy.context_events (
                  request_id, context_key, previous_state, next_state,
                  actor_account_id, correlation_id, idempotency_key
                ) values (
                  :request_id, :context_key, 'held', 'pending',
                  :actor_account_id, :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "request_id": request_id,
                "context_key": context_key,
                "actor_account_id": actor.account_id,
                "correlation_id": correlation_id,
                "idempotency_key": _scoped_key(command_key, "context"),
            },
        )
        self.session.execute(
            text(
                """
                insert into privacy.hold_events (
                  hold_id, event_type, actor_account_id, details,
                  correlation_id, idempotency_key
                ) values (
                  :hold_id, 'privacy.hold.released', :actor_account_id,
                  cast(:details as jsonb), :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "hold_id": hold_id,
                "actor_account_id": actor.account_id,
                "details": json.dumps({"release_reason": reason.value}, sort_keys=True),
                "correlation_id": correlation_id,
                "idempotency_key": command_key,
            },
        )
        self._insert_audit(
            event_type="privacy.hold.released",
            actor_account_id=actor.account_id,
            subject_account_id=subject_account_id,
            request_id=request_id,
            outcome="released",
            reason=reason.value,
            details={"hold_id": str(hold_id), "context_key": context_key},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_key, "audit"),
        )
        self._insert_outbox(
            event_type="privacy.hold.released",
            request_id=request_id,
            idempotency_key=_scoped_key(command_key, "outbox"),
            correlation_id=correlation_id,
            payload={
                "hold_id": str(hold_id),
                "request_id": str(request_id),
                "account_id": str(subject_account_id),
                "context_key": context_key,
                "release_reason": reason.value,
            },
        )
        self.session.commit()
        return self.get_hold(hold_id)

    def get_tombstone(self, *, account_id: UUID, context_key: str) -> DeletionTombstoneRead:
        row = self.session.execute(
            text(
                """
                select account_id, context_key, request_id, applied_at,
                       last_replayed_at, replay_count, version
                from privacy.deletion_tombstones
                where account_id = :account_id and context_key = :context_key
                """
            ),
            {"account_id": account_id, "context_key": context_key},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Deletion tombstone not found")
        return DeletionTombstoneRead(
            account_id=UUID(str(row["account_id"])),
            context_key=str(row["context_key"]),
            request_id=UUID(str(row["request_id"])),
            applied_at=row["applied_at"],
            last_replayed_at=row["last_replayed_at"],
            replay_count=int(row["replay_count"]),
            version=int(row["version"]),
        )

    def replay_tombstone(
        self,
        *,
        actor: RequestIdentity,
        account_id: UUID,
        context_key: str,
        expected_version: int,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> DeletionTombstoneRead:
        command_key = _scoped_key(
            "privacy-tombstone-replay",
            account_id,
            context_key,
            idempotency_key,
        )
        replay_request_id = self.session.execute(
            text(
                """
                select request_id
                from privacy.audit_events
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command_key},
        ).scalar_one_or_none()
        if replay_request_id is not None:
            return self.get_tombstone(account_id=account_id, context_key=context_key)
        if actor.account_id == account_id:
            raise PrivacyOperationsForbiddenError(
                "Privacy Operators cannot replay their own deletion tombstones"
            )
        row = self.session.execute(
            text(
                """
                select request_id, version
                from privacy.deletion_tombstones
                where account_id = :account_id and context_key = :context_key
                for update
                """
            ),
            {"account_id": account_id, "context_key": context_key},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Deletion tombstone not found")
        if int(row["version"]) != expected_version:
            raise PrivacyOperationsConflictError("Deletion tombstone version conflict")
        request_id = UUID(str(row["request_id"]))
        self.session.execute(
            text(
                """
                update privacy.deletion_tombstones
                set last_replayed_at = now(), replay_count = replay_count + 1,
                    version = version + 1
                where account_id = :account_id and context_key = :context_key
                """
            ),
            {"account_id": account_id, "context_key": context_key},
        )
        self._insert_audit(
            event_type="privacy.deletion-tombstone.replayed",
            actor_account_id=actor.account_id,
            subject_account_id=account_id,
            request_id=request_id,
            outcome="replay-requested",
            reason="backup-restore-reapply",
            details={"context_key": context_key},
            correlation_id=correlation_id,
            idempotency_key=command_key,
        )
        self._insert_outbox(
            event_type="privacy.deletion-tombstone.replay-requested",
            request_id=request_id,
            idempotency_key=_scoped_key(command_key, "outbox"),
            correlation_id=correlation_id,
            payload={
                "request_id": str(request_id),
                "account_id": str(account_id),
                "context_key": context_key,
            },
        )
        self.session.commit()
        return self.get_tombstone(account_id=account_id, context_key=context_key)

    def _complete_request_if_ready(
        self,
        *,
        request_id: UUID,
        actor_account_id: UUID,
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        incomplete = int(
            self.session.execute(
                text(
                    """
                    select count(*)
                    from privacy.request_contexts
                    where request_id = :request_id
                      and state not in ('completed', 'not_applicable')
                    """
                ),
                {"request_id": request_id},
            ).scalar_one()
        )
        if incomplete != 0:
            return
        current_state = self.session.execute(
            text(
                """
                select state::text
                from privacy.requests
                where request_id = :request_id
                for update
                """
            ),
            {"request_id": request_id},
        ).scalar_one()
        if current_state == PrivacyRequestState.COMPLETED.value:
            return
        if current_state != PrivacyRequestState.PROCESSING.value:
            raise PrivacyOperationsConflictError(
                "Privacy request cannot complete outside processing state"
            )
        self.session.execute(
            text(
                """
                update privacy.requests
                set state = 'completed', completed_at = now(), version = version + 1
                where request_id = :request_id
                """
            ),
            {"request_id": request_id},
        )
        self._insert_request_event(
            request_id=request_id,
            event_type="privacy.request.completed",
            previous_state=PrivacyRequestState.PROCESSING,
            next_state=PrivacyRequestState.COMPLETED,
            actor_account_id=actor_account_id,
            details={},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(idempotency_key, "request-completed"),
        )

    def _apply_deletion_tombstone(
        self,
        *,
        account_id: UUID,
        request_id: UUID,
        context_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into privacy.deletion_tombstones (
                  account_id, context_key, request_id
                ) values (
                  :account_id, :context_key, :request_id
                )
                on conflict (account_id, context_key) do update
                set request_id = excluded.request_id,
                    applied_at = now(),
                    last_replayed_at = null,
                    replay_count = 0,
                    version = privacy.deletion_tombstones.version + 1
                """
            ),
            {
                "account_id": account_id,
                "context_key": context_key,
                "request_id": request_id,
            },
        )

    def _block_account_access(
        self,
        *,
        identity: RequestIdentity,
        request_id: UUID,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> None:
        reason_code = "privacy-account-deletion-requested"
        command_key = _scoped_key(
            "privacy-delete-block",
            identity.account_id,
            idempotency_key,
        )
        self.session.execute(
            text(
                """
                update identity.accounts
                set state = 'deleting', state_reason = :reason, state_changed_at = now()
                where account_id = :account_id and state = 'active'
                """
            ),
            {"account_id": identity.account_id, "reason": reason_code},
        )
        self.session.execute(
            text(
                """
                insert into identity.account_state_events (
                  account_id, previous_state, next_state, actor_account_id,
                  reason, correlation_id, idempotency_key
                ) values (
                  :account_id, 'active', 'deleting', :account_id,
                  :reason, :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "account_id": identity.account_id,
                "reason": reason_code,
                "correlation_id": correlation_id,
                "idempotency_key": _scoped_key(command_key, "identity-event"),
            },
        )
        self.session.execute(
            text(
                """
                insert into identity.authorization_audit_events (
                  event_type, actor_account_id, subject_account_id, outcome,
                  reason, details, correlation_id
                ) values (
                  'identity.account-self-deletion-started', :account_id, :account_id, 'changed',
                  :reason, cast(:details as jsonb), :correlation_id
                )
                """
            ),
            {
                "account_id": identity.account_id,
                "reason": reason_code,
                "details": json.dumps({"request_id": str(request_id)}, sort_keys=True),
                "correlation_id": correlation_id,
            },
        )
        self.session.execute(
            text(
                """
                insert into integration.outbox_events (
                  event_type, event_version, source_context, aggregate_type,
                  aggregate_id, idempotency_key, correlation_id, occurred_at, payload
                ) values (
                  'identity.account-state-changed', 1, 'privacy-operations', 'account',
                  :account_id, :idempotency_key, :correlation_id, now(), cast(:payload as jsonb)
                )
                on conflict (source_context, idempotency_key) do nothing
                """
            ),
            {
                "account_id": str(identity.account_id),
                "idempotency_key": _scoped_key(command_key, "outbox"),
                "correlation_id": correlation_id,
                "payload": json.dumps(
                    {
                        "account_id": str(identity.account_id),
                        "previous_state": "active",
                        "next_state": "deleting",
                        "request_id": str(request_id),
                        "actor_account_id": str(identity.account_id),
                    },
                    sort_keys=True,
                ),
            },
        )

    def _insert_request_event(
        self,
        *,
        request_id: UUID,
        event_type: str,
        previous_state: PrivacyRequestState | None,
        next_state: PrivacyRequestState,
        actor_account_id: UUID,
        details: dict[str, Any],
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into privacy.request_events (
                  request_id, event_type, previous_state, next_state,
                  actor_account_id, details,
                  correlation_id, idempotency_key
                ) values (
                  :request_id, :event_type,
                  cast(:previous_state as privacy.request_state),
                  cast(:next_state as privacy.request_state),
                  :actor_account_id, cast(:details as jsonb),
                  :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "request_id": request_id,
                "event_type": event_type,
                "previous_state": previous_state.value if previous_state else None,
                "next_state": next_state.value,
                "actor_account_id": actor_account_id,
                "details": json.dumps(details, sort_keys=True),
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )

    def _insert_audit(
        self,
        *,
        event_type: str,
        actor_account_id: UUID,
        subject_account_id: UUID | None,
        request_id: UUID | None,
        outcome: str,
        reason: str | None,
        details: dict[str, Any],
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into privacy.audit_events (
                  event_type, actor_account_id, subject_account_id, request_id,
                  outcome, reason, details, correlation_id, idempotency_key
                ) values (
                  :event_type, :actor_account_id, :subject_account_id, :request_id,
                  :outcome, :reason, cast(:details as jsonb), :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "event_type": event_type,
                "actor_account_id": actor_account_id,
                "subject_account_id": subject_account_id,
                "request_id": request_id,
                "outcome": outcome,
                "reason": reason,
                "details": json.dumps(details, sort_keys=True),
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )

    def _insert_outbox(
        self,
        *,
        event_type: str,
        request_id: UUID,
        idempotency_key: str,
        correlation_id: UUID,
        payload: dict[str, Any],
    ) -> None:
        self.session.execute(
            text(
                """
                insert into integration.outbox_events (
                  event_type, event_version, source_context, aggregate_type,
                  aggregate_id, idempotency_key, correlation_id, occurred_at, payload
                ) values (
                  :event_type, 1, 'privacy-operations', 'privacy_request',
                  :aggregate_id, :idempotency_key, :correlation_id, now(), cast(:payload as jsonb)
                )
                on conflict (source_context, idempotency_key) do nothing
                """
            ),
            {
                "event_type": event_type,
                "aggregate_id": str(request_id),
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
                "payload": json.dumps(payload, sort_keys=True),
            },
        )
