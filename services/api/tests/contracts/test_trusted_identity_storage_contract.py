from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
POSTGRES_MIGRATION = REPO_ROOT / "infra/supabase/migrations/0003_trusted_identity_and_evidence.sql"
POSTGRES_SEED = REPO_ROOT / "infra/supabase/seed/0003_mei_xiang_trusted_identity_seed.sql"
D1_MIGRATION = REPO_ROOT / "infra/cloudflare/d1/migrations/0002_trusted_identity_and_evidence.sql"
D1_SCHEMA = REPO_ROOT / "infra/cloudflare/d1/schema.sql"
D1_SEED = REPO_ROOT / "infra/cloudflare/d1/seed.sql"
API_DOCKERFILE = REPO_ROOT / "services/api/Dockerfile"
DOCKER_COMPOSE = REPO_ROOT / "docker-compose.yml"

REQUIRED_TABLES = {
    "evidence_sources",
    "panda_names",
    "panda_name_sources",
    "panda_slugs",
    "panda_slug_sources",
    "panda_external_identifiers",
    "panda_external_identifier_sources",
    "fact_assertions",
    "fact_assertion_sources",
    "public_fact_conclusions",
    "public_fact_conclusion_assertions",
}
STABLE_IDS = {
    "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "38cd1cad-3e34-5511-bc35-a091ece74e11",
}


def normalized_sql(path: Path) -> str:
    return " ".join(path.read_text(encoding="utf-8-sig").lower().split())


def test_postgres_schema_models_identity_evidence_and_public_safe_sources() -> None:
    sql = normalized_sql(POSTGRES_MIGRATION)

    for table in REQUIRED_TABLES:
        assert f"create table if not exists public.{table}" in sql

    assert "create or replace view public.public_evidence_sources" in sql
    assert "internal_notes" in sql
    assert "restricted_excerpt" in sql
    assert "unique (panda_id, field_key, conclusion_version)" in sql
    assert "where is_current" in sql


def test_d1_projection_schema_contains_the_same_public_identity_tables() -> None:
    migration = normalized_sql(D1_MIGRATION)
    schema = normalized_sql(D1_SCHEMA)

    for table in REQUIRED_TABLES:
        assert f"create table if not exists {table}" in migration
        assert f"create table if not exists {table}" in schema


def test_postgres_and_d1_seeds_use_the_golden_stable_ids() -> None:
    postgres_seed = normalized_sql(POSTGRES_SEED)
    d1_seed = normalized_sql(D1_SEED)

    for stable_id in STABLE_IDS:
        assert stable_id in postgres_seed
        assert stable_id in d1_seed

    assert "meixiang" in postgres_seed
    assert "tiantian" in postgres_seed
    assert "src_smithsonian_history" in postgres_seed
    assert "fact-mei-xiang-birth-date" in postgres_seed


def test_api_container_packages_the_canonical_golden_dataset() -> None:
    dockerfile = API_DOCKERFILE.read_text(encoding="utf-8-sig")
    compose = DOCKER_COMPOSE.read_text(encoding="utf-8-sig")

    assert "COPY contracts/golden-dataset/mei-xiang-family.v1.json" in dockerfile
    assert "context: ." in compose
    assert "dockerfile: services/api/Dockerfile" in compose
