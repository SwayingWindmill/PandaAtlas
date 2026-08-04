from app.main import app


def test_unified_audit_openapi_is_private_and_explicit() -> None:
    schema = app.openapi()
    paths = schema["paths"]
    assert "/api/v1/admin/audit/events" in paths
    assert "/api/v1/admin/audit/metrics" in paths
    assert "/api/v1/admin/audit/integrity-summaries" in paths
    assert "/api/v1/admin/audit/integrity-summaries/{summary_id}/verify" in paths
    assert "/api/v1/admin/audit/exports" in paths
    assert "/api/v1/admin/audit/exports/{artifact_id}/download" in paths
    assert "/api/v1/admin/audit/maintenance/retention" in paths
    event_schema = schema["components"]["schemas"]["AuditEventRead"]
    properties = event_schema["properties"]
    assert "details_hash" in properties
    assert "actor_role_snapshot" in properties
    assert "correlation_id" in properties
    assert "details" not in properties
    assert "payload" not in properties
    assert "email" not in properties
    assert "token" not in properties
    artifact_properties = schema["components"]["schemas"]["AuditExportArtifactRead"]["properties"]
    assert "file_sha256" in artifact_properties
    assert "scope_hash" in artifact_properties
    assert "expires_at" in artifact_properties
    assert "encrypted_payload" not in artifact_properties
    assert "nonce" not in artifact_properties


def test_audit_read_and_integrity_capabilities_are_separate() -> None:
    schema = app.openapi()
    event_operation = schema["paths"]["/api/v1/admin/audit/events"]["get"]
    integrity_operation = schema["paths"]["/api/v1/admin/audit/integrity-summaries"]["post"]
    assert event_operation["operationId"] != integrity_operation["operationId"]
    assert event_operation["responses"]["200"]
    assert integrity_operation["responses"]["201"]
