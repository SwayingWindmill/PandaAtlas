from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0021_community_curation_bridge.sql"
)


def test_bridge_storage_preserves_full_provenance_and_origin_policy() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create schema if not exists community_curation" in sql
    assert "create table if not exists community_curation.assertion_bridges" in sql
    for column in (
        "review_case_id",
        "submission_id",
        "revision_number",
        "decision_id",
        "change_set_id",
        "contributor_account_id",
        "target_type",
        "target_id",
        "base_archive_version",
        "risk_level",
        "selected_assertion_keys",
        "not_recommended_assertion_keys",
        "source_ids",
        "attachment_ids",
        "actor_role_snapshot",
    ):
        assert column in sql
    assert "origin_context, origin_actor_id" in sql
    assert "'community_intake', submission.account_id" in sql


def test_bridge_command_never_marks_contributor_published() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    bridge_function = sql.split(
        "create or replace function community_curation.create_assertion_bridge", 1
    )[1].split("create or replace function community_curation.record_archive_release", 1)[0]

    assert "incorporation_in_progress" in bridge_function
    assert "incorporated_full" not in bridge_function
    assert "incorporated_partial" not in bridge_function
    assert "status = 'draft'" in bridge_function
    assert "'not_validated'" in bridge_function


def test_projection_result_is_the_only_full_or_partial_incorporation_boundary() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    projection_function = sql.split(
        "create or replace function community_curation.record_projection_result", 1
    )[1]

    assert "incorporated_full" in projection_function
    assert "incorporated_partial" in projection_function
    assert "notification.intents" in projection_function
    assert "notification.inbox_items" in projection_function
    assert "projection cannot complete before matching release observation" in projection_function


def test_bridge_evidence_is_append_only_and_private() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for trigger in (
        "trg_assertion_bridge_items_append_only",
        "trg_release_observations_append_only",
        "trg_projection_results_append_only",
        "trg_bridge_command_receipts_append_only",
    ):
        assert trigger in sql
    assert "revoke all on schema community_curation from public" in sql
    assert "community_curation.chain_integrity_metrics" in sql
