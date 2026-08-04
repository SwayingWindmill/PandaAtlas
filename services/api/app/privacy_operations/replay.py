from __future__ import annotations

import hashlib
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.engagement.repository import EngagementRepository
from app.identity.models import AccountState


class PrivacyDeletionReplayError(RuntimeError):
    """Raised when a deletion tombstone cannot be reapplied safely."""


def _scoped_key(*parts: object) -> str:
    return ":".join(str(part) for part in parts)


def _append_identity_state_event(
    session: Session,
    *,
    account_id: UUID,
    previous_state: str,
    next_state: str,
    actor_account_id: UUID,
    reason: str,
    correlation_id: UUID,
    idempotency_key: str,
) -> None:
    session.execute(
        text(
            """
            insert into identity.account_state_events (
              account_id, previous_state, next_state, actor_account_id,
              reason, correlation_id, idempotency_key
            ) values (
              :account_id, cast(:previous_state as identity.account_state),
              cast(:next_state as identity.account_state), :actor_account_id,
              :reason, :correlation_id, :idempotency_key
            )
            """
        ),
        {
            "account_id": account_id,
            "previous_state": previous_state,
            "next_state": next_state,
            "actor_account_id": actor_account_id,
            "reason": reason,
            "correlation_id": correlation_id,
            "idempotency_key": idempotency_key,
        },
    )


def reapply_account_deletion(
    session: Session,
    *,
    actor_account_id: UUID,
    account_id: UUID,
    request_id: UUID,
    idempotency_key: str,
    correlation_id: UUID,
) -> dict[str, int]:
    tombstone = session.execute(
        text(
            """
            select tombstone_email, contributor_subject_hash
            from identity.account_tombstones
            where account_id = :account_id and privacy_request_id = :request_id
            for share
            """
        ),
        {"account_id": account_id, "request_id": request_id},
    ).mappings().one_or_none()
    if tombstone is None:
        raise PrivacyDeletionReplayError(
            "Identity tombstone must exist before deletion replay"
        )

    tombstone_email = str(tombstone["tombstone_email"])
    contributor_subject_hash = str(tombstone["contributor_subject_hash"])
    legacy_subject_hash = hashlib.sha256(
        f"community-intake-account:{account_id}".encode()
    ).hexdigest()
    previous_state = session.execute(
        text(
            """
            select state::text
            from identity.accounts
            where account_id = :account_id
            for update
            """
        ),
        {"account_id": account_id},
    ).scalar_one_or_none()
    if previous_state is None:
        raise PrivacyDeletionReplayError("Identity account is missing during replay")
    original_state = str(previous_state)
    entered_deleting = original_state not in {
        AccountState.DELETING.value,
        AccountState.DELETED.value,
    }
    if entered_deleting:
        session.execute(
            text(
                """
                update identity.accounts
                set state = 'deleting',
                    state_reason = 'privacy-backup-restore-reapply-in-progress',
                    state_changed_at = now()
                where account_id = :account_id
                """
            ),
            {"account_id": account_id},
        )
        _append_identity_state_event(
            session,
            account_id=account_id,
            previous_state=original_state,
            next_state=AccountState.DELETING.value,
            actor_account_id=actor_account_id,
            reason="privacy-backup-restore-reapply-in-progress",
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(idempotency_key, "identity-deleting"),
        )

    private_result = EngagementRepository(session).delete_private_data_for_account(
        account_id=account_id,
        actor_account_id=actor_account_id,
        idempotency_key=_scoped_key(idempotency_key, "private-domains"),
        reason="privacy-backup-restore-reapply",
        correlation_id=correlation_id,
        commit=False,
        allow_tombstone_replay=True,
    )
    submission_result = session.execute(
        text(
            """
            update community_intake.submissions
            set contributor_subject_hash = :contributor_subject_hash,
                contributor_subject_anonymized_at = coalesce(
                  contributor_subject_anonymized_at,
                  now()
                ),
                contributor_subject_anonymization_request_id = coalesce(
                  contributor_subject_anonymization_request_id,
                  :request_id
                ),
                updated_at = now()
            where contributor_subject_hash = :legacy_subject_hash
            """
        ),
        {
            "request_id": request_id,
            "contributor_subject_hash": contributor_subject_hash,
            "legacy_subject_hash": legacy_subject_hash,
        },
    )
    bridge_result = session.execute(
        text(
            """
            update community_curation.assertion_bridges
            set contributor_account_id = null,
                contributor_subject_hash = :contributor_subject_hash,
                contributor_anonymized_at = coalesce(contributor_anonymized_at, now()),
                contributor_anonymization_request_id = coalesce(
                  contributor_anonymization_request_id,
                  :request_id
                )
            where contributor_account_id = :account_id
            """
        ),
        {
            "account_id": account_id,
            "request_id": request_id,
            "contributor_subject_hash": contributor_subject_hash,
        },
    )
    change_set_result = session.execute(
        text(
            """
            update public.change_sets
            set origin_actor_id = null,
                origin_actor_subject_hash = :contributor_subject_hash,
                origin_actor_anonymized_at = coalesce(origin_actor_anonymized_at, now()),
                origin_actor_anonymization_request_id = coalesce(
                  origin_actor_anonymization_request_id,
                  :request_id
                )
            where origin_context = 'community_intake'
              and origin_actor_id = :account_id
            """
        ),
        {
            "account_id": account_id,
            "request_id": request_id,
            "contributor_subject_hash": contributor_subject_hash,
        },
    )
    revision_result = session.execute(
        text(
            """
            update public.entity_revisions
            set payload = jsonb_set(
                  payload #- '{community_provenance,contributor_account_id}',
                  '{community_provenance,contributor_subject_hash}',
                  to_jsonb(cast(:contributor_subject_hash as text)),
                  true
                ),
                privacy_redacted_at = coalesce(privacy_redacted_at, now()),
                privacy_redaction_request_id = coalesce(
                  privacy_redaction_request_id,
                  :request_id
                )
            where payload #>> '{community_provenance,contributor_account_id}' = :account_id
            """
        ),
        {
            "account_id": str(account_id),
            "request_id": request_id,
            "contributor_subject_hash": contributor_subject_hash,
        },
    )

    active_assignments = session.execute(
        text(
            """
            select assignment.assignment_id
            from identity.role_assignments assignment
            left join identity.role_assignment_revocations revocation
              on revocation.assignment_id = assignment.assignment_id
            where assignment.account_id = :account_id
              and revocation.assignment_id is null
              and (assignment.expires_at is null or assignment.expires_at > now())
            for update of assignment
            """
        ),
        {"account_id": account_id},
    ).scalars().all()
    revoked_roles = 0
    for value in active_assignments:
        assignment_id = UUID(str(value))
        result = session.execute(
            text(
                """
                insert into identity.role_assignment_revocations (
                  assignment_id, revoked_by_account_id, reason,
                  correlation_id, idempotency_key
                ) values (
                  :assignment_id, :actor_account_id, :reason,
                  :correlation_id, :idempotency_key
                )
                on conflict (assignment_id) do nothing
                """
            ),
            {
                "assignment_id": assignment_id,
                "actor_account_id": actor_account_id,
                "reason": "privacy-backup-restore-reapply",
                "correlation_id": correlation_id,
                "idempotency_key": _scoped_key(
                    idempotency_key,
                    "role-revocation",
                    assignment_id,
                ),
            },
        )
        revoked_roles += int(result.rowcount or 0)

    refresh_result = session.execute(
        text("delete from auth.refresh_tokens where user_id = :account_id"),
        {"account_id": str(account_id)},
    )
    auth_result = session.execute(
        text(
            """
            update auth.users
            set email = :tombstone_email,
                encrypted_password = '',
                raw_user_meta_data = '{}'::jsonb,
                email_confirmed_at = null,
                phone = null,
                phone_confirmed_at = null,
                confirmation_token = '',
                recovery_token = '',
                email_change = '',
                email_change_token_new = '',
                email_change_token_current = '',
                phone_change = '',
                phone_change_token = '',
                reauthentication_token = '',
                last_sign_in_at = null,
                deleted_at = coalesce(deleted_at, now()),
                raw_app_meta_data = jsonb_build_object(
                  'provider', 'deleted', 'providers', '[]'::jsonb
                ),
                updated_at = now()
            where id = :account_id
            """
        ),
        {"account_id": account_id, "tombstone_email": tombstone_email},
    )

    session.execute(
        text(
            """
            update identity.accounts
            set email = :tombstone_email,
                state = 'deleted',
                state_reason = 'privacy-backup-restore-reapplied',
                state_changed_at = case
                  when state <> 'deleted' then now() else state_changed_at
                end,
                last_authenticated_at = null,
                last_authentication_method = null,
                last_session_id = null,
                last_jwt_issued_at = null,
                last_seen_at = now()
            where account_id = :account_id
            """
        ),
        {"account_id": account_id, "tombstone_email": tombstone_email},
    )
    if original_state != AccountState.DELETED.value:
        _append_identity_state_event(
            session,
            account_id=account_id,
            previous_state=AccountState.DELETING.value,
            next_state=AccountState.DELETED.value,
            actor_account_id=actor_account_id,
            reason="privacy-backup-restore-reapplied",
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(idempotency_key, "identity-deleted"),
        )

    counts: dict[str, int] = {
        key: int(value)
        for key, value in private_result.items()
        if key.endswith("_deleted") or key.endswith("_anonymized")
    }
    counts.update(
        {
            "community_submissions_rekeyed": int(submission_result.rowcount or 0),
            "assertion_bridges_anonymized": int(bridge_result.rowcount or 0),
            "change_sets_anonymized": int(change_set_result.rowcount or 0),
            "entity_revisions_redacted": int(revision_result.rowcount or 0),
            "active_roles_revoked": revoked_roles,
            "auth_refresh_credentials_revoked": int(refresh_result.rowcount or 0),
            "auth_users_scrubbed": int(auth_result.rowcount or 0),
        }
    )
    return counts
