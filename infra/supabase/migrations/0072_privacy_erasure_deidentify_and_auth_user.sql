-- Account deletion keeps a correction and its review history, and drops the link to the person.
-- The panda account row stays as a deleted tombstone, so it can no longer reference auth.users:
-- the Auth user (email, sessions, factors) is removed after the panda-side cleanup.
-- Status events stay append-only except for replacing the contributor's subject hash.

begin;

do $drop_account_auth_fkey$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'identity'
    and rel.relname = 'accounts'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) like '%auth.users%';
  if constraint_name is not null then
    execute format('alter table identity.accounts drop constraint %I', constraint_name);
  end if;
end
$drop_account_auth_fkey$;

do $staff_invitation_auth_fkey$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'identity'
    and rel.relname = 'staff_invitations'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) like '%auth.users%';
  if constraint_name is not null then
    execute format('alter table identity.staff_invitations drop constraint %I', constraint_name);
    execute format(
      'alter table identity.staff_invitations add constraint %I foreign key (account_id) references auth.users(id) on delete cascade',
      constraint_name
    );
  end if;
end
$staff_invitation_auth_fkey$;

create or replace function community_intake.enforce_status_event_erasure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'contributor status events are append-only' using errcode = '55000';
  end if;
  if new.status_event_id is distinct from old.status_event_id
    or new.submission_id is distinct from old.submission_id
    or new.status is distinct from old.status
    or new.active_revision_number is distinct from old.active_revision_number
    or new.user_visible_reason is distinct from old.user_visible_reason
    or new.source_context is distinct from old.source_context
    or new.source_event_id is distinct from old.source_event_id
    or new.correlation_id is distinct from old.correlation_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.occurred_at is distinct from old.occurred_at
    or new.actor_subject_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'contributor status events are append-only' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contributor_status_events_append_only on community_intake.contributor_status_events;
create trigger trg_contributor_status_events_append_only
before update or delete on community_intake.contributor_status_events
for each row execute function community_intake.enforce_status_event_erasure();

revoke all on function community_intake.enforce_status_event_erasure() from public;
grant update on community_intake.contributor_status_events to zhipanda_app;

commit;
