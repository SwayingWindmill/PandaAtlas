begin;

-- Accountable Archive operations never rewrite a published Release. Every
-- correction, rollback, retraction, merge/split, or emergency takedown creates
-- a new immutable Release and an Outbox event for Public Projection.
create table if not exists public.archive_operation_records (
  operation_id uuid primary key default gen_random_uuid(),
  release_id uuid not null unique references public.publication_batches(id) on delete restrict,
  operation_type text not null check (operation_type in (
    'rollback',
    'targeted_correction',
    'retraction',
    'merge',
    'split',
    'emergency_takedown'
  )),
  target_release_id uuid references public.publication_batches(id) on delete restrict,
  subject jsonb check (subject is null or jsonb_typeof(subject) = 'object'),
  source_entities jsonb not null default '[]'::jsonb check (
    jsonb_typeof(source_entities) = 'array'
  ),
  destination_entities jsonb not null default '[]'::jsonb check (
    jsonb_typeof(destination_entities) = 'array'
  ),
  effect_payload jsonb not null check (jsonb_typeof(effect_payload) = 'object'),
  impact_preview jsonb not null check (jsonb_typeof(impact_preview) = 'object'),
  risk_level text not null check (risk_level in ('ordinary', 'sensitive')),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  actor_role_snapshot jsonb not null check (jsonb_typeof(actor_role_snapshot) = 'array'),
  actor_capability_snapshot jsonb not null check (
    jsonb_typeof(actor_capability_snapshot) = 'array'
  ),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  correlation_id uuid not null,
  outbox_event_id uuid not null unique references integration.outbox_events(event_id)
    on delete restrict,
  followup_due_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (operation_type = 'rollback' and target_release_id is not null)
    or (operation_type <> 'rollback')
  ),
  check (
    (operation_type = 'emergency_takedown' and followup_due_at is not null)
    or (operation_type <> 'emergency_takedown' and followup_due_at is null)
  )
);

create index if not exists idx_archive_operation_records_type_time
  on public.archive_operation_records(operation_type, created_at desc);
create index if not exists idx_archive_operation_records_projection
  on public.archive_operation_records(release_id, created_at desc);
create index if not exists idx_archive_operation_records_followup
  on public.archive_operation_records(followup_due_at)
  where operation_type = 'emergency_takedown';

create table if not exists public.archive_operation_command_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  command_name text not null check (
    command_name in ('execute_archive_operation', 'complete_emergency_followup')
  ),
  command_payload_sha256 text not null check (command_payload_sha256 ~ '^[a-f0-9]{64}$'),
  operation_id uuid not null references public.archive_operation_records(operation_id)
    on delete restrict,
  followup_change_set_id uuid references public.change_sets(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (actor_account_id, idempotency_key)
);

create table if not exists public.archive_emergency_followup_completions (
  operation_id uuid primary key references public.archive_operation_records(operation_id)
    on delete restrict,
  followup_change_set_id uuid not null references public.change_sets(id) on delete restrict,
  completed_by uuid not null references identity.accounts(account_id) on delete restrict,
  reason text not null check (length(trim(reason)) between 3 and 2000),
  correlation_id uuid not null,
  completed_at timestamptz not null default now()
);

create or replace function public.reject_archive_operation_evidence_mutation()
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
    'archive_operation_records',
    'archive_operation_command_receipts',
    'archive_emergency_followup_completions'
  ] loop
    execute format('drop trigger if exists trg_%I_append_only on public.%I', relation_name, relation_name);
    execute format(
      'create trigger trg_%I_append_only before update or delete on public.%I '
      || 'for each row execute function public.reject_archive_operation_evidence_mutation()',
      relation_name,
      relation_name
    );
  end loop;
end
$append_only$;

create or replace function public.execute_accountable_archive_operation(
  requested_operation_type text,
  requested_expected_archive_release_id uuid,
  requested_target_release_id uuid,
  requested_actor_id uuid,
  requested_idempotency_key text,
  requested_payload_sha256 text,
  requested_reason text,
  requested_data_version text,
  requested_public_schema_version text,
  requested_database_migration_version text,
  requested_projection_code_version text,
  requested_risk_level text,
  requested_subject jsonb,
  requested_source_entities jsonb,
  requested_destination_entities jsonb,
  requested_effect_payload jsonb,
  requested_impact_preview jsonb,
  requested_correlation_id uuid,
  requested_roles jsonb,
  requested_capabilities jsonb,
  requested_recent_auth boolean
)
returns table (
  operation_id uuid,
  release_id uuid,
  outbox_event_id uuid,
  followup_due_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, integration
as $operation$
declare
  replay public.archive_operation_command_receipts;
  existing_operation public.archive_operation_records;
  current_release_id uuid;
  current_release public.publication_batches;
  target_release public.publication_batches;
  new_release public.publication_batches;
  new_operation_id uuid := gen_random_uuid();
  new_event_id uuid := gen_random_uuid();
  event_time timestamptz := now();
  due_at timestamptz;
  publication_operation text := 'release';
  rollback_is_complex boolean := false;
  required_capability text;
begin
  -- Replay resolution intentionally precedes optimistic concurrency and policy.
  select * into replay
  from public.archive_operation_command_receipts receipt
  where receipt.actor_account_id = requested_actor_id
    and receipt.idempotency_key = requested_idempotency_key;

  if found then
    if replay.command_name <> 'execute_archive_operation'
      or replay.command_payload_sha256 <> requested_payload_sha256 then
      raise exception 'Idempotency key was reused with a different Archive operation'
        using errcode = '23505';
    end if;
    select * into existing_operation
    from public.archive_operation_records record
    where record.operation_id = replay.operation_id;
    return query select
      existing_operation.operation_id,
      existing_operation.release_id,
      existing_operation.outbox_event_id,
      existing_operation.followup_due_at,
      existing_operation.created_at;
    return;
  end if;

  if requested_operation_type not in (
    'rollback',
    'targeted_correction',
    'retraction',
    'merge',
    'split',
    'emergency_takedown'
  ) then
    raise exception 'Unsupported Archive operation type' using errcode = '22023';
  end if;
  if requested_risk_level not in ('ordinary', 'sensitive') then
    raise exception 'Unsupported Archive risk level' using errcode = '22023';
  end if;
  if jsonb_typeof(requested_effect_payload) <> 'object'
    or requested_effect_payload = '{}'::jsonb then
    raise exception 'Archive operation effect payload is required' using errcode = '22023';
  end if;
  if jsonb_typeof(requested_impact_preview) <> 'object' then
    raise exception 'Archive operation impact preview is required' using errcode = '22023';
  end if;

  select pointer.latest_release_id into current_release_id
  from public.archive_release_pointer pointer
  where pointer.singleton = true
  for update;

  if current_release_id is distinct from requested_expected_archive_release_id then
    raise exception 'Archive release version conflict' using errcode = '40001';
  end if;

  select * into current_release
  from public.publication_batches batch
  where batch.id = current_release_id and batch.status = 'published';
  if not found then
    raise exception 'Current Archive Release is missing' using errcode = 'P0002';
  end if;

  if requested_target_release_id is not null then
    select * into target_release
    from public.publication_batches batch
    where batch.id = requested_target_release_id and batch.status = 'published';
    if not found then
      raise exception 'Target Archive Release is missing or unpublished' using errcode = 'P0002';
    end if;
  end if;

  if requested_operation_type = 'rollback' then
    if requested_target_release_id is null then
      raise exception 'Rollback requires a target Release' using errcode = '22023';
    end if;
    publication_operation := 'rollback';
    rollback_is_complex := current_release.previous_batch_id is distinct from requested_target_release_id;
    required_capability := case
      when rollback_is_complex or requested_risk_level = 'sensitive'
        then 'archive.sensitive.rollback'
      else 'archive.accountable.rollback'
    end;
  elsif requested_operation_type in ('targeted_correction', 'retraction') then
    required_capability := case
      when requested_risk_level = 'sensitive' then 'archive.sensitive.correct'
      else 'archive.accountable.correct'
    end;
  elsif requested_operation_type in ('merge', 'split') then
    required_capability := 'archive.sensitive.merge_split';
  else
    required_capability := 'archive.sensitive.takedown';
  end if;

  if not (requested_capabilities ? required_capability) then
    raise exception 'Required Archive operation capability is missing'
      using errcode = '42501';
  end if;
  if (
    requested_risk_level = 'sensitive'
    or rollback_is_complex
    or requested_operation_type in ('merge', 'split', 'emergency_takedown')
  ) and not requested_recent_auth then
    raise exception 'Sensitive Archive operation requires recent authentication'
      using errcode = '42501';
  end if;
  if requested_operation_type = 'emergency_takedown'
    and coalesce((requested_effect_payload ->> 'reduction_only')::boolean, false) is not true then
    raise exception 'Emergency takedown may only reduce public exposure'
      using errcode = '23514';
  end if;

  if requested_operation_type = 'emergency_takedown' then
    due_at := event_time + interval '1 day';
  end if;

  insert into public.publication_batches (
    public_schema_version, data_version, database_migration_version,
    projection_code_version, reason, correlation_id, operation, status,
    created_by, published_by, published_at, previous_batch_id,
    rollback_target_id, withdrawal_target_id
  ) values (
    requested_public_schema_version, requested_data_version,
    requested_database_migration_version, requested_projection_code_version,
    requested_reason, requested_correlation_id, publication_operation, 'draft',
    requested_actor_id, null, null, current_release_id,
    case when publication_operation = 'rollback' then requested_target_release_id end,
    null
  ) returning * into new_release;

  insert into public.publication_batch_change_sets (batch_id, change_set_id)
  select new_release.id, existing.change_set_id
  from public.publication_batch_change_sets existing
  where existing.batch_id = case
    when publication_operation = 'rollback' then requested_target_release_id
    else current_release_id
  end
  on conflict do nothing;

  update public.publication_batches
  set status = 'published', published_by = requested_actor_id, published_at = event_time
  where id = new_release.id
  returning * into new_release;

  update public.archive_release_pointer
  set latest_release_id = new_release.id, switched_at = event_time
  where singleton = true;

  insert into integration.outbox_events (
    event_id, event_type, event_version, source_context, aggregate_type,
    aggregate_id, aggregate_version, idempotency_key, correlation_id,
    causation_id, occurred_at, payload
  ) values (
    new_event_id,
    'archive.operation.' || requested_operation_type,
    1,
    'archive',
    'archive_operation',
    new_operation_id::text,
    1,
    'archive-operation:' || new_operation_id::text,
    requested_correlation_id,
    new_release.id,
    event_time,
    jsonb_build_object(
      'operation_id', new_operation_id,
      'release_id', new_release.id,
      'operation_type', requested_operation_type,
      'target_release_id', requested_target_release_id,
      'previous_release_id', current_release_id,
      'data_version', requested_data_version,
      'risk_level', requested_risk_level,
      'subject', requested_subject,
      'source_entities', requested_source_entities,
      'destination_entities', requested_destination_entities,
      'effect_payload', requested_effect_payload,
      'impact_preview', requested_impact_preview,
      'projection_status', 'pending',
      'notification_eligible', requested_operation_type in (
        'targeted_correction', 'retraction', 'emergency_takedown'
      ),
      'followup_due_at', due_at
    )
  );

  insert into public.archive_operation_records (
    operation_id, release_id, operation_type, target_release_id,
    subject, source_entities, destination_entities, effect_payload,
    impact_preview, risk_level, actor_account_id, actor_role_snapshot,
    actor_capability_snapshot, reason, correlation_id, outbox_event_id,
    followup_due_at, created_at
  ) values (
    new_operation_id, new_release.id, requested_operation_type,
    requested_target_release_id, requested_subject,
    coalesce(requested_source_entities, '[]'::jsonb),
    coalesce(requested_destination_entities, '[]'::jsonb),
    requested_effect_payload, requested_impact_preview, requested_risk_level,
    requested_actor_id, requested_roles, requested_capabilities,
    requested_reason, requested_correlation_id, new_event_id, due_at, event_time
  );

  insert into public.archive_operation_command_receipts (
    actor_account_id, idempotency_key, command_name,
    command_payload_sha256, operation_id
  ) values (
    requested_actor_id, requested_idempotency_key, 'execute_archive_operation',
    requested_payload_sha256, new_operation_id
  );

  insert into public.audit_events (
    event_type, subject_type, subject_id, actor_id, reason, correlation_id, metadata
  ) values (
    'archive.operation.' || requested_operation_type,
    'archive_operation', new_operation_id, requested_actor_id,
    requested_reason, requested_correlation_id,
    jsonb_build_object(
      'release_id', new_release.id,
      'target_release_id', requested_target_release_id,
      'risk_level', requested_risk_level,
      'required_capability', required_capability,
      'followup_due_at', due_at
    )
  );

  return query select new_operation_id, new_release.id, new_event_id, due_at, event_time;
end;
$operation$;

create or replace function public.complete_emergency_takedown_followup(
  requested_operation_id uuid,
  requested_followup_change_set_id uuid,
  requested_actor_id uuid,
  requested_idempotency_key text,
  requested_payload_sha256 text,
  requested_reason text,
  requested_correlation_id uuid,
  requested_capabilities jsonb,
  requested_recent_auth boolean
)
returns public.archive_emergency_followup_completions
language plpgsql
security definer
set search_path = public
as $followup$
declare
  replay public.archive_operation_command_receipts;
  operation public.archive_operation_records;
  change_set public.change_sets;
  result public.archive_emergency_followup_completions;
begin
  select * into replay
  from public.archive_operation_command_receipts receipt
  where receipt.actor_account_id = requested_actor_id
    and receipt.idempotency_key = requested_idempotency_key;

  if found then
    if replay.command_name <> 'complete_emergency_followup'
      or replay.command_payload_sha256 <> requested_payload_sha256
      or replay.operation_id <> requested_operation_id
      or replay.followup_change_set_id <> requested_followup_change_set_id then
      raise exception 'Idempotency key was reused with a different follow-up command'
        using errcode = '23505';
    end if;
    select * into result
    from public.archive_emergency_followup_completions completion
    where completion.operation_id = requested_operation_id;
    return result;
  end if;

  select * into operation
  from public.archive_operation_records record
  where record.operation_id = requested_operation_id
    and record.operation_type = 'emergency_takedown';
  if not found then
    raise exception 'Emergency takedown operation was not found' using errcode = 'P0002';
  end if;

  select * into change_set
  from public.change_sets item
  where item.id = requested_followup_change_set_id;
  if not found or change_set.governance_mode <> 'single-accountable-approver-v1'
    or change_set.status not in ('ready', 'published') then
    raise exception 'Follow-up must reference a formal accountable Change Set'
      using errcode = '23514';
  end if;

  if not (requested_capabilities ? 'archive.sensitive.takedown')
    or not requested_recent_auth then
    raise exception 'Emergency follow-up requires Senior capability and recent authentication'
      using errcode = '42501';
  end if;

  insert into public.archive_emergency_followup_completions (
    operation_id, followup_change_set_id, completed_by, reason, correlation_id
  ) values (
    requested_operation_id, requested_followup_change_set_id,
    requested_actor_id, requested_reason, requested_correlation_id
  ) returning * into result;

  insert into public.archive_operation_command_receipts (
    actor_account_id, idempotency_key, command_name, command_payload_sha256,
    operation_id, followup_change_set_id
  ) values (
    requested_actor_id, requested_idempotency_key, 'complete_emergency_followup',
    requested_payload_sha256, requested_operation_id, requested_followup_change_set_id
  );

  insert into public.audit_events (
    event_type, subject_type, subject_id, actor_id, reason, correlation_id, metadata
  ) values (
    'archive.emergency_takedown.followup_completed',
    'archive_operation', requested_operation_id, requested_actor_id,
    requested_reason, requested_correlation_id,
    jsonb_build_object('followup_change_set_id', requested_followup_change_set_id)
  );

  return result;
end;
$followup$;

create or replace view public.archive_operation_metrics as
select
  count(*) filter (where operation_type = 'rollback')::integer as rollback_count,
  count(*) filter (where operation_type = 'targeted_correction')::integer
    as targeted_correction_count,
  count(*) filter (where operation_type = 'retraction')::integer as retraction_count,
  count(*) filter (where operation_type = 'merge')::integer as merge_count,
  count(*) filter (where operation_type = 'split')::integer as split_count,
  count(*) filter (where operation_type = 'emergency_takedown')::integer
    as emergency_takedown_count,
  count(*) filter (
    where public_pointer.active_batch_id is distinct from record.release_id
  )::integer as pending_projection_count,
  count(*) filter (
    where record.operation_type = 'emergency_takedown'
      and record.followup_due_at < now()
      and completion.operation_id is null
  )::integer as overdue_emergency_followup_count
from public.archive_operation_records record
cross join public.public_release_pointer public_pointer
left join public.archive_emergency_followup_completions completion
  on completion.operation_id = record.operation_id
where public_pointer.singleton = true;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('archive.accountable.rollback', 'Create an ordinary latest-release rollback as a new immutable Archive Release.', true),
  ('archive.accountable.correct', 'Create an ordinary targeted correction or retraction Release.', true),
  ('archive.sensitive.rollback', 'Create a sensitive or complex rollback Release.', true),
  ('archive.sensitive.correct', 'Create a sensitive targeted correction or retraction Release.', true),
  ('archive.sensitive.merge_split', 'Execute audited entity merge or split Releases.', true),
  ('archive.sensitive.takedown', 'Execute and close emergency public-risk takedowns.', true),
  ('archive.accountable.operation_metrics', 'Read Archive operation and follow-up metrics.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('archive_editor', 'archive.accountable.rollback'),
  ('archive_editor', 'archive.accountable.correct'),
  ('archive_editor', 'archive.accountable.operation_metrics'),
  ('senior_archive_editor', 'archive.accountable.rollback'),
  ('senior_archive_editor', 'archive.accountable.correct'),
  ('senior_archive_editor', 'archive.sensitive.rollback'),
  ('senior_archive_editor', 'archive.sensitive.correct'),
  ('senior_archive_editor', 'archive.sensitive.merge_split'),
  ('senior_archive_editor', 'archive.sensitive.takedown'),
  ('senior_archive_editor', 'archive.accountable.operation_metrics')
on conflict do nothing;

revoke all on function public.execute_accountable_archive_operation(
  text, uuid, uuid, uuid, text, text, text, text, text, text, text,
  text, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, jsonb, jsonb, boolean
) from public;
revoke all on function public.complete_emergency_takedown_followup(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, boolean
) from public;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.execute_accountable_archive_operation(
      text, uuid, uuid, uuid, text, text, text, text, text, text, text,
      text, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, jsonb, jsonb, boolean
    ) to service_role;
    grant execute on function public.complete_emergency_takedown_followup(
      uuid, uuid, uuid, text, text, text, uuid, jsonb, boolean
    ) to service_role;
  end if;
end
$grants$;

alter table public.archive_operation_records enable row level security;
alter table public.archive_operation_command_receipts enable row level security;
alter table public.archive_emergency_followup_completions enable row level security;

do $policies$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'archive_operation_records',
    'archive_operation_command_receipts',
    'archive_emergency_followup_completions'
  ] loop
    execute format('drop policy if exists %I on public.%I', relation_name || '_backend', relation_name);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
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
