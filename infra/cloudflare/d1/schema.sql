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
