from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION_0036 = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0036_domain_event_type_consistency.sql"
)
PANDA_SCHEMA = REPO_ROOT / "services" / "api" / "app" / "schemas" / "panda.py"
CANONICAL_EVENT_TYPES = (
    "birth",
    "arrival",
    "transfer",
    "return",
    "naming",
    "public_debut",
    "selection",
    "announcement",
    "observation",
    "death",
)


def test_authoritative_event_constraint_matches_public_api_event_types() -> None:
    migration = MIGRATION_0036.read_text(encoding="utf-8")
    schema = PANDA_SCHEMA.read_text(encoding="utf-8")

    for event_type in CANONICAL_EVENT_TYPES:
        assert f"'{event_type}'" in migration
        assert event_type in schema

    for unsupported in ("breeding", "cub_birth", "milestone", "memorial", "other"):
        assert f"'{unsupported}'" not in migration


def test_event_constraint_replaces_the_transfer_only_legacy_constraint() -> None:
    migration = MIGRATION_0036.read_text(encoding="utf-8")

    assert "drop constraint if exists domain_events_event_type_check" in migration
    assert "add constraint domain_events_event_type_check" in migration
    assert migration.count("'transfer'") == 1
