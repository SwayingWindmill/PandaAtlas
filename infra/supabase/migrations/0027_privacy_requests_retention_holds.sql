-- Privacy request workflow, context projections, retention policy, holds, and deletion tombstones.
-- Migration 0026 is reserved for the scoped moderation delivery that precedes this slice.

begin;

create schema if not exists privacy;
comment on schema privacy is
  'Private access/export, deletion, retention, hold, and tombstone state owned by FastAPI.';

do $types$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'privacy' and t.typname = 'request_kind'
  ) then
    create type privacy.request_kind as enum ('access_export', 'account_deletion');
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'privacy' and t.typname = 'request_state'
  ) then
    create type privacy.request_state as enum (
      'requested', 'verified', 'processing', 'completed', 'failed'
    );
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'privacy' and t.typname = 'context_state'
  ) then
    create type privacy.context_state as enum (
      'pending', 'processing', 'completed', 'failed', 'held', 'not_applicable'
    );
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'privacy' and t.typname = 'hold_state'
  ) then
    create type privacy.hold_state as enum ('active', 'released');
  end if;
end
$types$;

create table if not exists privacy.requests (
  request_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  kind privacy.request_kind not null,
  state privacy.request_state not null default 'requested',
  requested_reason text not null,
  requested_at timestamptz not null default now(),
  verified_by_account_id uuid references identity.accounts(account_id) on delete restrict,
  verified_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  version integer not null default 1,
  idempotency_key text not null,
  correlation_id uuid not null,
  updated_at timestamptz not null default now(),
  constraint privacy_requests_reason_nonempty check (length(trim(requested_reason)) >= 10),
  constraint privacy_requests_version_positive check (version >= 1),
  constraint privacy_requests_idempotency_unique unique (account_id, idempotency_key),
  constraint privacy_requests_verified_shape check (
    (verified_at is null and verified_by_account_id is null)
    or (verified_at is not null and verified_by_account_id is not null)
  ),
  constraint privacy_requests_completion_shape check (
    (state = 'completed' and completed_at is not null)
    or (state <> 'completed' and completed_at is null)
  ),
  constraint privacy_requests_failure_shape check (
    (state = 'failed' and failed_at is not null and failure_code is not null)
    or (state <> 'failed' and failed_at is null and failure_code is null)
  ),
  constraint privacy_requests_failure_code_format check (
    failure_code is null or failure_code ~ '^[a-z][a-z0-9_.-]{2,127}$'
  )
);

create unique index if not exists idx_privacy_requests_one_open_kind
  on privacy.requests (account_id, kind)
  where state in ('requested', 'verified', 'processing');
create index if not exists idx_privacy_requests_queue
  on privacy.requests (state, requested_at, request_id);

create table if not exists privacy.request_events (
  event_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references privacy.requests(request_id) on delete restrict,
  event_type text not null,
  previous_state privacy.request_state,
  next_state privacy.request_state not null,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint privacy_request_events_type_nonempty check (length(trim(event_type)) > 0),
  constraint privacy_request_events_details_object check (jsonb_typeof(details) = 'object'),
  constraint privacy_request_events_state_changed check (
    previous_state is null or previous_state <> next_state
  )
);

create table if not exists privacy.request_contexts (
  request_id uuid not null references privacy.requests(request_id) on delete restrict,
  context_key text not null,
  state privacy.context_state not null default 'pending',
  attempts integer not null default 0,
  last_error_code text,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (request_id, context_key),
  constraint privacy_request_context_key_format check (
    context_key ~ '^[a-z][a-z0-9_.-]{2,63}$'
  ),
  constraint privacy_request_context_attempts_nonnegative check (attempts >= 0),
  constraint privacy_request_context_version_positive check (version >= 1),
  constraint privacy_request_context_failure_shape check (
    (state = 'failed' and last_error_code is not null)
    or (state <> 'failed' and last_error_code is null)
  ),
  constraint privacy_request_context_error_code_format check (
    last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_.-]{2,127}$'
  )
);

create table if not exists privacy.context_events (
  event_id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  context_key text not null,
  previous_state privacy.context_state not null,
  next_state privacy.context_state not null,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  internal_error_code text,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  foreign key (request_id, context_key)
    references privacy.request_contexts(request_id, context_key) on delete restrict,
  constraint privacy_context_events_state_changed check (previous_state <> next_state),
  constraint privacy_context_events_failure_shape check (
    (next_state = 'failed' and internal_error_code is not null)
    or (next_state <> 'failed' and internal_error_code is null)
  ),
  constraint privacy_context_events_error_code_format check (
    internal_error_code is null
    or internal_error_code ~ '^[a-z][a-z0-9_.-]{2,127}$'
  )
);

create index if not exists idx_privacy_contexts_state
  on privacy.request_contexts (state, updated_at, request_id);

create table if not exists privacy.retention_policies (
  policy_key text primary key,
  context_key text not null,
  retention_days integer not null,
  rolling_backup_days integer not null default 35,
  rationale text not null,
  effective_from timestamptz not null,
  enabled boolean not null default true,
  created_by_account_id uuid references identity.accounts(account_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint privacy_retention_policy_key_format check (
    policy_key ~ '^[a-z][a-z0-9_.-]{2,127}$'
  ),
  constraint privacy_retention_days_nonnegative check (retention_days >= 0),
  constraint privacy_retention_backup_boundary check (rolling_backup_days = 35),
  constraint privacy_retention_rationale_nonempty check (length(trim(rationale)) > 0)
);

create table if not exists privacy.holds (
  hold_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  request_id uuid references privacy.requests(request_id) on delete restrict,
  context_key text not null,
  basis text not null,
  state privacy.hold_state not null default 'active',
  version integer not null default 1,
  created_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  created_at timestamptz not null default now(),
  review_due_at timestamptz not null,
  released_by_account_id uuid references identity.accounts(account_id) on delete restrict,
  released_at timestamptz,
  release_reason text,
  constraint privacy_holds_context_key_format check (
    context_key ~ '^[a-z][a-z0-9_.-]{2,63}$'
  ),
  constraint privacy_holds_basis check (
    basis in ('legal_obligation', 'security_investigation', 'fraud_prevention')
  ),
  constraint privacy_holds_version_positive check (version >= 1),
  constraint privacy_holds_review_after_creation check (review_due_at > created_at),
  constraint privacy_holds_release_shape check (
    (state = 'active' and released_by_account_id is null and released_at is null and release_reason is null)
    or
    (state = 'released' and released_by_account_id is not null and released_at is not null
      and release_reason in ('basis_resolved', 'review_expired', 'superseded'))
  )
);

create unique index if not exists idx_privacy_holds_one_active_context
  on privacy.holds (account_id, context_key)
  where state = 'active';
create index if not exists idx_privacy_holds_active_review
  on privacy.holds (review_due_at, hold_id)
  where state = 'active';

create table if not exists privacy.hold_events (
  event_id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references privacy.holds(hold_id) on delete restrict,
  event_type text not null,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint privacy_hold_events_details_object check (jsonb_typeof(details) = 'object')
);

create table if not exists privacy.deletion_tombstones (
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  context_key text not null,
  request_id uuid not null references privacy.requests(request_id) on delete restrict,
  applied_at timestamptz not null default now(),
  last_replayed_at timestamptz,
  replay_count integer not null default 0,
  version integer not null default 1,
  primary key (account_id, context_key),
  constraint privacy_tombstone_replay_nonnegative check (replay_count >= 0),
  constraint privacy_tombstone_version_positive check (version >= 1)
);

create table if not exists privacy.audit_events (
  audit_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  subject_account_id uuid references identity.accounts(account_id) on delete restrict,
  request_id uuid references privacy.requests(request_id) on delete restrict,
  outcome text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint privacy_audit_event_type_nonempty check (length(trim(event_type)) > 0),
  constraint privacy_audit_outcome_nonempty check (length(trim(outcome)) > 0),
  constraint privacy_audit_details_object check (jsonb_typeof(details) = 'object')
);

create index if not exists idx_privacy_audit_subject_time
  on privacy.audit_events (subject_account_id, occurred_at desc);
create index if not exists idx_privacy_audit_actor_time
  on privacy.audit_events (actor_account_id, occurred_at desc);

create or replace function privacy.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_privacy_requests_updated_at on privacy.requests;
create trigger trg_privacy_requests_updated_at
before update on privacy.requests
for each row execute function privacy.set_updated_at();

drop trigger if exists trg_privacy_request_contexts_updated_at on privacy.request_contexts;
create trigger trg_privacy_request_contexts_updated_at
before update on privacy.request_contexts
for each row execute function privacy.set_updated_at();

create or replace function privacy.reject_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

do $append_only$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'request_events',
    'context_events',
    'hold_events',
    'audit_events'
  ] loop
    execute format(
      'drop trigger if exists %I on privacy.%I',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
    execute format(
      'create trigger %I before update or delete on privacy.%I '
      'for each row execute function privacy.reject_append_only_mutation()',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
  end loop;
end
$append_only$;

insert into privacy.retention_policies (
  policy_key, context_key, retention_days, rolling_backup_days, rationale, effective_from
) values
  (
    'privacy.export-artifact.v1', 'export_artifact', 1, 35,
    'Encrypted privacy exports expire no later than 24 hours after publication.', now()
  ),
  (
    'privacy.community-draft.v1', 'community_intake', 90, 35,
    'Unsubmitted contribution drafts retain a bounded recovery window.', now()
  ),
  (
    'privacy.notification-body.v1', 'notification', 90, 35,
    'Private notification bodies are replaced by minimal tombstones after expiry.', now()
  ),
  (
    'privacy.backup-boundary.v1', 'backup_tombstone', 35, 35,
    'Deletion tombstones must be reapplied to every restore within the rolling backup boundary.', now()
  )
on conflict (policy_key) do nothing;

revoke all on schema privacy from public;
revoke all on all tables in schema privacy from public;
revoke all on all sequences in schema privacy from public;
revoke all on all functions in schema privacy from public;
alter default privileges in schema privacy revoke all on tables from public;
alter default privileges in schema privacy revoke all on sequences from public;
alter default privileges in schema privacy revoke all on functions from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema privacy from %I', role_name);
      execute format('revoke all on all tables in schema privacy from %I', role_name);
      execute format('revoke all on all sequences in schema privacy from %I', role_name);
      execute format('revoke all on all functions in schema privacy from %I', role_name);
    end if;
  end loop;
end
$roles$;

comment on table privacy.requests is
  'Current privacy request projection. State changes are append-only in request_events.';
comment on table privacy.request_contexts is
  'Retryable per-context execution projection for one privacy request.';
comment on table privacy.deletion_tombstones is
  'Deletion facts reapplied after restore within the fixed 35-day backup boundary.';

commit;
