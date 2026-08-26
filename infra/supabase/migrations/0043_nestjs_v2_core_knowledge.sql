-- NestJS V2 authoritative panda-world schemas.
-- These private schemas own knowledge truth. Publication/public-read eligibility is
-- intentionally separate and will be projected by the Publication/PublicRead work.

begin;

create schema if not exists evidence;
create schema if not exists panda;
create schema if not exists lineage;
create schema if not exists place;
create schema if not exists life_history;
create schema if not exists media;

comment on schema evidence is 'Private source provenance and evidence metadata owned by the Evidence module.';
comment on schema panda is 'Private stable panda identity, names, identifiers, and evidence-aware biographical facts.';
comment on schema lineage is 'Private parentage assertions and lineage truth owned by the Lineage module.';
comment on schema place is 'Private institutions and spatial places owned by the Places module.';
comment on schema life_history is 'Private residency and life-event truth owned by the LifeHistory module.';
comment on schema media is 'Private reviewed media rights, R2 object metadata, derivatives, and panda associations.';

-- Evidence -------------------------------------------------------------------

create table if not exists evidence.sources (
  source_id text primary key,
  publisher text not null check (length(trim(publisher)) > 0),
  title text not null check (length(trim(title)) > 0),
  url text not null check (length(trim(url)) > 0),
  published_on date,
  last_verified_on date not null,
  language_tag text not null check (length(trim(language_tag)) > 0),
  access_state text not null check (
    access_state in ('accessible', 'redirected', 'changed', 'unavailable', 'archived', 'restricted')
  ),
  evidence_tier text,
  public_summary text,
  internal_notes text,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evidence.attachments (
  attachment_id uuid primary key default gen_random_uuid(),
  source_id text not null references evidence.sources(source_id) on delete restrict,
  storage_bucket text not null check (length(trim(storage_bucket)) > 0),
  storage_key text not null check (length(trim(storage_key)) > 0),
  object_version text not null check (length(trim(object_version)) > 0),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size >= 0),
  media_type text not null check (length(trim(media_type)) > 0),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_key, object_version)
);

create index if not exists idx_evidence_sources_verified on evidence.sources(last_verified_on desc, source_id);
create index if not exists idx_evidence_attachments_source on evidence.attachments(source_id);

-- Panda ----------------------------------------------------------------------

create table if not exists panda.pandas (
  panda_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists panda.slugs (
  slug_id uuid primary key default gen_random_uuid(),
  panda_id uuid not null references panda.pandas(panda_id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  slug_kind text not null check (slug_kind in ('canonical', 'legacy')),
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create unique index if not exists idx_panda_one_canonical_slug
  on panda.slugs(panda_id) where slug_kind = 'canonical';

create table if not exists panda.names (
  name_id uuid primary key default gen_random_uuid(),
  panda_id uuid not null references panda.pandas(panda_id) on delete cascade,
  language_tag text not null check (length(trim(language_tag)) > 0),
  name_kind text not null check (
    name_kind in ('official', 'official_romanization', 'pinyin', 'alias', 'historic_spelling', 'historical_name', 'nickname')
  ),
  value text not null check (length(trim(value)) > 0),
  normalized_value text not null check (length(trim(normalized_value)) > 0),
  is_primary boolean not null default false,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  unique (panda_id, language_tag, name_kind, value),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create index if not exists idx_panda_names_lookup on panda.names(normalized_value);
create index if not exists idx_panda_names_panda on panda.names(panda_id, is_primary desc, language_tag);
create unique index if not exists idx_panda_one_current_primary_name_per_language
  on panda.names(panda_id, language_tag) where is_primary and valid_to is null;

create table if not exists panda.name_sources (
  name_id uuid not null references panda.names(name_id) on delete cascade,
  source_id text not null references evidence.sources(source_id) on delete restrict,
  primary key (name_id, source_id)
);

create table if not exists panda.external_identifiers (
  external_identifier_id uuid primary key default gen_random_uuid(),
  panda_id uuid not null references panda.pandas(panda_id) on delete cascade,
  system text not null check (length(trim(system)) > 0),
  value text not null check (length(trim(value)) > 0),
  normalized_value text not null check (length(trim(normalized_value)) > 0),
  created_at timestamptz not null default now(),
  unique (system, normalized_value)
);

create table if not exists panda.external_identifier_sources (
  external_identifier_id uuid not null references panda.external_identifiers(external_identifier_id) on delete cascade,
  source_id text not null references evidence.sources(source_id) on delete restrict,
  primary key (external_identifier_id, source_id)
);

create table if not exists panda.fact_assertions (
  assertion_id text primary key,
  panda_id uuid not null references panda.pandas(panda_id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  value_json jsonb not null,
  certainty text not null check (certainty in ('confirmed', 'provisional')),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active', 'superseded')),
  last_verified_on date not null,
  supersedes_assertion_id text references panda.fact_assertions(assertion_id) on delete restrict,
  created_at timestamptz not null default now(),
  check (supersedes_assertion_id is null or supersedes_assertion_id <> assertion_id)
);

create table if not exists panda.fact_assertion_sources (
  assertion_id text not null references panda.fact_assertions(assertion_id) on delete cascade,
  source_id text not null references evidence.sources(source_id) on delete restrict,
  stance text not null default 'supports' check (stance in ('supports', 'refutes', 'context')),
  primary key (assertion_id, source_id)
);

create table if not exists panda.fact_conclusions (
  conclusion_id uuid primary key default gen_random_uuid(),
  panda_id uuid not null references panda.pandas(panda_id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  value_json jsonb,
  status text not null check (status in ('confirmed', 'provisional', 'disputed', 'superseded')),
  last_verified_on date not null,
  candidate_values_json jsonb not null default '[]'::jsonb check (jsonb_typeof(candidate_values_json) = 'array'),
  superseded_values_json jsonb not null default '[]'::jsonb check (jsonb_typeof(superseded_values_json) = 'array'),
  conclusion_version integer not null check (conclusion_version >= 1),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (panda_id, field_key, conclusion_version),
  check ((status = 'disputed' and value_json is null) or status <> 'disputed')
);

create unique index if not exists idx_panda_one_current_conclusion
  on panda.fact_conclusions(panda_id, field_key) where is_current;

create table if not exists panda.fact_conclusion_assertions (
  conclusion_id uuid not null references panda.fact_conclusions(conclusion_id) on delete cascade,
  assertion_id text not null references panda.fact_assertions(assertion_id) on delete restrict,
  primary key (conclusion_id, assertion_id)
);

create index if not exists idx_panda_fact_assertions_lookup
  on panda.fact_assertions(panda_id, field_key, lifecycle_state, last_verified_on desc);

-- Places ---------------------------------------------------------------------

create table if not exists place.institutions (
  institution_id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_zh text,
  name_en text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(length(trim(name_zh)), 0) > 0 or coalesce(length(trim(name_en)), 0) > 0)
);

create table if not exists place.places (
  place_id uuid primary key default gen_random_uuid(),
  institution_id uuid references place.institutions(institution_id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  place_type text not null check (
    place_type in ('facility', 'habitat', 'protected_area', 'distribution_area', 'coarse_location')
  ),
  name_zh text,
  name_en text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  region text,
  center geometry(point, 4326),
  boundary geometry(multipolygon, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(length(trim(name_zh)), 0) > 0 or coalesce(length(trim(name_en)), 0) > 0),
  check (place_type = 'facility' or institution_id is null)
);

create index if not exists idx_places_institution on place.places(institution_id) where institution_id is not null;
create index if not exists idx_places_center_gist on place.places using gist(center) where center is not null;
create index if not exists idx_places_boundary_gist on place.places using gist(boundary) where boundary is not null;

-- Life history ---------------------------------------------------------------

create table if not exists life_history.residencies (
  residency_id text primary key,
  panda_id uuid not null references panda.pandas(panda_id) on delete cascade,
  place_id uuid not null references place.places(place_id) on delete restrict,
  residency_type text not null check (residency_type in ('primary', 'temporary', 'transit', 'quarantine')),
  start_on date,
  start_precision text not null check (start_precision in ('day', 'month', 'year', 'unknown')),
  end_on date,
  end_precision text check (end_precision is null or end_precision in ('day', 'month', 'year', 'unknown')),
  status text not null check (status in ('confirmed', 'confirmed_country_level', 'provisional')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((start_precision = 'unknown' and start_on is null) or (start_precision <> 'unknown' and start_on is not null)),
  check (end_precision is not null or end_on is null),
  check ((end_precision = 'unknown' and end_on is null) or end_precision is distinct from 'unknown'),
  check (end_on is null or start_on is null or end_on >= start_on)
);

alter table life_history.residencies
  add constraint life_history_primary_residency_no_overlap
  exclude using gist (
    panda_id with =,
    daterange(start_on, coalesce(end_on, 'infinity'::date), '[)') with &&
  ) where (residency_type = 'primary' and start_on is not null);

create table if not exists life_history.residency_sources (
  residency_id text not null references life_history.residencies(residency_id) on delete cascade,
  source_id text not null references evidence.sources(source_id) on delete restrict,
  primary key (residency_id, source_id)
);

create table if not exists life_history.events (
  event_id text primary key,
  event_type text not null check (
    event_type in ('birth', 'arrival', 'transfer', 'return', 'naming', 'public_debut', 'selection', 'announcement', 'observation', 'death')
  ),
  event_status text not null check (event_status in ('announced', 'completed', 'cancelled', 'disputed')),
  occurred_on date,
  occurred_precision text not null check (occurred_precision in ('day', 'month', 'year', 'unknown')),
  from_place_id uuid references place.places(place_id) on delete restrict,
  to_place_id uuid references place.places(place_id) on delete restrict,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((occurred_precision = 'unknown' and occurred_on is null) or (occurred_precision <> 'unknown' and occurred_on is not null)),
  check (from_place_id is null or to_place_id is null or from_place_id <> to_place_id)
);

create table if not exists life_history.event_participants (
  event_id text not null references life_history.events(event_id) on delete cascade,
  panda_id uuid not null references panda.pandas(panda_id) on delete cascade,
  participant_role text not null default 'subject' check (length(trim(participant_role)) > 0),
  primary key (event_id, panda_id, participant_role)
);

create table if not exists life_history.event_sources (
  event_id text not null references life_history.events(event_id) on delete cascade,
  source_id text not null references evidence.sources(source_id) on delete restrict,
  primary key (event_id, source_id)
);

create index if not exists idx_life_history_residencies_panda
  on life_history.residencies(panda_id, start_on desc nulls last, residency_id);
create index if not exists idx_life_history_event_participants_panda
  on life_history.event_participants(panda_id, event_id);

-- Lineage --------------------------------------------------------------------

create table if not exists lineage.parentage_assertions (
  assertion_id text primary key,
  child_id uuid not null references panda.pandas(panda_id) on delete cascade,
  parent_id uuid not null references panda.pandas(panda_id) on delete restrict,
  parent_role text not null check (parent_role in ('father', 'mother')),
  status text not null check (status in ('confirmed', 'tentative', 'disputed', 'superseded')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (child_id <> parent_id)
);

create table if not exists lineage.parentage_assertion_sources (
  assertion_id text not null references lineage.parentage_assertions(assertion_id) on delete cascade,
  source_id text not null references evidence.sources(source_id) on delete restrict,
  primary key (assertion_id, source_id)
);

create index if not exists idx_lineage_parentage_child
  on lineage.parentage_assertions(child_id, parent_role, status);
create index if not exists idx_lineage_parentage_parent
  on lineage.parentage_assertions(parent_id, status);
create unique index if not exists idx_lineage_one_confirmed_parent_per_role
  on lineage.parentage_assertions(child_id, parent_role) where status = 'confirmed';

-- Media ----------------------------------------------------------------------

create table if not exists media.assets (
  asset_id uuid primary key default gen_random_uuid(),
  source_id text references evidence.sources(source_id) on delete restrict,
  storage_bucket text not null check (length(trim(storage_bucket)) > 0),
  storage_key text not null check (length(trim(storage_key)) > 0),
  object_version text,
  storage_etag text,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  media_type text not null check (length(trim(media_type)) > 0),
  byte_size bigint not null check (byte_size > 0),
  title text,
  creator text,
  copyright_text text,
  license text,
  attribution_text text,
  rights_status text not null check (rights_status in ('cleared', 'restricted', 'unknown')),
  eligibility_status text not null check (eligibility_status in ('eligible', 'restricted', 'pending')),
  taken_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_key, object_version)
);

create unique index if not exists idx_media_asset_object_identity
  on media.assets(storage_bucket, storage_key, coalesce(object_version, ''));

create table if not exists media.derivatives (
  parent_asset_id uuid not null references media.assets(asset_id) on delete restrict,
  derivative_asset_id uuid not null references media.assets(asset_id) on delete restrict,
  derivative_kind text not null check (derivative_kind in ('thumbnail', 'web', 'preview', 'crop', 'other')),
  transform_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(transform_metadata) = 'object'),
  primary key (parent_asset_id, derivative_asset_id),
  check (parent_asset_id <> derivative_asset_id)
);

create table if not exists media.panda_assets (
  panda_id uuid not null references panda.pandas(panda_id) on delete cascade,
  asset_id uuid not null references media.assets(asset_id) on delete restrict,
  usage_role text not null default 'gallery' check (usage_role in ('cover', 'gallery', 'historical', 'evidence')),
  display_order integer not null default 0 check (display_order >= 0),
  primary key (panda_id, asset_id, usage_role)
);

create unique index if not exists idx_media_one_cover_per_panda
  on media.panda_assets(panda_id) where usage_role = 'cover';

-- V2 application authorization ------------------------------------------------

insert into identity.capabilities (capability_key, description, sensitive) values
  ('evidence.read', 'Read restricted Evidence metadata through the V2 application boundary.', false),
  ('evidence.manage', 'Create and maintain Evidence sources and attachments.', false),
  ('panda.read', 'Read authoritative Panda identity and biographical knowledge.', false),
  ('panda.manage', 'Create and maintain Panda identity and biographical knowledge.', false),
  ('places.read', 'Read authoritative institutions and places.', false),
  ('places.manage', 'Create and maintain institutions and places.', false),
  ('life_history.read', 'Read authoritative panda residency and life-event history.', false),
  ('life_history.manage', 'Create and maintain panda residency and life-event history.', false),
  ('lineage.read', 'Read authoritative panda parentage assertions.', false),
  ('lineage.manage', 'Create and maintain panda parentage assertions.', false),
  ('media.read', 'Read reviewed media metadata and rights state.', false),
  ('media.manage', 'Create and maintain reviewed media metadata, derivatives, and panda associations.', false)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key)
select role_key, capability_key
from (values
  ('reviewer', 'evidence.read'),
  ('reviewer', 'panda.read'),
  ('reviewer', 'places.read'),
  ('reviewer', 'life_history.read'),
  ('reviewer', 'lineage.read'),
  ('reviewer', 'media.read'),
  ('archive_editor', 'evidence.read'),
  ('archive_editor', 'evidence.manage'),
  ('archive_editor', 'panda.read'),
  ('archive_editor', 'panda.manage'),
  ('archive_editor', 'places.read'),
  ('archive_editor', 'places.manage'),
  ('archive_editor', 'life_history.read'),
  ('archive_editor', 'life_history.manage'),
  ('archive_editor', 'lineage.read'),
  ('archive_editor', 'lineage.manage'),
  ('archive_editor', 'media.read'),
  ('archive_editor', 'media.manage'),
  ('senior_archive_editor', 'evidence.read'),
  ('senior_archive_editor', 'evidence.manage'),
  ('senior_archive_editor', 'panda.read'),
  ('senior_archive_editor', 'panda.manage'),
  ('senior_archive_editor', 'places.read'),
  ('senior_archive_editor', 'places.manage'),
  ('senior_archive_editor', 'life_history.read'),
  ('senior_archive_editor', 'life_history.manage'),
  ('senior_archive_editor', 'lineage.read'),
  ('senior_archive_editor', 'lineage.manage'),
  ('senior_archive_editor', 'media.read'),
  ('senior_archive_editor', 'media.manage')
) as grants(role_key, capability_key)
on conflict (role_key, capability_key) do nothing;

-- Browser roles never access authoritative V2 knowledge tables directly.
revoke all on schema evidence, panda, lineage, place, life_history, media from public;
revoke all on schema evidence, panda, lineage, place, life_history, media from anon, authenticated;

grant usage on schema evidence, panda, lineage, place, life_history, media to zhipanda_app;
grant select, insert, update, delete on all tables in schema evidence to zhipanda_app;
grant select, insert, update, delete on all tables in schema panda to zhipanda_app;
grant select, insert, update, delete on all tables in schema lineage to zhipanda_app;
grant select, insert, update, delete on all tables in schema place to zhipanda_app;
grant select, insert, update, delete on all tables in schema life_history to zhipanda_app;
grant select, insert, update, delete on all tables in schema media to zhipanda_app;

commit;
