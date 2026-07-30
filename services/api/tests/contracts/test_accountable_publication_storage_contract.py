from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0020_accountable_archive_publication.sql"
)


def test_accountable_publication_separates_archive_and_public_heads() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table if not exists public.archive_release_pointer" in sql
    assert "update public.archive_release_pointer" in sql
    function_body = sql.split(
        "create or replace function public.publish_accountable_change_set", 1
    )[1]
    function_body = function_body.split("revoke all on function", 1)[0]
    assert "update public.public_release_pointer" not in function_body
    assert "archive.release.published" in function_body
    assert "insert into integration.outbox_events" in function_body


def test_publish_transaction_preserves_idempotency_and_conflict_order() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    function_body = sql.split(
        "create or replace function public.publish_accountable_change_set", 1
    )[1]
    function_body = function_body.split("revoke all on function", 1)[0]

    assert function_body.index("from public.archive_command_receipts") < function_body.index(
        "for update"
    )
    assert "change set version conflict" in function_body
    assert "change set base archive version is stale" in function_body
    assert "contributor cannot publish contribution-derived work" in function_body
    assert (
        "sensitive publication requires senior capability and recent authentication"
        in function_body
    )


def test_release_validation_audit_and_command_evidence_are_append_only() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for relation in (
        "archive_validation_results",
        "archive_release_evidence",
        "archive_command_receipts",
        "archive_publication_failures",
    ):
        assert f"trg_{relation}_append_only" in sql
    assert "published change sets are immutable" in sql
    assert "published publication batches are immutable" not in sql
    assert "archive.accountable.validate" in sql
    assert "archive.accountable.publish" in sql
    assert "archive.accountable.metrics" in sql
    assert "('administrator'" not in sql


def test_accountable_publication_exposes_operational_lag_metrics() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create or replace view public.archive_publication_metrics" in sql
    for metric in (
        "ready_change_sets",
        "published_change_sets",
        "publish_failed_change_sets",
        "stale_base_failures",
        "conflict_failures",
        "pending_outbox_events",
        "oldest_outbox_lag_seconds",
        "projection_lag_releases",
    ):
        assert metric in sql
