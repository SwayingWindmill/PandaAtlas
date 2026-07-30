-- PandaAtlas-owned Notification Intent, Inbox, preference, delivery, and Digest state.
-- FastAPI is the sole command authority; browser roles receive no grants.

begin;

create schema if not exists notification;
comment on schema notification is
  'Private Notification Intent, native Inbox, channel decision, delivery, Digest, and audit state.';

do $types$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'notification' and t.typname = 'category'
  ) then
    create type notification.category as enum (
      'birthday', 'major_activity', 'submission_status', 'incorporation',
      'correction_retraction', 'security_role'
    );
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'notification' and t.typname = 'channel'
  ) then
    create type notification.channel as enum ('station', 'email', 'web_push');
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'notification' and t.typname = 'intent_state'
  ) then
    create type notification.intent_state as enum ('active', 'retracted');
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'notification' and t.typname = 'delivery_state'
  ) then
    create type notification.delivery_state as enum (
      'pending', 'suppressed', 'queued', 'delivered', 'failed', 'retracted'
    );
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'notification' and t.typname = 'digest_frequency'
  ) then
    create type notification.digest_frequency as enum ('daily', 'weekly');
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'notification' and t.typname = 'digest_state'
  ) then
    create type notification.digest_state as enum (
      'building', 'queued', 'delivered', 'failed', 'retracted'
    );
  end if;
end
$types$;

create table if not exists notification.preferences (
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  category notification.category not null,
  channel notification.channel not null,
  enabled boolean not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (account_id, category, channel),
  constraint notification_security_preference check (
    category <> 'security_role' or enabled
  )
);

create table if not exists notification.preference_events (
  event_id uuid primary key default gen_random_uuid(),
  account_subject_hash text not null,
  category notification.category not null,
  channel notification.channel not null,
  enabled boolean not null,
  preference_version integer not null check (preference_version > 0),
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  correlation_id uuid not null,
  constraint notification_preference_subject_hash check (
    account_subject_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint notification_preference_event_idempotency unique (
    account_subject_hash, idempotency_key
  )
);

create table if not exists notification.source_receipts (
  source_event_id uuid primary key,
  event_type text not null,
  payload_hash text not null,
  outcome text not null check (
    outcome in ('created', 'updated', 'retracted', 'suppressed', 'ignored', 'duplicate')
  ),
  intent_count integer not null default 0 check (intent_count >= 0),
  suppression_reason text,
  correlation_id uuid not null,
  processed_at timestamptz not null default now(),
  constraint notification_receipt_event_type check (
    event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'
  ),
  constraint notification_receipt_payload_hash check (
    payload_hash ~ '^[a-f0-9]{64}$'
  )
);

create table if not exists notification.intents (
  intent_id uuid primary key default gen_random_uuid(),
  logical_key text not null unique,
  source_event_id uuid not null,
  source_event_type text not null,
  source_context text not null,
  source_id text not null,
  source_version integer,
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  category notification.category not null,
  mandatory boolean not null default false,
  audience_snapshot jsonb not null,
  preference_snapshot jsonb not null,
  content_snapshot jsonb not null,
  state notification.intent_state not null default 'active',
  created_at timestamptz not null default now(),
  retracted_at timestamptz,
  retraction_reason text,
  correlation_id uuid not null,
  constraint notification_intent_source_event_type check (
    source_event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'
  ),
  constraint notification_intent_snapshots_object check (
    jsonb_typeof(audience_snapshot) = 'object'
    and jsonb_typeof(preference_snapshot) = 'object'
    and jsonb_typeof(content_snapshot) = 'object'
  ),
  constraint notification_intent_state_consistency check (
    (state = 'active' and retracted_at is null and retraction_reason is null)
    or (state = 'retracted' and retracted_at is not null and retraction_reason is not null)
  )
);

create table if not exists notification.intent_channels (
  intent_id uuid not null references notification.intents(intent_id) on delete restrict,
  channel notification.channel not null,
  enabled boolean not null,
  decision text not null check (
    decision in ('mandatory', 'default', 'preference', 'suppressed')
  ),
  suppression_reason text,
  preference_version integer,
  delivery_state notification.delivery_state not null,
  decided_at timestamptz not null default now(),
  queued_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  primary key (intent_id, channel),
  constraint notification_channel_decision_consistency check (
    delivery_state = 'retracted'
    or (enabled and suppression_reason is null and delivery_state <> 'suppressed')
    or (not enabled and suppression_reason is not null and delivery_state = 'suppressed')
  )
);

create table if not exists notification.inbox_items (
  inbox_item_id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references notification.intents(intent_id) on delete restrict,
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  category notification.category not null,
  body jsonb not null,
  body_version integer not null default 1 check (body_version > 0),
  created_at timestamptz not null default now(),
  body_expires_at timestamptz not null default (now() + interval '90 days'),
  body_purged_at timestamptz,
  seen_at timestamptz,
  read_at timestamptz,
  retracted_at timestamptz,
  retraction_reason text,
  updated_at timestamptz not null default now(),
  constraint notification_inbox_body_object check (jsonb_typeof(body) = 'object'),
  constraint notification_inbox_body_retention check (
    body_expires_at > created_at and body_expires_at <= created_at + interval '90 days'
  ),
  constraint notification_inbox_read_consistency check (
    read_at is null or (seen_at is not null and read_at >= seen_at)
  ),
  constraint notification_inbox_retraction_consistency check (
    (retracted_at is null and retraction_reason is null)
    or (retracted_at is not null and retraction_reason is not null)
  )
);

create table if not exists notification.inbox_state_events (
  state_event_id uuid primary key default gen_random_uuid(),
  inbox_item_id uuid,
  account_subject_hash text not null,
  action text not null check (
    action in ('seen', 'read', 'read_all', 'body_purged', 'retracted')
  ),
  affected_count integer not null default 1 check (affected_count >= 0),
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  correlation_id uuid not null,
  constraint notification_inbox_state_subject_hash check (
    account_subject_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint notification_inbox_state_idempotency unique (
    account_subject_hash, idempotency_key
  )
);

create table if not exists notification.delivery_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references notification.intents(intent_id) on delete restrict,
  channel notification.channel not null,
  attempt_number integer not null check (attempt_number > 0),
  idempotency_key text not null,
  state notification.delivery_state not null,
  provider text,
  provider_message_id text,
  failure_code text,
  failure_detail text,
  attempted_at timestamptz not null default now(),
  correlation_id uuid not null,
  constraint notification_delivery_attempt_unique unique (
    intent_id, channel, attempt_number
  ),
  constraint notification_delivery_attempt_idempotency unique (
    intent_id, channel, idempotency_key
  )
);

create table if not exists notification.digest_batches (
  batch_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  frequency notification.digest_frequency not null,
  state notification.digest_state not null default 'building',
  locale text not null check (locale in ('zh-CN', 'en')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  content jsonb not null,
  content_version integer not null default 1 check (content_version > 0),
  idempotency_key text not null,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  retracted_at timestamptz,
  constraint notification_digest_content_object check (jsonb_typeof(content) = 'object'),
  constraint notification_digest_period check (period_end > period_start),
  constraint notification_digest_idempotency unique (account_id, idempotency_key),
  constraint notification_digest_state_consistency check (
    (state = 'building' and queued_at is null)
    or (state = 'queued' and queued_at is not null)
    or (state = 'delivered' and queued_at is not null and delivered_at is not null)
    or (state = 'failed' and queued_at is not null and failed_at is not null)
    or (state = 'retracted' and queued_at is not null and retracted_at is not null)
  )
);

create table if not exists notification.digest_items (
  batch_id uuid not null references notification.digest_batches(batch_id) on delete restrict,
  intent_id uuid not null references notification.intents(intent_id) on delete restrict,
  ordinal integer not null check (ordinal > 0),
  content_snapshot jsonb not null,
  primary key (batch_id, intent_id),
  constraint notification_digest_item_ordinal unique (batch_id, ordinal),
  constraint notification_digest_item_content_object check (
    jsonb_typeof(content_snapshot) = 'object'
  )
);

create table if not exists notification.audit_events (
  audit_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_subject_hash text,
  subject_account_hash text,
  target_type text not null,
  target_id text not null,
  outcome text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null,
  constraint notification_audit_event_type check (
    event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'
  ),
  constraint notification_audit_actor_hash check (
    actor_subject_hash is null or actor_subject_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint notification_audit_subject_hash check (
    subject_account_hash is null or subject_account_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint notification_audit_details_object check (jsonb_typeof(details) = 'object'),
  constraint notification_audit_idempotency unique (event_type, idempotency_key)
);

create index if not exists idx_notification_intents_account_created
  on notification.intents (account_id, created_at desc, intent_id desc);
create index if not exists idx_notification_intents_source
  on notification.intents (source_context, source_id, account_id, category);
create index if not exists idx_notification_inbox_account_created
  on notification.inbox_items (account_id, created_at desc, inbox_item_id desc);
create index if not exists idx_notification_inbox_unread
  on notification.inbox_items (account_id, read_at, created_at desc)
  where read_at is null;
create index if not exists idx_notification_inbox_retention
  on notification.inbox_items (body_expires_at)
  where body_purged_at is null;
create index if not exists idx_notification_channels_state
  on notification.intent_channels (channel, delivery_state, decided_at);
create index if not exists idx_notification_digest_account_period
  on notification.digest_batches (account_id, period_end desc, batch_id);

create or replace function notification.reject_append_only_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

do $append_only$
declare relation_name text;
begin
  foreach relation_name in array array[
    'preference_events', 'source_receipts', 'inbox_state_events', 'audit_events'
  ] loop
    execute format(
      'drop trigger if exists %I on notification.%I',
      'trg_' || relation_name || '_append_only', relation_name
    );
    execute format(
      'create trigger %I before update or delete on notification.%I for each row execute function notification.reject_append_only_mutation()',
      'trg_' || relation_name || '_append_only', relation_name
    );
  end loop;
end
$append_only$;

create or replace function notification.protect_queued_digest()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from identity.accounts
      where account_id = old.account_id and state = 'deleting'
    ) then
      return old;
    end if;
    raise exception 'queued DigestBatch is immutable' using errcode = '55000';
  end if;
  if old.state <> 'building' then
    if new.account_id <> old.account_id
      or new.frequency <> old.frequency
      or new.locale <> old.locale
      or new.period_start <> old.period_start
      or new.period_end <> old.period_end
      or new.content <> old.content
      or new.content_version <> old.content_version
      or new.idempotency_key <> old.idempotency_key then
      raise exception 'queued DigestBatch content is immutable' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_digest_batches_immutable on notification.digest_batches;
create trigger trg_digest_batches_immutable
  before update or delete on notification.digest_batches
  for each row execute function notification.protect_queued_digest();

create or replace function notification.protect_delivery_attempt()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and exists (
    select 1
    from notification.intents intent
    join identity.accounts account on account.account_id = intent.account_id
    where intent.intent_id = old.intent_id and account.state = 'deleting'
  ) then
    return old;
  end if;
  raise exception 'DeliveryAttempt is immutable' using errcode = '55000';
end;
$$;

drop trigger if exists trg_delivery_attempts_immutable on notification.delivery_attempts;
create trigger trg_delivery_attempts_immutable
  before update or delete on notification.delivery_attempts
  for each row execute function notification.protect_delivery_attempt();

create or replace function notification.protect_digest_item()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and exists (
    select 1
    from notification.digest_batches batch
    join identity.accounts account on account.account_id = batch.account_id
    where batch.batch_id = old.batch_id and account.state = 'deleting'
  ) then
    return old;
  end if;
  raise exception 'DigestItem is immutable' using errcode = '55000';
end;
$$;

drop trigger if exists trg_digest_items_immutable on notification.digest_items;
create trigger trg_digest_items_immutable
  before update or delete on notification.digest_items
  for each row execute function notification.protect_digest_item();

insert into notification.preferences (account_id, category, channel, enabled, version, updated_at)
select
  account_id,
  case category
    when 'birthday' then 'birthday'::notification.category
    when 'major_activity' then 'major_activity'::notification.category
    when 'submission_status' then 'submission_status'::notification.category
    when 'incorporation' then 'incorporation'::notification.category
    when 'correction_retraction' then 'correction_retraction'::notification.category
    when 'security_role' then 'security_role'::notification.category
  end,
  channel::text::notification.channel,
  case when category = 'security_role' then true else enabled end,
  version,
  updated_at
from engagement.notification_preferences
where category in (
  'birthday', 'major_activity', 'submission_status', 'incorporation',
  'correction_retraction', 'security_role'
)
on conflict (account_id, category, channel) do nothing;

revoke all on schema notification from public;
revoke all on all tables in schema notification from public;
revoke all on all sequences in schema notification from public;
revoke all on all functions in schema notification from public;
alter default privileges in schema notification revoke all on tables from public;
alter default privileges in schema notification revoke all on sequences from public;
alter default privileges in schema notification revoke all on functions from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema notification from %I', role_name);
      execute format('revoke all on all tables in schema notification from %I', role_name);
      execute format('revoke all on all sequences in schema notification from %I', role_name);
      execute format('revoke all on all functions in schema notification from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
