-- Immutable, versioned public release storage. The pointer is the only mutable row.

create table if not exists public_releases (
  dataset_release_version text primary key,
  public_schema_version text not null,
  database_migration_version text not null,
  publication_batch_id text not null,
  projection_code_version text not null,
  released_at text not null,
  licenses_json text not null check (json_valid(licenses_json))
);
create table if not exists public_release_records (
  dataset_release_version text not null references public_releases(dataset_release_version),
  entity_type text not null,
  entity_id text not null,
  public_json text not null check (json_valid(public_json)),
  primary key (dataset_release_version, entity_type, entity_id)
);

create table if not exists public_release_pointer (
  singleton integer primary key check (singleton = 1),
  dataset_release_version text references public_releases(dataset_release_version),
  switched_at text
);

insert or ignore into public_release_pointer (singleton) values (1);

create table if not exists public_release_withdrawals (
  id integer primary key autoincrement,
  dataset_release_version text not null references public_releases(dataset_release_version),
  entity_type text,
  entity_id text,
  reason text not null,
  withdrawn_at text not null
);

create view if not exists current_public_release as
select release.*
from public_release_pointer pointer
join public_releases release
  on release.dataset_release_version = pointer.dataset_release_version
where not exists (
  select 1 from public_release_withdrawals withdrawal
  where withdrawal.dataset_release_version = release.dataset_release_version
    and withdrawal.entity_type is null
    and withdrawal.entity_id is null
);

create view if not exists current_public_records as
select record.*
from public_release_records record
join current_public_release release
  on release.dataset_release_version = record.dataset_release_version
where not exists (
  select 1 from public_release_withdrawals withdrawal
  where withdrawal.dataset_release_version = record.dataset_release_version
    and withdrawal.entity_type = record.entity_type
    and withdrawal.entity_id = record.entity_id
);
