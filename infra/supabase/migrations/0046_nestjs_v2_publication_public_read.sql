-- NestJS V2 publication and release-scoped public reads.
-- Publication owns immutable releases, activation, and narrow delivery controls.
-- Public read models are typed PostgreSQL projections; D1/Worker/file artifacts are not part of V2.

begin;

create schema if not exists publication;
create schema if not exists public_read;

comment on schema publication is
  'Private V2 release lifecycle, membership, activation pointer, transitions, and emergency delivery controls.';
comment on schema public_read is
  'Release-scoped typed public projections served only through the NestJS V2 Publication module.';

create table publication.releases (
  release_id uuid primary key default gen_random_uuid(),
  version text not null unique check (length(trim(version)) between 1 and 80),
  projection_schema_version integer not null default 1 check (projection_schema_version >= 1),
  lifecycle_state text not null default 'building' check (lifecycle_state in ('building', 'sealed')),
  created_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  created_at timestamptz not null default now(),
  built_at timestamptz not null default now(),
  sealed_at timestamptz,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  check (
    (lifecycle_state = 'building' and sealed_at is null and content_sha256 is null)
    or
    (lifecycle_state = 'sealed' and sealed_at is not null and content_sha256 is not null)
  )
);

create table publication.release_memberships (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  resource_kind text not null check (
    resource_kind in ('panda', 'institution', 'place', 'lineage', 'residency', 'life_event', 'media', 'evidence')
  ),
  resource_id text not null check (length(trim(resource_id)) > 0),
  source_revision text not null check (length(trim(source_revision)) > 0),
  source_version text not null check (length(trim(source_version)) > 0),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  projection_sha256 text not null check (projection_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (release_id, resource_kind, resource_id)
);

create index idx_publication_membership_resource
  on publication.release_memberships(resource_kind, resource_id, release_id);

create table publication.release_transitions (
  transition_id uuid primary key default gen_random_uuid(),
  release_id uuid not null references publication.releases(release_id) on delete restrict,
  transition_type text not null check (
    transition_type in ('built', 'sealed', 'activated', 'rolled_back', 'suspended', 'restored')
  ),
  from_release_id uuid references publication.releases(release_id) on delete restrict,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  reason text not null check (length(trim(reason)) between 3 and 2000),
  occurred_at timestamptz not null default now()
);

create index idx_publication_release_transitions
  on publication.release_transitions(release_id, occurred_at desc, transition_id desc);

create table publication.current_release (
  singleton boolean primary key default true check (singleton),
  release_id uuid not null references publication.releases(release_id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table publication.delivery_control_events (
  control_event_id uuid primary key default gen_random_uuid(),
  control_kind text not null check (control_kind in ('release_suspension', 'resource_takedown')),
  release_id uuid references publication.releases(release_id) on delete restrict,
  resource_kind text check (resource_kind is null or resource_kind in ('panda', 'place', 'media', 'evidence')),
  resource_id text,
  action text not null check (action in ('apply', 'restore')),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  reason text not null check (length(trim(reason)) between 3 and 2000),
  occurred_at timestamptz not null default now(),
  check (
    (control_kind = 'release_suspension' and release_id is not null and resource_kind is null and resource_id is null)
    or
    (control_kind = 'resource_takedown' and release_id is null and resource_kind is not null and resource_id is not null and length(trim(resource_id)) > 0)
  )
);

create index idx_publication_release_suspension_events
  on publication.delivery_control_events(release_id, occurred_at desc, control_event_id desc)
  where control_kind = 'release_suspension';
create index idx_publication_resource_takedown_events
  on publication.delivery_control_events(resource_kind, resource_id, occurred_at desc, control_event_id desc)
  where control_kind = 'resource_takedown';

-- Typed release-scoped read models ------------------------------------------------

create table public_read.pandas (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  panda_id uuid not null,
  canonical_slug text not null check (canonical_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legacy_slugs text[] not null default '{}',
  names jsonb not null check (jsonb_typeof(names) = 'array'),
  facts jsonb not null check (jsonb_typeof(facts) = 'array'),
  evidence_source_ids text[] not null default '{}',
  primary key (release_id, panda_id),
  unique (release_id, canonical_slug)
);

create table public_read.institutions (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  institution_id uuid not null,
  slug text not null,
  name_zh text,
  name_en text,
  country_code text,
  primary key (release_id, institution_id),
  unique (release_id, slug)
);

create table public_read.places (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  place_id uuid not null,
  institution_id uuid,
  slug text not null,
  place_type text not null,
  name_zh text,
  name_en text,
  country_code text,
  region text,
  longitude double precision,
  latitude double precision,
  primary key (release_id, place_id),
  unique (release_id, slug)
);

create index idx_public_read_places_institution
  on public_read.places(release_id, institution_id) where institution_id is not null;

create table public_read.lineage (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  assertion_id text not null,
  child_id uuid not null,
  parent_id uuid not null,
  parent_role text not null check (parent_role in ('father', 'mother')),
  source_ids text[] not null default '{}',
  primary key (release_id, assertion_id)
);

create index idx_public_read_lineage_child on public_read.lineage(release_id, child_id);
create index idx_public_read_lineage_parent on public_read.lineage(release_id, parent_id);

create table public_read.residencies (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  residency_id text not null,
  panda_id uuid not null,
  place_id uuid not null,
  residency_type text not null,
  start_on date,
  start_precision text not null,
  end_on date,
  end_precision text,
  status text not null,
  source_ids text[] not null default '{}',
  primary key (release_id, residency_id)
);

create index idx_public_read_residencies_panda on public_read.residencies(release_id, panda_id);

create table public_read.life_events (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  event_id text not null,
  event_type text not null,
  event_status text not null,
  occurred_on date,
  occurred_precision text not null,
  from_place_id uuid,
  to_place_id uuid,
  summary text,
  participant_ids uuid[] not null default '{}',
  source_ids text[] not null default '{}',
  primary key (release_id, event_id)
);

create index idx_public_read_life_events_participants
  on public_read.life_events using gin(participant_ids);

create table public_read.media (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  asset_id uuid not null,
  panda_id uuid not null,
  source_id text,
  usage_role text not null,
  display_order integer not null,
  object_key text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  media_type text not null,
  title text,
  creator text,
  copyright_text text,
  license text,
  attribution_text text,
  taken_at timestamptz,
  primary key (release_id, panda_id, asset_id, usage_role)
);

create index idx_public_read_media_panda
  on public_read.media(release_id, panda_id, display_order, asset_id);

create table public_read.evidence_sources (
  release_id uuid not null references publication.releases(release_id) on delete cascade,
  source_id text not null,
  publisher text not null,
  title text not null,
  url text not null,
  published_on date,
  last_verified_on date not null,
  language_tag text not null,
  access_state text not null,
  evidence_tier text,
  public_summary text,
  primary key (release_id, source_id)
);

create table public_read.stats (
  release_id uuid primary key references publication.releases(release_id) on delete cascade,
  panda_count integer not null check (panda_count >= 0),
  institution_count integer not null check (institution_count >= 0),
  place_count integer not null check (place_count >= 0),
  lineage_count integer not null check (lineage_count >= 0),
  residency_count integer not null check (residency_count >= 0),
  life_event_count integer not null check (life_event_count >= 0),
  media_count integer not null check (media_count >= 0),
  evidence_source_count integer not null check (evidence_source_count >= 0)
);

-- Once sealed, release content and membership are immutable. Activation and emergency
-- controls live outside the sealed release content and therefore never rewrite history.
create or replace function publication.reject_sealed_content_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  old_release_id uuid;
  new_release_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_release_id := old.release_id;
    if exists (
      select 1 from publication.releases r
      where r.release_id = old_release_id and r.lifecycle_state = 'sealed'
    ) then
      raise exception 'sealed release % content is immutable', old_release_id using errcode = '55000';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_release_id := new.release_id;
    if exists (
      select 1 from publication.releases r
      where r.release_id = new_release_id and r.lifecycle_state = 'sealed'
    ) then
      raise exception 'sealed release % content is immutable', new_release_id using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

create or replace function publication.reject_sealed_release_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.lifecycle_state = 'sealed' then
    raise exception 'sealed release % is immutable', old.release_id using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

create trigger publication_releases_immutable_after_seal
before update or delete on publication.releases
for each row execute function publication.reject_sealed_release_mutation();

create trigger publication_memberships_immutable_after_seal
before insert or update or delete on publication.release_memberships
for each row execute function publication.reject_sealed_content_mutation();

create trigger public_read_pandas_immutable_after_seal
before insert or update or delete on public_read.pandas
for each row execute function publication.reject_sealed_content_mutation();
create trigger public_read_institutions_immutable_after_seal
before insert or update or delete on public_read.institutions
for each row execute function publication.reject_sealed_content_mutation();
create trigger public_read_places_immutable_after_seal
before insert or update or delete on public_read.places
for each row execute function publication.reject_sealed_content_mutation();
create trigger public_read_lineage_immutable_after_seal
before insert or update or delete on public_read.lineage
for each row execute function publication.reject_sealed_content_mutation();
create trigger public_read_residencies_immutable_after_seal
before insert or update or delete on public_read.residencies
for each row execute function publication.reject_sealed_content_mutation();
create trigger public_read_life_events_immutable_after_seal
before insert or update or delete on public_read.life_events
for each row execute function publication.reject_sealed_content_mutation();
create trigger public_read_media_immutable_after_seal
before insert or update or delete on public_read.media
for each row execute function publication.reject_sealed_content_mutation();
create trigger public_read_evidence_immutable_after_seal
before insert or update or delete on public_read.evidence_sources
for each row execute function publication.reject_sealed_content_mutation();
create trigger public_read_stats_immutable_after_seal
before insert or update or delete on public_read.stats
for each row execute function publication.reject_sealed_content_mutation();

-- V2 publication capabilities ----------------------------------------------------

insert into identity.capabilities (
  capability_key,
  description,
  sensitive,
  requires_recent_auth,
  minimum_aal,
  requires_live_session
) values
  ('publication.release.manage', 'Build and seal immutable V2 public releases.', true, true, 'aal1', false),
  ('publication.release.activate', 'Activate or roll back the V2 public release pointer.', true, true, 'aal2', true),
  ('publication.emergency', 'Apply or restore narrow emergency release/resource delivery controls.', true, true, 'aal2', true)
on conflict (capability_key) do update
set description = excluded.description,
    sensitive = excluded.sensitive,
    requires_recent_auth = excluded.requires_recent_auth,
    minimum_aal = excluded.minimum_aal,
    requires_live_session = excluded.requires_live_session;

insert into identity.role_capabilities (role_key, capability_key) values
  ('archive_editor', 'publication.release.manage'),
  ('senior_archive_editor', 'publication.release.manage'),
  ('senior_archive_editor', 'publication.release.activate'),
  ('senior_archive_editor', 'publication.emergency')
on conflict (role_key, capability_key) do nothing;

-- The Nest application is the only runtime authority for these schemas.
revoke all on schema publication, public_read from public, anon, authenticated;
revoke all on all tables in schema publication, public_read from public, anon, authenticated;
revoke all on all functions in schema publication from public, anon, authenticated;

grant usage on schema publication, public_read to zhipanda_app;
grant select, insert, update on publication.releases to zhipanda_app;
grant select, insert on publication.release_memberships to zhipanda_app;
grant select, insert on publication.release_transitions to zhipanda_app;
grant select, insert, update on publication.current_release to zhipanda_app;
grant select, insert on publication.delivery_control_events to zhipanda_app;
grant select, insert on all tables in schema public_read to zhipanda_app;

commit;
