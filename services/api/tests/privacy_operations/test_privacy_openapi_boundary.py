from __future__ import annotations

from app.main import app


def test_privacy_openapi_separates_user_and_operator_models() -> None:
    openapi = app.openapi()
    paths = openapi["paths"]
    schemas = openapi["components"]["schemas"]

    assert "/api/v1/privacy/requests" in paths
    assert "/api/v1/privacy/requests/{request_id}/export" in paths
    assert "/api/v1/privacy/requests/{request_id}/export-access" in paths
    assert "/api/v1/privacy/exports/download" in paths
    assert "/api/v1/admin/privacy/requests" in paths
    assert "/api/v1/admin/privacy/metrics" in paths
    assert "/api/v1/admin/privacy/maintenance" in paths
    assert "/api/v1/admin/privacy/requests/{request_id}/generate-export" in paths
    assert "/api/v1/admin/privacy/requests/{request_id}/execute-private-deletion" in paths
    assert "/api/v1/admin/privacy/requests/{request_id}/finalize-account-deletion" in paths
    assert "/api/v1/admin/privacy/requests/{request_id}/holds" in paths
    assert "/api/v1/admin/privacy/requests/{request_id}/holds/{context_key}" in paths
    assert "/api/v1/admin/privacy/holds/{hold_id}/release" in paths
    assert "/api/v1/admin/privacy/tombstones/{account_id}/{context_key}/replay" in paths

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


def test_privacy_export_models_never_expose_crypto_or_storage_material() -> None:
    schemas = app.openapi()["components"]["schemas"]

    export_fields = set(schemas["PrivacyExportRead"]["properties"])
    access_fields = set(schemas["PrivacyExportAccessRead"]["properties"])

    assert export_fields == {
        "artifact_id",
        "request_id",
        "state",
        "schema_version",
        "plaintext_byte_size",
        "created_at",
        "expires_at",
    }
    assert {"nonce", "ciphertext", "ciphertext_sha256", "key_version"}.isdisjoint(
        export_fields
    )
    assert access_fields == {"artifact", "reference", "expires_at"}


def test_privacy_maintenance_models_expose_only_operational_counts() -> None:
    schemas = app.openapi()["components"]["schemas"]

    maintenance_fields = set(schemas["PrivacyMaintenanceRead"]["properties"])
    metrics_fields = set(schemas["PrivacyMetricsSnapshot"]["properties"])

    assert maintenance_fields == {
        "run_id",
        "started_at",
        "completed_at",
        "replay_tombstones_after_restore",
        "counts",
    }
    assert {
        "open_request_count",
        "oldest_open_request_age_seconds",
        "failed_context_count",
        "orphan_attachment_count",
        "overdue_hold_review_count",
        "expired_export_payload_count",
        "tombstone_account_count",
        "tombstone_replay_count_24h",
        "export_access_grant_count_24h",
        "export_download_count_24h",
        "completed_request_count_24h",
        "alerts",
    } == metrics_fields
    assert {"account_id", "email", "request_id", "ciphertext"}.isdisjoint(
        maintenance_fields | metrics_fields
    )
