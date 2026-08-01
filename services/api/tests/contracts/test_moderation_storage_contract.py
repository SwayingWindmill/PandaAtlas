from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0025_moderation_sanctions_and_appeals.sql"
)


def test_moderation_storage_is_scoped_versioned_and_append_only() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table review_moderation.moderation_subjects" in sql
    assert "create table review_moderation.moderation_actions" in sql
    assert "moderation subject version must increase by exactly one" in sql
    assert "trg_moderation_actions_append_only" in sql
    assert "create or replace view review_moderation.effective_sanctions" in sql
    for action in (
        "warning",
        "submission_restricted",
        "attachment_restricted",
        "notification_restricted",
        "account_suspended",
        "account_closed_for_abuse",
        "restoration",
    ):
        assert action in sql


def test_appeals_preserve_history_and_have_five_business_day_sla() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table review_moderation.appeal_cases" in sql
    assert "create table review_moderation.appeal_events" in sql
    assert "review_moderation.add_business_days(now(), 5)" in sql
    assert "trg_appeal_events_append_only" in sql
    assert "closed appeal cases are immutable" in sql
    assert "idx_appeal_cases_one_open_per_sanction" in sql
    assert "create or replace view review_moderation.appeal_queue" in sql
    assert "sla_overdue" in sql


def test_moderation_uses_canonical_audit_and_integration_outbox_boundaries() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table review_moderation.moderation_audit_events" in sql
    assert "trg_moderation_audit_events_append_only" in sql
    assert "create table review_moderation.moderation_outbox_events" not in sql


def test_moderation_capabilities_are_explicit_and_administrator_is_not_granted() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for capability in (
        "moderation.case.read",
        "moderation.sanction.issue",
        "moderation.sanction.manage",
        "moderation.appeal.decide",
        "moderation.metrics",
    ):
        assert capability in sql
    assert "('reviewer', 'moderation.sanction.issue')" in sql
    assert "('moderator', 'moderation.sanction.manage')" in sql
    assert "('administrator', 'moderation." not in sql
