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
  parent_role text not null,
  status text not null,
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
  residency_type text not null,
  start_date text not null,
  start_precision text not null,
  end_date text,
  end_precision text,
  status text not null,
  publication_status text not null default 'draft'
);

create table if not exists residency_sources (
  residency_id text not null references panda_residencies(id),
  source_id text not null references evidence_sources(id),
  primary key (residency_id, source_id)
);

create table if not exists domain_events (
  id text primary key,
  event_type text not null,
  event_status text not null,
  event_date text not null,
  event_date_precision text not null,
  from_facility_id text references facilities(id),
  from_coarse_location text,
  to_facility_id text references facilities(id),
  to_coarse_location text,
  publication_status text not null default 'draft'
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
