from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest

from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.privacy_operations.exports import (
    PrivacyExportCipher,
    PrivacyExportDownloadSigner,
    PrivacyExportService,
)
from app.privacy_operations.models import (
    PrivacyContextState,
    PrivacyHoldBasis,
    PrivacyHoldReleaseReason,
    PrivacyHoldState,
    PrivacyRequestKind,
    PrivacyRequestState,
)
from app.privacy_operations.service import (
    PrivacyOperationsConflictError,
    PrivacyOperationsForbiddenError,
    PrivacyOperationsService,
)


def _normalize_dsn(value: str) -> str:
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run privacy operations database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


def _identity(
    account_id: UUID,
    *,
    capabilities: frozenset[str] = frozenset({"account.session.read"}),
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=f"privacy-{account_id}@example.invalid",
        session_id=f"privacy-{account_id}",
        state=AccountState.ACTIVE,
        roles=frozenset({"member"}),
        capabilities=capabilities,
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def _create_account(database_url: str, account_id: UUID) -> None:
    email = f"privacy-{account_id}@example.invalid"
    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                insert into auth.users (
                  instance_id, id, aud, role, email, encrypted_password,
                  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                  created_at, updated_at
                ) values (
                  '00000000-0000-0000-0000-000000000000', %s, 'authenticated',
                  'authenticated', %s, '', now(), '{"provider":"email","providers":["email"]}',
                  '{}', now(), now()
                )
                """,
                (account_id, email),
            )
            cursor.execute(
                """
                insert into identity.accounts (account_id, email)
                values (%s, %s)
                """,
                (account_id, email),
            )
        connection.commit()


def _scalar(database_url: str, sql: str, params: tuple[object, ...]) -> object:
    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchone()[0]


def _seed_final_deletion_archive_data(
    database_url: str,
    *,
    account_id: UUID,
    operator_id: UUID,
) -> dict[str, object]:
    submission_id = uuid4()
    review_case_id = uuid4()
    decision_id = uuid4()
    change_set_id = uuid4()
    revision_id = uuid4()
    bridge_id = uuid4()
    correlation_id = uuid4()
    original_subject_hash = hashlib.sha256(
        f"community-intake-account:{account_id}".encode()
    ).hexdigest()
    marker = f"preserved-public-fact-{uuid4()}"
    target_id = f"panda-final-{uuid4().hex}"
    revision_content = {
        "assertions": [{"assertion_key": "name", "value": marker}],
    }
    entity_payload = {
        "public_record": {"marker": marker},
        "community_provenance": {
            "submission_id": str(submission_id),
            "contributor_account_id": str(account_id),
            "target_type": "panda",
            "target_id": target_id,
        },
    }
    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
            for role_key in ("contributor", "archive_editor"):
                cursor.execute(
                    """
                    insert into identity.role_assignments (
                      account_id, role_key, assigned_by_account_id, reason,
                      correlation_id, idempotency_key
                    ) values (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        account_id,
                        role_key,
                        operator_id,
                        "Seed final deletion role snapshot.",
                        correlation_id,
                        f"privacy-final-role-{role_key}-{uuid4()}",
                    ),
                )
            cursor.execute(
                """
                insert into auth.refresh_tokens (
                  instance_id, token, user_id, revoked, created_at, updated_at
                ) values (
                  '00000000-0000-0000-0000-000000000000', %s, %s, false, now(), now()
                )
                """,
                (f"privacy-refresh-{uuid4()}", str(account_id)),
            )
            cursor.execute(
                """
                insert into community_intake.submissions (
                  submission_id, account_id, contributor_subject_hash,
                  submission_type, target_type, target_id, public_version_seen,
                  state, draft_content, latest_revision_number, submitted_at,
                  contributor_status
                ) values (
                  %s, %s, %s, 'correction', 'panda', %s,
                  'archive-final-test', 'submitted', %s::jsonb, 1, now(), 'accepted'
                )
                """,
                (
                    submission_id,
                    account_id,
                    original_subject_hash,
                    target_id,
                    json.dumps({"summary": marker}),
                ),
            )
            cursor.execute(
                """
                insert into community_intake.submission_revisions (
                  submission_id, revision_number, content, content_sha256,
                  public_version_seen
                ) values (%s, 1, %s::jsonb, %s, 'archive-final-test')
                """,
                (
                    submission_id,
                    json.dumps(revision_content),
                    hashlib.sha256(
                        json.dumps(revision_content, sort_keys=True).encode()
                    ).hexdigest(),
                ),
            )
            cursor.execute(
                """
                insert into review_moderation.review_cases (
                  review_case_id, submission_id, opened_revision_number,
                  active_revision_number, state, version, primary_assignee_id,
                  closed_at
                ) values (%s, %s, 1, 1, 'closed', 1, %s, now())
                """,
                (review_case_id, submission_id, operator_id),
            )
            cursor.execute(
                """
                insert into review_moderation.decisions (
                  decision_id, review_case_id, active_revision_number, outcome,
                  user_visible_explanation, selected_assertion_keys,
                  decided_by_account_id
                ) values (
                  %s, %s, 1, 'accepted',
                  'Accepted for the final deletion provenance fixture.',
                  '["name"]'::jsonb, %s
                )
                """,
                (decision_id, review_case_id, operator_id),
            )
            cursor.execute(
                """
                insert into public.entity_revisions (
                  id, entity_type, entity_id, revision_number, payload,
                  created_by, substantive_modified_by
                ) values (%s, 'panda', %s, 1, %s::jsonb, %s, %s)
                """,
                (
                    revision_id,
                    target_id,
                    json.dumps(entity_payload),
                    operator_id,
                    operator_id,
                ),
            )
            cursor.execute(
                """
                insert into public.change_sets (
                  id, title, reason, status, created_by, governance_mode,
                  validation_state, base_archive_version, risk_level,
                  origin_context, origin_actor_id
                ) values (
                  %s, 'Published community fact', 'Preserve public fact provenance.',
                  'draft', %s, 'single-accountable-approver-v1', 'ready',
                  'archive-final-test', 'ordinary', 'community_intake', %s
                )
                """,
                (change_set_id, operator_id, account_id),
            )
            cursor.execute(
                """
                insert into public.change_set_revisions (change_set_id, revision_id)
                values (%s, %s)
                """,
                (change_set_id, revision_id),
            )
            cursor.execute(
                "update public.change_sets set status = 'published' where id = %s",
                (change_set_id,),
            )
            cursor.execute(
                """
                insert into community_curation.assertion_bridges (
                  bridge_id, review_case_id, submission_id, revision_number,
                  decision_id, change_set_id, contributor_account_id,
                  contributor_subject_hash, target_type, target_id,
                  base_archive_version, risk_level, selected_assertion_keys,
                  not_recommended_assertion_keys, source_ids, attachment_ids,
                  actor_account_id, actor_role_snapshot, reason, correlation_id
                ) values (
                  %s, %s, %s, 1, %s, %s, %s, %s, 'panda',
                  %s, 'archive-final-test', 'ordinary',
                  '["name"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
                  %s, '["archive_editor"]'::jsonb,
                  'Preserve published fact while anonymizing contributor.', %s
                )
                """,
                (
                    bridge_id,
                    review_case_id,
                    submission_id,
                    decision_id,
                    change_set_id,
                    account_id,
                    original_subject_hash,
                    target_id,
                    operator_id,
                    correlation_id,
                ),
            )
        connection.commit()
    return {
        "submission_id": submission_id,
        "bridge_id": bridge_id,
        "change_set_id": change_set_id,
        "revision_id": revision_id,
        "marker": marker,
        "original_subject_hash": original_subject_hash,
    }


def test_account_deletion_request_is_blocking_verified_and_retryable(real_db_url: str) -> None:
    account_id = uuid4()
    operator_id = uuid4()
    _create_account(real_db_url, account_id)
    _create_account(real_db_url, operator_id)
    requester = _identity(account_id)
    operator = _identity(operator_id, capabilities=frozenset({"privacy.operate"}))
    correlation_id = uuid4()
    create_key = f"privacy-delete-{uuid4()}"

    with session_scope() as session:
        assert session is not None
        service = PrivacyOperationsService(session)
        created = service.create_request(
            identity=requester,
            kind=PrivacyRequestKind.ACCOUNT_DELETION,
            reason="Delete my account and begin irreversible private-data removal.",
            idempotency_key=create_key,
            correlation_id=correlation_id,
        )
        replay = service.create_request(
            identity=requester,
            kind=PrivacyRequestKind.ACCOUNT_DELETION,
            reason="Delete my account and begin irreversible private-data removal.",
            idempotency_key=create_key,
            correlation_id=correlation_id,
        )

    assert replay.request_id == created.request_id
    assert created.state is PrivacyRequestState.REQUESTED
    assert {context.context_key for context in created.contexts} == {
        "identity_access",
        "engagement",
        "community_intake",
        "notification",
        "archive_provenance",
        "backup_tombstone",
    }
    assert _scalar(
        real_db_url,
        "select state::text from identity.accounts where account_id = %s",
        (account_id,),
    ) == "deleting"
    assert _scalar(
        real_db_url,
        "select count(*) from identity.account_state_events "
        "where account_id = %s and next_state = 'deleting'",
        (account_id,),
    ) == 1
    assert _scalar(
        real_db_url,
        "select state_reason from identity.accounts where account_id = %s",
        (account_id,),
    ) == "privacy-account-deletion-requested"
    assert _scalar(
        real_db_url,
        "select reason from privacy.audit_events "
        "where request_id = %s and event_type = 'privacy.request.created'",
        (created.request_id,),
    ) == "user-requested"

    with session_scope() as session:
        assert session is not None
        service = PrivacyOperationsService(session)
        verified = service.verify_request(
            actor=operator,
            request_id=created.request_id,
            expected_version=1,
            idempotency_key=f"privacy-verify-{uuid4()}",
            correlation_id=correlation_id,
        )
        assert verified.state is PrivacyRequestState.VERIFIED
        community_context = next(
            context
            for context in verified.contexts
            if context.context_key == "community_intake"
        )
        hold_key = f"privacy-hold-{uuid4()}"
        hold_review_due_at = datetime.now(UTC) + timedelta(days=7)
        hold = service.create_hold(
            actor=operator,
            request_id=created.request_id,
            context_key=community_context.context_key,
            expected_context_version=community_context.version,
            basis=PrivacyHoldBasis.SECURITY_INVESTIGATION,
            review_due_at=hold_review_due_at,
            idempotency_key=hold_key,
            correlation_id=correlation_id,
        )
        hold_replay = service.create_hold(
            actor=operator,
            request_id=created.request_id,
            context_key=community_context.context_key,
            expected_context_version=community_context.version,
            basis=PrivacyHoldBasis.SECURITY_INVESTIGATION,
            review_due_at=hold_review_due_at,
            idempotency_key=hold_key,
            correlation_id=correlation_id,
        )
        assert hold_replay.hold_id == hold.hold_id
        with pytest.raises(PrivacyOperationsConflictError):
            service.create_hold(
                actor=operator,
                request_id=created.request_id,
                context_key=community_context.context_key,
                expected_context_version=community_context.version,
                basis=PrivacyHoldBasis.LEGAL_OBLIGATION,
                review_due_at=hold_review_due_at,
                idempotency_key=hold_key,
                correlation_id=correlation_id,
            )
        assert hold.state is PrivacyHoldState.ACTIVE
        held_request = service.get_request(created.request_id)
        held_context = next(
            context
            for context in held_request.contexts
            if context.context_key == "community_intake"
        )
        assert held_context.state is PrivacyContextState.HELD
        assert [item.hold_id for item in service.list_holds(
            actor=operator,
            request_id=created.request_id,
            correlation_id=correlation_id,
        )] == [hold.hold_id]

        processing = service.update_context(
            actor=operator,
            request_id=created.request_id,
            context_key="identity_access",
            expected_version=1,
            next_state=PrivacyContextState.PROCESSING,
            internal_error_code=None,
            idempotency_key=f"privacy-context-start-{uuid4()}",
            correlation_id=correlation_id,
        )
        assert processing.state is PrivacyRequestState.PROCESSING
        identity_context = next(
            context for context in processing.contexts if context.context_key == "identity_access"
        )
        assert identity_context.attempts == 1
        release_key = f"privacy-hold-release-{uuid4()}"
        released = service.release_hold(
            actor=operator,
            hold_id=hold.hold_id,
            expected_hold_version=hold.version,
            expected_context_version=held_context.version,
            reason=PrivacyHoldReleaseReason.BASIS_RESOLVED,
            idempotency_key=release_key,
            correlation_id=correlation_id,
        )
        release_replay = service.release_hold(
            actor=operator,
            hold_id=hold.hold_id,
            expected_hold_version=hold.version,
            expected_context_version=held_context.version,
            reason=PrivacyHoldReleaseReason.BASIS_RESOLVED,
            idempotency_key=release_key,
            correlation_id=correlation_id,
        )
        assert release_replay.hold_id == released.hold_id
        with pytest.raises(PrivacyOperationsConflictError):
            service.release_hold(
                actor=operator,
                hold_id=hold.hold_id,
                expected_hold_version=hold.version,
                expected_context_version=held_context.version,
                reason=PrivacyHoldReleaseReason.SUPERSEDED,
                idempotency_key=release_key,
                correlation_id=correlation_id,
            )
        assert released.state is PrivacyHoldState.RELEASED
        assert released.version == 2
        released_request = service.get_request(created.request_id)
        released_context = next(
            context
            for context in released_request.contexts
            if context.context_key == "community_intake"
        )
        assert released_context.state is PrivacyContextState.PENDING

        failed = service.update_context(
            actor=operator,
            request_id=created.request_id,
            context_key="identity_access",
            expected_version=2,
            next_state=PrivacyContextState.FAILED,
            internal_error_code="identity_provider_unavailable",
            idempotency_key=f"privacy-context-fail-{uuid4()}",
            correlation_id=correlation_id,
        )
        failed_context = next(
            context for context in failed.contexts if context.context_key == "identity_access"
        )
        assert failed_context.state is PrivacyContextState.FAILED
        assert failed_context.last_error_code == "identity_provider_unavailable"

        retried = service.update_context(
            actor=operator,
            request_id=created.request_id,
            context_key="identity_access",
            expected_version=3,
            next_state=PrivacyContextState.PROCESSING,
            internal_error_code=None,
            idempotency_key=f"privacy-context-retry-{uuid4()}",
            correlation_id=correlation_id,
        )
        retried_context = next(
            context for context in retried.contexts if context.context_key == "identity_access"
        )
        assert retried_context.attempts == 2

        current = retried
        with pytest.raises(PrivacyOperationsConflictError):
            service.update_context(
                actor=operator,
                request_id=created.request_id,
                context_key="identity_access",
                expected_version=retried_context.version,
                next_state=PrivacyContextState.COMPLETED,
                internal_error_code=None,
                idempotency_key=f"privacy-identity-manual-complete-{uuid4()}",
                correlation_id=correlation_id,
            )
        engagement_context = next(
            context for context in current.contexts if context.context_key == "engagement"
        )
        current = service.update_context(
            actor=operator,
            request_id=created.request_id,
            context_key="engagement",
            expected_version=engagement_context.version,
            next_state=PrivacyContextState.PROCESSING,
            internal_error_code=None,
            idempotency_key=f"privacy-engagement-processing-{uuid4()}",
            correlation_id=correlation_id,
        )
        engagement_context = next(
            context for context in current.contexts if context.context_key == "engagement"
        )
        with pytest.raises(PrivacyOperationsConflictError):
            service.update_context(
                actor=operator,
                request_id=created.request_id,
                context_key="engagement",
                expected_version=engagement_context.version,
                next_state=PrivacyContextState.COMPLETED,
                internal_error_code=None,
                idempotency_key=f"privacy-engagement-manual-complete-{uuid4()}",
                correlation_id=correlation_id,
            )
        bundle_versions = {
            context.context_key: context.version
            for context in current.contexts
            if context.context_key in {"engagement", "community_intake", "notification"}
        }
        deletion_key = f"privacy-private-deletion-{uuid4()}"
        current = service.execute_private_deletion(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=bundle_versions,
            idempotency_key=deletion_key,
            correlation_id=correlation_id,
        )
        deletion_replay = service.execute_private_deletion(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=bundle_versions,
            idempotency_key=deletion_key,
            correlation_id=correlation_id,
        )
        assert deletion_replay.request_id == current.request_id
        assert {
            context.context_key
            for context in current.contexts
            if context.state is PrivacyContextState.COMPLETED
        } >= {"engagement", "community_intake", "notification"}
        final_versions = {
            context.context_key: context.version
            for context in current.contexts
            if context.context_key in {"archive_provenance", "identity_access"}
        }
        finalization_key = f"privacy-final-deletion-{uuid4()}"
        current = service.finalize_account_deletion(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=final_versions,
            idempotency_key=finalization_key,
            correlation_id=correlation_id,
        )
        finalization_replay = service.finalize_account_deletion(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=final_versions,
            idempotency_key=finalization_key,
            correlation_id=correlation_id,
        )
        assert finalization_replay.request_id == current.request_id
        backup_context = next(
            context
            for context in current.contexts
            if context.context_key == "backup_tombstone"
        )
        current = service.update_context(
            actor=operator,
            request_id=created.request_id,
            context_key="backup_tombstone",
            expected_version=backup_context.version,
            next_state=PrivacyContextState.PROCESSING,
            internal_error_code=None,
            idempotency_key=f"privacy-backup-start-{uuid4()}",
            correlation_id=correlation_id,
        )
        backup_context = next(
            context
            for context in current.contexts
            if context.context_key == "backup_tombstone"
        )
        current = service.update_context(
            actor=operator,
            request_id=created.request_id,
            context_key="backup_tombstone",
            expected_version=backup_context.version,
            next_state=PrivacyContextState.COMPLETED,
            internal_error_code=None,
            idempotency_key=f"privacy-backup-complete-{uuid4()}",
            correlation_id=correlation_id,
        )

    assert current.state is PrivacyRequestState.COMPLETED
    assert current.completed_at is not None
    assert all(
        context.state is PrivacyContextState.COMPLETED for context in current.contexts
    )
    assert _scalar(
        real_db_url,
        "select count(*) from privacy.deletion_tombstones where account_id = %s",
        (account_id,),
    ) == 6
    tombstone_replay_key = f"privacy-tombstone-replay-{uuid4()}"
    with session_scope() as session:
        assert session is not None
        service = PrivacyOperationsService(session)
        replayed_tombstone = service.replay_tombstone(
            actor=operator,
            account_id=account_id,
            context_key="engagement",
            expected_version=1,
            idempotency_key=tombstone_replay_key,
            correlation_id=correlation_id,
        )
        tombstone_replay = service.replay_tombstone(
            actor=operator,
            account_id=account_id,
            context_key="engagement",
            expected_version=1,
            idempotency_key=tombstone_replay_key,
            correlation_id=correlation_id,
        )
    assert tombstone_replay.version == replayed_tombstone.version
    assert replayed_tombstone.replay_count == 1
    assert replayed_tombstone.version == 2
    assert replayed_tombstone.last_replayed_at is not None
    assert _scalar(
        real_db_url,
        "select count(*) from privacy.audit_events where request_id = %s",
        (created.request_id,),
    ) >= 4

    repeated_correlation_id = uuid4()
    with session_scope() as session:
        assert session is not None
        service = PrivacyOperationsService(session)
        detail = service.get_for_operator(
            actor=operator,
            request_id=created.request_id,
            correlation_id=repeated_correlation_id,
        )
        first_queue = service.list_for_operator(
            actor=operator,
            correlation_id=repeated_correlation_id,
        )
        second_queue = service.list_for_operator(
            actor=operator,
            correlation_id=repeated_correlation_id,
        )

    assert detail.request_id == created.request_id
    assert created.request_id in {item.request_id for item in first_queue}
    assert created.request_id in {item.request_id for item in second_queue}
    assert _scalar(
        real_db_url,
        "select count(*) from privacy.audit_events "
        "where actor_account_id = %s and event_type = 'privacy.operator-request.read'",
        (operator_id,),
    ) == 1
    assert _scalar(
        real_db_url,
        "select count(*) from privacy.audit_events "
        "where actor_account_id = %s and event_type = 'privacy.operator-queue.read'",
        (operator_id,),
    ) == 2


def test_access_export_request_does_not_block_account(real_db_url: str) -> None:
    account_id = uuid4()
    _create_account(real_db_url, account_id)

    with session_scope() as session:
        assert session is not None
        created = PrivacyOperationsService(session).create_request(
            identity=_identity(account_id),
            kind=PrivacyRequestKind.ACCESS_EXPORT,
            reason="Provide a private export of the personal information linked to my account.",
            idempotency_key=f"privacy-export-{uuid4()}",
            correlation_id=uuid4(),
        )

    assert created.state is PrivacyRequestState.REQUESTED
    assert len(created.contexts) == 4
    assert _scalar(
        real_db_url,
        "select state::text from identity.accounts where account_id = %s",
        (account_id,),
    ) == "active"
    with session_scope() as session:
        assert session is not None
        rows = PrivacyOperationsService(session).list_for_account_audited(
            actor=_identity(account_id),
            correlation_id=uuid4(),
        )
    assert [row.request_id for row in rows] == [created.request_id]
    assert _scalar(
        real_db_url,
        "select count(*) from privacy.audit_events "
        "where subject_account_id = %s and event_type = 'privacy.self-queue.read'",
        (account_id,),
    ) == 1


def test_same_idempotency_key_is_scoped_per_account(real_db_url: str) -> None:
    first_account_id = uuid4()
    second_account_id = uuid4()
    _create_account(real_db_url, first_account_id)
    _create_account(real_db_url, second_account_id)
    shared_key = f"privacy-shared-{uuid4()}"

    with session_scope() as session:
        assert session is not None
        service = PrivacyOperationsService(session)
        first = service.create_request(
            identity=_identity(first_account_id),
            kind=PrivacyRequestKind.ACCESS_EXPORT,
            reason="Provide the private export associated with the first account.",
            idempotency_key=shared_key,
            correlation_id=uuid4(),
        )
        second = service.create_request(
            identity=_identity(second_account_id),
            kind=PrivacyRequestKind.ACCESS_EXPORT,
            reason="Provide the private export associated with the second account.",
            idempotency_key=shared_key,
            correlation_id=uuid4(),
        )

    assert first.request_id != second.request_id


def test_privacy_operator_cannot_decide_own_request(real_db_url: str) -> None:
    account_id = uuid4()
    verifier_id = uuid4()
    _create_account(real_db_url, account_id)
    _create_account(real_db_url, verifier_id)
    operator = _identity(account_id, capabilities=frozenset({"privacy.operate"}))
    verifier = _identity(verifier_id, capabilities=frozenset({"privacy.operate"}))

    with session_scope() as session:
        assert session is not None
        service = PrivacyOperationsService(session)
        created = service.create_request(
            identity=operator,
            kind=PrivacyRequestKind.ACCESS_EXPORT,
            reason="Provide the private export associated with my operator account.",
            idempotency_key=f"privacy-self-{uuid4()}",
            correlation_id=uuid4(),
        )
        with pytest.raises(PrivacyOperationsForbiddenError):
            service.verify_request(
                actor=operator,
                request_id=created.request_id,
                expected_version=1,
                idempotency_key=f"privacy-self-verify-{uuid4()}",
                correlation_id=uuid4(),
            )
        verified = service.verify_request(
            actor=verifier,
            request_id=created.request_id,
            expected_version=1,
            idempotency_key=f"privacy-other-verify-{uuid4()}",
            correlation_id=uuid4(),
        )
        context = verified.contexts[0]
        own_export_versions = {
            item.context_key: item.version for item in verified.contexts
        }
        with pytest.raises(PrivacyOperationsForbiddenError):
            PrivacyExportService(
                session,
                cipher=PrivacyExportCipher(
                    "self-conflict-privacy-export-master-key-at-least-32-characters"
                ),
                signer=PrivacyExportDownloadSigner(
                    signing_key=(
                        "self-conflict-privacy-export-signing-key-at-least-32-characters"
                    ),
                    ttl_seconds=300,
                ),
                artifact_ttl_seconds=3600,
            ).generate(
                actor=operator,
                request_id=created.request_id,
                expected_context_versions=own_export_versions,
                idempotency_key=f"privacy-self-export-{uuid4()}",
                correlation_id=uuid4(),
            )
        own_bundle_versions = {
            item.context_key: item.version
            for item in verified.contexts
            if item.context_key in {"engagement", "community_intake", "notification"}
        }
        with pytest.raises(PrivacyOperationsForbiddenError):
            service.execute_private_deletion(
                actor=operator,
                request_id=created.request_id,
                expected_context_versions=own_bundle_versions,
                idempotency_key=f"privacy-self-delete-{uuid4()}",
                correlation_id=uuid4(),
            )
        with pytest.raises(PrivacyOperationsForbiddenError):
            service.finalize_account_deletion(
                actor=operator,
                request_id=created.request_id,
                expected_context_versions={
                    "archive_provenance": 1,
                    "identity_access": 1,
                },
                idempotency_key=f"privacy-self-finalize-{uuid4()}",
                correlation_id=uuid4(),
            )
        with pytest.raises(PrivacyOperationsForbiddenError):
            service.create_hold(
                actor=operator,
                request_id=created.request_id,
                context_key=context.context_key,
                expected_context_version=context.version,
                basis=PrivacyHoldBasis.LEGAL_OBLIGATION,
                review_due_at=datetime.now(UTC) + timedelta(days=7),
                idempotency_key=f"privacy-self-hold-{uuid4()}",
                correlation_id=uuid4(),
            )
        with pytest.raises(PrivacyOperationsForbiddenError):
            service.update_context(
                actor=operator,
                request_id=created.request_id,
                context_key=context.context_key,
                expected_version=context.version,
                next_state=PrivacyContextState.PROCESSING,
                internal_error_code=None,
                idempotency_key=f"privacy-self-process-{uuid4()}",
                correlation_id=uuid4(),
            )


def test_final_account_deletion_anonymizes_archive_and_identity(
    real_db_url: str,
) -> None:
    account_id = uuid4()
    operator_id = uuid4()
    _create_account(real_db_url, account_id)
    _create_account(real_db_url, operator_id)
    seeded = _seed_final_deletion_archive_data(
        real_db_url,
        account_id=account_id,
        operator_id=operator_id,
    )
    requester = _identity(account_id)
    operator = _identity(operator_id, capabilities=frozenset({"privacy.operate"}))
    correlation_id = uuid4()
    original_email = requester.email

    with session_scope() as session:
        assert session is not None
        service = PrivacyOperationsService(session)
        created = service.create_request(
            identity=requester,
            kind=PrivacyRequestKind.ACCOUNT_DELETION,
            reason="Delete this account and irreversibly anonymize published provenance.",
            idempotency_key=f"privacy-final-request-{uuid4()}",
            correlation_id=correlation_id,
        )
        verified = service.verify_request(
            actor=operator,
            request_id=created.request_id,
            expected_version=1,
            idempotency_key=f"privacy-final-verify-{uuid4()}",
            correlation_id=correlation_id,
        )
        private_versions = {
            context.context_key: context.version
            for context in verified.contexts
            if context.context_key in {"engagement", "community_intake", "notification"}
        }
        private_deleted = service.execute_private_deletion(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=private_versions,
            idempotency_key=f"privacy-final-private-{uuid4()}",
            correlation_id=correlation_id,
        )
        final_versions = {
            context.context_key: context.version
            for context in private_deleted.contexts
            if context.context_key in {"archive_provenance", "identity_access"}
        }
        finalization_key = f"privacy-finalize-{uuid4()}"
        finalized = service.finalize_account_deletion(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=final_versions,
            idempotency_key=finalization_key,
            correlation_id=correlation_id,
        )
        replay = service.finalize_account_deletion(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=final_versions,
            idempotency_key=finalization_key,
            correlation_id=correlation_id,
        )

    assert replay.request_id == finalized.request_id
    assert finalized.state is PrivacyRequestState.PROCESSING
    assert {
        context.context_key
        for context in finalized.contexts
        if context.state is PrivacyContextState.COMPLETED
    } >= {
        "archive_provenance",
        "identity_access",
        "engagement",
        "community_intake",
        "notification",
    }
    tombstone_email = _scalar(
        real_db_url,
        "select email from identity.accounts where account_id = %s",
        (account_id,),
    )
    assert isinstance(tombstone_email, str)
    assert tombstone_email.startswith("deleted-")
    assert tombstone_email.endswith("@deleted.invalid")
    assert tombstone_email != original_email
    assert _scalar(
        real_db_url,
        "select email from auth.users where id = %s",
        (account_id,),
    ) == tombstone_email
    assert _scalar(
        real_db_url,
        "select state::text from identity.accounts where account_id = %s",
        (account_id,),
    ) == "deleted"
    assert _scalar(
        real_db_url,
        "select count(*) from auth.refresh_tokens where user_id = %s",
        (str(account_id),),
    ) == 0
    assert _scalar(
        real_db_url,
        "select raw_app_meta_data->>'provider' from auth.users where id = %s",
        (account_id,),
    ) == "deleted"
    tombstone_document = _scalar(
        real_db_url,
        """
        select to_jsonb(tombstone)
        from identity.account_tombstones tombstone where account_id = %s
        """,
        (account_id,),
    )
    assert original_email not in json.dumps(tombstone_document, sort_keys=True)
    role_snapshot = _scalar(
        real_db_url,
        "select role_snapshot from identity.account_tombstones where account_id = %s",
        (account_id,),
    )
    staff_role_snapshot = _scalar(
        real_db_url,
        "select staff_role_snapshot from identity.account_tombstones where account_id = %s",
        (account_id,),
    )
    assert {item["role_key"] for item in role_snapshot} == {
        "archive_editor",
        "contributor",
    }
    assert [item["role_key"] for item in staff_role_snapshot] == [
        "archive_editor",
        "contributor",
    ]
    assert _scalar(
        real_db_url,
        """
        select count(*)
        from identity.role_assignment_revocations revocation
        join identity.role_assignments assignment
          on assignment.assignment_id = revocation.assignment_id
        where assignment.account_id = %s
        """,
        (account_id,),
    ) == 2

    contributor_subject_hash = _scalar(
        real_db_url,
        "select contributor_subject_hash from identity.account_tombstones where account_id = %s",
        (account_id,),
    )
    assert contributor_subject_hash != seeded["original_subject_hash"]
    assert _scalar(
        real_db_url,
        """
        select contributor_subject_hash
        from community_intake.submissions where submission_id = %s
        """,
        (seeded["submission_id"],),
    ) == contributor_subject_hash
    assert _scalar(
        real_db_url,
        """
        select contributor_account_id
        from community_curation.assertion_bridges where bridge_id = %s
        """,
        (seeded["bridge_id"],),
    ) is None
    assert _scalar(
        real_db_url,
        """
        select contributor_subject_hash
        from community_curation.assertion_bridges where bridge_id = %s
        """,
        (seeded["bridge_id"],),
    ) == contributor_subject_hash
    assert _scalar(
        real_db_url,
        "select origin_actor_id from public.change_sets where id = %s",
        (seeded["change_set_id"],),
    ) is None
    assert _scalar(
        real_db_url,
        "select origin_actor_subject_hash from public.change_sets where id = %s",
        (seeded["change_set_id"],),
    ) == contributor_subject_hash
    assert _scalar(
        real_db_url,
        "select status from public.change_sets where id = %s",
        (seeded["change_set_id"],),
    ) == "published"
    payload = _scalar(
        real_db_url,
        "select payload from public.entity_revisions where id = %s",
        (seeded["revision_id"],),
    )
    assert payload["public_record"]["marker"] == seeded["marker"]
    assert "contributor_account_id" not in payload["community_provenance"]
    assert (
        payload["community_provenance"]["contributor_subject_hash"]
        == contributor_subject_hash
    )
    counts = _scalar(
        real_db_url,
        "select counts from privacy.archive_anonymization_events where request_id = %s",
        (created.request_id,),
    )
    assert counts == {
        "community_submissions_rekeyed": 1,
        "assertion_bridges_anonymized": 1,
        "change_sets_anonymized": 1,
        "entity_revisions_redacted": 1,
    }
    assert _scalar(
        real_db_url,
        "select count(*) from privacy.deletion_tombstones where account_id = %s",
        (account_id,),
    ) == 5
    assert _scalar(
        real_db_url,
        """
        select count(*) from privacy.audit_events
        where request_id = %s and event_type = 'privacy.account-deletion.finalized'
        """,
        (created.request_id,),
    ) == 1

    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            with pytest.raises(psycopg.Error):
                cursor.execute(
                    """
                    update identity.account_tombstones
                    set role_snapshot = '[]'::jsonb
                    where account_id = %s
                    """,
                    (account_id,),
                )
        connection.rollback()
    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            with pytest.raises(psycopg.Error):
                cursor.execute(
                    """
                    update community_intake.submissions
                    set contributor_subject_hash = %s,
                        contributor_subject_anonymized_at = null,
                        contributor_subject_anonymization_request_id = null
                    where submission_id = %s
                    """,
                    (
                        seeded["original_subject_hash"],
                        seeded["submission_id"],
                    ),
                )
        connection.rollback()
    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            with pytest.raises(psycopg.Error):
                cursor.execute(
                    """
                    update public.change_sets
                    set origin_actor_id = %s,
                        origin_actor_subject_hash = null,
                        origin_actor_anonymized_at = null,
                        origin_actor_anonymization_request_id = null
                    where id = %s
                    """,
                    (account_id, seeded["change_set_id"]),
                )
        connection.rollback()
    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            with pytest.raises(psycopg.Error):
                cursor.execute(
                    """
                    update community_curation.assertion_bridges
                    set contributor_account_id = %s,
                        contributor_subject_hash = %s,
                        contributor_anonymized_at = null,
                        contributor_anonymization_request_id = null
                    where bridge_id = %s
                    """,
                    (
                        account_id,
                        seeded["original_subject_hash"],
                        seeded["bridge_id"],
                    ),
                )
        connection.rollback()
    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            with pytest.raises(psycopg.Error):
                cursor.execute(
                    """
                    update public.entity_revisions
                    set privacy_redacted_at = null,
                        privacy_redaction_request_id = null
                    where id = %s
                    """,
                    (seeded["revision_id"],),
                )
        connection.rollback()


def _seed_export_visible_data(
    database_url: str,
    *,
    account_id: UUID,
    panda_id: str,
    visible_marker: str,
    internal_marker: str,
) -> None:
    submission_id = uuid4()
    attachment_id = uuid4()
    intent_id = uuid4()
    contributor_hash = hashlib.sha256(str(account_id).encode()).hexdigest()
    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update identity.accounts
                set last_authentication_method = %s, last_session_id = %s,
                    last_jwt_issued_at = now()
                where account_id = %s
                """,
                (internal_marker, f"session-{internal_marker}", account_id),
            )
            cursor.execute(
                """
                insert into engagement.follows (
                  account_id, panda_id, state, first_followed_at, followed_at, version
                ) values (%s, %s, 'active', now(), now(), 1)
                """,
                (account_id, panda_id),
            )
            cursor.execute(
                """
                insert into engagement.notification_preferences (
                  account_id, category, channel, enabled, version
                ) values (%s, 'major_activity', 'email', true, 1)
                """,
                (account_id,),
            )
            cursor.execute(
                """
                insert into engagement.passport_entries (
                  account_id, panda_id, relationship_state, first_followed_at,
                  followed_at, contribution_count, projection_version
                ) values (%s, %s, 'active', now(), now(), 1, 1)
                """,
                (account_id, panda_id),
            )
            cursor.execute(
                """
                insert into community_intake.submissions (
                  submission_id, account_id, contributor_subject_hash,
                  submission_type, target_type, target_id, public_version_seen,
                  draft_content
                ) values (
                  %s, %s, %s, 'correction', 'panda', %s, 'release-test',
                  %s::jsonb
                )
                """,
                (
                    submission_id,
                    account_id,
                    contributor_hash,
                    panda_id,
                    json.dumps({"summary": visible_marker, "contact": visible_marker}),
                ),
            )
            cursor.execute(
                """
                insert into community_intake.attachments (
                  attachment_id, submission_id, storage_object_key,
                  original_filename, media_type, byte_size
                ) values (%s, %s, %s, 'evidence.pdf', 'application/pdf', 128)
                """,
                (attachment_id, submission_id, f"private/{internal_marker}/evidence.pdf"),
            )
            cursor.execute(
                """
                insert into notification.preferences (
                  account_id, category, channel, enabled, version
                ) values (%s, 'major_activity', 'station', true, 1)
                """,
                (account_id,),
            )
            cursor.execute(
                """
                insert into notification.intents (
                  intent_id, logical_key, source_event_id, source_event_type,
                  source_context, source_id, source_version, account_id, category,
                  audience_snapshot, preference_snapshot, content_snapshot,
                  correlation_id
                ) values (
                  %s, %s, %s, 'panda.activity.published', 'activity', %s, 1,
                  %s, 'major_activity', '{}'::jsonb, '{}'::jsonb, %s::jsonb, %s
                )
                """,
                (
                    intent_id,
                    f"privacy-export-{account_id}",
                    uuid4(),
                    panda_id,
                    account_id,
                    json.dumps(
                        {
                            "title": visible_marker,
                            "internal_delivery_note": internal_marker,
                        }
                    ),
                    uuid4(),
                ),
            )
            cursor.execute(
                """
                insert into notification.inbox_items (
                  intent_id, account_id, category, body
                ) values (%s, %s, 'major_activity', %s::jsonb)
                """,
                (
                    intent_id,
                    account_id,
                    json.dumps({"title": visible_marker, "body": visible_marker}),
                ),
            )
        connection.commit()


def test_access_export_is_encrypted_user_scoped_and_audited(real_db_url: str) -> None:
    account_id = uuid4()
    other_account_id = uuid4()
    operator_id = uuid4()
    _create_account(real_db_url, account_id)
    _create_account(real_db_url, other_account_id)
    _create_account(real_db_url, operator_id)
    visible_marker = f"visible-{uuid4()}"
    other_marker = f"other-visible-{uuid4()}"
    internal_marker = f"internal-{uuid4()}"
    other_internal_marker = f"other-internal-{uuid4()}"
    _seed_export_visible_data(
        real_db_url,
        account_id=account_id,
        panda_id="panda-export-owner",
        visible_marker=visible_marker,
        internal_marker=internal_marker,
    )
    _seed_export_visible_data(
        real_db_url,
        account_id=other_account_id,
        panda_id="panda-export-other",
        visible_marker=other_marker,
        internal_marker=other_internal_marker,
    )
    requester = _identity(account_id)
    other_requester = _identity(other_account_id)
    operator = _identity(operator_id, capabilities=frozenset({"privacy.operate"}))
    correlation_id = uuid4()
    cipher = PrivacyExportCipher("real-db-privacy-export-master-key-at-least-32-characters")
    signer = PrivacyExportDownloadSigner(
        signing_key="real-db-privacy-export-signing-key-at-least-32-characters",
        ttl_seconds=300,
    )

    with session_scope() as session:
        assert session is not None
        workflow = PrivacyOperationsService(session)
        created = workflow.create_request(
            identity=requester,
            kind=PrivacyRequestKind.ACCESS_EXPORT,
            reason="Provide a complete encrypted export of my user-visible account data.",
            idempotency_key=f"privacy-export-request-{uuid4()}",
            correlation_id=correlation_id,
        )
        verified = workflow.verify_request(
            actor=operator,
            request_id=created.request_id,
            expected_version=1,
            idempotency_key=f"privacy-export-verify-{uuid4()}",
            correlation_id=correlation_id,
        )
        identity_context = next(
            context for context in verified.contexts if context.context_key == "identity_profile"
        )
        processing = workflow.update_context(
            actor=operator,
            request_id=created.request_id,
            context_key="identity_profile",
            expected_version=identity_context.version,
            next_state=PrivacyContextState.PROCESSING,
            internal_error_code=None,
            idempotency_key=f"privacy-export-context-processing-{uuid4()}",
            correlation_id=correlation_id,
        )
        identity_context = next(
            context
            for context in processing.contexts
            if context.context_key == "identity_profile"
        )
        with pytest.raises(PrivacyOperationsConflictError):
            workflow.update_context(
                actor=operator,
                request_id=created.request_id,
                context_key="identity_profile",
                expected_version=identity_context.version,
                next_state=PrivacyContextState.COMPLETED,
                internal_error_code=None,
                idempotency_key=f"privacy-export-manual-complete-{uuid4()}",
                correlation_id=correlation_id,
            )

        versions = {context.context_key: context.version for context in processing.contexts}
        export_service = PrivacyExportService(
            session,
            cipher=cipher,
            signer=signer,
            artifact_ttl_seconds=3600,
        )
        generate_key = f"privacy-export-generate-{uuid4()}"
        artifact = export_service.generate(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=versions,
            idempotency_key=generate_key,
            correlation_id=correlation_id,
        )
        replay = export_service.generate(
            actor=operator,
            request_id=created.request_id,
            expected_context_versions=versions,
            idempotency_key=generate_key,
            correlation_id=correlation_id,
        )
        assert replay.artifact_id == artifact.artifact_id
        access = export_service.issue_access(
            actor=requester,
            request_id=created.request_id,
            correlation_id=correlation_id,
        )
        with pytest.raises(PrivacyOperationsForbiddenError):
            export_service.download(
                actor=other_requester,
                reference=access.reference,
                correlation_id=correlation_id,
            )
        content, filename = export_service.download(
            actor=requester,
            reference=access.reference,
            correlation_id=correlation_id,
        )

    payload = json.loads(content)
    serialized = content.decode("utf-8")
    owner_email = f"privacy-{account_id}@example.invalid"
    other_email = f"privacy-{other_account_id}@example.invalid"
    assert filename == f"zhipanda-privacy-export-{created.request_id}.json"
    assert payload["schema"] == "zhipanda.privacy-export.v1"
    assert payload["account"]["email"] == owner_email
    assert payload["engagement"]["follows"][0]["panda_id"] == "panda-export-owner"
    assert payload["submissions"][0]["draft_content"]["summary"] == visible_marker
    assert payload["notifications"]["inbox"][0]["body"]["title"] == visible_marker
    assert other_email not in serialized
    assert other_marker not in serialized
    assert internal_marker not in serialized
    assert other_internal_marker not in serialized
    assert "last_authentication_method" not in serialized
    assert "last_session_id" not in serialized
    assert "storage_object_key" not in serialized
    assert "content_snapshot" not in serialized

    ciphertext = _scalar(
        real_db_url,
        "select ciphertext from privacy.export_artifacts where artifact_id = %s",
        (artifact.artifact_id,),
    )
    assert isinstance(ciphertext, bytes)
    assert owner_email.encode() not in ciphertext
    assert visible_marker.encode() not in ciphertext
    assert _scalar(
        real_db_url,
        """
        select expires_at <= created_at + interval '24 hours'
        from privacy.export_artifacts where artifact_id = %s
        """,
        (artifact.artifact_id,),
    ) is True
    assert _scalar(
        real_db_url,
        "select state::text from privacy.requests where request_id = %s",
        (created.request_id,),
    ) == "completed"
    assert _scalar(
        real_db_url,
        """
        select count(*) from privacy.request_contexts
        where request_id = %s and state = 'completed'
        """,
        (created.request_id,),
    ) == 4
    assert _scalar(
        real_db_url,
        """
        select count(*) from privacy.audit_events
        where request_id = %s
          and event_type in (
            'privacy.export.generated',
            'privacy.export-access.granted',
            'privacy.export-access.denied',
            'privacy.export.downloaded'
          )
        """,
        (created.request_id,),
    ) == 4
