-- Private personalized Feed state. Activity remains the public-safe source projection;
-- this schema owns account cursors, explicit viewed-state commands, and audit evidence.

begin;

create schema if not exists feed;
comment on schema feed is
  'Private personalized Feed state and explicit last-viewed command evidence.';

create table if not exists feed.account_state (
  account_id uuid primary key references identity.accounts(account_id) on delete restrict,
  last_viewed_at timestamptz not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists feed.last_viewed_events (
  event_id uuid primary key default gen_random_uuid(),
  account_subject_hash text not null check (account_subject_hash ~ '^[0-9a-f]{64}$'),
  viewed_through_at timestamptz not null,
  state_version integer not null check (state_version > 0),
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  unique (account_subject_hash, idempotency_key)
);

create index if not exists idx_feed_last_viewed_events_subject_time
  on feed.last_viewed_events (account_subject_hash, occurred_at desc, event_id);

create or replace function feed.reject_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

drop trigger if exists trg_feed_last_viewed_events_append_only
  on feed.last_viewed_events;
create trigger trg_feed_last_viewed_events_append_only
before update or delete on feed.last_viewed_events
for each row execute function feed.reject_append_only_mutation();

revoke all on schema feed from public;
revoke all on all tables in schema feed from public;
revoke all on all sequences in schema feed from public;
revoke all on all functions in schema feed from public;
alter default privileges in schema feed revoke all on tables from public;
alter default privileges in schema feed revoke all on sequences from public;
alter default privileges in schema feed revoke all on functions from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema feed from %I', role_name);
      execute format('revoke all on all tables in schema feed from %I', role_name);
      execute format('revoke all on all sequences in schema feed from %I', role_name);
      execute format('revoke all on all functions in schema feed from %I', role_name);
    end if;
  end loop;
end
$roles$;

comment on table feed.account_state is
  'Account-scoped explicit Feed last-viewed state. Reads never mutate this table.';
comment on table feed.last_viewed_events is
  'Append-only idempotency and audit evidence for explicit mark-last-viewed commands.';

commit;
