-- Application-layer encrypted privacy export artifacts and their fixed 24-hour lifetime.

begin;

do $types$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'privacy' and t.typname = 'export_state'
  ) then
    create type privacy.export_state as enum ('ready', 'expired', 'deleted');
  end if;
end
$types$;

create table if not exists privacy.export_artifacts (
  artifact_id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references privacy.requests(request_id) on delete restrict,
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  state privacy.export_state not null default 'ready',
  schema_version integer not null default 1,
  key_version integer not null default 1,
  nonce bytea,
  ciphertext bytea,
  ciphertext_sha256 text,
  plaintext_byte_size bigint not null,
  ciphertext_byte_size bigint,
  created_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  expired_at timestamptz,
  deleted_at timestamptz,
  version integer not null default 1,
  command_hash text not null,
  idempotency_key text not null unique,
  correlation_id uuid not null,
  constraint privacy_export_schema_version_positive check (schema_version >= 1),
  constraint privacy_export_key_version_positive check (key_version >= 1),
  constraint privacy_export_nonce_length check (nonce is null or octet_length(nonce) = 12),
  constraint privacy_export_ciphertext_hash check (
    ciphertext_sha256 is null or ciphertext_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint privacy_export_command_hash check (command_hash ~ '^[a-f0-9]{64}$'),
  constraint privacy_export_plaintext_size_positive check (plaintext_byte_size > 0),
  constraint privacy_export_ciphertext_shape check (
    (
      state in ('ready', 'expired')
      and nonce is not null
      and ciphertext is not null
      and ciphertext_sha256 is not null
      and ciphertext_byte_size = octet_length(ciphertext)
      and ciphertext_byte_size > plaintext_byte_size
    )
    or (
      state = 'deleted'
      and nonce is null
      and ciphertext is null
      and ciphertext_sha256 is null
      and ciphertext_byte_size is null
    )
  ),
  constraint privacy_export_version_positive check (version >= 1),
  constraint privacy_export_lifetime check (
    expires_at > created_at and expires_at <= created_at + interval '24 hours'
  ),
  constraint privacy_export_state_shape check (
    (state = 'ready' and expired_at is null and deleted_at is null)
    or (state = 'expired' and expired_at is not null and deleted_at is null)
    or (state = 'deleted' and deleted_at is not null)
  )
);

create index if not exists idx_privacy_export_expiry
  on privacy.export_artifacts (state, expires_at, artifact_id)
  where state = 'ready';

comment on table privacy.export_artifacts is
  'Application-layer encrypted user export artifacts. Plaintext and encryption keys are never stored.';

revoke all on privacy.export_artifacts from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on privacy.export_artifacts from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
