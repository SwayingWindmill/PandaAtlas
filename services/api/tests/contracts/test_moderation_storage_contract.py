from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0026_scoped_moderation_and_appeals.sql"
)


def test_moderation_storage_is_append_only_and_versioned() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in (
        "review_moderation.sanctions",
        "review_moderation.restoration_events",
        "review_moderation.appeal_cases",
        "review_moderation.appeal_decisions",
        "review_moderation.moderation_audit_events",
        "review_moderation.moderation_command_receipts",
    ):
        assert f"create table {table}" in sql
    assert "moderation subject version must increase by exactly one" in sql
    assert "warning_sanction_id uuid" in sql
    assert "appeal case version must increase by exactly one" in sql
    assert "trg_moderation_sanctions_append_only" in sql
    assert "trg_moderation_restorations_append_only" in sql
    assert "trg_moderation_appeal_decisions_append_only" in sql
    assert "trg_moderation_audit_append_only" in sql
    assert "trg_moderation_receipts_append_only" in sql


def test_moderation_storage_preserves_identity_and_has_sla_alerts() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "references identity.accounts(account_id) on delete restrict" in sql
    assert "review_moderation.add_business_days(now(), 5)" in sql
    assert "review_moderation.moderation_alerts" in sql
    assert "appeal_sla_overdue" in sql
    assert "inconsistent_account_state" in sql
    assert "expired_restriction_projected" in sql
    assert "on delete cascade" not in sql


def test_moderation_capabilities_do_not_leak_to_administrator_or_archive_editor() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for capability in (
        "moderation.sanction.read",
        "moderation.sanction.apply",
        "moderation.sanction.restore",
        "moderation.temporary_submission_freeze",
        "moderation.appeal.read",
        "moderation.appeal.decide",
        "moderation.metrics",
    ):
        assert capability in sql
    assert "('administrator', 'moderation." not in sql
    assert "('archive_editor', 'moderation." not in sql
    assert "('reviewer', 'moderation.temporary_submission_freeze')" in sql
    assert "('moderator', 'moderation.sanction.apply')" in sql


def test_moderation_scope_is_connected_to_authoritative_write_paths() -> None:
    migration = MIGRATION.read_text(encoding="utf-8").lower()
    journey = (
        REPO_ROOT / "services" / "api" / "app" / "community_intake" / "repository.py"
    ).read_text(encoding="utf-8").lower()
    delivery = (
        REPO_ROOT / "services" / "api" / "app" / "notification" / "repository.py"
    ).read_text(encoding="utf-8").lower()

    assert "moderation_subject_status" in migration
    assert "submission_restricted" in journey
    assert "attachment_restricted" in journey
    assert "notification_restricted" in delivery
