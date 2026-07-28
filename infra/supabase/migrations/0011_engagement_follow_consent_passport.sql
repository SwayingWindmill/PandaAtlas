-- Private Identity & Engagement state for Pending Follow, Follow, consent, and Passport.
-- FastAPI is the sole command authority; browser roles receive no grants.

begin;

create schema if not exists engagement;
comment on schema engagement is
  'Private Pending Follow, Follow, consent, Passport, and engagement audit state.';

do $types$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'engagement' and t.typname = 'pending_follow_status'
  ) then
    create type engagement.pending_follow_status as enum (
      'pending', 'completed', 'cancelled', 'expired'
    );
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'engagement' and t.typname = 'pending_follow_outcome'
  ) then
    create type engagement.pending_follow_outcome as enum (
      'followed', 'already_followed', 'cancelled', 'intent_expired'
    );
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'engagement' and t.typname = 'follow_state'
  ) then
    create type engagement.follow_state as enum ('active', 'inactive');
  end if;
end
$types$;

create table if not exists engagement.pending_follow_intents (
  intent_id uuid primary key default gen_random_uuid(),
  handle_hash text not null unique,
  continuation_handle_hash text unique,
  panda_id text not null,
  locale text not null,
  safe_return_path text not null,
  status engagement.pending_follow_status not null default 'pending',
  outcome engagement.pending_follow_outcome,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  completed_by_account_id uuid references identity.accounts(account_id) on delete set null,
  request_id uuid not null,
  correlation_id uuid not null,
  version integer not null default 1 check (version > 0),
  constraint engagement_pending_handle_hash check (handle_hash ~ '^[a-f0-9]{64}$'),
  constraint engagement_pending_continuation_hash check (
    continuation_handle_hash is null or continuation_handle_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint engagement_pending_panda_id check (length(trim(panda_id)) between 1 and 255),
  constraint engagement_pending_locale check (locale in ('zh', 'en')),
  constraint engagement_pending_safe_return check (
    safe_return_path like '/%' and safe_return_path not like '//%' and position('\\' in safe_return_path) = 0
  ),
  constraint engagement_pending_lifetime check (
    expires_at > created_at and expires_at <= created_at + interval '1 hour'
  ),
  constraint engagement_pending_terminal_consistency check (
    (status = 'pending' and outcome is null and completed_at is null and completed_by_account_id is null)
    or
    (status <> 'pending' and outcome is not null and completed_at is not null)
  )
);

create table if not exists engagement.follows (
  follow_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  panda_id text not null,
  state engagement.follow_state not null default 'active',
  first_followed_at timestamptz not null default now(),
  followed_at timestamptz not null default now(),
  unfollowed_at timestamptz,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint engagement_follows_account_panda unique (account_id, panda_id),
  constraint engagement_follows_panda_id check (length(trim(panda_id)) between 1 and 255),
  constraint engagement_follows_state_consistency check (
    (state = 'active' and unfollowed_at is null)
    or (state = 'inactive' and unfollowed_at is not null)
  ),
  constraint engagement_follows_first_history check (first_followed_at <= followed_at)
);

create table if not exists engagement.follow_events (
  event_id uuid primary key default gen_random_uuid(),
  follow_id uuid not null,
  account_subject_hash text not null,
  panda_id text not null,
  action text not null check (action in ('followed', 'unfollowed')),
  follow_version integer not null check (follow_version > 0),
  pending_intent_id uuid,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  correlation_id uuid not null,
  constraint engagement_follow_event_subject_hash check (account_subject_hash ~ '^[a-f0-9]{64}$'),
  constraint engagement_follow_event_idempotency unique (account_subject_hash, idempotency_key)
);

create table if not exists engagement.notification_preferences (
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  category text not null,
  channel text not null,
  enabled boolean not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (account_id, category, channel),
  constraint engagement_preference_category check (category ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  constraint engagement_preference_channel check (channel in ('station', 'email', 'web_push'))
);

create table if not exists engagement.notification_preference_events (
  event_id uuid primary key default gen_random_uuid(),
  account_subject_hash text not null,
  category text not null,
  channel text not null,
  enabled boolean not null,
  preference_version integer not null check (preference_version > 0),
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  correlation_id uuid not null,
  constraint engagement_preference_event_subject_hash check (account_subject_hash ~ '^[a-f0-9]{64}$'),
  constraint engagement_preference_event_idempotency unique (account_subject_hash, idempotency_key)
);

create table if not exists engagement.passport_contribution_events (
  source_event_id uuid primary key,
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  panda_id text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  correlation_id uuid not null,
  constraint engagement_passport_contribution_panda_id check (
    length(trim(panda_id)) between 1 and 255
  )
);

create table if not exists engagement.passport_entries (
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  panda_id text not null,
  relationship_state engagement.follow_state,
  first_followed_at timestamptz,
  followed_at timestamptz,
  unfollowed_at timestamptz,
  contribution_count integer not null default 0 check (contribution_count >= 0),
  projection_version integer not null check (projection_version > 0),
  projected_at timestamptz not null default now(),
  primary key (account_id, panda_id),
  constraint engagement_passport_state_consistency check (
    (
      relationship_state is null
      and first_followed_at is null
      and followed_at is null
      and unfollowed_at is null
      and contribution_count > 0
    )
    or (
      relationship_state = 'active'
      and first_followed_at is not null
      and followed_at is not null
      and unfollowed_at is null
    )
    or (
      relationship_state = 'inactive'
      and first_followed_at is not null
      and followed_at is not null
      and unfollowed_at is not null
    )
  )
);

create table if not exists engagement.last_viewed_profiles (
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  panda_id text not null,
  viewed_at timestamptz not null default now(),
  primary key (account_id, panda_id)
);

create table if not exists engagement.audit_events (
  audit_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_account_id uuid references identity.accounts(account_id) on delete set null,
  subject_account_id uuid references identity.accounts(account_id) on delete set null,
  target_type text not null,
  target_id text not null,
  outcome text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null,
  constraint engagement_audit_event_type check (event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  constraint engagement_audit_details_object check (jsonb_typeof(details) = 'object'),
  constraint engagement_audit_idempotency unique (event_type, idempotency_key)
);

create index if not exists idx_engagement_pending_expiry
  on engagement.pending_follow_intents (status, expires_at);
create index if not exists idx_engagement_follows_account_state
  on engagement.follows (account_id, state, followed_at desc);
create index if not exists idx_engagement_follow_events_subject_time
  on engagement.follow_events (account_subject_hash, occurred_at desc, event_id);
create index if not exists idx_engagement_preference_events_subject_time
  on engagement.notification_preference_events (account_subject_hash, occurred_at desc, event_id);
create index if not exists idx_engagement_passport_contributions_account_panda
  on engagement.passport_contribution_events (account_id, panda_id, occurred_at, source_event_id);
create index if not exists idx_engagement_audit_subject_time
  on engagement.audit_events (subject_account_id, occurred_at desc, audit_id);

create or replace function engagement.reject_append_only_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

do $append_only$
declare relation_name text;
begin
  foreach relation_name in array array[
    'follow_events', 'notification_preference_events', 'audit_events'
  ] loop
    execute format('drop trigger if exists %I on engagement.%I',
      'trg_' || relation_name || '_append_only', relation_name);
    execute format(
      'create trigger %I before update or delete on engagement.%I for each row execute function engagement.reject_append_only_mutation()',
      'trg_' || relation_name || '_append_only', relation_name
    );
  end loop;
end
$append_only$;

drop trigger if exists trg_passport_contribution_events_immutable_updates
  on engagement.passport_contribution_events;
create trigger trg_passport_contribution_events_immutable_updates
  before update on engagement.passport_contribution_events
  for each row execute function engagement.reject_append_only_mutation();

revoke all on schema engagement from public;
revoke all on all tables in schema engagement from public;
revoke all on all sequences in schema engagement from public;
revoke all on all functions in schema engagement from public;
alter default privileges in schema engagement revoke all on tables from public;
alter default privileges in schema engagement revoke all on sequences from public;
alter default privileges in schema engagement revoke all on functions from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema engagement from %I', role_name);
      execute format('revoke all on all tables in schema engagement from %I', role_name);
      execute format('revoke all on all sequences in schema engagement from %I', role_name);
      execute format('revoke all on all functions in schema engagement from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
