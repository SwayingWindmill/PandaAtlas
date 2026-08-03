-- Audited Privacy maintenance runs and indexes for bounded operational metrics.

begin;

create table if not exists privacy.maintenance_runs (
  run_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  replay_tombstones_after_restore boolean not null default false,
  counts jsonb not null,
  command_hash text not null,
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint privacy_maintenance_run_time_order check (completed_at >= started_at),
  constraint privacy_maintenance_run_counts_object check (jsonb_typeof(counts) = 'object'),
  constraint privacy_maintenance_run_command_hash check (command_hash ~ '^[a-f0-9]{64}$')
);

create trigger trg_privacy_maintenance_runs_append_only
before update or delete on privacy.maintenance_runs
for each row execute function privacy.reject_append_only_mutation();

create index if not exists idx_privacy_requests_open_age
  on privacy.requests (requested_at, request_id)
  where state in ('requested', 'verified', 'processing');
create index if not exists idx_privacy_contexts_failed_age
  on privacy.request_contexts (updated_at, request_id, context_key)
  where state = 'failed';
create index if not exists idx_privacy_tombstones_replay_age
  on privacy.deletion_tombstones (last_replayed_at, applied_at, account_id, context_key);
create index if not exists idx_privacy_audit_event_time
  on privacy.audit_events (event_type, occurred_at desc);
create index if not exists idx_privacy_export_payload_expiry
  on privacy.export_artifacts (expires_at, artifact_id)
  where state in ('ready', 'expired');

revoke all on privacy.maintenance_runs from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on privacy.maintenance_runs from %I', role_name);
    end if;
  end loop;
end
$roles$;

comment on table privacy.maintenance_runs is
  'Append-only evidence for retention purge and explicit post-restore tombstone replay runs.';

commit;
