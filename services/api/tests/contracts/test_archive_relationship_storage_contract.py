from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
POSTGRES_MIGRATION = (
    REPO_ROOT / "infra/supabase/migrations/0004_lineage_residency_events.sql"
)
D1_MIGRATION = (
    REPO_ROOT / "infra/cloudflare/d1/migrations/0003_lineage_residency_events.sql"
)
D1_SCHEMA = REPO_ROOT / "infra/cloudflare/d1/schema.sql"
POSTGRES_SEED = (
    REPO_ROOT
    / "infra/supabase/seed/0004_mei_xiang_lineage_residency_events_seed.sql"
)
D1_SEED = REPO_ROOT / "infra/cloudflare/d1/seed.sql"

REQUIRED_TABLES = {
    "institutions",
    "facilities",
    "parentage_assertions",
    "parentage_assertion_sources",
    "panda_residencies",
    "residency_sources",
    "domain_events",
    "domain_event_participants",
    "domain_event_sources",
}


def normalized_sql(path: Path) -> str:
    return " ".join(path.read_text(encoding="utf-8-sig").lower().split())


def test_postgres_models_reviewed_relationships_and_non_overlapping_residency() -> None:
    sql = normalized_sql(POSTGRES_MIGRATION)

    for table in REQUIRED_TABLES:
        assert f"create table if not exists public.{table}" in sql

    assert "exclude using gist" in sql
    assert "daterange(start_date, coalesce(end_date, 'infinity'::date), '[)')" in sql
    assert "start_precision" in sql
    assert "event_date_precision" in sql
    assert "unique (event_id, panda_id)" in sql


def test_d1_projection_has_public_relationship_residency_and_event_tables() -> None:
    migration = normalized_sql(D1_MIGRATION)
    schema = normalized_sql(D1_SCHEMA)

    for table in REQUIRED_TABLES:
        assert f"create table if not exists {table}" in migration
        assert f"create table if not exists {table}" in schema

    assert migration.count("publication_status text not null") >= 5
    assert schema.count("publication_status text not null") >= 5


def test_storage_seeds_reviewed_third_generation_and_shared_event() -> None:
    for seed_path in (POSTGRES_SEED, D1_SEED):
        seed = normalized_sql(seed_path)
        assert "parent-bao-li-mother" in seed
        assert "parent-bao-li-father" not in seed
        assert "event-smithsonian-return-plan-2020" in seed
        assert "event-smithsonian-departure-2023" in seed
        assert seed.count("event-smithsonian-departure-2023") >= 4
