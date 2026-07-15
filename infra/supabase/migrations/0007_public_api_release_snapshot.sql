-- Pin subsequent publication batches to the complete public API snapshot projector.

alter table public.publication_batches
  alter column database_migration_version set default '0007',
  alter column projection_code_version set default 'public-release-v2';

create table if not exists public.public_api_release_withdrawals (
  id uuid primary key default gen_random_uuid(),
  dataset_release_version text not null,
  entity_type text,
  entity_id text,
  reason text not null check (length(trim(reason)) > 0),
  withdrawn_at timestamptz not null default now(),
  check (
    (entity_type is null and entity_id is null)
    or (entity_type is not null and entity_id is not null)
  ),
  unique nulls not distinct (dataset_release_version, entity_type, entity_id)
);

create or replace function public.reject_public_api_withdrawal_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'public API release withdrawals are append-only';
end;
$$;

drop trigger if exists trg_public_api_release_withdrawals_append_only
  on public.public_api_release_withdrawals;
create trigger trg_public_api_release_withdrawals_append_only
before update or delete on public.public_api_release_withdrawals
for each row execute function public.reject_public_api_withdrawal_mutation();

alter table public.public_api_release_withdrawals enable row level security;

drop policy if exists public_api_release_withdrawals_service_role
  on public.public_api_release_withdrawals;
create policy public_api_release_withdrawals_service_role
  on public.public_api_release_withdrawals
  for all
  to service_role
  using (true)
  with check (true);
