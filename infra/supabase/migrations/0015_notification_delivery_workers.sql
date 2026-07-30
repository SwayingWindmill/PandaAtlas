-- Durable Notification delivery workers, provider webhook evidence, and PGMQ queues.
-- FastAPI/PostgreSQL remain the sole authoritative write path; queue messages carry IDs only.

begin;

do $types$
begin
  if not exists (
    select 1
    from pg_type type
    join pg_namespace namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'notification'
      and type.typname = 'transport_job_state'
  ) then
    create type notification.transport_job_state as enum (
      'pending',
      'queued',
      'retrying',
      'submitted',
      'delivered',
      'failed',
      'dead_lettered',
      'suppressed'
    );
  end if;
end
$types$;

create table if not exists notification.transport_outbox_receipts (
  source_event_id uuid primary key
    references integration.outbox_events(event_id) on delete restrict,
  event_type text not null,
  outcome text not null
    check (outcome in ('queued', 'suppressed', 'ignored', 'duplicate')),
  delivery_id uuid,
  queue_message_id bigint,
  reason text,
  processed_at timestamptz not null default now(),
  correlation_id uuid not null,
  constraint notification_transport_receipt_event_type check (
    event_type in ('notification.intent.created', 'notification.digest.queued')
  )
);

create table if not exists notification.delivery_jobs (
  delivery_id uuid primary key,
  source_event_id uuid not null unique
    references integration.outbox_events(event_id) on delete restrict,
  account_id uuid not null
    references identity.accounts(account_id) on delete restrict,
  intent_id uuid
    references notification.intents(intent_id) on delete restrict,
  digest_batch_id uuid
    references notification.digest_batches(batch_id) on delete restrict,
  channel notification.channel not null default 'email',
  locale text not null check (locale in ('zh-CN', 'en')),
  template_key text not null check (template_key in ('intent', 'digest')),
  template_version integer not null default 1 check (template_version > 0),
  state notification.transport_job_state not null default 'pending',
  provider text,
  provider_message_id text,
  queue_message_id bigint,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  attempt_cycle_start integer not null default 0
    check (attempt_cycle_start >= 0 and attempt_cycle_start <= attempt_count),
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  dead_lettered_at timestamptz,
  suppressed_at timestamptz,
  updated_at timestamptz not null default now(),
  correlation_id uuid not null,
  constraint notification_delivery_job_one_target check (
    (intent_id is not null and digest_batch_id is null and template_key = 'intent')
    or (intent_id is null and digest_batch_id is not null and template_key = 'digest')
  ),
  constraint notification_delivery_job_email_only check (channel = 'email'),
  constraint notification_delivery_job_provider_pair check (
    provider_message_id is null or provider is not null
  )
);

create unique index if not exists idx_notification_delivery_job_intent_email
  on notification.delivery_jobs (intent_id, channel)
  where intent_id is not null;
create unique index if not exists idx_notification_delivery_job_digest_email
  on notification.delivery_jobs (digest_batch_id, channel)
  where digest_batch_id is not null;
create index if not exists idx_notification_delivery_job_state
  on notification.delivery_jobs (state, next_attempt_at, created_at, delivery_id);
create unique index if not exists idx_notification_delivery_job_provider_message
  on notification.delivery_jobs (provider, provider_message_id)
  where provider_message_id is not null;

create table if not exists notification.transport_attempts (
  transport_attempt_id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null
    references notification.delivery_jobs(delivery_id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  outcome text not null
    check (outcome in ('submitted', 'retry', 'failed', 'dead_lettered')),
  provider text not null,
  provider_message_id text,
  failure_code text,
  retryable boolean not null default false,
  provider_latency_ms integer not null check (provider_latency_ms >= 0),
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  constraint notification_transport_attempt_unique
    unique (delivery_id, attempt_number),
  constraint notification_transport_attempt_result check (
    (outcome = 'submitted' and provider_message_id is not null and failure_code is null)
    or (outcome <> 'submitted' and failure_code is not null)
  )
);

create table if not exists notification.provider_webhook_events (
  provider_event_id text primary key,
  provider text not null check (provider = 'resend'),
  event_type text not null,
  provider_message_id text,
  payload_hash text not null,
  minimal_payload jsonb not null default '{}'::jsonb,
  signature_verified boolean not null check (signature_verified),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text not null default 'queued'
    check (outcome in ('queued', 'processed', 'ignored', 'duplicate', 'failed')),
  correlation_id uuid not null,
  constraint notification_webhook_payload_hash
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint notification_webhook_minimal_object
    check (jsonb_typeof(minimal_payload) = 'object')
);

create index if not exists idx_notification_webhook_provider_message
  on notification.provider_webhook_events (provider_message_id, received_at)
  where provider_message_id is not null;

create table if not exists notification.email_suppressions (
  account_id uuid primary key
    references identity.accounts(account_id) on delete restrict,
  reason text not null check (reason in ('hard_bounce', 'complaint')),
  provider_event_id text not null
    references notification.provider_webhook_events(provider_event_id) on delete restrict,
  created_at timestamptz not null default now(),
  correlation_id uuid not null
);

create table if not exists notification.worker_events (
  worker_event_id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'retry_scheduled',
      'dead_lettered',
      'operator_requeued',
      'webhook_verification_failed'
    )
  ),
  delivery_id uuid,
  queue_name text not null,
  queue_message_id bigint,
  attempt_number integer,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  constraint notification_worker_event_details_object
    check (jsonb_typeof(details) = 'object')
);

create or replace function notification.reject_transport_append_only_mutation()
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
    'transport_outbox_receipts',
    'worker_events'
  ] loop
    execute format(
      'drop trigger if exists %I on notification.%I',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
    execute format(
      'create trigger %I before update or delete on notification.%I '
      || 'for each row execute function notification.reject_transport_append_only_mutation()',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
  end loop;
end
$append_only$;

create or replace function notification.protect_transport_attempt()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and exists (
    select 1
    from notification.delivery_jobs job
    join identity.accounts account on account.account_id = job.account_id
    where job.delivery_id = old.delivery_id
      and account.state = 'deleting'
  ) then
    return old;
  end if;
  raise exception 'TransportAttempt is immutable' using errcode = '55000';
end;
$$;

drop trigger if exists trg_transport_attempts_immutable
  on notification.transport_attempts;
create trigger trg_transport_attempts_immutable
  before update or delete on notification.transport_attempts
  for each row execute function notification.protect_transport_attempt();

do $queues$
declare
  queue_name text;
begin
  if to_regprocedure('pgmq.create(text)') is not null then
    foreach queue_name in array array[
      'notification_deliveries',
      'notification_deliveries_dlq',
      'notification_webhooks',
      'notification_webhooks_dlq'
    ] loop
      if to_regclass('pgmq.q_' || queue_name) is null then
        perform pgmq.create(queue_name);
      end if;
    end loop;
  end if;
end
$queues$;

revoke all on schema notification from public;
revoke all on all tables in schema notification from public;
revoke all on all sequences in schema notification from public;
revoke all on all functions in schema notification from public;
alter default privileges in schema notification revoke all on tables from public;
alter default privileges in schema notification revoke all on sequences from public;
alter default privileges in schema notification revoke all on functions from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format(
        'revoke all on all tables in schema notification from %I',
        role_name
      );
      execute format(
        'revoke all on all sequences in schema notification from %I',
        role_name
      );
      execute format(
        'revoke all on all functions in schema notification from %I',
        role_name
      );
      if to_regnamespace('pgmq') is not null then
        execute format('revoke all on schema pgmq from %I', role_name);
        execute format(
          'revoke all on all tables in schema pgmq from %I',
          role_name
        );
        execute format(
          'revoke all on all sequences in schema pgmq from %I',
          role_name
        );
        execute format(
          'revoke all on all functions in schema pgmq from %I',
          role_name
        );
      end if;
    end if;
  end loop;
end
$roles$;

commit;
