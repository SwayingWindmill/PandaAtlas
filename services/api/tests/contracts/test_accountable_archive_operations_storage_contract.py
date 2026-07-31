from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0022_accountable_archive_operations.sql"
)


def _function(sql: str, name: str, terminator: str) -> str:
    body = sql.split(f"create or replace function public.{name}", 1)[1]
    return body.split(terminator, 1)[0]


def test_operations_are_append_only_and_release_backed() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table if not exists public.archive_operation_records" in sql
    assert "release_id uuid not null unique" in sql
    assert "archive_operation_command_receipts" in sql
    assert "archive_emergency_followup_completions" in sql
    for relation in (
        "archive_operation_records",
        "archive_operation_command_receipts",
        "archive_emergency_followup_completions",
    ):
        assert f"trg_{relation}_append_only" in sql


def test_operation_replay_precedes_release_version_lock() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    function_body = _function(
        sql,
        "execute_accountable_archive_operation",
        "$operation$;",
    )

    assert function_body.index("from public.archive_operation_command_receipts") < (
        function_body.index("from public.archive_release_pointer")
    )
    assert "archive release version conflict" in function_body
    assert "update public.archive_release_pointer" in function_body
    assert "update public.public_release_pointer" not in function_body
    assert "archive.operation.' || requested_operation_type" in function_body


def test_rollback_and_sensitive_operations_fail_closed() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    function_body = _function(
        sql,
        "execute_accountable_archive_operation",
        "$operation$;",
    )

    assert "publication_operation := 'rollback'" in function_body
    assert "archive.accountable.rollback" in function_body
    assert "archive.sensitive.rollback" in function_body
    assert "archive.sensitive.correct" in function_body
    assert "archive.sensitive.merge_split" in function_body
    assert "archive.sensitive.takedown" in function_body
    assert "sensitive archive operation requires recent authentication" in function_body
    assert "emergency takedown may only reduce public exposure" in function_body


def test_emergency_takedown_requires_formal_followup() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    function_body = _function(
        sql,
        "complete_emergency_takedown_followup",
        "$followup$;",
    )

    assert "followup_due_at" in sql
    assert "interval '1 day'" in sql
    assert "single-accountable-approver-v1" in function_body
    assert "status not in ('ready', 'published')" in function_body
    assert "archive.emergency_takedown.followup_completed" in function_body
    assert "overdue_emergency_followup_count" in sql
