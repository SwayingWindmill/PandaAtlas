-- Private Admin media intake.
-- Raw files are quarantined in a private bucket and are never public media by upload alone.

begin;

create schema if not exists admin_media;
revoke all on schema admin_media from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema admin_media from %I', role_name);
    end if;
  end loop;
end
$roles$;

create table if not exists admin_media.uploads (
  upload_id uuid primary key default gen_random_uuid(),
  panda_id uuid not null,
  original_filename text not null check (length(trim(original_filename)) between 1 and 255),
  media_type text not null check (media_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 20971520),
  state text not null default 'reserved'
    check (state in ('reserved', 'uploaded', 'processing', 'ready', 'rejected')),
  storage_bucket text not null default 'admin-media-private',
  storage_object_key text not null unique,
  storage_etag text,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by uuid not null references identity.accounts(account_id) on delete restrict,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_media_uploads_panda_created
  on admin_media.uploads (panda_id, created_at desc);
create index if not exists idx_admin_media_uploads_state
  on admin_media.uploads (state, created_at desc);

revoke all on admin_media.uploads from public;

do $table_roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on admin_media.uploads from %I', role_name);
    end if;
  end loop;
end
$table_roles$;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('media.upload', 'Reserve and upload private raw media for editorial processing.', false)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('archive_editor', 'media.upload'),
  ('senior_archive_editor', 'media.upload'),
  ('administrator', 'media.upload')
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-media-private',
  'admin-media-private',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
