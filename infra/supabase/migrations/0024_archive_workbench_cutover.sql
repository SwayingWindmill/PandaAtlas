begin;

-- Archive publication cutover control is independent from the application
-- feature flag. Holding publication blocks creation of every new publication
-- batch while preserving existing Releases, audit, Outbox, and projection data.
create table if not exists public.archive_publication_cutover_control (
  singleton boolean primary key default true check (singleton),
  state text not null default 'open' check (state in ('open', 'held')),
  version integer not null default 1 check (version >= 1),
  reason text not null default 'Initial accountable publication cutover state.',
  changed_by uuid references identity.accounts(account_id) on delete restrict,
  changed_at timestamptz not null default now(),
  check (singleton)
);

insert into public.archive_publication_cutover_control (
  singleton, state, version, reason
) values (
  true, 'open', 1, 'Initial accountable publication cutover state.'
) on conflict (singleton) do nothing;

create table if not exists public.archive_cutover_command_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  command_payload_sha256 text not null check (command_payload_sha256 ~ '^[a-f0-9]{64}$'),
  requested_state text not null check (requested_state in ('open', 'held')),
  resulting_version integer not null check (resulting_version >= 1),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (actor_account_id, idempotency_key)
);

create table if not exists public.archive_cutover_audit (
  cutover_audit_id uuid primary key default gen_random_uuid(),
  previous_state text not null check (previous_state in ('open', 'held')),
  next_state text not null check (next_state in ('open', 'held')),
  previous_version integer not null check (previous_version >= 1),
  next_version integer not null check (next_version >= 1),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  actor_role_snapshot jsonb not null check (jsonb_typeof(actor_role_snapshot) = 'array'),
  actor_capability_snapshot jsonb not null check (
    jsonb_typeof(actor_capability_snapshot) = 'array'
  ),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  check (next_version = previous_version + 1)
);

create or replace function public.reject_archive_cutover_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

drop trigger if exists trg_archive_cutover_command_receipts_append_only
  on public.archive_cutover_command_receipts;
create trigger trg_archive_cutover_command_receipts_append_only
before update or delete on public.archive_cutover_command_receipts
for each row execute function public.reject_archive_cutover_evidence_mutation();

drop trigger if exists trg_archive_cutover_audit_append_only
  on public.archive_cutover_audit;
create trigger trg_archive_cutover_audit_append_only
before update or delete on public.archive_cutover_audit
for each row execute function public.reject_archive_cutover_evidence_mutation();

create or replace function public.block_publication_batch_when_cutover_held()
returns trigger
language plpgsql
as $$
declare
  cutover_state text;
begin
  select control.state into cutover_state
  from public.archive_publication_cutover_control control
  where control.singleton = true
  for share;

  if cutover_state = 'held' then
    raise exception 'Archive publication is held for migration cutover'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_publication_batches_cutover_hold
  on public.publication_batches;
create trigger trg_publication_batches_cutover_hold
before insert on public.publication_batches
for each row execute function public.block_publication_batch_when_cutover_held();

create or replace function public.set_archive_publication_cutover(
  requested_actor_id uuid,
  requested_expected_version integer,
  requested_state text,
  requested_idempotency_key text,
  requested_payload_sha256 text,
  requested_reason text,
  requested_correlation_id uuid,
  requested_roles jsonb,
  requested_capabilities jsonb,
  requested_recent_auth boolean
)
returns public.archive_publication_cutover_control
language plpgsql
security definer
set search_path = public
as $cutover$
declare
  replay public.archive_cutover_command_receipts;
  control public.archive_publication_cutover_control;
  previous_state text;
  previous_version integer;
begin
  -- Idempotent replay is resolved before the version lock.
  select * into replay
  from public.archive_cutover_command_receipts receipt
  where receipt.actor_account_id = requested_actor_id
    and receipt.idempotency_key = requested_idempotency_key;

  if found then
    if replay.command_payload_sha256 <> requested_payload_sha256
      or replay.requested_state <> requested_state then
      raise exception 'Idempotency key was reused with a different cutover command'
        using errcode = '23505';
    end if;
    select * into control
    from public.archive_publication_cutover_control item
    where item.singleton = true;
    return control;
  end if;

  if requested_state not in ('open', 'held') then
    raise exception 'Unsupported Archive cutover state' using errcode = '22023';
  end if;
  if not (requested_capabilities ? 'archive.cutover.manage') then
    raise exception 'Archive cutover capability is required' using errcode = '42501';
  end if;
  if not requested_recent_auth then
    raise exception 'Archive cutover requires recent authentication'
      using errcode = '42501';
  end if;

  select * into control
  from public.archive_publication_cutover_control item
  where item.singleton = true
  for update;

  if control.version <> requested_expected_version then
    raise exception 'Archive cutover version conflict' using errcode = '40001';
  end if;

  previous_state := control.state;
  previous_version := control.version;

  update public.archive_publication_cutover_control
  set state = requested_state,
      version = previous_version + 1,
      reason = requested_reason,
      changed_by = requested_actor_id,
      changed_at = now()
  where singleton = true
  returning * into control;

  insert into public.archive_cutover_command_receipts (
    actor_account_id, idempotency_key, command_payload_sha256,
    requested_state, resulting_version, reason, correlation_id
  ) values (
    requested_actor_id, requested_idempotency_key, requested_payload_sha256,
    requested_state, control.version, requested_reason, requested_correlation_id
  );

  insert into public.archive_cutover_audit (
    previous_state, next_state, previous_version, next_version,
    actor_account_id, actor_role_snapshot, actor_capability_snapshot,
    reason, correlation_id
  ) values (
    previous_state, requested_state, previous_version, control.version,
    requested_actor_id, requested_roles, requested_capabilities,
    requested_reason, requested_correlation_id
  );

  insert into public.audit_events (
    event_type, subject_type, subject_id, actor_id, reason, correlation_id, metadata
  ) values (
    'archive.publication_cutover.' || requested_state,
    'archive_publication_cutover', requested_correlation_id,
    requested_actor_id, requested_reason, requested_correlation_id,
    jsonb_build_object(
      'previous_state', previous_state,
      'next_state', requested_state,
      'previous_version', previous_version,
      'next_version', control.version
    )
  );

  return control;
end;
$cutover$;

create or replace view public.archive_workbench_queue as
select
  'change_set'::text as item_type,
  change_set.id as item_id,
  case
    when change_set.status = 'publish_failed' then 'publish_failed'
    when change_set.risk_level = 'sensitive' then 'sensitive_ready'
    else 'ordinary_ready'
  end as queue,
  change_set.title,
  change_set.status,
  change_set.risk_level,
  change_set.governance_version as version,
  change_set.base_archive_version,
  change_set.published_release_id as release_id,
  null::uuid as operation_id,
  change_set.created_at as created_at,
  coalesce(change_set.validated_at, change_set.created_at) as updated_at
from public.change_sets change_set
where change_set.governance_mode = 'single-accountable-approver-v1'
  and change_set.status in ('ready', 'publish_failed')
union all
select
  'release'::text,
  release.id,
  'projection_lag'::text,
  'Release ' || release.data_version,
  release.status,
  evidence.risk_level,
  1,
  evidence.base_archive_version,
  release.id,
  null::uuid,
  release.created_at,
  coalesce(release.published_at, release.created_at)
from public.publication_batches release
join public.archive_release_evidence evidence on evidence.release_id = release.id
cross join public.public_release_pointer public_pointer
where public_pointer.singleton = true
  and release.status = 'published'
  and public_pointer.active_batch_id is distinct from release.id
union all
select
  'operation'::text,
  operation.operation_id,
  case
    when operation.operation_type = 'emergency_takedown'
      and completion.operation_id is null then 'emergency_followup'
    else operation.operation_type
  end,
  initcap(replace(operation.operation_type, '_', ' ')),
  case
    when public_pointer.active_batch_id = operation.release_id then 'projected'
    else 'pending'
  end,
  operation.risk_level,
  1,
  null::text,
  operation.release_id,
  operation.operation_id,
  operation.created_at,
  operation.created_at
from public.archive_operation_records operation
cross join public.public_release_pointer public_pointer
left join public.archive_emergency_followup_completions completion
  on completion.operation_id = operation.operation_id
where public_pointer.singleton = true;

create or replace view public.archive_workbench_metrics as
select
  (select count(*) from public.archive_workbench_queue
    where queue = 'ordinary_ready')::integer as ordinary_ready,
  (select count(*) from public.archive_workbench_queue
    where queue = 'sensitive_ready')::integer as sensitive_ready,
  (select count(*) from public.archive_workbench_queue
    where queue = 'publish_failed')::integer as publish_failed,
  (select count(*) from public.archive_workbench_queue
    where queue = 'projection_lag')::integer as projection_lag,
  (select count(*) from public.archive_workbench_queue
    where queue = 'emergency_followup')::integer as emergency_followup,
  control.state as cutover_state,
  control.version as cutover_version
from public.archive_publication_cutover_control control
where control.singleton = true;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('archive.workbench.read', 'Read bounded Archive workbench queues, evidence, and operation status.', true),
  ('archive.cutover.manage', 'Hold or resume Archive publication during migration cutover.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('archive_editor', 'archive.workbench.read'),
  ('senior_archive_editor', 'archive.workbench.read'),
  ('senior_archive_editor', 'archive.cutover.manage')
on conflict do nothing;

revoke all on function public.set_archive_publication_cutover(
  uuid, integer, text, text, text, text, uuid, jsonb, jsonb, boolean
) from public;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.set_archive_publication_cutover(
      uuid, integer, text, text, text, text, uuid, jsonb, jsonb, boolean
    ) to service_role;
  end if;
end
$grants$;

alter table public.archive_publication_cutover_control enable row level security;
alter table public.archive_cutover_command_receipts enable row level security;
alter table public.archive_cutover_audit enable row level security;

do $policies$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'archive_publication_cutover_control',
    'archive_cutover_command_receipts',
    'archive_cutover_audit'
  ] loop
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('drop policy if exists %I on public.%I', relation_name || '_backend', relation_name);
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        relation_name || '_backend',
        relation_name
      );
    end if;
  end loop;
end
$policies$;

commit;
