begin;

create schema if not exists community_intake;

create type community_intake.submission_type as enum (
  'correction',
  'sourced_information'
);

create type community_intake.target_type as enum ('panda');

create type community_intake.submission_state as enum (
  'draft',
  'submitted',
  'withdrawn',
  'expired',
  'closed'
);

create type community_intake.source_kind as enum (
  'url',
  'publication',
  'document',
  'other'
);

create type community_intake.attachment_state as enum (
  'quarantined',
  'clean',
  'infected',
  'scan_failed',
  'deleted'
);

create table community_intake.submissions (
  submission_id uuid primary key default gen_random_uuid(),
  account_id uuid references identity.accounts(account_id) on delete restrict,
  contributor_subject_hash text not null check (
    contributor_subject_hash ~ '^[0-9a-f]{64}$'
  ),
  submission_type community_intake.submission_type not null,
  target_type community_intake.target_type not null default 'panda',
  target_id text not null check (length(target_id) between 1 and 255),
  public_version_seen text not null check (length(public_version_seen) between 1 and 255),
  state community_intake.submission_state not null default 'draft',
  draft_content jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_content) = 'object'),
  version integer not null default 1 check (version >= 1),
  latest_revision_number integer not null default 0 check (latest_revision_number >= 0),
  expires_at timestamptz not null default (now() + interval '90 days'),
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  closed_at timestamptz,
  retention_due_at timestamptz,
  retention_completed_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (state in ('draft', 'expired') and submitted_at is null)
    or state = 'withdrawn'
    or (state in ('submitted', 'closed') and submitted_at is not null)
  ),
  check ((state = 'withdrawn') = (withdrawn_at is not null)),
  check ((state = 'closed') = (closed_at is not null)),
  check ((state = 'closed') = (retention_due_at is not null)),
  check (retention_completed_at is null or state = 'closed')
);

create index idx_community_submissions_account
  on community_intake.submissions(account_id, created_at desc);
create index idx_community_submissions_expiry
  on community_intake.submissions(expires_at)
  where state = 'draft';
create index idx_community_submissions_retention_due
  on community_intake.submissions(retention_due_at)
  where state = 'closed' and retention_completed_at is null;
create index idx_community_submissions_target
  on community_intake.submissions(target_type, target_id, created_at desc);

create table community_intake.submission_revisions (
  submission_id uuid not null references community_intake.submissions(submission_id)
    on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  public_version_seen text not null check (length(public_version_seen) between 1 and 255),
  submitted_at timestamptz not null default now(),
  primary key (submission_id, revision_number)
);

create table community_intake.submitted_sources (
  source_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  revision_number integer not null,
  source_kind community_intake.source_kind not null,
  title text not null check (length(title) between 1 and 500),
  locator text not null check (length(locator) between 1 and 2000),
  publisher text check (publisher is null or length(publisher) <= 500),
  published_on date,
  normalized_locator_hash text not null check (
    normalized_locator_hash ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz not null default now(),
  foreign key (submission_id, revision_number)
    references community_intake.submission_revisions(submission_id, revision_number)
    on delete cascade,
  unique (submission_id, revision_number, normalized_locator_hash)
);

create index idx_community_sources_revision
  on community_intake.submitted_sources(submission_id, revision_number);

create table community_intake.attachments (
  attachment_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references community_intake.submissions(submission_id)
    on delete cascade,
  bound_revision_number integer,
  storage_bucket text not null default 'community-intake-private',
  storage_object_key text not null,
  object_version text,
  original_filename text not null check (length(original_filename) between 1 and 255),
  media_type text not null check (
    media_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  content_sha256 text check (
    content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  state community_intake.attachment_state not null default 'quarantined',
  upload_completed_at timestamptz,
  scan_attempts integer not null default 0 check (scan_attempts >= 0),
  last_scan_code text check (last_scan_code is null or length(last_scan_code) <= 255),
  last_scanned_at timestamptz,
  metadata_stripped boolean not null default false,
  preview_object_key text,
  body_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (submission_id, bound_revision_number)
    references community_intake.submission_revisions(submission_id, revision_number)
    on delete restrict,
  unique (storage_bucket, storage_object_key),
  check (
    (upload_completed_at is null and object_version is null and content_sha256 is null)
    or (upload_completed_at is not null and object_version is not null and content_sha256 is not null)
  ),
  check ((state = 'deleted') = (body_deleted_at is not null))
);

create index idx_community_attachments_submission
  on community_intake.attachments(submission_id, created_at);
create index idx_community_attachments_scan_queue
  on community_intake.attachments(state, last_scanned_at, created_at)
  where upload_completed_at is not null and state in ('quarantined', 'scan_failed');

create table community_intake.attachment_scan_events (
  scan_event_id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references community_intake.attachments(attachment_id)
    on delete cascade,
  attempt_number integer not null check (attempt_number >= 1),
  outcome community_intake.attachment_state not null check (
    outcome in ('clean', 'infected', 'scan_failed')
  ),
  scanner_name text not null check (length(scanner_name) between 1 and 255),
  scanner_version text check (scanner_version is null or length(scanner_version) <= 255),
  result_code text not null check (length(result_code) between 1 and 255),
  metadata_stripped boolean not null default false,
  preview_object_key text,
  correlation_id uuid not null,
  scanned_at timestamptz not null default now(),
  unique (attachment_id, attempt_number)
);

create table community_intake.sensitive_read_events (
  read_event_id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references community_intake.attachments(attachment_id)
    on delete restrict,
  actor_subject_hash text not null check (actor_subject_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null check (length(purpose) between 3 and 500),
  outcome text not null check (outcome in ('granted', 'denied')),
  denial_reason text,
  reference_jti_hash text check (
    reference_jti_hash is null or reference_jti_hash ~ '^[0-9a-f]{64}$'
  ),
  reference_expires_at timestamptz,
  correlation_id uuid not null,
  read_at timestamptz not null default now()
);

create table community_intake.retention_events (
  retention_event_id uuid primary key default gen_random_uuid(),
  submission_id uuid references community_intake.submissions(submission_id)
    on delete set null,
  contributor_subject_hash text not null check (
    contributor_subject_hash ~ '^[0-9a-f]{64}$'
  ),
  action text not null check (
    action in (
      'draft_expired', 'closed_unincorporated_due', 'anonymized',
      'attachment_deleted', 'orphan_deleted', 'legal_hold_applied',
      'legal_hold_released'
    )
  ),
  reason text not null check (length(reason) between 3 and 1000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);

create table community_intake.audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  event_type text not null check (length(event_type) between 3 and 255),
  actor_subject_hash text not null check (actor_subject_hash ~ '^[0-9a-f]{64}$'),
  submission_id uuid references community_intake.submissions(submission_id)
    on delete set null,
  target_type text not null check (length(target_type) between 1 and 100),
  target_id text not null check (length(target_id) between 1 and 255),
  outcome text not null check (length(outcome) between 1 and 100),
  reason text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  correlation_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 1 and 255),
  occurred_at timestamptz not null default now(),
  unique (actor_subject_hash, idempotency_key)
);

create or replace function community_intake.reject_append_only_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create or replace function community_intake.enforce_attachment_limits()
returns trigger language plpgsql as $$
declare
  current_count integer;
  current_bytes bigint;
begin
  if new.state = 'deleted' then
    return new;
  end if;
  select count(*), coalesce(sum(byte_size), 0)
  into current_count, current_bytes
  from community_intake.attachments
  where submission_id = new.submission_id
    and state <> 'deleted'
    and attachment_id <> new.attachment_id;
  if current_count >= 5 then
    raise exception 'a submission may contain at most five attachments' using errcode = '23514';
  end if;
  if current_bytes + new.byte_size > 31457280 then
    raise exception 'submission attachments may total at most 30 MiB' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_community_attachment_limits
before insert or update of byte_size, state, submission_id
on community_intake.attachments
for each row execute function community_intake.enforce_attachment_limits();

create or replace function community_intake.enforce_attachment_transition()
returns trigger language plpgsql as $$
begin
  if new.submission_id <> old.submission_id
    or new.storage_bucket <> old.storage_bucket
    or new.storage_object_key <> old.storage_object_key
    or new.media_type <> old.media_type
    or new.byte_size <> old.byte_size then
    raise exception 'attachment identity metadata is immutable' using errcode = '55000';
  end if;
  if new.original_filename <> old.original_filename and not (
    new.original_filename = '[deleted]'
    and new.state = 'deleted'
    and new.body_deleted_at is not null
  ) then
    raise exception 'attachment filename is immutable' using errcode = '55000';
  end if;
  if old.bound_revision_number is not null
    and new.bound_revision_number <> old.bound_revision_number then
    raise exception 'attachment revision binding is immutable' using errcode = '55000';
  end if;
  if old.state = 'deleted' and new.state <> 'deleted' then
    raise exception 'deleted attachment is terminal' using errcode = '55000';
  end if;
  if new.state <> old.state and not (
    (old.state = 'quarantined' and new.state in ('clean', 'infected', 'scan_failed', 'deleted'))
    or (old.state = 'scan_failed' and new.state in ('quarantined', 'clean', 'infected', 'deleted'))
    or (old.state in ('clean', 'infected') and new.state = 'deleted')
  ) then
    raise exception 'invalid attachment state transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_community_attachment_transition
before update on community_intake.attachments
for each row execute function community_intake.enforce_attachment_transition();

create or replace function community_intake.enforce_submission_transition()
returns trigger language plpgsql as $$
begin
  if new.account_id is distinct from old.account_id then
    if old.account_id is null or new.account_id is not null then
      raise exception 'submission account ownership cannot be reassigned' using errcode = '55000';
    end if;
    if not exists (
      select 1 from identity.accounts
      where account_id = old.account_id and state = 'deleting'
    ) then
      raise exception 'submission can be anonymized only while account is deleting'
        using errcode = '55000';
    end if;
  end if;
  if new.state <> old.state and not (
    (old.state = 'draft' and new.state in ('submitted', 'withdrawn', 'expired'))
    or (old.state = 'submitted' and new.state in ('withdrawn', 'closed'))
  ) then
    raise exception 'invalid submission state transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_community_submission_transition
before update on community_intake.submissions
for each row execute function community_intake.enforce_submission_transition();

do $append_only$
declare relation_name text;
begin
  foreach relation_name in array array[
    'submission_revisions', 'submitted_sources', 'attachment_scan_events',
    'sensitive_read_events', 'retention_events', 'audit_events'
  ] loop
    execute format(
      'create trigger %I before update or delete on community_intake.%I '
      'for each row execute function community_intake.reject_append_only_mutation()',
      'trg_' || relation_name || '_append_only', relation_name
    );
  end loop;
end
$append_only$;

do $storage$
begin
  if to_regclass('storage.buckets') is not null then
    execute $sql$
      insert into storage.buckets (
        id, name, public, file_size_limit, allowed_mime_types
      ) values (
        'community-intake-private', 'community-intake-private', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      )
      on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types
    $sql$;
  end if;
end
$storage$;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('community_intake.evidence.read', 'Read clean private contribution evidence.', true),
  ('community_intake.scan.record', 'Record malware scan results for private evidence.', true),
  ('community_intake.retention.manage', 'Execute Community Intake retention operations.', true)
on conflict (capability_key) do nothing;

insert into identity.roles (role_key, display_name, description, is_staff) values
  ('community_scanner', 'Community Scanner',
   'Service role that records private evidence malware scan results.', true)
on conflict (role_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('reviewer', 'community_intake.evidence.read'),
  ('moderator', 'community_intake.evidence.read'),
  ('community_scanner', 'community_intake.scan.record'),
  ('privacy_operator', 'community_intake.retention.manage')
on conflict do nothing;

revoke all on schema community_intake from public;
revoke all on all tables in schema community_intake from public;
revoke all on all sequences in schema community_intake from public;
revoke all on all functions in schema community_intake from public;
alter default privileges in schema community_intake revoke all on tables from public;
alter default privileges in schema community_intake revoke all on sequences from public;
alter default privileges in schema community_intake revoke all on functions from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema community_intake from %I', role_name);
      execute format('revoke all on all tables in schema community_intake from %I', role_name);
      execute format('revoke all on all sequences in schema community_intake from %I', role_name);
      execute format('revoke all on all functions in schema community_intake from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
