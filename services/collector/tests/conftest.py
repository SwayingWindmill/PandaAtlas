from __future__ import annotations

import asyncio
import os
import sys
from collections.abc import AsyncIterator

import psycopg
import pytest

from collector.store import Store

#: A database of its own: the tests empty every table, and the collector host's real database
#: lives on the same server.
SERVER = "postgresql://collector:collector@localhost:55432"
DSN = os.environ.get("COLLECTOR_TEST_DATABASE_URL", f"{SERVER}/collector_test")
TABLES = "outbox, item_sightings, item_versions, items, runs, alerts, adapter_state, targets"


@pytest.fixture(scope="session")
def test_database() -> None:
    if "COLLECTOR_TEST_DATABASE_URL" in os.environ:
        return
    try:
        with psycopg.connect(f"{SERVER}/collector", autocommit=True, connect_timeout=5) as conn:
            exists = conn.execute(
                "SELECT 1 FROM pg_database WHERE datname = 'collector_test'"
            ).fetchone()
            if not exists:
                conn.execute("CREATE DATABASE collector_test")
    except psycopg.OperationalError as exc:  # pragma: no cover - environment guard
        pytest.fail(
            f"PostgreSQL not reachable at {SERVER} ({exc}). Start it with "
            "`docker compose -f infra/collector/compose.yml up -d postgres`."
        )


@pytest.fixture
def anyio_backend() -> tuple[str, dict[str, object]]:
    if sys.platform == "win32":
        # psycopg's async mode needs the selector loop on Windows, as in the CLI.
        return "asyncio", {"loop_factory": asyncio.SelectorEventLoop}
    return "asyncio", {}


@pytest.fixture
async def store(test_database: None) -> AsyncIterator[Store]:
    try:
        store = await asyncio.wait_for(Store.open(DSN), 10)
    except Exception as exc:  # pragma: no cover - environment guard
        pytest.fail(
            f"PostgreSQL not reachable at {DSN} ({exc!r}). Start it with "
            "`docker compose -f infra/collector/compose.yml up -d postgres`."
        )
    await store.migrate()
    async with store.pool.connection() as conn:
        await conn.execute(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE")
    yield store
    await store.close()
