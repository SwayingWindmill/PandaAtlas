-- Pin projection provenance to every immutable publication batch.

alter table public.publication_batches
  add column if not exists database_migration_version text not null default '0006',
  add column if not exists projection_code_version text not null default 'public-release-v1';

alter table public.publication_batches
  drop constraint if exists publication_batches_database_migration_version_nonempty,
  add constraint publication_batches_database_migration_version_nonempty
    check (length(trim(database_migration_version)) > 0),
  drop constraint if exists publication_batches_projection_code_version_nonempty,
  add constraint publication_batches_projection_code_version_nonempty
    check (length(trim(projection_code_version)) > 0);
