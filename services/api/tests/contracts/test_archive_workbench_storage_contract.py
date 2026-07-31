from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0024_archive_workbench_cutover.sql"
)


def _function(sql: str, name: str, terminator: str) -> str:
    return sql.split(f"create or replace function public.{name}", 1)[1].split(
        terminator, 1
    )[0]


def test_cutover_hold_blocks_new_publication_without_deleting_history() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table if not exists public.archive_publication_cutover_control" in sql
    assert "trg_publication_batches_cutover_hold" in sql
    trigger = _function(
        sql,
        "block_publication_batch_when_cutover_held",
        "$$;",
    )
    assert "archive publication is held for migration cutover" in trigger
    assert "before insert on public.publication_batches" in sql
    assert "delete from public.publication_batches" not in sql
    assert "update public.archive_release_pointer" not in sql
    assert "update public.public_release_pointer" not in sql


def test_cutover_command_is_idempotent_versioned_and_recent_auth() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    function_body = _function(sql, "set_archive_publication_cutover", "$cutover$;")

    assert function_body.index("from public.archive_cutover_command_receipts") < (
        function_body.index("for update")
    )
    assert "replay.requested_state" in function_body
    assert "replay.resulting_version" in function_body
    assert "replay.actor_account_id" in function_body
    assert "replay.created_at" in function_body
    assert "archive cutover version conflict" in function_body
    assert "archive.cutover.manage" in function_body
    assert "archive cutover requires recent authentication" in function_body
    assert "archive.publication_cutover.' || requested_state" in function_body
    assert "actor_role_snapshot" in function_body
    assert "actor_capability_snapshot" in function_body


def test_cutover_evidence_is_append_only_and_capabilities_are_explicit() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for relation in (
        "archive_cutover_command_receipts",
        "archive_cutover_audit",
    ):
        assert f"trg_{relation}_append_only" in sql
    assert "archive.workbench.read" in sql
    assert "archive.cutover.manage" in sql
    assert "('administrator', 'archive.cutover.manage')" not in sql
    assert "('service', 'archive.cutover.manage')" not in sql


def test_projection_lag_only_reports_the_current_unprojected_archive_release() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "cross join public.archive_release_pointer archive_pointer" in sql
    assert "release.id = archive_pointer.latest_release_id" in sql
    assert (
        "public_pointer.active_batch_id is distinct from "
        "archive_pointer.latest_release_id"
    ) in sql


def test_workbench_views_cover_required_operational_queues() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create or replace view public.archive_workbench_queue" in sql
    assert "create or replace view public.archive_workbench_metrics" in sql
    for queue in (
        "ordinary_ready",
        "sensitive_ready",
        "publish_failed",
        "projection_lag",
        "emergency_followup",
    ):
        assert queue in sql
    for operation in (
        "targeted_correction",
        "retraction",
        "rollback",
        "merge",
        "split",
    ):
        assert operation in sql
