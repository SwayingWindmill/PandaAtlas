-- Panda Atlas initial schema draft for Supabase Postgres + PostGIS
-- File: 0001_panda_atlas_init.sql

begin;

create extension if not exists "pgcrypto";
create extension if not exists postgis;

-- ----------
-- enum types
-- ----------
create type public.panda_status as enum (
  'alive',
  'deceased',
  'unknown'
);

create type public.sighting_source_type as enum (
  'wild',
  'captive',
  'research',
  'camera_trap',
  'public_report'
);

create type public.distribution_layer as enum (
  'wild',
  'captive',
  'protected_area',
  'corridor'
);

create type public.import_job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed'
);

create type public.app_user_role as enum (
  'admin',
  'editor',
  'reviewer'
);

-- ----------
-- base tables
-- ----------
create table if not exists public.pandas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_zh text not null,
  name_en text,
  gender text check (gender in ('male', 'female', 'unknown')) default 'unknown',
  birth_date date,
  death_date date,
  status public.panda_status not null default 'unknown',
  birthplace text,
  current_location text,
  father_id uuid references public.pandas(id) on delete set null,
  mother_id uuid references public.pandas(id) on delete set null,
  intro text,
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habitats (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  province text,
  level text,
  area_km2 numeric(10,2),
  center geometry(point, 4326),
  boundary geometry(multipolygon, 4326) not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  panda_id uuid references public.pandas(id) on delete set null,
  habitat_id uuid references public.habitats(id) on delete set null,
  observed_at timestamptz not null,
  source_type public.sighting_source_type not null,
  confidence numeric(3,2) not null default 1.00 check (confidence >= 0 and confidence <= 1),
  location geometry(point, 4326) not null,
  note text,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distribution_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  version text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (snapshot_date, version)
);

create table if not exists public.distribution_cells (
  id bigserial primary key,
  snapshot_id uuid not null references public.distribution_snapshots(id) on delete cascade,
  layer public.distribution_layer not null,
  cell_code text not null,
  density numeric(8,2),
  geom geometry(multipolygon, 4326) not null,
  created_at timestamptz not null default now(),
  unique (snapshot_id, layer, cell_code)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null,
  storage_path text not null,
  title text,
  photographer text,
  copyright_text text,
  license text,
  taken_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.panda_media (
  panda_id uuid not null references public.pandas(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete cascade,
  is_cover boolean not null default false,
  display_order int not null default 0,
  primary key (panda_id, media_id)
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_user_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_uri text,
  status public.import_job_status not null default 'queued',
  summary jsonb not null default '{}'::jsonb,
  error_log text,
  requested_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------
-- indexes
-- ----------
create index if not exists idx_pandas_name_zh on public.pandas using btree (name_zh);
create index if not exists idx_pandas_tags_gin on public.pandas using gin (tags);
create index if not exists idx_habitats_boundary_gist on public.habitats using gist (boundary);
create index if not exists idx_sightings_location_gist on public.sightings using gist (location);
create index if not exists idx_sightings_observed_at on public.sightings using btree (observed_at desc);
create index if not exists idx_distribution_cells_geom_gist on public.distribution_cells using gist (geom);
create index if not exists idx_distribution_cells_snapshot_layer on public.distribution_cells using btree (snapshot_id, layer);
create index if not exists idx_panda_media_cover on public.panda_media using btree (panda_id, is_cover desc, display_order asc);

-- ----------
-- updated_at trigger
-- ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pandas_updated_at on public.pandas;
create trigger trg_pandas_updated_at
before update on public.pandas
for each row execute function public.set_updated_at();

drop trigger if exists trg_habitats_updated_at on public.habitats;
create trigger trg_habitats_updated_at
before update on public.habitats
for each row execute function public.set_updated_at();

drop trigger if exists trg_sightings_updated_at on public.sightings;
create trigger trg_sightings_updated_at
before update on public.sightings
for each row execute function public.set_updated_at();

drop trigger if exists trg_media_assets_updated_at on public.media_assets;
create trigger trg_media_assets_updated_at
before update on public.media_assets
for each row execute function public.set_updated_at();

-- ----------
-- role helper + RLS
-- ----------
create or replace function public.has_any_role(check_roles public.app_user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any(check_roles)
  );
$$;

alter table public.pandas enable row level security;
alter table public.habitats enable row level security;
alter table public.sightings enable row level security;
alter table public.distribution_snapshots enable row level security;
alter table public.distribution_cells enable row level security;
alter table public.media_assets enable row level security;
alter table public.panda_media enable row level security;
alter table public.admin_import_jobs enable row level security;
alter table public.user_roles enable row level security;

-- public read policies
 drop policy if exists pandas_public_read on public.pandas;
create policy pandas_public_read on public.pandas
for select using (true);

 drop policy if exists habitats_public_read on public.habitats;
create policy habitats_public_read on public.habitats
for select using (true);

 drop policy if exists sightings_public_read on public.sightings;
create policy sightings_public_read on public.sightings
for select using (true);

 drop policy if exists distribution_snapshots_public_read on public.distribution_snapshots;
create policy distribution_snapshots_public_read on public.distribution_snapshots
for select using (true);

 drop policy if exists distribution_cells_public_read on public.distribution_cells;
create policy distribution_cells_public_read on public.distribution_cells
for select using (true);

 drop policy if exists media_assets_public_read on public.media_assets;
create policy media_assets_public_read on public.media_assets
for select using (true);

 drop policy if exists panda_media_public_read on public.panda_media;
create policy panda_media_public_read on public.panda_media
for select using (true);

-- admin/editor write policies
 drop policy if exists pandas_admin_write on public.pandas;
create policy pandas_admin_write on public.pandas
for all
using (public.has_any_role(array['admin', 'editor']::public.app_user_role[]))
with check (public.has_any_role(array['admin', 'editor']::public.app_user_role[]));

 drop policy if exists habitats_admin_write on public.habitats;
create policy habitats_admin_write on public.habitats
for all
using (public.has_any_role(array['admin', 'editor']::public.app_user_role[]))
with check (public.has_any_role(array['admin', 'editor']::public.app_user_role[]));

 drop policy if exists sightings_admin_write on public.sightings;
create policy sightings_admin_write on public.sightings
for all
using (public.has_any_role(array['admin', 'editor']::public.app_user_role[]))
with check (public.has_any_role(array['admin', 'editor']::public.app_user_role[]));

 drop policy if exists distribution_snapshots_admin_write on public.distribution_snapshots;
create policy distribution_snapshots_admin_write on public.distribution_snapshots
for all
using (public.has_any_role(array['admin', 'editor']::public.app_user_role[]))
with check (public.has_any_role(array['admin', 'editor']::public.app_user_role[]));

 drop policy if exists distribution_cells_admin_write on public.distribution_cells;
create policy distribution_cells_admin_write on public.distribution_cells
for all
using (public.has_any_role(array['admin', 'editor']::public.app_user_role[]))
with check (public.has_any_role(array['admin', 'editor']::public.app_user_role[]));

 drop policy if exists media_assets_admin_write on public.media_assets;
create policy media_assets_admin_write on public.media_assets
for all
using (public.has_any_role(array['admin', 'editor']::public.app_user_role[]))
with check (public.has_any_role(array['admin', 'editor']::public.app_user_role[]));

 drop policy if exists panda_media_admin_write on public.panda_media;
create policy panda_media_admin_write on public.panda_media
for all
using (public.has_any_role(array['admin', 'editor']::public.app_user_role[]))
with check (public.has_any_role(array['admin', 'editor']::public.app_user_role[]));

 drop policy if exists admin_import_jobs_admin_only on public.admin_import_jobs;
create policy admin_import_jobs_admin_only on public.admin_import_jobs
for all
using (public.has_any_role(array['admin', 'editor']::public.app_user_role[]))
with check (public.has_any_role(array['admin', 'editor']::public.app_user_role[]));

 drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles
for select using (user_id = auth.uid());

 drop policy if exists user_roles_admin_manage on public.user_roles;
create policy user_roles_admin_manage on public.user_roles
for all
using (public.has_any_role(array['admin']::public.app_user_role[]))
with check (public.has_any_role(array['admin']::public.app_user_role[]));

commit;
