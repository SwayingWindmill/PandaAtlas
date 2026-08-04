from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
MIGRATION = ROOT / "infra/supabase/migrations/0031_unified_audit_projection.sql"
EXPORT_MIGRATION = ROOT / "infra/supabase/migrations/0032_audit_exports_and_sensitive_reads.sql"
MAINTENANCE_MIGRATION = ROOT / "infra/supabase/migrations/0033_audit_retention_maintenance.sql"
SERVICE = ROOT / "services/api/app/audit/service.py"
EXPORT_SERVICE = ROOT / "services/api/app/audit/exports.py"
MAINTENANCE_SERVICE = ROOT / "services/api/app/audit/maintenance.py"


def test_unified_audit_storage_is_private_append_only_and_hash_only() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "create schema if not exists audit" in sql
    assert "create table if not exists audit.event_facts" in sql
    assert "create table if not exists audit.rejected_payloads" in sql
    assert "create table if not exists audit.integrity_summaries" in sql
    assert "create table if not exists audit.integrity_checks" in sql
    assert "'event_facts'" in sql
    assert "'integrity_summaries'" in sql
    assert "audit.reject_append_only_mutation()" in sql
    assert "details_hash text not null" in sql
    assert "extensions.digest" in sql
    event_table_sql = sql.split("create table if not exists audit.event_facts", 1)[1]
    event_table_sql = event_table_sql.split(");", 1)[0]
    assert "details jsonb" not in event_table_sql
    assert "revoke all on schema audit from public" in sql
    assert "array['anon', 'authenticated']" in sql


def test_projection_is_same_transaction_and_capabilities_are_separate() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    for source in (
        "identity.authorization_audit_events",
        "engagement.audit_events",
        "activity.audit_events",
        "notification.audit_events",
        "community_intake.audit_events",
        "review_moderation.audit_events",
        "public.audit_events",
    ):
        assert f"after insert on {source}" in sql
    assert "('audit_reader', 'audit.read')" in sql
    assert "('audit_exporter', 'audit.read')" in sql
    assert "('audit_reader', 'audit.export')" not in sql
    assert "('audit_exporter', 'audit.integrity.manage')" in sql


def test_service_rejects_contacts_and_credentials_and_audits_reads() -> None:
    source = SERVICE.read_text(encoding="utf-8")
    assert "_EMAIL_PATTERN" in source
    assert '"access_token"' in source
    assert '"refresh_token"' in source
    assert '"authorization: bearer"' in source
    assert "insert into audit.rejected_payloads" in source
    assert 'action="audit.events.search"' in source
    assert 'event_class="sensitive_read"' in source
    assert "_event_digest" in source


def test_audit_exports_are_encrypted_bounded_and_self_auditing() -> None:
    sql = EXPORT_MIGRATION.read_text(encoding="utf-8")
    source = EXPORT_SERVICE.read_text(encoding="utf-8")
    assert "create table audit.export_artifacts" in sql
    assert "encrypted_payload bytea not null" in sql
    assert "octet_length(nonce) = 12" in sql
    assert "expires_at <= created_at + interval '24 hours'" in sql
    assert "trg_export_artifacts_protected" in sql
    assert "after insert on community_intake.sensitive_read_events" in sql
    assert "'community_intake_evidence'" in sql
    assert "AESGCM" in source
    assert 'action="audit.export.generate"' in source
    assert 'action="audit.export.download"' in source
    assert "_MAX_EXPORT_ROWS = 10_000" in source
    assert "encrypted_payload" not in (
        ROOT / "services/api/app/audit/models.py"
    ).read_text(encoding="utf-8")


def test_audit_retention_only_removes_expired_ciphertext_and_keeps_evidence() -> None:
    sql = MAINTENANCE_MIGRATION.read_text(encoding="utf-8")
    source = MAINTENANCE_SERVICE.read_text(encoding="utf-8")
    assert "create table audit.maintenance_runs" in sql
    assert "trg_maintenance_runs_append_only" in sql
    assert "('audit_exporter', 'audit.maintain')" in sql
    assert "delete from audit.export_artifacts" in source
    assert "where expires_at <= now()" in source
    assert 'action="audit.retention.expired_exports"' in source
    assert "delete from audit.event_facts" not in source
