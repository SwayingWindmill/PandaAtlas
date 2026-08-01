import os
from collections.abc import Iterator
from uuid import UUID

import psycopg
import pytest


ARCHIVE_MAP_CLOSE_ACTOR_ID = UUID("33333333-3333-4333-8333-333333333333")
ARCHIVE_MAP_CLOSE_ACTOR_EMAIL = "archive-map-close@example.invalid"


def _normalize_dsn(value: str) -> str:
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


@pytest.fixture(scope="session", autouse=True)
def ensure_archive_map_close_actor() -> Iterator[None]:
    """Create the shared Archive actor in ephemeral real-DB test foundations."""
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        yield
        return

    database_url = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        yield
        return

    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
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
                (ARCHIVE_MAP_CLOSE_ACTOR_ID, ARCHIVE_MAP_CLOSE_ACTOR_EMAIL),
            )
            cursor.execute(
                """
                insert into identity.accounts (account_id, email)
                values (%s, %s)
                on conflict (account_id) do nothing
                """,
                (ARCHIVE_MAP_CLOSE_ACTOR_ID, ARCHIVE_MAP_CLOSE_ACTOR_EMAIL),
            )
        connection.commit()

    yield
