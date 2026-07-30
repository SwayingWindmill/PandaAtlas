begin;

-- Single-accountable-approver publication. A published Archive Release is
-- authoritative immediately, but the public Release pointer is advanced only
-- by the Public Projection consumer after a successful projection.
alter table public.change_sets
  add column if not exists risk_level text not null default 'ordinary',
  add column if not exists origin_context text not null default 'archive',
  add column if not exists origin_actor_id uuid,
  add column if not exists last_validation_hash text,
  add column if not exists published_release_id uuid references public.publication_batches(id)
    on delete restrict;

update public.change_sets
set origin_actor_id = created_by
where origin_actor_id is null;

alter table public.change_sets
  alter column origin_actor_id set not null;

alter table public.change_sets
  drop constraint if exists change_sets_risk_level_check;
alter table public.change_sets
  add constraint change_sets_risk_level_check check (
    risk_level in ('ordinary', 'sensitive')
  );

alter table public.change_sets
  drop constraint if exists change_sets_origin_context_check;
alter table public.change_sets
  add constraint change_sets_origin_context_check check (
    origin_context in ('archive', 'community_intake')
  );

alter table public.change_sets
  drop constraint if exists change_sets_validation_hash_check;
alter table public.change_sets
  add constraint change_sets_validation_hash_check check (
    last_validation_hash is null or last_validation_hash ~ '^[a-f0-9]{64}$'
  );

create table if not exists public.archive_validation_results (
  validation_result_id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null references public.change_sets(id) on delete restrict,
  governance_version integer not null check (governance_version >= 1),
  outcome text not null check (outcome in ('validation_failed', 'ready')),
  risk_level text not null check (risk_level in ('ordinary', 'sensitive')),
  base_archive_version text not null,
  validation_hash text not null check (validation_hash ~ '^[a-f0-9]{64}$'),
  issues jsonb not null default '[]'::jsonb check (jsonb_typeof(issues) = 'array'),
  revision_evidence jsonb not null check (jsonb_typeof(revision_evidence) = 'array'),
  source_evidence jsonb not null check (jsonb_typeof(source_evidence) = 'array'),
  attachment_evidence jsonb not null check (jsonb_typeof(attachment_evidence) = 'array'),
  validated_by uuid not null references identity.accounts(account_id) on delete restrict,
  actor_role_snapshot jsonb not null check (jsonb_typeof(actor_role_snapshot) = 'array'),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (change_set_id, governance_version)
);

create index if not exists idx_archive_validation_results_change_set
  on public.archive_validation_results(change_set_id, created_at desc);

create table if not exists public.archive_release_pointer (
  singleton boolean primary key default true check (singleton),
  latest_release_id uuid references public.publication_batches(id) on delete restrict,
  switched_at timestamptz,
  check (singleton)
);

insert into public.archive_release_pointer (singleton, latest_release_id, switched_at)
select true, active_batch_id, switched_at
from public.public_release_pointer
where singleton = true
on conflict (singleton) do nothing;

create table if not exists public.archive_release_evidence (
  release_id uuid primary key references public.publication_batches(id) on delete restrict,
  change_set_id uuid not null unique references public.change_sets(id) on delete restrict,
  validation_result_id uuid not null references public.archive_validation_results(validation_result_id)
    on delete restrict,
  base_archive_version text not null,
  risk_level text not null check (risk_level in ('ordinary', 'sensitive')),
  publisher_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  publisher_role_snapshot jsonb not null check (jsonb_typeof(publisher_role_snapshot) = 'array'),
  publisher_capability_snapshot jsonb not null check (
    jsonb_typeof(publisher_capability_snapshot) = 'array'
  ),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  validation_hash text not null check (validation_hash ~ '^[a-f0-9]{64}$'),
  revision_evidence jsonb not null check (jsonb_typeof(revision_evidence) = 'array'),
  source_evidence jsonb not null check (jsonb_typeof(source_evidence) = 'array'),
  attachment_evidence jsonb not null check (jsonb_typeof(attachment_evidence) = 'array'),
  outbox_event_id uuid not null unique references integration.outbox_events(event_id)
    on delete restrict,
  correlation_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.archive_command_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  command_name text not null check (command_name in ('validate_change_set', 'publish_change_set')),
  command_payload_sha256 text not null check (command_payload_sha256 ~ '^[a-f0-9]{64}$'),
  change_set_id uuid not null references public.change_sets(id) on delete restrict,
  validation_result_id uuid references public.archive_validation_results(validation_result_id)
    on delete restrict,
  release_id uuid references public.publication_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (actor_account_id, idempotency_key),
  check (
    (command_name = 'validate_change_set' and validation_result_id is not null and release_id is null)
    or (command_name = 'publish_change_set' and release_id is not null)
  )
);

create table if not exists public.archive_publication_failures (
  failure_id uuid primary key default gen_random_uuid(),
  change_set_id uuid references public.change_sets(id) on delete restrict,
  actor_account_id uuid references identity.accounts(account_id) on delete restrict,
  failure_type text not null check (
    failure_type in ('stale_base', 'version_conflict', 'policy_conflict', 'audit_failure')
  ),
  reason text not null,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);

create or replace function public.reject_accountable_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create trigger trg_archive_validation_results_append_only
before update or delete on public.archive_validation_results
for each row execute function public.reject_accountable_evidence_mutation();
create trigger trg_archive_release_evidence_append_only
before update or delete on public.archive_release_evidence
for each row execute function public.reject_accountable_evidence_mutation();
create trigger trg_archive_command_receipts_append_only
before update or delete on public.archive_command_receipts
for each row execute function public.reject_accountable_evidence_mutation();
create trigger trg_archive_publication_failures_append_only
before update or delete on public.archive_publication_failures
for each row execute function public.reject_accountable_evidence_mutation();

create or replace function public.protect_published_change_set()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    raise exception 'Published change sets are immutable' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_published_change_sets_immutable
before update or delete on public.change_sets
for each row execute function public.protect_published_change_set();

-- Retain historical four-eyes batches while admitting explicitly ready
-- single-accountable-approver change sets.
create or replace function public.require_approved_batch_change_set()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.change_sets change_set
    where change_set.id = new.change_set_id
      and (
        (change_set.governance_mode = 'four-eyes-v1' and change_set.status = 'approved')
        or (
          change_set.governance_mode = 'single-accountable-approver-v1'
          and change_set.status in ('ready', 'published')
          and change_set.validation_state = 'ready'
        )
      )
  ) then
    raise exception 'Change set is not eligible for a publication batch'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.publish_accountable_change_set(
  requested_change_set_id uuid,
  requested_actor_id uuid,
  requested_expected_version integer,
  requested_idempotency_key text,
  requested_payload_sha256 text,
  requested_reason text,
  requested_data_version text,
  requested_public_schema_version text,
  requested_database_migration_version text,
  requested_projection_code_version text,
  requested_correlation_id uuid,
  requested_roles jsonb,
  requested_capabilities jsonb,
  requested_recent_auth boolean
)
returns table (
  release_id uuid,
  outbox_event_id uuid,
  previous_release_id uuid,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = public, integration
as $accountable$
declare
  replay public.archive_command_receipts;
  change_set public.change_sets;
  validation public.archive_validation_results;
  current_release_id uuid;
  current_archive_version text;
  new_release public.publication_batches;
  event_id uuid := gen_random_uuid();
  event_time timestamptz := now();
begin
  select * into replay
  from public.archive_command_receipts receipt
  where receipt.actor_account_id = requested_actor_id
    and receipt.idempotency_key = requested_idempotency_key;

  if found then
    if replay.command_name <> 'publish_change_set'
      or replay.command_payload_sha256 <> requested_payload_sha256 then
      raise exception 'Idempotency key was reused with a different command'
        using errcode = '23505';
    end if;
    return query
    select batch.id, evidence.outbox_event_id, batch.previous_batch_id, batch.published_at
    from public.publication_batches batch
    join public.archive_release_evidence evidence on evidence.release_id = batch.id
    where batch.id = replay.release_id;
    return;
  end if;

  select pointer.latest_release_id into current_release_id
  from public.archive_release_pointer pointer
  where pointer.singleton = true
  for update;

  select batch.data_version into current_archive_version
  from public.publication_batches batch
  where batch.id = current_release_id;
  current_archive_version := coalesce(current_archive_version, 'unpublished');

  select * into change_set
  from public.change_sets item
  where item.id = requested_change_set_id
  for update;

  if not found then
    raise exception 'Change set not found' using errcode = 'P0002';
  end if;
  if change_set.governance_mode <> 'single-accountable-approver-v1'
    or change_set.status <> 'ready'
    or change_set.validation_state <> 'ready' then
    raise exception 'Change set is not ready for accountable publication'
      using errcode = '23514';
  end if;
  if change_set.governance_version <> requested_expected_version then
    raise exception 'Change set version conflict' using errcode = '40001';
  end if;
  if change_set.base_archive_version is distinct from current_archive_version then
    raise exception 'Change set base Archive version is stale' using errcode = '40001';
  end if;
  if change_set.origin_context = 'community_intake'
    and change_set.origin_actor_id = requested_actor_id then
    raise exception 'Contributor cannot publish contribution-derived work'
      using errcode = '42501';
  end if;
  if not (requested_capabilities ? 'archive.accountable.publish') then
    raise exception 'Accountable publication capability is required'
      using errcode = '42501';
  end if;
  if change_set.risk_level = 'sensitive' and (
    not (requested_capabilities ? 'archive.sensitive.publish')
    or not requested_recent_auth
  ) then
    raise exception 'Sensitive publication requires Senior capability and recent authentication'
      using errcode = '42501';
  end if;

  select * into validation
  from public.archive_validation_results result
  where result.change_set_id = requested_change_set_id
    and result.outcome = 'ready'
    and result.governance_version = requested_expected_version
    and result.validation_hash = change_set.last_validation_hash
    and result.base_archive_version = current_archive_version
  order by result.created_at desc
  limit 1;

  if not found then
    raise exception 'A matching ready validation result is required'
      using errcode = '23514';
  end if;

  insert into public.publication_batches (
    public_schema_version, data_version, database_migration_version,
    projection_code_version, reason, correlation_id, operation, status,
    created_by, published_by, published_at, previous_batch_id
  ) values (
    requested_public_schema_version, requested_data_version,
    requested_database_migration_version, requested_projection_code_version,
    requested_reason, requested_correlation_id, 'release', 'draft',
    requested_actor_id, null, null, current_release_id
  ) returning * into new_release;

  insert into public.publication_batch_change_sets (batch_id, change_set_id)
  select new_release.id, existing.change_set_id
  from public.publication_batch_change_sets existing
  join public.publication_batches active on active.id = current_release_id
  where existing.batch_id = current_release_id
    and active.operation <> 'withdrawal'
  on conflict do nothing;

  insert into public.publication_batch_change_sets (batch_id, change_set_id)
  values (new_release.id, requested_change_set_id)
  on conflict do nothing;

  update public.publication_batches
  set status = 'published', published_by = requested_actor_id, published_at = event_time
  where id = new_release.id
  returning * into new_release;

  update public.change_sets
  set status = 'published', published_release_id = new_release.id,
      governance_version = governance_version + 1
  where id = requested_change_set_id;

  update public.archive_release_pointer
  set latest_release_id = new_release.id, switched_at = event_time
  where singleton = true;

  insert into integration.outbox_events (
    event_id, event_type, event_version, source_context, aggregate_type,
    aggregate_id, aggregate_version, idempotency_key, correlation_id,
    causation_id, occurred_at, payload
  ) values (
    event_id, 'archive.release.published', 1, 'archive', 'release',
    new_release.id::text, requested_expected_version + 1,
    'archive-release:' || requested_change_set_id::text || ':' || requested_data_version,
    requested_correlation_id, requested_change_set_id, event_time,
    jsonb_build_object(
      'release_id', new_release.id,
      'change_set_id', requested_change_set_id,
      'data_version', requested_data_version,
      'public_schema_version', requested_public_schema_version,
      'database_migration_version', requested_database_migration_version,
      'projection_code_version', requested_projection_code_version,
      'base_archive_version', current_archive_version,
      'previous_release_id', current_release_id,
      'risk_level', change_set.risk_level,
      'validation_result_id', validation.validation_result_id,
      'validation_hash', validation.validation_hash,
      'projection_status', 'pending'
    )
  );

  insert into public.archive_release_evidence (
    release_id, change_set_id, validation_result_id, base_archive_version,
    risk_level, publisher_account_id, publisher_role_snapshot,
    publisher_capability_snapshot, reason, validation_hash, revision_evidence,
    source_evidence, attachment_evidence, outbox_event_id, correlation_id
  ) values (
    new_release.id, requested_change_set_id, validation.validation_result_id,
    current_archive_version, change_set.risk_level, requested_actor_id,
    requested_roles, requested_capabilities, requested_reason,
    validation.validation_hash, validation.revision_evidence,
    validation.source_evidence, validation.attachment_evidence,
    event_id, requested_correlation_id
  );

  insert into public.audit_events (
    event_type, subject_type, subject_id, actor_id, reason, correlation_id, metadata
  ) values (
    'archive.release.published', 'publication_batch', new_release.id,
    requested_actor_id, requested_reason, requested_correlation_id,
    jsonb_build_object(
      'change_set_id', requested_change_set_id,
      'validation_result_id', validation.validation_result_id,
      'base_archive_version', current_archive_version,
      'previous_release_id', current_release_id,
      'risk_level', change_set.risk_level,
      'actor_roles', requested_roles
    )
  );

  insert into public.archive_command_receipts (
    actor_account_id, idempotency_key, command_name,
    command_payload_sha256, change_set_id, release_id
  ) values (
    requested_actor_id, requested_idempotency_key, 'publish_change_set',
    requested_payload_sha256, requested_change_set_id, new_release.id
  );

  return query select new_release.id, event_id, current_release_id, event_time;
end;
$accountable$;

revoke all on function public.publish_accountable_change_set(
  uuid, uuid, integer, text, text, text, text, text, text, text,
  uuid, jsonb, jsonb, boolean
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.publish_accountable_change_set(uuid, uuid, integer, text, text, text, text, text, text, text, uuid, jsonb, jsonb, boolean) to service_role';
  end if;
end
$$;

create or replace view public.change_set_governance_compatibility as
select
  change_set.id,
  change_set.status as stored_status,
  change_set.governance_mode,
  change_set.validation_state,
  change_set.created_by,
  change_set.reviewed_by as legacy_reviewed_by,
  change_set.reviewed_at as legacy_reviewed_at,
  change_set.review_reason as legacy_review_reason,
  change_set.validated_by,
  change_set.validated_at,
  change_set.validation_reason,
  change_set.base_archive_version,
  change_set.governance_version,
  case
    when change_set.status = 'approved' then 'legacy_approved'
    when change_set.status = 'published' then 'published'
    when change_set.validation_state = 'ready' then 'ready'
    when change_set.validation_state = 'validation_failed' then 'validation_failed'
    else change_set.status
  end as effective_state,
  (
    change_set.governance_mode = 'four-eyes-v1'
    and change_set.status in ('submitted', 'approved')
  ) as requires_explicit_revalidation,
  (
    change_set.governance_mode = 'four-eyes-v1'
    and change_set.status = 'approved'
  ) as legacy_publication_eligible,
  change_set.risk_level,
  change_set.origin_context,
  change_set.origin_actor_id,
  change_set.published_release_id,
  (
    change_set.governance_mode = 'single-accountable-approver-v1'
    and change_set.status = 'ready'
    and change_set.validation_state = 'ready'
  ) as accountable_publication_eligible
from public.change_sets change_set;

create or replace view public.archive_publication_metrics as
select
  count(*) filter (where status = 'ready')::bigint as ready_change_sets,
  count(*) filter (where status = 'published')::bigint as published_change_sets,
  count(*) filter (where status = 'publish_failed')::bigint as publish_failed_change_sets,
  (select count(*) from public.archive_publication_failures where failure_type = 'stale_base')::bigint
    as stale_base_failures,
  (select count(*) from public.archive_publication_failures where failure_type in ('version_conflict', 'policy_conflict'))::bigint
    as conflict_failures,
  (select count(*) from integration.outbox_events where source_context = 'archive' and event_type = 'archive.release.published' and published_at is null)::bigint
    as pending_outbox_events,
  coalesce((select extract(epoch from (now() - min(occurred_at)))::bigint from integration.outbox_events where source_context = 'archive' and event_type = 'archive.release.published' and published_at is null), 0)
    as oldest_outbox_lag_seconds,
  (select count(*) from public.archive_release_evidence evidence where not exists (select 1 from public.public_release_pointer pointer where pointer.active_batch_id = evidence.release_id))::bigint
    as projection_lag_releases
from public.change_sets
where governance_mode = 'single-accountable-approver-v1';

insert into identity.capabilities (capability_key, description, sensitive) values
  ('archive.accountable.validate', 'Validate a Change Set against the current Archive base.', true),
  ('archive.accountable.publish', 'Publish one ready Change Set as an immutable Archive Release.', true),
  ('archive.accountable.metrics', 'Read accountable publication and projection-lag metrics.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('archive_editor', 'archive.accountable.validate'),
  ('archive_editor', 'archive.accountable.publish'),
  ('archive_editor', 'archive.accountable.metrics'),
  ('senior_archive_editor', 'archive.accountable.validate'),
  ('senior_archive_editor', 'archive.accountable.publish'),
  ('senior_archive_editor', 'archive.accountable.metrics')
on conflict do nothing;

alter table public.archive_validation_results enable row level security;
alter table public.archive_release_pointer enable row level security;
alter table public.archive_release_evidence enable row level security;
alter table public.archive_command_receipts enable row level security;
alter table public.archive_publication_failures enable row level security;

revoke all on public.archive_validation_results from public;
revoke all on public.archive_release_pointer from public;
revoke all on public.archive_release_evidence from public;
revoke all on public.archive_command_receipts from public;
revoke all on public.archive_publication_failures from public;

comment on table public.archive_validation_results is
  'Append-only Curation validation evidence for single-accountable publication.';
comment on table public.archive_release_evidence is
  'Immutable attribution, source, diff, validation, actor, audit, and Outbox evidence for one Archive Release.';
comment on table public.archive_command_receipts is
  'Idempotency receipts resolved before optimistic-concurrency validation.';
comment on table public.archive_release_pointer is
  'Authoritative Archive head; deliberately separate from the successful Public Projection pointer.';
comment on function public.publish_accountable_change_set(
  uuid, uuid, integer, text, text, text, text, text, text, text,
  uuid, jsonb, jsonb, boolean
) is 'Atomically publishes one ready Change Set, immutable Release, audit evidence, and Outbox event without switching the public pointer.';

commit;
