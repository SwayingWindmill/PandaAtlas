begin;

create extension if not exists btree_gist;

create table if not exists public.institutions (
  id uuid primary key,
  name_zh text,
  name_en text,
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  )
);

create table if not exists public.facilities (
  id uuid primary key,
  institution_id uuid references public.institutions(id) on delete restrict,
  name_zh text,
  name_en text,
  country_code text,
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  )
);

create table if not exists public.parentage_assertions (
  id text primary key,
  child_id uuid not null references public.pandas(id) on delete cascade,
  parent_id uuid not null references public.pandas(id) on delete restrict,
  parent_role text not null check (parent_role in ('father', 'mother')),
  status text not null check (
    status in ('confirmed', 'tentative', 'disputed', 'superseded')
  ),
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  reviewed_at timestamptz,
  check (child_id <> parent_id)
);

create table if not exists public.parentage_assertion_sources (
  assertion_id text not null references public.parentage_assertions(id) on delete cascade,
  source_id text not null references public.evidence_sources(id) on delete restrict,
  primary key (assertion_id, source_id)
);

create table if not exists public.panda_residencies (
  id text primary key,
  panda_id uuid not null references public.pandas(id) on delete cascade,
  facility_id uuid references public.facilities(id) on delete restrict,
  coarse_location text,
  residency_type text not null check (
    residency_type in ('primary', 'temporary', 'transit', 'quarantine')
  ),
  start_date date not null,
  start_precision text not null check (start_precision in ('day', 'month', 'year')),
  end_date date,
  end_precision text check (end_precision in ('day', 'month', 'year')),
  status text not null check (
    status in ('confirmed', 'confirmed_country_level', 'provisional')
  ),
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  check ((facility_id is null) <> (coarse_location is null)),
  check (end_date is null or end_date >= start_date),
  exclude using gist (
    panda_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[)') with &&
  ) where (residency_type = 'primary')
);

create table if not exists public.residency_sources (
  residency_id text not null references public.panda_residencies(id) on delete cascade,
  source_id text not null references public.evidence_sources(id) on delete restrict,
  primary key (residency_id, source_id)
);

create table if not exists public.domain_events (
  id text primary key,
  event_type text not null check (event_type in ('transfer')),
  event_status text not null check (
    event_status in ('announced', 'completed', 'cancelled', 'disputed')
  ),
  event_date date not null,
  event_date_precision text not null check (event_date_precision in ('day', 'month', 'year')),
  from_facility_id uuid references public.facilities(id) on delete restrict,
  from_coarse_location text,
  to_facility_id uuid references public.facilities(id) on delete restrict,
  to_coarse_location text,
  publication_status text not null default 'draft' check (
    publication_status in ('published', 'draft', 'restricted')
  ),
  check (from_facility_id is null or from_coarse_location is null),
  check (to_facility_id is null or to_coarse_location is null)
);

create table if not exists public.domain_event_participants (
  event_id text not null references public.domain_events(id) on delete cascade,
  panda_id uuid not null references public.pandas(id) on delete cascade,
  unique (event_id, panda_id)
);

create table if not exists public.domain_event_sources (
  event_id text not null references public.domain_events(id) on delete cascade,
  source_id text not null references public.evidence_sources(id) on delete restrict,
  primary key (event_id, source_id)
);

create index if not exists idx_parentage_child on public.parentage_assertions(child_id, status);
create index if not exists idx_parentage_parent on public.parentage_assertions(parent_id, status);
create index if not exists idx_residencies_panda on public.panda_residencies(panda_id, start_date desc);
create index if not exists idx_event_participants_panda on public.domain_event_participants(panda_id);

alter table public.institutions enable row level security;
alter table public.facilities enable row level security;
alter table public.parentage_assertions enable row level security;
alter table public.parentage_assertion_sources enable row level security;
alter table public.panda_residencies enable row level security;
alter table public.residency_sources enable row level security;
alter table public.domain_events enable row level security;
alter table public.domain_event_participants enable row level security;
alter table public.domain_event_sources enable row level security;

create policy institutions_public_read on public.institutions
for select using (publication_status = 'published');
create policy facilities_public_read on public.facilities
for select using (publication_status = 'published');
create policy parentage_public_read on public.parentage_assertions
for select using (publication_status = 'published' and status = 'confirmed');
create policy residencies_public_read on public.panda_residencies
for select using (publication_status = 'published');
create policy domain_events_public_read on public.domain_events
for select using (publication_status = 'published');

commit;
