-- Bounded Audit retention maintenance evidence.

begin;

create table audit.maintenance_runs (
  run_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  reason text not null check (length(trim(reason)) between 3 and 1000),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null,
  correlation_id uuid not null,
  expired_export_count integer not null check (expired_export_count >= 0),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  constraint audit_maintenance_time_order check (completed_at >= started_at),
  constraint audit_maintenance_idempotency unique (actor_account_id, idempotency_key)
);

create index idx_audit_maintenance_runs_completed
  on audit.maintenance_runs (completed_at desc, run_id desc);

create or replace function audit.reject_maintenance_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit maintenance evidence is append-only' using errcode = '55000';
end;
$$;

drop trigger if exists trg_maintenance_runs_append_only on audit.maintenance_runs;
create trigger trg_maintenance_runs_append_only
before update or delete on audit.maintenance_runs
for each row execute function audit.reject_maintenance_mutation();

insert into identity.capabilities (capability_key, description, sensitive) values
  ('audit.maintain', 'Run bounded Audit retention maintenance.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('audit_exporter', 'audit.maintain')
on conflict (role_key, capability_key) do nothing;

comment on table audit.maintenance_runs is
  'Append-only evidence for bounded removal of expired encrypted Audit exports.';

revoke all on audit.maintenance_runs from public;
revoke all on function audit.reject_maintenance_mutation() from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on audit.maintenance_runs from %I', role_name);
      execute format(
        'revoke all on function audit.reject_maintenance_mutation() from %I',
        role_name
      );
    end if;
  end loop;
end
$roles$;

commit;
