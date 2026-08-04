import os
from collections.abc import Iterator
from uuid import UUID

import psycopg
import pytest

ARCHIVE_MAP_CLOSE_ACTOR_ID = UUID("33333333-3333-4333-8333-333333333333")
ARCHIVE_MAP_CLOSE_ACTOR_EMAIL = "archive-map-close@example.invalid"
ARCHIVE_MAP_CLOSE_REVIEWER_ID = UUID("44444444-4444-4444-8444-444444444444")
ARCHIVE_MAP_CLOSE_REVIEWER_EMAIL = "archive-map-close-reviewer@example.invalid"
ARCHIVE_MAP_CLOSE_PUBLISHER_ID = UUID("55555555-5555-4555-8555-555555555555")
ARCHIVE_MAP_CLOSE_PUBLISHER_EMAIL = "archive-map-close-publisher@example.invalid"

_ARCHIVE_MAP_CLOSE_ACTORS = (
    (ARCHIVE_MAP_CLOSE_ACTOR_ID, ARCHIVE_MAP_CLOSE_ACTOR_EMAIL),
    (ARCHIVE_MAP_CLOSE_REVIEWER_ID, ARCHIVE_MAP_CLOSE_REVIEWER_EMAIL),
    (ARCHIVE_MAP_CLOSE_PUBLISHER_ID, ARCHIVE_MAP_CLOSE_PUBLISHER_EMAIL),
)


def _normalize_dsn(value: str) -> str:
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


@pytest.fixture(scope="session", autouse=True)
def ensure_archive_map_close_actor() -> Iterator[None]:
    """Create the shared Archive actors in ephemeral real-DB test foundations."""
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        yield
        return

    database_url = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        yield
        return

    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
            for account_id, email in _ARCHIVE_MAP_CLOSE_ACTORS:
                cursor.execute(
                    """
                    insert into auth.users (
                      instance_id, id, aud, role, email, encrypted_password,
                      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                      created_at, updated_at
                    ) values (
                      '00000000-0000-0000-0000-000000000000', %s,
                      'authenticated', 'authenticated', %s, '', now(),
                      '{"provider":"email","providers":["email"]}',
                      '{}', now(), now()
                    )
                    on conflict (id) do nothing
                    """,
                    (account_id, email),
                )
                cursor.execute(
                    """
                    insert into identity.accounts (account_id, email)
                    values (%s, %s)
                    on conflict (account_id) do nothing
                    """,
                    (account_id, email),
                )
        connection.commit()

    yield


@pytest.fixture(autouse=True)
def bind_archive_publication_test_actors(
    request: pytest.FixtureRequest,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[None]:
    """Bind the Archive publication journey to provisioned four-eyes actors."""
    if request.node.name != "test_archive_publication_emits_transactional_activity_event":
        yield
        return

    module = request.module
    if module is None:
        yield
        return

    original_create_change_set = module.create_change_set
    original_submit_change_set = module.submit_change_set
    original_review_change_set = module.review_change_set
    original_create_publication_batch = module.create_publication_batch
    original_publish_batch = module.publish_batch

    def create_change_set(payload: object, _actor_id: UUID) -> object:
        return original_create_change_set(payload, ARCHIVE_MAP_CLOSE_ACTOR_ID)

    def submit_change_set(change_set_id: UUID, _actor_id: UUID) -> object:
        return original_submit_change_set(change_set_id, ARCHIVE_MAP_CLOSE_ACTOR_ID)

    def review_change_set(change_set_id: UUID, payload: object, _actor_id: UUID) -> object:
        return original_review_change_set(
            change_set_id,
            payload,
            ARCHIVE_MAP_CLOSE_REVIEWER_ID,
        )

    def create_publication_batch(payload: object, _actor_id: UUID) -> object:
        return original_create_publication_batch(payload, ARCHIVE_MAP_CLOSE_PUBLISHER_ID)

    def publish_batch(batch_id: UUID, _actor_id: UUID) -> object:
        return original_publish_batch(batch_id, ARCHIVE_MAP_CLOSE_PUBLISHER_ID)

    monkeypatch.setattr(module, "create_change_set", create_change_set)
    monkeypatch.setattr(module, "submit_change_set", submit_change_set)
    monkeypatch.setattr(module, "review_change_set", review_change_set)
    monkeypatch.setattr(module, "create_publication_batch", create_publication_batch)
    monkeypatch.setattr(module, "publish_batch", publish_batch)

    yield
