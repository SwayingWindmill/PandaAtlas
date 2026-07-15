import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = REPO_ROOT / "infra/supabase/migrations/0008_evidence_attachments.sql"
ENVIRONMENT_POLICY = REPO_ROOT / "contracts/recovery-drill-environments.v1.json"


def test_evidence_attachments_are_restricted_versioned_and_checksum_addressed() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table if not exists public.evidence_attachments" in sql
    assert "references public.evidence_sources(id) on delete restrict" in sql
    assert "unique (storage_bucket, storage_key, object_version)" in sql
    assert "content_sha256" in sql
    assert "check (content_sha256 ~ '^[0-9a-f]{64}$')" in sql
    assert "publication_status in ('draft', 'restricted')" in sql
    assert "alter table public.evidence_attachments enable row level security" in sql
    assert "evidence_attachments_staff_write" in sql
    assert "create or replace view" not in sql


def test_recovery_environment_policy_is_synthetic_isolated_and_targeted() -> None:
    policy = json.loads(ENVIRONMENT_POLICY.read_text(encoding="utf-8"))
    environment = policy["approved_environment"]

    assert environment["postgres_image"] == "postgis/postgis:16-3.4"
    assert environment["requirements"] == {
        "synthetic_data_only": True,
        "host_ports_published": False,
        "existing_database_connections_allowed": False,
        "container_removed_after_drill": True,
        "provider_managed_recovery_claim_allowed": False,
        "independent_failure_domain_claim_allowed": False,
    }
    assert policy["recovery_objectives_seconds"] == {
        "rpo": 900,
        "critical_backend_rto": 14400,
    }
