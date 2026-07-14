begin;

-- Trusted Archive identity and evidence model. Existing columns on public.pandas
-- remain compatibility projections; public.pandas.id is the stable identity.

create table if not exists public.evidence_sources (
  id text primary key,
  publisher text not null,
  title text not null,
  url text not null,
  published_at date,
  last_verified_at date not null,
  language_tag text not null,
  access_state text not null check (
    access_state in ('accessible', 'redirected', 'changed', 'unavailable', 'archived', 'restricted')
  ),
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  evidence_tier text,
  public_summary text,
  internal_notes text,
  content_hash text,
  restricted_excerpt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.panda_names (
  id uuid primary key default gen_random_uuid(),
  panda_id uuid not null references public.pandas(id) on delete cascade,
  language_tag text not null,
  name_kind text not null check (
    name_kind in (
      'official',
      'official_romanization',
      'pinyin',
      'alias',
      'historic_spelling',
      'historical_name',
      'nickname'
    )
  ),
  value text not null,
  normalized_value text not null,
  is_primary boolean not null default false,
  valid_from date,
  valid_to date,
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  created_at timestamptz not null default now(),
  unique (panda_id, language_tag, name_kind, value),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table if not exists public.panda_name_sources (
  panda_name_id uuid not null references public.panda_names(id) on delete cascade,
  source_id text not null references public.evidence_sources(id) on delete restrict,
  primary key (panda_name_id, source_id)
);

create table if not exists public.panda_slugs (
  id uuid primary key default gen_random_uuid(),
  panda_id uuid not null references public.pandas(id) on delete cascade,
  slug text not null unique,
  slug_kind text not null check (slug_kind in ('canonical', 'legacy')),
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create unique index if not exists idx_panda_slugs_one_canonical
  on public.panda_slugs (panda_id)
  where slug_kind = 'canonical';

create table if not exists public.panda_slug_sources (
  panda_slug_id uuid not null references public.panda_slugs(id) on delete cascade,
  source_id text not null references public.evidence_sources(id) on delete restrict,
  primary key (panda_slug_id, source_id)
);

create table if not exists public.panda_external_identifiers (
  id uuid primary key default gen_random_uuid(),
  panda_id uuid not null references public.pandas(id) on delete cascade,
  system text not null,
  value text not null,
  normalized_value text not null,
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  created_at timestamptz not null default now(),
  unique (system, value)
);

create table if not exists public.panda_external_identifier_sources (
  external_identifier_id uuid not null
    references public.panda_external_identifiers(id) on delete cascade,
  source_id text not null references public.evidence_sources(id) on delete restrict,
  primary key (external_identifier_id, source_id)
);

create table if not exists public.fact_assertions (
  id text primary key,
  panda_id uuid not null references public.pandas(id) on delete cascade,
  field_key text not null,
  value_json jsonb not null,
  certainty text not null check (certainty in ('confirmed', 'provisional')),
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  last_verified_at date not null,
  supersedes_assertion_id text references public.fact_assertions(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.fact_assertion_sources (
  assertion_id text not null references public.fact_assertions(id) on delete cascade,
  source_id text not null references public.evidence_sources(id) on delete restrict,
  stance text not null default 'supports' check (stance in ('supports', 'refutes', 'context')),
  primary key (assertion_id, source_id)
);

create table if not exists public.public_fact_conclusions (
  id uuid primary key default gen_random_uuid(),
  panda_id uuid not null references public.pandas(id) on delete cascade,
  field_key text not null,
  value_json jsonb,
  status text not null check (status in ('confirmed', 'provisional', 'disputed', 'superseded')),
  last_verified_at date not null,
  candidate_values_json jsonb not null default '[]'::jsonb,
  superseded_values_json jsonb not null default '[]'::jsonb,
  conclusion_version integer not null default 1 check (conclusion_version >= 1),
  is_current boolean not null default true,
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  created_at timestamptz not null default now(),
  unique (panda_id, field_key, conclusion_version)
);

create unique index if not exists idx_public_fact_conclusions_one_current
  on public.public_fact_conclusions (panda_id, field_key)
  where is_current;

create table if not exists public.public_fact_conclusion_assertions (
  conclusion_id uuid not null
    references public.public_fact_conclusions(id) on delete cascade,
  assertion_id text not null references public.fact_assertions(id) on delete restrict,
  primary key (conclusion_id, assertion_id)
);

create index if not exists idx_panda_names_search
  on public.panda_names using btree (normalized_value);
create index if not exists idx_panda_names_panda
  on public.panda_names using btree (panda_id, publication_status);
create index if not exists idx_panda_slugs_panda
  on public.panda_slugs using btree (panda_id, slug_kind);
create index if not exists idx_external_identifiers_search
  on public.panda_external_identifiers using btree (normalized_value);
create index if not exists idx_fact_assertions_panda_field
  on public.fact_assertions using btree (panda_id, field_key, last_verified_at desc);
create index if not exists idx_public_fact_conclusions_panda
  on public.public_fact_conclusions using btree (panda_id, is_current, field_key);

create or replace view public.public_evidence_sources as
select
  id,
  publisher,
  title,
  url,
  published_at,
  last_verified_at,
  language_tag,
  access_state,
  evidence_tier,
  public_summary
from public.evidence_sources
where publication_status = 'published';

alter table public.evidence_sources enable row level security;
alter table public.panda_names enable row level security;
alter table public.panda_name_sources enable row level security;
alter table public.panda_slugs enable row level security;
alter table public.panda_slug_sources enable row level security;
alter table public.panda_external_identifiers enable row level security;
alter table public.panda_external_identifier_sources enable row level security;
alter table public.fact_assertions enable row level security;
alter table public.fact_assertion_sources enable row level security;
alter table public.public_fact_conclusions enable row level security;
alter table public.public_fact_conclusion_assertions enable row level security;

-- Public reads are limited to identity labels and already-derived conclusions.
drop policy if exists panda_names_public_read on public.panda_names;
create policy panda_names_public_read on public.panda_names
for select using (publication_status = 'published');

drop policy if exists panda_slugs_public_read on public.panda_slugs;
create policy panda_slugs_public_read on public.panda_slugs
for select using (publication_status = 'published');

drop policy if exists panda_external_identifiers_public_read
  on public.panda_external_identifiers;
create policy panda_external_identifiers_public_read
  on public.panda_external_identifiers
for select using (publication_status = 'published');

drop policy if exists public_fact_conclusions_public_read
  on public.public_fact_conclusions;
create policy public_fact_conclusions_public_read
  on public.public_fact_conclusions
for select using (publication_status = 'published' and is_current);

-- Sources, assertions, and join tables remain staff-only. The public source view
-- exposes only approved metadata and excludes internal_notes/restricted_excerpt.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'evidence_sources',
    'panda_names',
    'panda_name_sources',
    'panda_slugs',
    'panda_slug_sources',
    'panda_external_identifiers',
    'panda_external_identifier_sources',
    'fact_assertions',
    'fact_assertion_sources',
    'public_fact_conclusions',
    'public_fact_conclusion_assertions'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_staff_write',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all using '
      || '(public.has_any_role(array[''admin'', ''editor'', ''reviewer'']::public.app_user_role[])) '
      || 'with check '
      || '(public.has_any_role(array[''admin'', ''editor'', ''reviewer'']::public.app_user_role[]))',
      table_name || '_staff_write',
      table_name
    );
  end loop;
end
$$;

commit;
