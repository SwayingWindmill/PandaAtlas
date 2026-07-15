begin;

-- Restricted evidence-object metadata. Object bytes remain in a versioned,
-- private attachment store and are never exposed through the public projection.
create table if not exists public.evidence_attachments (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.evidence_sources(id) on delete restrict,
  storage_bucket text not null,
  storage_key text not null,
  object_version text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size >= 0),
  media_type text not null,
  publication_status text not null default 'restricted' check (
    publication_status in ('draft', 'restricted')
  ),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_key, object_version)
);

create index if not exists idx_evidence_attachments_source
  on public.evidence_attachments (source_id);

alter table public.evidence_attachments enable row level security;

drop policy if exists evidence_attachments_staff_write
  on public.evidence_attachments;
create policy evidence_attachments_staff_write
  on public.evidence_attachments
for all using (
  public.has_any_role(array['admin', 'editor', 'reviewer']::public.app_user_role[])
)
with check (
  public.has_any_role(array['admin', 'editor', 'reviewer']::public.app_user_role[])
);

commit;
