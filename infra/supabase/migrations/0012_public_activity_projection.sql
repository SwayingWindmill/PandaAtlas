-- Rebuildable public-safe Activity projection sourced only from published Archive facts
-- or authorized editorial announcements.

begin;

create schema if not exists activity;
comment on schema activity is
  'Private public-safe Activity projection and editorial source state. Exposed only through FastAPI.';

create table if not exists activity.items (
  activity_id uuid primary key,
  source_type text not null check (source_type in ('archive.release', 'editorial.announcement')),
  source_id text not null check (source_id ~ '^[a-z0-9][a-z0-9:._-]{2,254}$'),
  source_version integer not null check (source_version > 0),
  source_event_id uuid not null unique,
  activity_type text not null check (activity_type in (
    'panda.birth',
    'panda.death',
    'panda.named',
    'panda.relocated',
    'panda.birthday',
    'panda.health_major',
    'archive.profile_corrected',
    'editorial.announcement'
  )),
  importance text not null check (importance in ('ordinary', 'important', 'critical')),
  importance_override_reason text,
  visibility text not null check (visibility in ('public', 'unlisted')),
  sitewide boolean not null default false,
  notification_eligible boolean not null default true,
  occurred_at timestamptz not null,
  occurred_precision text not null check (
    occurred_precision in ('exact', 'day', 'month', 'year', 'range', 'unknown')
  ),
  occurred_end_at timestamptz,
  published_at timestamptz not null,
  updated_at timestamptz not null,
  localization_key text not null check (localization_key ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  localization_version integer not null check (localization_version > 0),
  localized_snapshots jsonb not null check (jsonb_typeof(localized_snapshots) = 'array'),
  media jsonb check (media is null or jsonb_typeof(media) = 'object'),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  pin_starts_at timestamptz,
  pin_ends_at timestamptz,
  pin_reason text,
  retraction_state text not null default 'active' check (
    retraction_state in ('active', 'corrected', 'retracted')
  ),
  retracted_at timestamptz,
  retraction_reason text,
  correction_activity_id uuid references activity.items(activity_id) on delete restrict,
  is_backfill boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, source_version),
  check (
    (occurred_precision = 'range' and occurred_end_at is not null and occurred_end_at >= occurred_at)
    or (occurred_precision <> 'range' and occurred_end_at is null)
  ),
  check (
    (pin_starts_at is null and pin_ends_at is null and pin_reason is null)
    or (
      pin_starts_at is not null
      and pin_ends_at is not null
      and pin_ends_at > pin_starts_at
      and length(trim(pin_reason)) > 0
    )
  ),
  check (
    (retraction_state = 'active' and retracted_at is null and retraction_reason is null)
    or (retraction_state = 'corrected' and correction_activity_id is not null)
    or (
      retraction_state = 'retracted'
      and retracted_at is not null
      and length(trim(retraction_reason)) > 0
    )
  )
);

create table if not exists activity.targets (
  activity_id uuid not null references activity.items(activity_id) on delete cascade,
  target_type text not null check (target_type in ('panda', 'institution')),
  target_id text not null check (length(target_id) between 1 and 200),
  primary key (activity_id, target_type, target_id)
);

create table if not exists activity.projection_receipts (
  source_event_id uuid primary key,
  canonical_source_event_id uuid references activity.projection_receipts(source_event_id) on delete restrict,
  source_type text not null,
  source_id text not null,
  source_version integer not null check (source_version > 0),
  action text not null check (action in ('publish', 'snapshot_update', 'correction', 'retraction')),
  activity_type text not null,
  activity_id uuid not null references activity.items(activity_id) on delete restrict,
  outcome text not null check (
    outcome in ('created', 'updated', 'corrected', 'retracted', 'duplicate')
  ),
  source_payload_sha256 text not null check (source_payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_published_at timestamptz not null,
  projected_at timestamptz not null default now(),
  projection_lag_seconds double precision not null check (projection_lag_seconds >= 0),
  is_backfill boolean not null default false,
  replay_count integer not null default 0 check (replay_count >= 0),
  check (
    (outcome = 'duplicate' and canonical_source_event_id is not null)
    or (outcome <> 'duplicate' and canonical_source_event_id is null)
  )
);

create unique index if not exists uq_activity_projection_canonical_source
  on activity.projection_receipts (source_type, source_id, source_version, action)
  where outcome <> 'duplicate';

create table if not exists activity.projection_failures (
  id uuid primary key default gen_random_uuid(),
  source_event_id uuid,
  event_type text not null,
  error_code text not null,
  occurred_at timestamptz not null default now()
);

create table if not exists activity.editorial_announcements (
  command_id uuid primary key,
  source_id text not null check (source_id ~ '^[a-z0-9][a-z0-9:._-]{2,254}$'),
  source_version integer not null check (source_version > 0),
  source_event_id uuid not null unique,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  correlation_id uuid not null,
  reason text not null check (length(trim(reason)) > 0),
  command_payload_sha256 text not null check (command_payload_sha256 ~ '^[0-9a-f]{64}$'),
  public_content jsonb not null check (jsonb_typeof(public_content) = 'object'),
  published_at timestamptz not null,
  unique (source_id, source_version)
);

create table if not exists activity.audit_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_account_id uuid references identity.accounts(account_id) on delete restrict,
  target_type text not null,
  target_id text not null,
  reason text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_activity_items_public_order
  on activity.items (published_at desc, activity_id desc)
  where visibility = 'public' and retraction_state = 'active';
create index if not exists idx_activity_items_source_latest
  on activity.items (source_type, source_id, source_version desc);
create index if not exists idx_activity_items_pin_window
  on activity.items (pin_starts_at, pin_ends_at)
  where pin_starts_at is not null;
create index if not exists idx_activity_targets_target
  on activity.targets (target_type, target_id, activity_id);
create index if not exists idx_activity_receipts_metrics
  on activity.projection_receipts (projected_at, activity_type, is_backfill);
create index if not exists idx_activity_failures_time
  on activity.projection_failures (occurred_at desc, event_type);

create or replace function activity.reject_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '23514';
end;
$$;

do $append_only$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'projection_failures',
    'editorial_announcements',
    'audit_events'
  ] loop
    execute format(
      'drop trigger if exists %I on activity.%I',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
    execute format(
      'create trigger %I before update or delete on activity.%I '
      'for each row execute function activity.reject_append_only_mutation()',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
  end loop;
end
$append_only$;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('activity.editorial.publish', 'Publish reviewed editorial Activity announcements.', true),
  ('activity.sitewide.publish', 'Publish explicitly reviewed sitewide Activity announcements.', true),
  ('activity.pin.manage', 'Create bounded public Activity pins.', true)
on conflict (capability_key) do nothing;

insert into identity.roles (role_key, display_name, description, is_staff) values
  ('editorial_publisher', 'Editorial Publisher', 'May publish reviewed editorial Activity announcements.', true)
on conflict (role_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('archive_editor', 'activity.editorial.publish'),
  ('senior_archive_editor', 'activity.editorial.publish'),
  ('senior_archive_editor', 'activity.sitewide.publish'),
  ('senior_archive_editor', 'activity.pin.manage'),
  ('editorial_publisher', 'account.session.read'),
  ('editorial_publisher', 'admin.shell.access'),
  ('editorial_publisher', 'activity.editorial.publish'),
  ('editorial_publisher', 'activity.sitewide.publish'),
  ('editorial_publisher', 'activity.pin.manage')
on conflict (role_key, capability_key) do nothing;

revoke all on schema activity from public;
revoke all on all tables in schema activity from public;
revoke all on all sequences in schema activity from public;
revoke all on all functions in schema activity from public;
alter default privileges in schema activity revoke all on tables from public;
alter default privileges in schema activity revoke all on sequences from public;
alter default privileges in schema activity revoke all on functions from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema activity from %I', role_name);
      execute format('revoke all on all tables in schema activity from %I', role_name);
      execute format('revoke all on all sequences in schema activity from %I', role_name);
      execute format('revoke all on all functions in schema activity from %I', role_name);
    end if;
  end loop;
end
$roles$;

comment on table activity.items is
  'Rebuildable public-safe ActivityItem projection. It never owns Archive facts.';
comment on table activity.projection_receipts is
  'Per-event consumption evidence with one canonical projection result per source version and action.';
comment on table activity.editorial_announcements is
  'Append-only authorized editorial source records; never used to impersonate Archive releases.';

commit;
