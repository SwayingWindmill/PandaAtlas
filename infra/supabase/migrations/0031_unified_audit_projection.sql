-- Unified, append-only Audit projection and integrity evidence.
-- Source-context audit tables remain authoritative; this schema is read-only evidence.

begin;

create schema if not exists audit;
comment on schema audit is
  'Private unified audit projection, sensitive-read evidence, integrity summaries, and metrics.';

create table if not exists audit.event_facts (
  event_id uuid primary key default gen_random_uuid(),
  source_context text not null,
  source_event_id uuid not null,
  event_class text not null default 'domain',
  actor_account_id uuid references identity.accounts(account_id) on delete set null,
  actor_subject_hash text,
  subject_account_id uuid references identity.accounts(account_id) on delete set null,
  actor_role_snapshot jsonb not null default '[]'::jsonb,
  action text not null,
  target_type text not null,
  target_id text not null,
  request_id text,
  idempotency_key text,
  correlation_id uuid not null,
  reason text not null,
  result text not null,
  related_case_id text,
  related_release_id text,
  before_version text,
  after_version text,
  diff_hash text,
  details_hash text not null,
  sensitive_read boolean not null default false,
  bulk_count integer not null default 1,
  occurred_at timestamptz not null,
  projected_at timestamptz not null default now(),
  constraint audit_event_source_context_format check (
    source_context ~ '^[a-z][a-z0-9_.-]{1,63}$'
  ),
  constraint audit_event_class_check check (
    event_class in ('domain', 'sensitive_read', 'export', 'integrity', 'correction')
  ),
  constraint audit_event_actor_hash check (
    actor_subject_hash is null or actor_subject_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint audit_event_role_snapshot_array check (
    jsonb_typeof(actor_role_snapshot) = 'array'
  ),
  constraint audit_event_action_nonempty check (length(trim(action)) between 3 and 160),
  constraint audit_event_target_type_nonempty check (length(trim(target_type)) between 1 and 100),
  constraint audit_event_target_id_nonempty check (length(trim(target_id)) between 1 and 255),
  constraint audit_event_reason_nonempty check (length(trim(reason)) between 3 and 1000),
  constraint audit_event_result_nonempty check (length(trim(result)) between 1 and 100),
  constraint audit_event_details_hash check (details_hash ~ '^[0-9a-f]{64}$'),
  constraint audit_event_diff_hash check (
    diff_hash is null or diff_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint audit_event_bulk_count_positive check (bulk_count > 0),
  constraint audit_event_source_unique unique (source_context, source_event_id)
);

create table if not exists audit.rejected_payloads (
  rejection_id uuid primary key default gen_random_uuid(),
  source_context text not null,
  action text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  rejection_code text not null,
  actor_account_id uuid references identity.accounts(account_id) on delete set null,
  actor_subject_hash text,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  constraint audit_rejected_actor_hash check (
    actor_subject_hash is null or actor_subject_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint audit_rejected_code_format check (
    rejection_code ~ '^[a-z][a-z0-9_.-]{2,127}$'
  )
);

create table if not exists audit.integrity_summaries (
  summary_id uuid primary key default gen_random_uuid(),
  range_started_at timestamptz not null,
  range_ended_at timestamptz not null,
  event_count bigint not null check (event_count >= 0),
  digest_sha256 text not null check (digest_sha256 ~ '^[0-9a-f]{64}$'),
  previous_digest_sha256 text check (
    previous_digest_sha256 is null or previous_digest_sha256 ~ '^[0-9a-f]{64}$'
  ),
  generated_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  generated_at timestamptz not null default now(),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint audit_integrity_range check (range_ended_at > range_started_at)
);

create table if not exists audit.integrity_checks (
  check_id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references audit.integrity_summaries(summary_id) on delete restrict,
  expected_digest_sha256 text not null check (expected_digest_sha256 ~ '^[0-9a-f]{64}$'),
  actual_digest_sha256 text not null check (actual_digest_sha256 ~ '^[0-9a-f]{64}$'),
  matched boolean not null,
  checked_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  checked_at timestamptz not null default now(),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  correlation_id uuid not null,
  idempotency_key text not null unique
);

create index if not exists idx_audit_events_time
  on audit.event_facts (occurred_at desc, event_id desc);
create index if not exists idx_audit_events_context_action
  on audit.event_facts (source_context, action, occurred_at desc);
create index if not exists idx_audit_events_actor
  on audit.event_facts (actor_account_id, occurred_at desc)
  where actor_account_id is not null;
create index if not exists idx_audit_events_target
  on audit.event_facts (target_type, target_id, occurred_at desc);
create index if not exists idx_audit_events_correlation
  on audit.event_facts (correlation_id, occurred_at desc);
create index if not exists idx_audit_events_sensitive
  on audit.event_facts (occurred_at desc)
  where sensitive_read;
create index if not exists idx_audit_rejected_time
  on audit.rejected_payloads (occurred_at desc);
create index if not exists idx_audit_integrity_range
  on audit.integrity_summaries (range_started_at, range_ended_at, generated_at desc);

create or replace function audit.reject_append_only_mutation()
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
    'event_facts',
    'rejected_payloads',
    'integrity_summaries',
    'integrity_checks'
  ] loop
    execute format(
      'drop trigger if exists %I on audit.%I',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
    execute format(
      'create trigger %I before update or delete on audit.%I '
      'for each row execute function audit.reject_append_only_mutation()',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
  end loop;
end
$append_only$;

create or replace function audit.role_snapshot(
  account_id_value uuid,
  occurred_at_value timestamptz
)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role_key', assignment.role_key,
        'assignment_id', assignment.assignment_id::text
      ) order by assignment.role_key, assignment.assignment_id
    ),
    '[]'::jsonb
  )
  from identity.role_assignments assignment
  where assignment.account_id = account_id_value
    and assignment.assigned_at <= occurred_at_value
    and (assignment.expires_at is null or assignment.expires_at > occurred_at_value)
    and not exists (
      select 1
      from identity.role_assignment_revocations revocation
      where revocation.assignment_id = assignment.assignment_id
        and revocation.revoked_at <= occurred_at_value
    );
$$;

create or replace function audit.json_hash(payload jsonb)
returns text
language sql
immutable
as $$
  select encode(digest(coalesce(payload, '{}'::jsonb)::text, 'sha256'), 'hex');
$$;

create or replace function audit.project_identity_authorization()
returns trigger
language plpgsql
as $$
begin
  insert into audit.event_facts (
    source_context, source_event_id, actor_account_id, subject_account_id,
    actor_role_snapshot, action, target_type, target_id, correlation_id,
    reason, result, details_hash, occurred_at
  ) values (
    'identity', new.audit_id, new.actor_account_id, new.subject_account_id,
    audit.role_snapshot(new.actor_account_id, new.occurred_at),
    new.event_type,
    case
      when new.capability_key is not null then 'capability'
      when new.role_key is not null then 'role'
      when new.subject_account_id is not null then 'account'
      else 'authorization'
    end,
    coalesce(
      new.capability_key,
      new.role_key,
      new.subject_account_id::text,
      new.assignment_id::text,
      'authorization'
    ),
    new.correlation_id,
    coalesce(nullif(trim(new.reason), ''), 'reason-not-recorded'),
    new.outcome,
    audit.json_hash(new.details),
    new.occurred_at
  ) on conflict (source_context, source_event_id) do nothing;
  return new;
end;
$$;

create or replace function audit.project_engagement()
returns trigger
language plpgsql
as $$
begin
  insert into audit.event_facts (
    source_context, source_event_id, actor_account_id, subject_account_id,
    actor_role_snapshot, action, target_type, target_id, idempotency_key,
    correlation_id, reason, result, details_hash, occurred_at
  ) values (
    'engagement', new.audit_id, new.actor_account_id, new.subject_account_id,
    audit.role_snapshot(new.actor_account_id, new.occurred_at),
    new.event_type, new.target_type, new.target_id, new.idempotency_key,
    new.correlation_id,
    coalesce(nullif(trim(new.reason), ''), 'reason-not-recorded'),
    new.outcome,
    audit.json_hash(new.details),
    new.occurred_at
  ) on conflict (source_context, source_event_id) do nothing;
  return new;
end;
$$;

create or replace function audit.project_activity()
returns trigger
language plpgsql
as $$
begin
  insert into audit.event_facts (
    source_context, source_event_id, actor_account_id, actor_role_snapshot,
    action, target_type, target_id, correlation_id, reason, result,
    details_hash, occurred_at
  ) values (
    'activity', new.event_id, new.actor_account_id,
    audit.role_snapshot(new.actor_account_id, new.occurred_at),
    new.event_type, new.target_type, new.target_id, new.correlation_id,
    coalesce(nullif(trim(new.reason), ''), 'reason-not-recorded'),
    'succeeded', audit.json_hash(new.details), new.occurred_at
  ) on conflict (source_context, source_event_id) do nothing;
  return new;
end;
$$;

create or replace function audit.project_notification()
returns trigger
language plpgsql
as $$
begin
  insert into audit.event_facts (
    source_context, source_event_id, actor_subject_hash, action,
    target_type, target_id, idempotency_key, correlation_id, reason,
    result, details_hash, occurred_at
  ) values (
    'notification', new.audit_id, new.actor_subject_hash, new.event_type,
    new.target_type, new.target_id, new.idempotency_key, new.correlation_id,
    coalesce(nullif(trim(new.reason), ''), 'reason-not-recorded'),
    new.outcome, audit.json_hash(new.details), new.occurred_at
  ) on conflict (source_context, source_event_id) do nothing;
  return new;
end;
$$;

create or replace function audit.project_community_intake()
returns trigger
language plpgsql
as $$
begin
  insert into audit.event_facts (
    source_context, source_event_id, actor_subject_hash, action,
    target_type, target_id, idempotency_key, correlation_id, reason,
    result, related_case_id, details_hash, occurred_at
  ) values (
    'community_intake', new.audit_event_id, new.actor_subject_hash, new.event_type,
    new.target_type, new.target_id, new.idempotency_key, new.correlation_id,
    coalesce(nullif(trim(new.reason), ''), 'reason-not-recorded'),
    new.outcome, new.submission_id::text, audit.json_hash(new.details), new.occurred_at
  ) on conflict (source_context, source_event_id) do nothing;
  return new;
end;
$$;

create or replace function audit.project_review_moderation()
returns trigger
language plpgsql
as $$
begin
  insert into audit.event_facts (
    source_context, source_event_id, actor_account_id, actor_role_snapshot,
    action, target_type, target_id, idempotency_key, correlation_id,
    reason, result, related_case_id, details_hash, occurred_at
  ) values (
    'review_moderation', new.audit_event_id, new.actor_account_id,
    audit.role_snapshot(new.actor_account_id, new.occurred_at),
    new.event_type,
    case when new.review_case_id is not null then 'review_case' else 'submission' end,
    coalesce(new.review_case_id::text, new.submission_id::text, 'review'),
    new.idempotency_key, new.correlation_id,
    coalesce(nullif(trim(new.reason), ''), 'reason-not-recorded'),
    new.outcome, new.review_case_id::text, audit.json_hash(new.details), new.occurred_at
  ) on conflict (source_context, source_event_id) do nothing;
  return new;
end;
$$;

create or replace function audit.project_archive()
returns trigger
language plpgsql
as $$
begin
  insert into audit.event_facts (
    source_context, source_event_id, actor_account_id, actor_role_snapshot,
    action, target_type, target_id, idempotency_key, correlation_id,
    reason, result, related_release_id, before_version, after_version,
    diff_hash, details_hash, occurred_at
  ) values (
    'archive', new.id, new.actor_id,
    audit.role_snapshot(new.actor_id, new.occurred_at),
    new.event_type, new.subject_type, new.subject_id::text,
    new.metadata ->> 'idempotency_key',
    coalesce(new.correlation_id, gen_random_uuid()),
    coalesce(nullif(trim(new.reason), ''), 'reason-not-recorded'),
    coalesce(new.metadata ->> 'outcome', 'succeeded'),
    coalesce(new.metadata ->> 'release_version', new.metadata ->> 'release_id'),
    new.metadata ->> 'before_version',
    new.metadata ->> 'after_version',
    case
      when coalesce(new.metadata ->> 'diff_hash', '') ~ '^[0-9a-f]{64}$'
        then new.metadata ->> 'diff_hash'
      else null
    end,
    audit.json_hash(new.metadata),
    new.occurred_at
  ) on conflict (source_context, source_event_id) do nothing;
  return new;
end;
$$;

insert into audit.event_facts (
  source_context, source_event_id, actor_account_id, subject_account_id,
  actor_role_snapshot, action, target_type, target_id, correlation_id,
  reason, result, details_hash, occurred_at
)
select
  'identity', event.audit_id, event.actor_account_id, event.subject_account_id,
  audit.role_snapshot(event.actor_account_id, event.occurred_at),
  event.event_type,
  case
    when event.capability_key is not null then 'capability'
    when event.role_key is not null then 'role'
    when event.subject_account_id is not null then 'account'
    else 'authorization'
  end,
  coalesce(
    event.capability_key,
    event.role_key,
    event.subject_account_id::text,
    event.assignment_id::text,
    'authorization'
  ),
  event.correlation_id,
  coalesce(nullif(trim(event.reason), ''), 'reason-not-recorded'),
  event.outcome,
  audit.json_hash(event.details),
  event.occurred_at
from identity.authorization_audit_events event
on conflict (source_context, source_event_id) do nothing;

insert into audit.event_facts (
  source_context, source_event_id, actor_account_id, subject_account_id,
  actor_role_snapshot, action, target_type, target_id, idempotency_key,
  correlation_id, reason, result, details_hash, occurred_at
)
select
  'engagement', event.audit_id, event.actor_account_id, event.subject_account_id,
  audit.role_snapshot(event.actor_account_id, event.occurred_at),
  event.event_type, event.target_type, event.target_id, event.idempotency_key,
  event.correlation_id,
  coalesce(nullif(trim(event.reason), ''), 'reason-not-recorded'),
  event.outcome, audit.json_hash(event.details), event.occurred_at
from engagement.audit_events event
on conflict (source_context, source_event_id) do nothing;

insert into audit.event_facts (
  source_context, source_event_id, actor_account_id, actor_role_snapshot,
  action, target_type, target_id, correlation_id, reason, result,
  details_hash, occurred_at
)
select
  'activity', event.event_id, event.actor_account_id,
  audit.role_snapshot(event.actor_account_id, event.occurred_at),
  event.event_type, event.target_type, event.target_id, event.correlation_id,
  coalesce(nullif(trim(event.reason), ''), 'reason-not-recorded'),
  'succeeded', audit.json_hash(event.details), event.occurred_at
from activity.audit_events event
on conflict (source_context, source_event_id) do nothing;

insert into audit.event_facts (
  source_context, source_event_id, actor_subject_hash, action,
  target_type, target_id, idempotency_key, correlation_id, reason,
  result, details_hash, occurred_at
)
select
  'notification', event.audit_id, event.actor_subject_hash, event.event_type,
  event.target_type, event.target_id, event.idempotency_key, event.correlation_id,
  coalesce(nullif(trim(event.reason), ''), 'reason-not-recorded'),
  event.outcome, audit.json_hash(event.details), event.occurred_at
from notification.audit_events event
on conflict (source_context, source_event_id) do nothing;

insert into audit.event_facts (
  source_context, source_event_id, actor_subject_hash, action,
  target_type, target_id, idempotency_key, correlation_id, reason,
  result, related_case_id, details_hash, occurred_at
)
select
  'community_intake', event.audit_event_id, event.actor_subject_hash, event.event_type,
  event.target_type, event.target_id, event.idempotency_key, event.correlation_id,
  coalesce(nullif(trim(event.reason), ''), 'reason-not-recorded'),
  event.outcome, event.submission_id::text, audit.json_hash(event.details), event.occurred_at
from community_intake.audit_events event
on conflict (source_context, source_event_id) do nothing;

insert into audit.event_facts (
  source_context, source_event_id, actor_account_id, actor_role_snapshot,
  action, target_type, target_id, idempotency_key, correlation_id,
  reason, result, related_case_id, details_hash, occurred_at
)
select
  'review_moderation', event.audit_event_id, event.actor_account_id,
  audit.role_snapshot(event.actor_account_id, event.occurred_at),
  event.event_type,
  case when event.review_case_id is not null then 'review_case' else 'submission' end,
  coalesce(event.review_case_id::text, event.submission_id::text, 'review'),
  event.idempotency_key, event.correlation_id,
  coalesce(nullif(trim(event.reason), ''), 'reason-not-recorded'),
  event.outcome, event.review_case_id::text, audit.json_hash(event.details), event.occurred_at
from review_moderation.audit_events event
on conflict (source_context, source_event_id) do nothing;

insert into audit.event_facts (
  source_context, source_event_id, actor_account_id, actor_role_snapshot,
  action, target_type, target_id, idempotency_key, correlation_id,
  reason, result, related_release_id, before_version, after_version,
  diff_hash, details_hash, occurred_at
)
select
  'archive', event.id, event.actor_id,
  audit.role_snapshot(event.actor_id, event.occurred_at),
  event.event_type, event.subject_type, event.subject_id::text,
  event.metadata ->> 'idempotency_key',
  coalesce(event.correlation_id, gen_random_uuid()),
  coalesce(nullif(trim(event.reason), ''), 'reason-not-recorded'),
  coalesce(event.metadata ->> 'outcome', 'succeeded'),
  coalesce(event.metadata ->> 'release_version', event.metadata ->> 'release_id'),
  event.metadata ->> 'before_version',
  event.metadata ->> 'after_version',
  case
    when coalesce(event.metadata ->> 'diff_hash', '') ~ '^[0-9a-f]{64}$'
      then event.metadata ->> 'diff_hash'
    else null
  end,
  audit.json_hash(event.metadata),
  event.occurred_at
from public.audit_events event
on conflict (source_context, source_event_id) do nothing;

drop trigger if exists trg_audit_project_identity on identity.authorization_audit_events;
create trigger trg_audit_project_identity
after insert on identity.authorization_audit_events
for each row execute function audit.project_identity_authorization();

drop trigger if exists trg_audit_project_engagement on engagement.audit_events;
create trigger trg_audit_project_engagement
after insert on engagement.audit_events
for each row execute function audit.project_engagement();

drop trigger if exists trg_audit_project_activity on activity.audit_events;
create trigger trg_audit_project_activity
after insert on activity.audit_events
for each row execute function audit.project_activity();

drop trigger if exists trg_audit_project_notification on notification.audit_events;
create trigger trg_audit_project_notification
after insert on notification.audit_events
for each row execute function audit.project_notification();

drop trigger if exists trg_audit_project_community on community_intake.audit_events;
create trigger trg_audit_project_community
after insert on community_intake.audit_events
for each row execute function audit.project_community_intake();

drop trigger if exists trg_audit_project_review on review_moderation.audit_events;
create trigger trg_audit_project_review
after insert on review_moderation.audit_events
for each row execute function audit.project_review_moderation();

drop trigger if exists trg_audit_project_archive on public.audit_events;
create trigger trg_audit_project_archive
after insert on public.audit_events
for each row execute function audit.project_archive();

insert into identity.capabilities (capability_key, description, sensitive) values
  ('audit.read', 'Search the unified read-only Audit projection.', true),
  ('audit.integrity.manage', 'Generate and verify Audit integrity summaries.', true)
on conflict (capability_key) do nothing;

insert into identity.roles (role_key, display_name, description, is_staff) values
  ('audit_reader', 'Audit Reader', 'May search unified Audit evidence but cannot export it.', true)
on conflict (role_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('audit_reader', 'account.session.read'),
  ('audit_reader', 'admin.shell.access'),
  ('audit_reader', 'audit.read'),
  ('audit_exporter', 'audit.read'),
  ('audit_exporter', 'audit.integrity.manage')
on conflict (role_key, capability_key) do nothing;

comment on table audit.event_facts is
  'Append-only normalized Audit projection. It is evidence, not a business-state recovery source.';
comment on column audit.event_facts.details_hash is
  'SHA-256 of source-context details; raw source payload is not copied into the projection.';
comment on table audit.integrity_summaries is
  'Append-only chained SHA-256 summaries over deterministic Audit event windows.';

revoke all on schema audit from public;
revoke all on all tables in schema audit from public;
revoke all on all sequences in schema audit from public;
revoke all on all functions in schema audit from public;
alter default privileges in schema audit revoke all on tables from public;
alter default privileges in schema audit revoke all on sequences from public;
alter default privileges in schema audit revoke all on functions from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema audit from %I', role_name);
      execute format('revoke all on all tables in schema audit from %I', role_name);
      execute format('revoke all on all sequences in schema audit from %I', role_name);
      execute format('revoke all on all functions in schema audit from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
