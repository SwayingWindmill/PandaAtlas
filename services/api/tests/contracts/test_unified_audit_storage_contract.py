from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
MIGRATION = ROOT / "infra/supabase/migrations/0031_unified_audit_projection.sql"
SERVICE = ROOT / "services/api/app/audit/service.py"


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
