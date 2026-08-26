-- NestJS V2 platform foundation.
-- Additive changes only: preserve V1 production data while establishing the V2
-- server-side database role, identity security policy, and durable consumers.

begin;

comment on schema identity is
  'Private application account, capability, and authorization state owned by PandaAtlas Identity.';
comment on schema integration is
  'Private cross-module integration infrastructure for the NestJS application and bounded workers.';

-- Email is profile/contact metadata, not authorization identity. Supabase auth.users.id
-- remains the stable account key and V2 authorization never depends on email.
alter table identity.accounts
  alter column email drop not null;

alter table identity.accounts
  drop constraint if exists identity_accounts_email_nonempty;

alter table identity.accounts
  drop constraint if exists identity_accounts_email_if_present_nonempty;
alter table identity.accounts
  add constraint identity_accounts_email_if_present_nonempty
  check (email is null or length(trim(email)) > 3);

-- Security policy belongs to the capability definition so every protected command
-- gets the same recent-auth/AAL/live-session interpretation.
alter table identity.capabilities
  add column if not exists requires_recent_auth boolean not null default false,
  add column if not exists minimum_aal text not null default 'aal1',
  add column if not exists requires_live_session boolean not null default false;

alter table identity.capabilities
  drop constraint if exists identity_capabilities_minimum_aal;
alter table identity.capabilities
  add constraint identity_capabilities_minimum_aal
  check (minimum_aal in ('aal1', 'aal2'));

update identity.capabilities
set requires_recent_auth = true
where sensitive = true
  and requires_recent_auth = false;

-- Highest-impact identity/privacy/audit operations require both stronger current
-- authentication and a live Supabase session. This policy can be extended by the
-- owning module as new sensitive capabilities are introduced.
update identity.capabilities
set minimum_aal = 'aal2',
    requires_live_session = true,
    requires_recent_auth = true
where capability_key in (
  'identity.role.manage',
  'identity.account.manage',
  'privacy.operate',
  'audit.export'
);

create table if not exists integration.consumer_receipts (
  consumer_key text not null,
  event_id uuid not null references integration.outbox_events(event_id) on delete restrict,
  processed_at timestamptz not null default now(),
  outcome text not null default 'processed',
  primary key (consumer_key, event_id),
  constraint integration_consumer_key_format
    check (consumer_key ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  constraint integration_consumer_outcome_nonempty
    check (length(trim(outcome)) > 0)
);

comment on table integration.consumer_receipts is
  'Idempotency receipts for at-least-once integration-event consumers.';

create or replace function identity.is_live_auth_session(
  requested_session_id uuid,
  requested_account_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $function$
  select exists (
    select 1
    from auth.sessions session
    where session.id = requested_session_id
      and session.user_id = requested_account_id
  )
$function$;

revoke all on function identity.is_live_auth_session(uuid, uuid) from public;

-- PGMQ is a work queue, not the event store. The canonical event remains in
-- integration.outbox_events; each consumer receives its own independently
-- retryable queue message that references event_id.
do $queues$
declare
  queue_name text;
begin
  if to_regprocedure('pgmq.create(text)') is not null then
    foreach queue_name in array array[
      'integration_updates',
      'integration_notification',
      'integration_audit'
    ] loop
      if to_regclass('pgmq.q_' || queue_name) is null then
        perform pgmq.create(queue_name);
      end if;
    end loop;
  end if;
end
$queues$;

-- The migration creates a group role only. Production login credentials are
-- provisioned out-of-band and granted membership; no password belongs in SQL.
do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'zhipanda_app') then
    create role zhipanda_app nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$role$;

grant usage on schema identity, integration to zhipanda_app;

grant select, insert, update on identity.accounts to zhipanda_app;
grant select on identity.roles, identity.capabilities, identity.role_capabilities to zhipanda_app;
grant select, insert on identity.role_assignments,
  identity.role_assignment_revocations,
  identity.account_state_events,
  identity.authorization_audit_events to zhipanda_app;
grant execute on function identity.is_live_auth_session(uuid, uuid) to zhipanda_app;

grant select, insert, update on integration.outbox_events to zhipanda_app;
grant select, insert on integration.consumer_receipts to zhipanda_app;

-- PGMQ functions are invoked by the app/worker role. Queue tables are technical
-- transport state; the role may mutate only this technical schema, never business
-- module schemas through queue privileges.
do $pgmq_grants$
begin
  if to_regnamespace('pgmq') is not null then
    grant usage on schema pgmq to zhipanda_app;
    grant select, insert, update, delete on all tables in schema pgmq to zhipanda_app;
    grant usage, select, update on all sequences in schema pgmq to zhipanda_app;
    grant execute on all functions in schema pgmq to zhipanda_app;
    alter default privileges in schema pgmq
      grant select, insert, update, delete on tables to zhipanda_app;
    alter default privileges in schema pgmq
      grant usage, select, update on sequences to zhipanda_app;
    alter default privileges in schema pgmq
      grant execute on functions to zhipanda_app;
  end if;
end
$pgmq_grants$;

revoke all on schema identity, integration from anon, authenticated;

commit;
