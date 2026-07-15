from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = REPO_ROOT / "infra/supabase/migrations/0008_evidence_attachments.sql"


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
