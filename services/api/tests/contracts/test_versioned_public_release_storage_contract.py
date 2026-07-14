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


def test_fresh_d1_schema_and_seed_activate_one_idempotent_release() -> None:
    database = sqlite3.connect(":memory:")
    database.executescript(
        (ROOT / "infra" / "cloudflare" / "d1" / "schema.sql").read_text(encoding="utf-8")
    )
    seed = (ROOT / "infra" / "cloudflare" / "d1" / "seed.sql").read_text(encoding="utf-8")
    database.executescript(seed)
    database.executescript(seed)

    assert database.execute(
        "select dataset_release_version from current_public_release"
    ).fetchone() == ("2026.07.14.2",)
    assert database.execute("select count(*) from public_releases").fetchone() == (1,)
