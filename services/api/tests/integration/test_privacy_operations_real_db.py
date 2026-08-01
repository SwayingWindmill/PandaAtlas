from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest

from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.privacy_operations.models import (
    PrivacyContextState,
    PrivacyRequestKind,
    PrivacyRequestState,
)
from app.privacy_operations.service import (
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

        current = service.update_context(
            actor=operator,
            request_id=created.request_id,
            context_key="identity_access",
            expected_version=4,
            next_state=PrivacyContextState.COMPLETED,
            internal_error_code=None,
            idempotency_key=f"privacy-context-complete-{uuid4()}",
            correlation_id=correlation_id,
        )
        for context in current.contexts:
            if context.context_key == "identity_access":
                continue
            current = service.update_context(
                actor=operator,
                request_id=created.request_id,
                context_key=context.context_key,
                expected_version=context.version,
                next_state=PrivacyContextState.PROCESSING,
                internal_error_code=None,
                idempotency_key=f"privacy-context-start-{context.context_key}-{uuid4()}",
                correlation_id=correlation_id,
            )
            updated = next(
                item for item in current.contexts if item.context_key == context.context_key
            )
            current = service.update_context(
                actor=operator,
                request_id=created.request_id,
                context_key=context.context_key,
                expected_version=updated.version,
                next_state=PrivacyContextState.COMPLETED,
                internal_error_code=None,
                idempotency_key=f"privacy-context-complete-{context.context_key}-{uuid4()}",
                correlation_id=correlation_id,
            )

    assert current.state is PrivacyRequestState.COMPLETED
    assert current.completed_at is not None
    assert all(
        context.state is PrivacyContextState.COMPLETED for context in current.contexts
    )
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
