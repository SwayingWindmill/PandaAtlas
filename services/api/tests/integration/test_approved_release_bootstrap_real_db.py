from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text

from app.core.config import settings
from app.db.session import configure_database, session_scope
from app.projection.approved_release_bootstrap import (
    APPROVED_RELEASE_VERSION,
    EXPECTED_PANDA_COUNT,
    activate_public_projection,
    import_archive_release,
    load_approved_release,
    preflight_release,
)
from app.services.managed_release_service import (
    get_current_api_release,
    get_current_panda_release,
    get_current_release_metadata,
)

REPO_ROOT = Path(__file__).resolve().parents[4]
ACTOR_ID = UUID("55555555-5555-4555-8555-555555555555")
ACTOR_EMAIL = "approved-release-publisher@example.test"


@pytest.fixture(scope="module")
def real_db() -> Iterator[None]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run real DB integration tests")
    database_url = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("Set DATABASE_URL or REAL_DB_URL for real DB tests")

    previous_url = settings.database_url
    previous_fallback = settings.db_use_mock_fallback
    settings.database_url = database_url
    settings.db_use_mock_fallback = False
    configure_database(database_url)
    with session_scope() as session:
        assert session is not None
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
                on conflict (id) do nothing
                """
            ),
            {"account_id": ACTOR_ID, "email": ACTOR_EMAIL},
        )
        session.execute(
            text(
                """
                insert into identity.accounts (
                  account_id, email, last_authenticated_at,
                  last_authentication_method, last_seen_at
                ) values (:account_id, :email, now(), 'otp', now())
                on conflict (account_id) do update
                set last_authenticated_at = excluded.last_authenticated_at,
                    last_authentication_method = excluded.last_authentication_method,
                    last_seen_at = excluded.last_seen_at
                """
            ),
            {"account_id": ACTOR_ID, "email": ACTOR_EMAIL},
        )
        session.execute(
            text(
                """
                insert into identity.role_assignments (
                  assignment_id, account_id, role_key, assigned_by_account_id,
                  reason, source, correlation_id, idempotency_key
                ) values (
                  :assignment_id, :account_id, 'archive_editor', null,
                  'Real-database approved release bootstrap acceptance.',
                  'test', :correlation_id, 'approved-release-bootstrap-real-db'
                )
                on conflict (account_id, idempotency_key) do nothing
                """
            ),
            {
                "assignment_id": uuid4(),
                "account_id": ACTOR_ID,
                "correlation_id": uuid4(),
            },
        )
        session.commit()
    try:
        yield
    finally:
        settings.database_url = previous_url
        settings.db_use_mock_fallback = previous_fallback
        configure_database(previous_url)


def test_approved_release_bootstrap_is_atomic_idempotent_and_public(real_db: None) -> None:
    _ = real_db
    bundle = load_approved_release(REPO_ROOT)
    reason = "Real PostgreSQL acceptance for the approved immutable Public Release."

    with session_scope() as session:
        assert session is not None
        existing = session.execute(
            text(
                "select id from public.publication_batches where data_version = :version"
            ),
            {"version": APPROVED_RELEASE_VERSION},
        ).scalar_one_or_none()
    if existing is not None:
        pytest.skip("Approved release already exists in this integration database")

    with session_scope() as session:
        assert session is not None
        dry_run = preflight_release(session, bundle, ACTOR_ID)
        assert dry_run["pandas"] == EXPECTED_PANDA_COUNT
        import_archive_release(
            session,
            bundle,
            ACTOR_ID,
            reason=reason,
        )
        session.rollback()

    with session_scope() as session:
        assert session is not None
        assert (
            session.execute(
                text(
                    "select id from public.publication_batches where data_version = :version"
                ),
                {"version": APPROVED_RELEASE_VERSION},
            ).scalar_one_or_none()
            is None
        )

    with session_scope() as session:
        assert session is not None
        release_id = import_archive_release(
            session,
            bundle,
            ACTOR_ID,
            reason=reason,
        )
        session.commit()

    with session_scope() as session:
        assert session is not None
        assert activate_public_projection(
            session,
            bundle,
            release_id,
            ACTOR_ID,
            reason=reason,
        )
        session.rollback()

    with session_scope() as session:
        assert session is not None
        assert (
            session.execute(
                text(
                    """
                    select active_batch_id
                    from public.public_release_pointer
                    where singleton = true
                    """
                )
            ).scalar_one_or_none()
            != release_id
        )

    with session_scope() as session:
        assert session is not None
        assert activate_public_projection(
            session,
            bundle,
            release_id,
            ACTOR_ID,
            reason=reason,
        )
        session.commit()

    metadata = get_current_release_metadata()
    assert metadata.dataset_release_version == APPROVED_RELEASE_VERSION
    assert metadata.public_schema_version == "1.3.0"
    assert metadata.publication_batch_id == "public-experiences-first-cohort-2026-07-31"
    api_release = get_current_api_release()
    assert len(api_release["pandas"]) == EXPECTED_PANDA_COUNT
    panda_release = get_current_panda_release()
    assert len(panda_release.records) == EXPECTED_PANDA_COUNT

    with session_scope() as session:
        assert session is not None
        assert (
            import_archive_release(session, bundle, ACTOR_ID, reason=reason)
            == release_id
        )
        assert not activate_public_projection(
            session,
            bundle,
            release_id,
            ACTOR_ID,
            reason=reason,
        )
        session.rollback()
