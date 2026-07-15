import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]


def test_d1_versioned_release_storage_supports_atomic_switch_and_withdrawal() -> None:
    migration = (
        ROOT / "infra" / "cloudflare" / "d1" / "migrations" / "0005_versioned_public_releases.sql"
    ).read_text(encoding="utf-8").lower()

    assert "create table if not exists public_releases" in migration
    assert "create table if not exists public_release_records" in migration
    assert "create table if not exists public_release_pointer" in migration
    assert "before update" in migration
    assert "immutable" in migration
    assert "withdrawn" in migration
    assert "current_public_release" in migration


def test_postgres_api_withdrawals_are_entity_scoped_and_append_only() -> None:
    migration = (
        ROOT
        / "infra"
        / "supabase"
        / "migrations"
        / "0007_public_api_release_snapshot.sql"
    ).read_text(encoding="utf-8").lower()

    assert "create table if not exists public.public_api_release_withdrawals" in migration
    assert "entity_type" in migration
    assert "entity_id" in migration
    assert "before update or delete" in migration
    assert "append-only" in migration


def test_fresh_d1_schema_seed_and_projection_preserve_history_and_activate_latest() -> None:
    database = sqlite3.connect(":memory:")
    database.executescript(
        (ROOT / "infra" / "cloudflare" / "d1" / "schema.sql").read_text(encoding="utf-8")
    )
    seed = (ROOT / "infra" / "cloudflare" / "d1" / "seed.sql").read_text(encoding="utf-8")
    database.executescript(seed)
    database.executescript(seed)
    database.executescript(
        (ROOT / "data" / "public-releases" / "2026.07.14.3" / "d1.sql").read_text(
            encoding="utf-8"
        )
    )

    assert database.execute(
        "select dataset_release_version from current_public_release"
    ).fetchone() == ("2026.07.14.3",)
    assert database.execute("select count(*) from public_releases").fetchone() == (2,)
    assert database.execute(
        "select count(*) from current_public_records where entity_type = 'api_pandas'"
    ).fetchone() == (7,)
