from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

PUBLIC_PATHS = {
    "/api/v1/moderation/notice",
    "/api/v1/moderation/appeals",
}
ADMIN_PATHS = {
    "/api/v1/admin/moderation/accounts",
    "/api/v1/admin/moderation/accounts/{account_id}",
    "/api/v1/admin/moderation/accounts/{account_id}/sanctions",
    "/api/v1/admin/moderation/accounts/{account_id}/temporary-submission-freezes",
    "/api/v1/admin/moderation/accounts/{account_id}/sanctions/{sanction_id}/restore",
    "/api/v1/admin/moderation/appeals",
    "/api/v1/admin/moderation/appeals/{appeal_case_id}/acknowledge",
    "/api/v1/admin/moderation/appeals/{appeal_case_id}/decide",
    "/api/v1/admin/moderation/metrics",
}


def test_moderation_routes_are_registered_in_runtime_openapi() -> None:
    paths = set(app.openapi()["paths"])

    assert PUBLIC_PATHS <= paths
    assert ADMIN_PATHS <= paths


def test_public_moderation_openapi_uses_user_safe_models() -> None:
    schemas = app.openapi()["components"]["schemas"]
    sanction_properties = set(schemas["UserSanctionRead"]["properties"])
    appeal_properties = set(schemas["UserAppealCaseRead"]["properties"])
    decision_properties = set(schemas["UserAppealDecisionRead"]["properties"])

    assert sanction_properties.isdisjoint(
        {
            "account_id",
            "internal_explanation",
            "issued_by_account_id",
            "subject_version_before",
            "subject_version_after",
        }
    )
    assert appeal_properties.isdisjoint(
        {
            "account_id",
            "first_responded_at",
            "sla_overdue",
            "age_seconds",
        }
    )
    assert decision_properties.isdisjoint(
        {
            "decision_id",
            "appeal_case_id",
            "internal_explanation",
            "decided_by_account_id",
        }
    )


def test_public_moderation_notice_requires_authentication() -> None:
    original_identity = settings.identity_auth_enabled
    original_moderation = settings.moderation_controls_enabled
    settings.identity_auth_enabled = True
    settings.moderation_controls_enabled = True
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/moderation/notice")
    finally:
        settings.identity_auth_enabled = original_identity
        settings.moderation_controls_enabled = original_moderation

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_admin_moderation_is_hidden_without_identity_auth() -> None:
    original_identity = settings.identity_auth_enabled
    original_shell = settings.admin_shell_enabled
    original_moderation = settings.moderation_controls_enabled
    settings.identity_auth_enabled = False
    settings.admin_shell_enabled = True
    settings.moderation_controls_enabled = True
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/admin/moderation/accounts")
    finally:
        settings.identity_auth_enabled = original_identity
        settings.admin_shell_enabled = original_shell
        settings.moderation_controls_enabled = original_moderation

    assert response.status_code == 404


def test_moderation_feature_flag_fails_closed_after_authentication_boundary() -> None:
    original_identity = settings.identity_auth_enabled
    original_moderation = settings.moderation_controls_enabled
    settings.identity_auth_enabled = False
    settings.moderation_controls_enabled = False
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/moderation/notice")
    finally:
        settings.identity_auth_enabled = original_identity
        settings.moderation_controls_enabled = original_moderation

    assert response.status_code == 404
