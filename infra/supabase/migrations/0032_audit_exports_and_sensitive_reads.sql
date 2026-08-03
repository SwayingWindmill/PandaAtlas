-- Encrypted Audit export artifacts and unified raw-attachment read evidence.

begin;

create table audit.export_artifacts (
  artifact_id uuid primary key default gen_random_uuid(),
  generated_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null default 'application/x-ndjson' check (
    content_type = 'application/x-ndjson'
  ),
  row_count integer not null check (row_count >= 0),
  byte_size integer not null check (byte_size >= 0),
  encryption_algorithm text not null default 'AES-256-GCM' check (
    encryption_algorithm = 'AES-256-GCM'
  ),
  key_version integer not null default 1 check (key_version > 0),
  nonce bytea not null check (octet_length(nonce) = 12),
  encrypted_payload bytea not null check (octet_length(encrypted_payload) >= 16),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  correlation_id uuid not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint audit_export_lifetime check (
    expires_at > created_at and expires_at <= created_at + interval '24 hours'
  ),
  constraint audit_export_idempotency unique (generated_by_account_id, idempotency_key)
);

create index idx_audit_export_artifacts_expiry
  on audit.export_artifacts (expires_at, artifact_id);
create index idx_audit_export_artifacts_generator
  on audit.export_artifacts (generated_by_account_id, created_at desc);

create or replace function audit.protect_export_artifact()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.expires_at <= now() then
    return old;
  end if;
  raise exception 'Audit export artifacts are immutable until expiry' using errcode = '55000';
end;
$$;

drop trigger if exists trg_export_artifacts_protected on audit.export_artifacts;
create trigger trg_export_artifacts_protected
before update or delete on audit.export_artifacts
for each row execute function audit.protect_export_artifact();

create or replace function audit.project_community_sensitive_read()
returns trigger
language plpgsql
as $$
begin
  insert into audit.event_facts (
    source_context, source_event_id, event_class, actor_subject_hash,
    action, target_type, target_id, correlation_id, reason, result,
    details_hash, sensitive_read, occurred_at
  ) values (
    'community_intake_evidence', new.read_event_id, 'sensitive_read', new.actor_subject_hash,
    'community.attachment.access', 'attachment', new.attachment_id::text,
    new.correlation_id, 'community-evidence-access', new.outcome,
    audit.json_hash(jsonb_build_object(
      'purpose', new.purpose,
      'denial_reason', new.denial_reason,
      'reference_jti_hash', new.reference_jti_hash,
      'reference_expires_at', new.reference_expires_at
    )),
    true, new.read_at
  ) on conflict (source_context, source_event_id) do nothing;
  return new;
end;
$$;

insert into audit.event_facts (
  source_context, source_event_id, event_class, actor_subject_hash,
  action, target_type, target_id, correlation_id, reason, result,
  details_hash, sensitive_read, occurred_at
)
select
  'community_intake_evidence', event.read_event_id, 'sensitive_read', event.actor_subject_hash,
  'community.attachment.access', 'attachment', event.attachment_id::text,
  event.correlation_id, 'community-evidence-access', event.outcome,
  audit.json_hash(jsonb_build_object(
    'purpose', event.purpose,
    'denial_reason', event.denial_reason,
    'reference_jti_hash', event.reference_jti_hash,
    'reference_expires_at', event.reference_expires_at
  )),
  true, event.read_at
from community_intake.sensitive_read_events event
on conflict (source_context, source_event_id) do nothing;

drop trigger if exists trg_audit_project_community_sensitive_read
  on community_intake.sensitive_read_events;
create trigger trg_audit_project_community_sensitive_read
after insert on community_intake.sensitive_read_events
for each row execute function audit.project_community_sensitive_read();

comment on table audit.export_artifacts is
  'Private encrypted Audit export delivery. Immutable metadata remains until bounded expiry cleanup.';
comment on column audit.export_artifacts.file_sha256 is
  'SHA-256 of the decrypted canonical NDJSON export file.';

revoke all on audit.export_artifacts from public;
revoke all on function audit.protect_export_artifact() from public;
revoke all on function audit.project_community_sensitive_read() from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on audit.export_artifacts from %I', role_name);
      execute format('revoke all on function audit.protect_export_artifact() from %I', role_name);
      execute format(
        'revoke all on function audit.project_community_sensitive_read() from %I',
        role_name
      );
    end if;
  end loop;
end
$roles$;

commit;
