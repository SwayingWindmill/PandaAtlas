from pathlib import Path

MIGRATION = (
    Path(__file__).resolve().parents[4]
    / "infra"
    / "supabase"
    / "migrations"
    / "0005_four_eyes_publication_workflow.sql"
)


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
