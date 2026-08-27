-- NestJS V2 downstream async/compliance modules.
-- V2 uses consumer-specific integration queues and new long-term domain tables so
-- legacy FastAPI workers cannot consume or mutate V2 work during the bounded migration.

begin;

create schema if not exists updates;
create schema if not exists notification;
create schema if not exists privacy;
create schema if not exists audit;

comment on schema updates is
  'Private Updates projection built asynchronously from immutable V2 publication events.';
comment on schema notification is
  'Private PandaAtlas Notification messages, preferences, provider jobs, and delivery evidence.';
comment on schema privacy is
  'Private PandaAtlas Privacy request orchestration and bounded export state.';
comment on schema audit is
  'Private append-only PandaAtlas Audit evidence projected from selected durable V2 integration events.';

-- Updates ---------------------------------------------------------------------

create table updates.items (
  update_id uuid primary key default gen_random_uuid(),
  source_event_id uuid not null unique references integration.outbox_events(event_id) on delete restrict,
  update_type text not null check (update_type in ('release_activated', 'release_rolled_back')),
  release_id uuid not null references publication.releases(release_id) on delete restrict,
  previous_release_id uuid references publication.releases(release_id) on delete restrict,
  release_version text not null check (length(trim(release_version)) between 1 and 80),
  occurred_at timestamptz not null,
  published_at timestamptz not null default now(),
  correlation_id uuid not null
);

create index idx_updates_items_public_order
  on updates.items(published_at desc, update_id desc);

create table updates.targets (
  update_id uuid not null references updates.items(update_id) on delete cascade,
  resource_kind text not null check (
    resource_kind in ('panda', 'institution', 'place', 'lineage', 'residency', 'life_event', 'media', 'evidence')
  ),
  resource_id text not null check (length(trim(resource_id)) between 1 and 512),
  change_type text not null check (change_type in ('added', 'changed', 'removed')),
  primary key (update_id, resource_kind, resource_id)
);

create index idx_updates_targets_resource
  on updates.targets(resource_kind, resource_id, update_id);

-- Notification ---------------------------------------------------------------
-- These V2 tables intentionally do not reuse legacy notification.intents or the
-- legacy notification_deliveries queue. That prevents V1 workers from claiming V2 work.

create table notification.channel_preferences (
  account_id uuid not null references identity.accounts(account_id) on delete cascade,
  category text not null check (category in ('knowledge_update', 'correction')),
  channel text not null check (channel in ('station', 'email')),
  enabled boolean not null,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  primary key (account_id, category, channel)
);

create table notification.messages (
  message_id uuid primary key default gen_random_uuid(),
  source_event_id uuid not null references integration.outbox_events(event_id) on delete restrict,
  account_id uuid not null references identity.accounts(account_id) on delete cascade,
  category text not null check (category in ('knowledge_update', 'correction')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  read_at timestamptz,
  unique (source_event_id, account_id),
  check (read_at is null or (seen_at is not null and read_at >= seen_at))
);

create index idx_notification_messages_account_time
  on notification.messages(account_id, created_at desc, message_id desc);
create index idx_notification_messages_unread
  on notification.messages(account_id, created_at desc)
  where read_at is null;

create table notification.message_channels (
  message_id uuid not null references notification.messages(message_id) on delete cascade,
  channel text not null check (channel in ('station', 'email')),
  state text not null check (state in ('ready', 'suppressed', 'submitted', 'dead_lettered')),
  suppression_reason text,
  updated_at timestamptz not null default now(),
  primary key (message_id, channel),
  check (
    (state = 'suppressed' and suppression_reason is not null)
    or (state <> 'suppressed' and suppression_reason is null)
  )
);

create table notification.provider_jobs (
  job_id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references notification.messages(message_id) on delete cascade,
  channel text not null default 'email' check (channel = 'email'),
  state text not null default 'pending' check (state in ('pending', 'retrying', 'submitted', 'dead_lettered', 'suppressed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  provider text,
  provider_message_id text,
  last_error_code text,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  dead_lettered_at timestamptz,
  suppressed_at timestamptz,
  check ((provider_message_id is null) or provider is not null),
  check ((state = 'submitted') = (submitted_at is not null)),
  check ((state = 'dead_lettered') = (dead_lettered_at is not null)),
  check ((state = 'suppressed') = (suppressed_at is not null))
);

create index idx_notification_provider_jobs_due
  on notification.provider_jobs(next_attempt_at, created_at, job_id)
  where state in ('pending', 'retrying');

create table notification.provider_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  job_id uuid not null references notification.provider_jobs(job_id) on delete restrict,
  attempt_number integer not null check (attempt_number >= 1),
  outcome text not null check (outcome in ('submitted', 'retry', 'dead_lettered')),
  provider text not null,
  provider_message_id text,
  error_code text,
  retryable boolean not null,
  latency_ms integer not null check (latency_ms >= 0),
  occurred_at timestamptz not null default now(),
  unique (job_id, attempt_number),
  check (
    (outcome = 'submitted' and provider_message_id is not null and error_code is null and not retryable)
    or (outcome <> 'submitted' and provider_message_id is null and error_code is not null)
  )
);

create table notification.provider_dead_letters (
  job_id uuid primary key references notification.provider_jobs(job_id) on delete restrict,
  final_error_code text not null,
  attempt_count integer not null check (attempt_count >= 1),
  dead_lettered_at timestamptz not null default now()
);

-- Privacy --------------------------------------------------------------------

create table privacy.subject_requests (
  request_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  kind text not null check (kind in ('access_export', 'account_deletion')),
  state text not null default 'pending' check (state in ('pending', 'processing', 'completed', 'failed')),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 200),
  correlation_id uuid not null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  unique (account_id, idempotency_key),
  check ((state = 'completed') = (completed_at is not null)),
  check ((state = 'failed') = (failed_at is not null and failure_code is not null))
);

create unique index idx_privacy_subject_requests_one_open_kind
  on privacy.subject_requests(account_id, kind)
  where state in ('pending', 'processing');
create index idx_privacy_subject_requests_due
  on privacy.subject_requests(state, requested_at, request_id)
  where state in ('pending', 'processing');

create table privacy.subject_request_steps (
  request_id uuid not null references privacy.subject_requests(request_id) on delete cascade,
  participant_key text not null check (participant_key ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  state text not null default 'pending' check (state in ('pending', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  updated_at timestamptz not null default now(),
  primary key (request_id, participant_key),
  check ((state = 'failed') = (last_error_code is not null))
);

create table privacy.export_snapshots (
  request_id uuid primary key references privacy.subject_requests(request_id) on delete cascade,
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create table privacy.subject_request_events (
  event_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references privacy.subject_requests(request_id) on delete restrict,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  previous_state text,
  next_state text not null,
  error_code text,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);

-- Audit ----------------------------------------------------------------------

create table audit.evidence_events (
  source_event_id uuid primary key references integration.outbox_events(event_id) on delete restrict,
  source_context text not null check (source_context ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  aggregate_type text not null check (length(trim(aggregate_type)) between 1 and 100),
  aggregate_id text not null check (length(trim(aggregate_id)) between 1 and 512),
  correlation_id uuid not null,
  occurred_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default now()
);

create index idx_audit_evidence_time
  on audit.evidence_events(occurred_at desc, source_event_id desc);
create index idx_audit_evidence_target
  on audit.evidence_events(aggregate_type, aggregate_id, occurred_at desc);
create index idx_audit_evidence_correlation
  on audit.evidence_events(correlation_id, occurred_at desc);

-- V2 provider queues are isolated from legacy FastAPI notification workers.
do $queues$
declare queue_name text;
begin
  if to_regprocedure('pgmq.create(text)') is not null then
    foreach queue_name in array array['notification_provider', 'notification_provider_dlq'] loop
      if to_regclass('pgmq.q_' || queue_name) is null then
        perform pgmq.create(queue_name);
      end if;
    end loop;
  end if;
end
$queues$;

-- Append-only evidence -------------------------------------------------------

create or replace function audit.reject_v2_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end
$function$;

create trigger audit_evidence_events_append_only
before update or delete on audit.evidence_events
for each row execute function audit.reject_v2_evidence_mutation();

create or replace function notification.reject_v2_attempt_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end
$function$;

create trigger notification_provider_attempts_append_only
before update or delete on notification.provider_attempts
for each row execute function notification.reject_v2_attempt_mutation();
create trigger notification_provider_dead_letters_append_only
before update or delete on notification.provider_dead_letters
for each row execute function notification.reject_v2_attempt_mutation();

create or replace function privacy.reject_v2_request_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end
$function$;

create trigger privacy_subject_request_events_append_only
before update or delete on privacy.subject_request_events
for each row execute function privacy.reject_v2_request_event_mutation();

-- Capabilities ---------------------------------------------------------------

insert into identity.capabilities (
  capability_key,
  description,
  sensitive,
  requires_recent_auth,
  minimum_aal,
  requires_live_session
) values
  ('notification.read', 'Read the signed-in account V2 notification inbox.', false, false, 'aal1', false),
  ('notification.manage', 'Manage the signed-in account V2 notification preferences and read state.', false, false, 'aal1', false),
  ('privacy.request.manage', 'Create and read the signed-in account privacy requests.', true, true, 'aal2', true),
  ('audit.read', 'Read selected V2 audit evidence.', true, true, 'aal1', false)
on conflict (capability_key) do update
set description = excluded.description,
    sensitive = excluded.sensitive,
    requires_recent_auth = excluded.requires_recent_auth,
    minimum_aal = excluded.minimum_aal,
    requires_live_session = excluded.requires_live_session;

insert into identity.role_capabilities (role_key, capability_key) values
  ('member', 'notification.read'),
  ('member', 'notification.manage'),
  ('member', 'privacy.request.manage'),
  ('archive_editor', 'audit.read'),
  ('senior_archive_editor', 'audit.read')
on conflict (role_key, capability_key) do nothing;

-- Database authority ---------------------------------------------------------

revoke all on schema updates, notification, privacy, audit from public, anon, authenticated;
revoke all on all tables in schema updates, notification, privacy, audit from public, anon, authenticated;
revoke all on all functions in schema updates, notification, privacy, audit from public, anon, authenticated;

 grant usage on schema updates, notification, privacy, audit to zhipanda_app;
 grant select, insert on updates.items, updates.targets to zhipanda_app;
 grant select, insert, update on notification.channel_preferences,
   notification.messages,
   notification.message_channels,
   notification.provider_jobs to zhipanda_app;
 grant select, insert on notification.provider_attempts, notification.provider_dead_letters to zhipanda_app;
 grant select, insert, update on privacy.subject_requests, privacy.subject_request_steps to zhipanda_app;
 grant select, insert, delete on privacy.export_snapshots to zhipanda_app;
 grant select, insert on privacy.subject_request_events to zhipanda_app;
 grant select, insert on audit.evidence_events to zhipanda_app;

commit;
