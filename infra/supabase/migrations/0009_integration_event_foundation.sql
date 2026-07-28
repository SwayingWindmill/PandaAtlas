-- Shared infrastructure for versioned integration events and durable queue transport.
-- Domain-specific producers and consumers are added by later delivery tickets.

begin;

create schema if not exists integration;
comment on schema integration is
  'Private cross-context integration infrastructure. Never expose through PostgREST.';

create table if not exists integration.outbox_events (
  event_id uuid primary key default gen_random_uuid(),
  schema_version smallint not null default 1 check (schema_version = 1),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  event_version integer not null default 1 check (event_version > 0),
  source_context text not null check (source_context ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  aggregate_type text not null check (aggregate_type ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  aggregate_id text not null check (length(aggregate_id) between 1 and 255),
  aggregate_version bigint check (aggregate_version is null or aggregate_version >= 0),
  idempotency_key text not null check (length(idempotency_key) between 1 and 255),
  correlation_id uuid not null,
  causation_id uuid,
  occurred_at timestamptz not null,
  available_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  published_at timestamptz,
  publish_attempts integer not null default 0 check (publish_attempts >= 0),
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  constraint outbox_context_idempotency_unique unique (source_context, idempotency_key),
  constraint outbox_causation_not_self check (causation_id is null or causation_id <> event_id),
  constraint outbox_publication_state_consistent check (
    (published_at is null) or (published_at >= occurred_at)
  )
);

comment on table integration.outbox_events is
  'Authoritative transactional Outbox. Queue messages reference event_id; this table owns replay history.';
comment on column integration.outbox_events.schema_version is
  'Version of the shared envelope contract, not the domain event payload.';
comment on column integration.outbox_events.event_version is
  'Version of the named domain event payload.';

create index if not exists idx_outbox_pending_delivery
  on integration.outbox_events (available_at, occurred_at, event_id)
  where published_at is null;

create index if not exists idx_outbox_correlation
  on integration.outbox_events (correlation_id, occurred_at, event_id);

create index if not exists idx_outbox_aggregate
  on integration.outbox_events (source_context, aggregate_type, aggregate_id, occurred_at);

-- Keep the migration readable by the previous PostGIS-only recovery image while
-- making the selected Supabase stack responsible for providing PGMQ. The
-- preflight script fails closed when the extension is unavailable or too old.
do $migration$
begin
  if exists (
    select 1
    from pg_available_extensions
    where name = 'pgmq'
  ) then
    execute 'create extension if not exists pgmq';
  end if;
end
$migration$;

do $queue$
begin
  if to_regprocedure('pgmq.create(text)') is not null
     and to_regclass('pgmq.q_integration_events') is null then
    perform pgmq.create('integration_events');
  end if;
end
$queue$;

-- A generic private bucket proves the Storage boundary without choosing the
-- evidence taxonomy owned by the contribution delivery map.
do $storage$
begin
  if to_regclass('storage.buckets') is not null then
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit)
      values ('panda-atlas-private', 'panda-atlas-private', false, 52428800)
      on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit
    $sql$;
  end if;
end
$storage$;

revoke all on schema integration from public;
revoke all on all tables in schema integration from public;
revoke all on all sequences in schema integration from public;
revoke all on all functions in schema integration from public;
alter default privileges in schema integration revoke all on tables from public;
alter default privileges in schema integration revoke all on sequences from public;
alter default privileges in schema integration revoke all on functions from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema integration from %I', role_name);
      execute format('revoke all on all tables in schema integration from %I', role_name);
      execute format('revoke all on all sequences in schema integration from %I', role_name);
      execute format('revoke all on all functions in schema integration from %I', role_name);

      if to_regnamespace('pgmq') is not null then
        execute format('revoke all on schema pgmq from %I', role_name);
        execute format('revoke all on all tables in schema pgmq from %I', role_name);
        execute format('revoke all on all sequences in schema pgmq from %I', role_name);
        execute format('revoke all on all functions in schema pgmq from %I', role_name);
      end if;
    end if;
  end loop;
end
$roles$;

commit;
