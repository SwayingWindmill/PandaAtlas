from __future__ import annotations

from pathlib import Path

import yaml

from app.main import app


CONTRACT_PATH = (
    Path(__file__).resolve().parents[2] / "openapi" / "review-moderation-v1.yaml"
)

REQUIRED_OPERATIONS = {
    ("/api/v1/admin/review-cases", "get"),
    ("/api/v1/admin/review-cases/intake/{submission_id}", "post"),
    ("/api/v1/admin/review-cases/{review_case_id}", "get"),
    ("/api/v1/admin/review-cases/{review_case_id}/active-revision", "get"),
    ("/api/v1/admin/review-cases/{review_case_id}/triage", "post"),
    ("/api/v1/admin/review-cases/{review_case_id}/claim", "post"),
    ("/api/v1/admin/review-cases/{review_case_id}/request-information", "post"),
    (
        "/api/v1/admin/review-cases/{review_case_id}/sources/{source_id}/verify",
        "post",
    ),
    ("/api/v1/admin/review-cases/{review_case_id}/decide", "post"),
    ("/api/v1/admin/review-cases/{review_case_id}/recommend", "post"),
    ("/api/v1/admin/review-cases/{review_case_id}/reopen", "post"),
    ("/api/v1/admin/review-metrics", "get"),
}


def test_review_openapi_matches_generated_fastapi_routes() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    generated = app.openapi()

    assert contract["openapi"] == "3.1.0"
    assert contract["components"]["securitySchemes"]["BearerAuth"]["scheme"] == "bearer"
    for path, method in REQUIRED_OPERATIONS:
        assert method in contract["paths"][path]
        assert method in generated["paths"][path]


def test_review_openapi_freezes_conflict_and_visibility_boundaries() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))

    accepted = contract["components"]["schemas"]["DecideReviewCaseCommand"]
    outcome = accepted["allOf"][1]["properties"]["outcome"]
    assert outcome["enum"] == [
        "accepted",
        "not_accepted",
        "duplicate",
        "out_of_scope",
        "abuse",
    ]
    request = contract["components"]["schemas"]["RequestInformationCommand"]
    request_properties = request["allOf"][1]["properties"]
    assert "user_visible_message" in request_properties
    assert "internal_note" in request_properties
    assert "409" in contract["paths"][
        "/api/v1/admin/review-cases/{review_case_id}/decide"
    ]["post"]["responses"]
