-- Supabase-backed accounts and explicit PostgreSQL capabilities.
-- Browser clients never receive grants on this private schema.

begin;

create schema if not exists identity;
comment on schema identity is
  'Private account, role, capability, and authorization audit state owned by FastAPI.';

do $types$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'identity' and t.typname = 'account_state'
  ) then
    create type identity.account_state as enum (
      'active',
      'suspended',
      'deleting',
      'deleted'
    );
  end if;
end
$types$;

create table if not exists identity.accounts (
  account_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  state identity.account_state not null default 'active',
  state_reason text,
  state_changed_at timestamptz not null default now(),
  last_authenticated_at timestamptz,
  last_authentication_method text,
  last_session_id text,
  last_jwt_issued_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_accounts_email_nonempty check (length(trim(email)) > 3),
  constraint identity_accounts_auth_method_nonempty check (
    last_authentication_method is null or length(trim(last_authentication_method)) > 0
  )
);

create table if not exists identity.roles (
  role_key text primary key,
  display_name text not null,
  description text not null,
  is_staff boolean not null default false,
  created_at timestamptz not null default now(),
  constraint identity_roles_key_format check (role_key ~ '^[a-z][a-z0-9_.-]{2,63}$')
);

create table if not exists identity.capabilities (
  capability_key text primary key,
  description text not null,
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  constraint identity_capabilities_key_format check (
    capability_key ~ '^[a-z][a-z0-9_.-]{2,127}$'
  )
);

create table if not exists identity.role_capabilities (
  role_key text not null references identity.roles(role_key) on delete restrict,
  capability_key text not null references identity.capabilities(capability_key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_key, capability_key)
);

create table if not exists identity.role_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  role_key text not null references identity.roles(role_key) on delete restrict,
  assigned_by_account_id uuid references identity.accounts(account_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  reason text not null,
  source text not null default 'operator',
  correlation_id uuid not null,
  idempotency_key text not null,
  constraint identity_role_assignments_expiry check (
    expires_at is null or expires_at > assigned_at
  ),
  constraint identity_role_assignments_reason_nonempty check (length(trim(reason)) > 0),
  constraint identity_role_assignments_source_nonempty check (length(trim(source)) > 0),
  constraint identity_role_assignments_idempotency_unique unique (
    account_id,
    idempotency_key
  )
);

create table if not exists identity.role_assignment_revocations (
  revocation_id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique
    references identity.role_assignments(assignment_id) on delete restrict,
  revoked_by_account_id uuid references identity.accounts(account_id) on delete restrict,
  revoked_at timestamptz not null default now(),
  reason text not null,
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint identity_role_revocations_reason_nonempty check (length(trim(reason)) > 0)
);

create table if not exists identity.account_state_events (
  event_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  previous_state identity.account_state not null,
  next_state identity.account_state not null,
  actor_account_id uuid references identity.accounts(account_id) on delete restrict,
  reason text not null,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint identity_account_state_changed check (previous_state <> next_state),
  constraint identity_account_state_reason_nonempty check (length(trim(reason)) > 0)
);

create table if not exists identity.authorization_audit_events (
  audit_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_account_id uuid references identity.accounts(account_id) on delete restrict,
  subject_account_id uuid references identity.accounts(account_id) on delete restrict,
  assignment_id uuid references identity.role_assignments(assignment_id) on delete restrict,
  role_key text references identity.roles(role_key) on delete restrict,
  capability_key text references identity.capabilities(capability_key) on delete restrict,
  outcome text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  constraint identity_authorization_audit_event_type_nonempty check (
    length(trim(event_type)) > 0
  ),
  constraint identity_authorization_audit_outcome check (
    outcome in ('allowed', 'denied', 'assigned', 'revoked', 'changed')
  ),
  constraint identity_authorization_audit_details_object check (
    jsonb_typeof(details) = 'object'
  )
);

create index if not exists idx_identity_accounts_state
  on identity.accounts (state, account_id);
create index if not exists idx_identity_role_assignments_account
  on identity.role_assignments (account_id, role_key, assigned_at desc);
create index if not exists idx_identity_role_assignments_expiry
  on identity.role_assignments (expires_at)
  where expires_at is not null;
create index if not exists idx_identity_authorization_audit_actor_time
  on identity.authorization_audit_events (actor_account_id, occurred_at desc);
create index if not exists idx_identity_authorization_audit_subject_time
  on identity.authorization_audit_events (subject_account_id, occurred_at desc);

create or replace function identity.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_identity_accounts_updated_at on identity.accounts;
create trigger trg_identity_accounts_updated_at
before update on identity.accounts
for each row execute function identity.set_updated_at();

create or replace function identity.reject_append_only_mutation()
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
    'role_assignments',
    'role_assignment_revocations',
    'account_state_events',
    'authorization_audit_events'
  ] loop
    execute format(
      'drop trigger if exists %I on identity.%I',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
    execute format(
      'create trigger %I before update or delete on identity.%I '
      'for each row execute function identity.reject_append_only_mutation()',
      'trg_' || relation_name || '_append_only',
      relation_name
    );
  end loop;
end
$append_only$;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('account.session.read', 'Read the current account session and effective capabilities.', false),
  ('admin.shell.access', 'Enter the bounded client-only administration shell.', false),
  ('identity.role.manage', 'Assign and revoke explicit PostgreSQL application roles.', true),
  ('identity.account.manage', 'Suspend, delete, or reactivate application accounts.', true),
  ('import.read', 'Read approved import sources and import job state.', false),
  ('import.execute', 'Create and execute approved import jobs.', true),
  ('archive.change_set.create', 'Create Archive Change Sets.', false),
  ('archive.change_set.submit', 'Submit Archive Change Sets for review.', false),
  ('archive.review', 'Review submitted Archive Change Sets.', false),
  ('archive.batch.create', 'Create publication batches.', false),
  ('archive.batch.preview', 'Preview publication batches.', false),
  ('archive.batch.publish', 'Publish ordinary Archive batches.', true),
  ('archive.batch.rollback', 'Create rollback publications.', true),
  ('archive.batch.withdraw', 'Withdraw published batches.', true),
  ('archive.sensitive.publish', 'Publish sensitive Archive changes.', true),
  ('moderation.review', 'Review community moderation cases.', false),
  ('privacy.operate', 'Execute approved privacy operations.', true),
  ('audit.export', 'Export restricted authorization and publication audit data.', true)
on conflict (capability_key) do nothing;

insert into identity.roles (role_key, display_name, description, is_staff) values
  ('member', 'Member', 'Base authenticated account with no staff authority.', false),
  ('contributor', 'Contributor', 'May draft and submit Archive Change Sets.', true),
  ('reviewer', 'Reviewer', 'May review Change Sets but cannot publish them.', true),
  ('archive_editor', 'Archive Editor', 'May curate and publish ordinary Archive changes.', true),
  ('senior_archive_editor', 'Senior Archive Editor', 'May publish sensitive Archive changes.', true),
  ('moderator', 'Moderator', 'May review community moderation cases.', true),
  ('privacy_operator', 'Privacy Operator', 'May execute approved privacy operations.', true),
  ('administrator', 'Administrator', 'May manage accounts and role assignments only.', true),
  ('audit_exporter', 'Audit Exporter', 'May export restricted audit records.', true),
  ('import_operator', 'Import Operator', 'May inspect and execute approved imports.', true)
on conflict (role_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('member', 'account.session.read'),
  ('contributor', 'account.session.read'),
  ('contributor', 'admin.shell.access'),
  ('contributor', 'archive.change_set.create'),
  ('contributor', 'archive.change_set.submit'),
  ('reviewer', 'account.session.read'),
  ('reviewer', 'admin.shell.access'),
  ('reviewer', 'archive.review'),
  ('reviewer', 'archive.batch.preview'),
  ('archive_editor', 'account.session.read'),
  ('archive_editor', 'admin.shell.access'),
  ('archive_editor', 'archive.change_set.create'),
  ('archive_editor', 'archive.change_set.submit'),
  ('archive_editor', 'archive.batch.create'),
  ('archive_editor', 'archive.batch.preview'),
  ('archive_editor', 'archive.batch.publish'),
  ('archive_editor', 'archive.batch.rollback'),
  ('archive_editor', 'archive.batch.withdraw'),
  ('senior_archive_editor', 'account.session.read'),
  ('senior_archive_editor', 'admin.shell.access'),
  ('senior_archive_editor', 'archive.change_set.create'),
  ('senior_archive_editor', 'archive.change_set.submit'),
  ('senior_archive_editor', 'archive.batch.create'),
  ('senior_archive_editor', 'archive.batch.preview'),
  ('senior_archive_editor', 'archive.batch.publish'),
  ('senior_archive_editor', 'archive.batch.rollback'),
  ('senior_archive_editor', 'archive.batch.withdraw'),
  ('senior_archive_editor', 'archive.sensitive.publish'),
  ('moderator', 'account.session.read'),
  ('moderator', 'admin.shell.access'),
  ('moderator', 'moderation.review'),
  ('privacy_operator', 'account.session.read'),
  ('privacy_operator', 'admin.shell.access'),
  ('privacy_operator', 'privacy.operate'),
  ('administrator', 'account.session.read'),
  ('administrator', 'admin.shell.access'),
  ('administrator', 'identity.role.manage'),
  ('administrator', 'identity.account.manage'),
  ('audit_exporter', 'account.session.read'),
  ('audit_exporter', 'admin.shell.access'),
  ('audit_exporter', 'audit.export'),
  ('import_operator', 'account.session.read'),
  ('import_operator', 'admin.shell.access'),
  ('import_operator', 'import.read'),
  ('import_operator', 'import.execute')
on conflict (role_key, capability_key) do nothing;

comment on table identity.role_assignments is
  'Append-only role grants. Revocation is represented only by role_assignment_revocations.';
comment on table identity.authorization_audit_events is
  'Append-only authorization decisions and sensitive identity command audit.';
comment on table public.user_roles is
  'Legacy pre-Supabase role table. New authorization uses private identity role assignments.';

revoke all on schema identity from public;
revoke all on all tables in schema identity from public;
revoke all on all sequences in schema identity from public;
revoke all on all functions in schema identity from public;
alter default privileges in schema identity revoke all on tables from public;
alter default privileges in schema identity revoke all on sequences from public;
alter default privileges in schema identity revoke all on functions from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema identity from %I', role_name);
      execute format('revoke all on all tables in schema identity from %I', role_name);
      execute format('revoke all on all sequences in schema identity from %I', role_name);
      execute format('revoke all on all functions in schema identity from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
