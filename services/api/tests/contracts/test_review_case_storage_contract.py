from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0019_review_moderation_review_cases.sql"
)


def test_review_case_storage_separates_submission_review_and_contributor_state() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create schema if not exists review_moderation" in sql
    assert "create table review_moderation.review_cases" in sql
    assert "community_intake.contributor_status_events" not in sql
    assert "one_active_submission" in sql
    assert "version must increase by exactly one" in sql
    assert "reviewer cannot be assigned to their own submission" in sql
    assert "reviewer cannot decide their own submission" in sql


def test_review_evidence_and_decisions_are_append_only_and_sla_visible() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for trigger in (
        "trg_review_information_requests_append_only",
        "trg_review_source_verifications_append_only",
        "trg_review_decisions_append_only",
        "trg_review_recommendations_append_only",
        "trg_review_audit_events_append_only",
        "trg_review_command_receipts_append_only",
    ):
        assert trigger in sql
    assert "add_business_days" in sql
    assert "review_moderation.sla_alerts" in sql
    assert "sla_overdue" in sql
    assert "user_visible_message" in sql
    assert "internal_note" in sql
    assert "outcome <> 'accepted' or jsonb_array_length(selected_assertion_keys) > 0" in sql


def test_reviewer_capabilities_are_explicit_and_not_granted_to_administrator() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "('reviewer'), ('moderator')" in sql
    assert "('admin')" not in sql
    for capability in (
        "review.case.read",
        "review.case.claim",
        "review.case.request_information",
        "review.case.verify_source",
        "review.case.decide",
        "review.case.recommend",
        "review.case.reopen",
    ):
        assert capability in sql
