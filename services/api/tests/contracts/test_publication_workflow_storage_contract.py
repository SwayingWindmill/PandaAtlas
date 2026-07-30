from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[4]
    / "infra"
    / "supabase"
    / "migrations"
    / "0005_four_eyes_publication_workflow.sql"
)
COMPATIBILITY_MIGRATION = MIGRATION.with_name("0018_single_accountable_approver_compatibility.sql")


def test_postgres_models_immutable_reviewed_publication_workflow() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in (
        "entity_revisions",
        "change_sets",
        "change_set_revisions",
        "change_set_reviews",
        "publication_batches",
        "publication_batch_change_sets",
        "public_release_pointer",
        "audit_events",
    ):
        assert f"create table if not exists public.{table}" in sql

    assert "reviewer cannot approve their own substantive revision" in sql
    assert "only approved change sets can enter a publication batch" in sql
    assert "create or replace function public.publish_publication_batch" in sql
    assert "for update" in sql
    assert "public_release_pointer" in sql
    assert "a release batch is a complete immutable snapshot" in sql
    assert "public_schema_version" in sql
    assert "data_version" in sql
    assert "correlation_id" in sql


def test_published_versions_revisions_and_audit_events_are_append_only() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create or replace function public.reject_append_only_mutation" in sql
    assert "trg_entity_revisions_append_only" in sql
    assert "trg_audit_events_append_only" in sql
    assert "trg_published_batches_immutable" in sql
    assert "rollback_target_id" in sql
    assert "withdrawal_target_id" in sql
    assert "revoke all on function public.publish_publication_batch" in sql
    assert "for select using" in sql
    assert "for all to service_role" in sql


def test_publication_batch_pins_projection_and_database_versions() -> None:
    migration = MIGRATION.with_name("0006_versioned_public_projection.sql")
    sql = migration.read_text(encoding="utf-8").lower()

    assert "database_migration_version" in sql
    assert "projection_code_version" in sql


def test_single_accountable_approver_compatibility_is_additive_and_fail_closed() -> None:
    sql = COMPATIBILITY_MIGRATION.read_text(encoding="utf-8").lower()

    assert "governance_mode" in sql
    assert "validation_state" in sql
    assert "legacy_approved" in sql
    assert "change_set_governance_compatibility" in sql
    assert "archive_governance_revalidations" in sql
    assert "archive_governance_migration_runs" in sql
    assert "requires_explicit_revalidation" in sql
    assert "release_count_before" in sql
    assert "release_count_after" in sql
    assert "legacy review command is disabled for this governance mode" in sql
    assert "set status = 'ready'" not in sql
    assert "update public.public_release_pointer" not in sql
