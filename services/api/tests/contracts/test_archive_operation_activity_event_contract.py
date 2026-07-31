from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0023_archive_operation_activity_events.sql"
)


def test_correction_and_retraction_emit_activity_source_events() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table if not exists public.archive_operation_activity_events" in sql
    assert "create or replace function public.emit_archive_operation_activity_source" in sql
    assert "new.operation_type not in ('targeted_correction', 'retraction')" in sql
    assert "archive.activity.corrected" in sql
    assert "archive.activity.retracted" in sql
    assert "aggregate_type" in sql
    assert "'activity_source'" in sql
    assert "activity_descriptor" in sql


def test_activity_event_is_transactional_and_notification_safe() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    outbox_insert = sql.split("insert into integration.outbox_events", 1)[1].split(
        "insert into public.archive_operation_activity_events", 1
    )[0]

    assert "after insert on public.archive_operation_records" in sql
    assert "archive-operation-activity:" in sql
    assert "source_version" in sql
    assert "archive.activity.corrected" in outbox_insert
    assert "archive.activity.retracted" in outbox_insert
    assert "'notification." not in outbox_insert
    assert "activity.item.corrected/retracted" in sql


def test_activity_descriptor_fails_closed() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for message in (
        "correction and retraction require an activity descriptor",
        "activity descriptor action does not match archive operation",
        "activity descriptor source_id is required",
        "activity descriptor targets are required",
        "activity descriptor localized snapshots are required",
        "activity retraction requires a public-safe reason",
    ):
        assert message in sql
    assert "trg_archive_operation_activity_events_append_only" in sql
    assert "enable row level security" in sql
