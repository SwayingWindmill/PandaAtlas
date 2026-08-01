from __future__ import annotations

from app.main import app


def test_privacy_openapi_separates_user_and_operator_models() -> None:
    openapi = app.openapi()
    paths = openapi["paths"]
    schemas = openapi["components"]["schemas"]

    assert "/api/v1/privacy/requests" in paths
    assert "/api/v1/admin/privacy/requests" in paths

    user_fields = set(schemas["UserPrivacyRequestRead"]["properties"])
    operator_fields = set(schemas["PrivacyRequestRead"]["properties"])

    assert "account_id" not in user_fields
    assert "verified_by_account_id" not in user_fields
    assert "failure_code" not in user_fields
    assert {"account_id", "verified_by_account_id", "failure_code"} <= operator_fields


def test_user_privacy_context_hides_internal_failure_code() -> None:
    schemas = app.openapi()["components"]["schemas"]

    user_fields = set(schemas["UserPrivacyContextRead"]["properties"])
    operator_fields = set(schemas["PrivacyContextRead"]["properties"])

    assert "last_error_code" not in user_fields
    assert "last_error_code" in operator_fields
