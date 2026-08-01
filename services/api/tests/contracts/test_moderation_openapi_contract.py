from __future__ import annotations

from pathlib import Path

import yaml

from app.main import app


CONTRACT_PATH = (
    Path(__file__).resolve().parents[2] / "openapi" / "moderation-appeals-v1.yaml"
)

REQUIRED_OPERATIONS = {
    ("/api/v1/admin/moderation/accounts/{account_id}", "get"),
    ("/api/v1/admin/moderation/accounts/{account_id}/actions", "post"),
    ("/api/v1/admin/moderation/actions/{action_id}/restore", "post"),
    ("/api/v1/admin/moderation/appeals", "get"),
    ("/api/v1/admin/moderation/appeals/{appeal_case_id}", "get"),
    ("/api/v1/admin/moderation/appeals/{appeal_case_id}/claim", "post"),
    ("/api/v1/admin/moderation/appeals/{appeal_case_id}/decide", "post"),
    ("/api/v1/admin/moderation/metrics", "get"),
    ("/api/v1/moderation/actions", "get"),
    ("/api/v1/moderation/appeals", "get"),
    ("/api/v1/moderation/appeals", "post"),
    ("/api/v1/moderation/appeals/{appeal_case_id}", "get"),
}


def test_moderation_openapi_matches_generated_fastapi_routes() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    generated = app.openapi()

    assert contract["openapi"] == "3.1.0"
    assert contract["components"]["securitySchemes"]["BearerAuth"]["scheme"] == "bearer"
    for path, method in REQUIRED_OPERATIONS:
        assert method in contract["paths"][path]
        assert method in generated["paths"][path]


def test_moderation_openapi_freezes_scope_conflict_and_user_privacy_boundaries() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))

    kinds = contract["components"]["schemas"]["ModerationActionKind"]["enum"]
    assert kinds == [
        "warning",
        "submission_restricted",
        "attachment_restricted",
        "notification_restricted",
        "account_suspended",
        "account_closed_for_abuse",
        "restoration",
    ]
    outcomes = contract["components"]["schemas"]["AppealOutcome"]["enum"]
    assert outcomes == ["upheld", "modified", "overturned"]
    user_appeal = contract["components"]["schemas"]["MyAppeal"]
    user_fields = user_appeal["properties"]
    assert "user_visible_resolution" in user_fields
    assert "internal_resolution" not in user_fields
    assert "primary_assignee_id" not in user_fields
    assert "sla_overdue" not in user_fields
    issue_responses = contract["paths"][
        "/api/v1/admin/moderation/accounts/{account_id}/actions"
    ]["post"]["responses"]
    assert "403" in issue_responses
    assert "409" in issue_responses
