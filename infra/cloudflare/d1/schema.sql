-- Panda Atlas Cloudflare D1 schema.
-- This is the SQLite/D1 counterpart to infra/supabase/migrations/0001_panda_atlas_init.sql.
-- Geometry is stored as GeoJSON text plus bbox columns because D1 does not provide PostGIS.

pragma foreign_keys = on;

create table if not exists pandas (
  id text primary key,
  slug text not null unique,
  name_zh text not null,
  name_en text,
  gender text not null default 'unknown' check (gender in ('male', 'female', 'unknown')),
  birth_date text,
  death_date text,
  status text not null default 'unknown' check (status in ('alive', 'deceased', 'unknown')),
  birthplace text,
  current_location text,
  father_id text references pandas(id) on delete set null,
  mother_id text references pandas(id) on delete set null,
  intro text,
  tags_json text not null default '[]',
  is_featured integer not null default 0 check (is_featured in (0, 1)),
  record_tier text check (record_tier in ('complete_first_pass', 'identity_first_pass', 'dependency_stub')),
  localized_content_json text not null default '[]',
  media_release_json text,
  public_revision_json text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists habitats (
  id text primary key,
  code text not null unique,
  name text not null,
  province text,
  level text,
  area_km2 real,
  center_lng real,
  center_lat real,
  boundary_geojson text,
  boundary_r2_key text,
  min_lng real not null,
  min_lat real not null,
  max_lng real not null,
  max_lat real not null,
  description text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (boundary_geojson is not null or boundary_r2_key is not null),
  check (min_lng < max_lng and min_lat < max_lat)
);

create table if not exists sightings (
  id text primary key,
  panda_id text references pandas(id) on delete set null,
  habitat_id text references habitats(id) on delete set null,
  observed_at text not null,
  source_type text not null check (source_type in ('wild', 'captive', 'research', 'camera_trap', 'public_report')),
  confidence real not null default 1.0 check (confidence >= 0 and confidence <= 1),
  longitude real not null,
  latitude real not null,
  note text,
  source_ref text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists distribution_snapshots (
  id text primary key,
  snapshot_date text not null,
  version text not null,
  notes text,
  geojson_r2_prefix text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (snapshot_date, version)
);

create table if not exists distribution_cells (
  id integer primary key,
  snapshot_id text not null references distribution_snapshots(id) on delete cascade,
  layer text not null check (layer in ('wild', 'captive', 'protected_area', 'corridor')),
  cell_code text not null,
  density real,
  geometry_geojson text,
  geometry_r2_key text,
  min_lng real not null,
  min_lat real not null,
  max_lng real not null,
  max_lat real not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (snapshot_id, layer, cell_code),
  check (geometry_geojson is not null or geometry_r2_key is not null),
  check (min_lng < max_lng and min_lat < max_lat)
);

create table if not exists media_assets (
  id text primary key,
  storage_bucket text not null,
  storage_path text not null,
  title text,
  photographer text,
  copyright_text text,
  license text,
  taken_at text,
  metadata_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (storage_bucket, storage_path)
);

create table if not exists panda_media (
  panda_id text not null references pandas(id) on delete cascade,
  media_id text not null references media_assets(id) on delete cascade,
  is_cover integer not null default 0 check (is_cover in (0, 1)),
  display_order integer not null default 0,
  primary key (panda_id, media_id)
);

create table if not exists admin_import_jobs (
  id text primary key,
  source_name text not null,
  source_uri text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  summary_json text not null default '{}',
  error_log text,
  started_at text,
  finished_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_pandas_name_zh on pandas (name_zh);
create index if not exists idx_pandas_slug on pandas (slug);
create index if not exists idx_pandas_status_gender on pandas (status, gender);
create index if not exists idx_habitats_bbox on habitats (min_lng, min_lat, max_lng, max_lat);
create index if not exists idx_sightings_panda_habitat on sightings (panda_id, habitat_id);
create index if not exists idx_distribution_cells_bbox on distribution_cells (min_lng, min_lat, max_lng, max_lat);
create index if not exists idx_distribution_cells_snapshot_layer on distribution_cells (snapshot_id, layer);
create index if not exists idx_panda_media_cover on panda_media (panda_id, is_cover desc, display_order asc);

-- Trusted identity and public evidence projection.
create table if not exists evidence_sources (
  id text primary key,
  publisher text not null,
  title text not null,
  url text not null,
  published_at text,
  last_verified_at text not null,
  language_tag text not null,
  access_state text not null,
  evidence_tier text,
  public_summary text
);

create table if not exists panda_names (
  id text primary key,
  panda_id text not null references pandas(id) on delete cascade,
  language_tag text not null,
  name_kind text not null,
  value text not null,
  normalized_value text not null,
  is_primary integer not null default 0 check (is_primary in (0, 1)),
  valid_from text,
  valid_to text,
  unique (panda_id, language_tag, name_kind, value)
);

create table if not exists panda_name_sources (
  panda_name_id text not null references panda_names(id) on delete cascade,
  source_id text not null references evidence_sources(id) on delete restrict,
  primary key (panda_name_id, source_id)
);

create table if not exists panda_slugs (
  id text primary key,
  panda_id text not null references pandas(id) on delete cascade,
  slug text not null unique,
  slug_kind text not null check (slug_kind in ('canonical', 'legacy')),
  valid_from text,
  valid_to text
);

create unique index if not exists idx_panda_slugs_one_canonical
  on panda_slugs (panda_id)
  where slug_kind = 'canonical';

create table if not exists panda_slug_sources (
  panda_slug_id text not null references panda_slugs(id) on delete cascade,
  source_id text not null references evidence_sources(id) on delete restrict,
  primary key (panda_slug_id, source_id)
);

create table if not exists panda_external_identifiers (
  id text primary key,
  panda_id text not null references pandas(id) on delete cascade,
  system text not null,
  value text not null,
  normalized_value text not null,
  unique (system, value)
);

create table if not exists panda_external_identifier_sources (
  external_identifier_id text not null
    references panda_external_identifiers(id) on delete cascade,
  source_id text not null references evidence_sources(id) on delete restrict,
  primary key (external_identifier_id, source_id)
);

create table if not exists fact_assertions (
  id text primary key,
  panda_id text not null references pandas(id) on delete cascade,
  field_key text not null,
  value_json text not null,
  certainty text not null check (certainty in ('confirmed', 'provisional')),
  last_verified_at text not null,
  supersedes_assertion_id text references fact_assertions(id) on delete restrict
);

create table if not exists fact_assertion_sources (
  assertion_id text not null references fact_assertions(id) on delete cascade,
  source_id text not null references evidence_sources(id) on delete restrict,
  stance text not null default 'supports' check (stance in ('supports', 'refutes', 'context')),
  primary key (assertion_id, source_id)
);

create table if not exists public_fact_conclusions (
  id text primary key,
  panda_id text not null references pandas(id) on delete cascade,
  field_key text not null,
  value_json text,
  status text not null check (status in ('confirmed', 'provisional', 'disputed', 'superseded')),
  last_verified_at text not null,
  candidate_values_json text not null default '[]',
  superseded_values_json text not null default '[]',
  conclusion_version integer not null default 1 check (conclusion_version >= 1),
  is_current integer not null default 1 check (is_current in (0, 1)),
  unique (panda_id, field_key, conclusion_version)
);

create unique index if not exists idx_public_fact_conclusions_one_current
  on public_fact_conclusions (panda_id, field_key)
  where is_current = 1;

create table if not exists public_fact_conclusion_assertions (
  conclusion_id text not null references public_fact_conclusions(id) on delete cascade,
  assertion_id text not null references fact_assertions(id) on delete restrict,
  primary key (conclusion_id, assertion_id)
);

create index if not exists idx_panda_names_search
  on panda_names (normalized_value);
create index if not exists idx_panda_names_panda
  on panda_names (panda_id, name_kind);
create index if not exists idx_panda_slugs_panda
  on panda_slugs (panda_id, slug_kind);
create index if not exists idx_external_identifiers_search
  on panda_external_identifiers (normalized_value);
create index if not exists idx_fact_assertions_panda_field
  on fact_assertions (panda_id, field_key, last_verified_at desc);
create index if not exists idx_public_fact_conclusions_panda
  on public_fact_conclusions (panda_id, is_current, field_key);

create table if not exists institutions (
  id text primary key,
  name_zh text,
  name_en text,
  publication_status text not null default 'draft'
);

create table if not exists facilities (
  id text primary key,
  institution_id text references institutions(id),
  name_zh text,
  name_en text,
  country_code text,
  publication_status text not null default 'draft'
);

create table if not exists parentage_assertions (
  id text primary key,
  child_id text not null references pandas(id),
  parent_id text not null references pandas(id),
  parent_role text not null check (parent_role in ('father', 'mother')),
  status text not null check (status in ('confirmed', 'tentative', 'disputed', 'superseded')),
  publication_status text not null default 'draft'
);

create table if not exists parentage_assertion_sources (
  assertion_id text not null references parentage_assertions(id),
  source_id text not null references evidence_sources(id),
  primary key (assertion_id, source_id)
);

create table if not exists panda_residencies (
  id text primary key,
  panda_id text not null references pandas(id),
  facility_id text references facilities(id),
  coarse_location text,
  residency_type text not null check (residency_type in ('primary', 'temporary', 'transit', 'quarantine')),
  start_date text not null,
  start_precision text not null check (start_precision in ('day', 'month', 'year')),
  end_date text,
  end_precision text check (end_precision in ('day', 'month', 'year')),
  status text not null check (status in ('confirmed', 'confirmed_country_level', 'provisional')),
  publication_status text not null default 'draft',
  check ((facility_id is null) <> (coarse_location is null)),
  check (end_date is null or end_date >= start_date)
);

create table if not exists residency_sources (
  residency_id text not null references panda_residencies(id),
  source_id text not null references evidence_sources(id),
  primary key (residency_id, source_id)
);

create table if not exists domain_events (
  id text primary key,
  event_type text not null check (event_type = 'transfer'),
  event_status text not null check (event_status in ('announced', 'completed', 'cancelled', 'disputed')),
  event_date text not null,
  event_date_precision text not null check (event_date_precision in ('day', 'month', 'year')),
  from_facility_id text references facilities(id),
  from_coarse_location text,
  to_facility_id text references facilities(id),
  to_coarse_location text,
  publication_status text not null default 'draft',
  check (from_facility_id is null or from_coarse_location is null),
  check (to_facility_id is null or to_coarse_location is null)
);

create table if not exists domain_event_participants (
  event_id text not null references domain_events(id),
  panda_id text not null references pandas(id),
  unique (event_id, panda_id)
);

create table if not exists domain_event_sources (
  event_id text not null references domain_events(id),
  source_id text not null references evidence_sources(id),
  primary key (event_id, source_id)
);

create index if not exists idx_parentage_child on parentage_assertions(child_id, status);
create index if not exists idx_parentage_parent on parentage_assertions(parent_id, status);
create index if not exists idx_residencies_panda on panda_residencies(panda_id, start_date desc);
create index if not exists idx_event_participants_panda on domain_event_participants(panda_id);

create trigger if not exists prevent_primary_residency_overlap_insert
before insert on panda_residencies
when new.residency_type = 'primary' and exists (
  select 1 from panda_residencies existing
  where existing.id <> new.id
    and existing.panda_id = new.panda_id
    and existing.residency_type = 'primary'
    and new.start_date < coalesce(existing.end_date, '9999-12-31')
    and existing.start_date < coalesce(new.end_date, '9999-12-31')
)
begin
  select raise(abort, 'primary residency intervals overlap');
end;

create trigger if not exists prevent_primary_residency_overlap_update
before update on panda_residencies
when new.residency_type = 'primary' and exists (
  select 1 from panda_residencies existing
  where existing.id <> new.id
    and existing.panda_id = new.panda_id
    and existing.residency_type = 'primary'
    and new.start_date < coalesce(existing.end_date, '9999-12-31')
    and existing.start_date < coalesce(new.end_date, '9999-12-31')
)
begin
  select raise(abort, 'primary residency intervals overlap');
end;
