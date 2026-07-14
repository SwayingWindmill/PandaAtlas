pragma foreign_keys = on;

-- Public projection counterpart of the authoritative Postgres Trusted Archive.
-- Restricted evidence fields are intentionally absent from D1.

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
