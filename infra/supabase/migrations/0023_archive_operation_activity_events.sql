begin;

-- A correction or retraction operation emits one Activity source event in the
-- same transaction as its immutable Archive Release. The Activity projector
-- later emits activity.item.corrected/retracted, which is the only notification
-- input and therefore prevents duplicate correction messages.
create table if not exists public.archive_operation_activity_events (
  operation_id uuid primary key references public.archive_operation_records(operation_id)
    on delete restrict,
  source_event_id uuid not null unique references integration.outbox_events(event_id)
    on delete restrict,
  source_id text not null,
  source_version integer not null check (source_version >= 1),
  action text not null check (action in ('correction', 'retraction')),
  created_at timestamptz not null default now(),
  unique (source_id, source_version, action)
);

create or replace function public.emit_archive_operation_activity_source()
returns trigger
language plpgsql
security definer
set search_path = public, integration
as $activity_source$
declare
  descriptor jsonb;
  expected_action text;
  source_id text;
  source_version integer;
  source_event_id uuid := gen_random_uuid();
  release public.publication_batches;
  provenance jsonb;
  event_payload jsonb;
begin
  if new.operation_type not in ('targeted_correction', 'retraction') then
    return new;
  end if;

  descriptor := new.effect_payload -> 'activity_descriptor';
  if descriptor is null or jsonb_typeof(descriptor) <> 'object' then
    raise exception 'Correction and retraction require an Activity descriptor'
      using errcode = '23514';
  end if;

  expected_action := case
    when new.operation_type = 'targeted_correction' then 'correction'
    else 'retraction'
  end;
  if descriptor ->> 'action' is distinct from expected_action then
    raise exception 'Activity descriptor action does not match Archive operation'
      using errcode = '23514';
  end if;

  source_id := nullif(trim(descriptor ->> 'source_id'), '');
  if source_id is null then
    raise exception 'Activity descriptor source_id is required'
      using errcode = '23514';
  end if;
  if descriptor -> 'targets' is null
    or jsonb_typeof(descriptor -> 'targets') <> 'array'
    or jsonb_array_length(descriptor -> 'targets') = 0 then
    raise exception 'Activity descriptor targets are required'
      using errcode = '23514';
  end if;
  if descriptor -> 'localized_snapshots' is null
    or jsonb_typeof(descriptor -> 'localized_snapshots') <> 'array'
    or jsonb_array_length(descriptor -> 'localized_snapshots') = 0 then
    raise exception 'Activity descriptor localized snapshots are required'
      using errcode = '23514';
  end if;
  if expected_action = 'retraction'
    and nullif(trim(descriptor ->> 'retraction_reason'), '') is null then
    raise exception 'Activity retraction requires a public-safe reason'
      using errcode = '23514';
  end if;

  select * into release
  from public.publication_batches batch
  where batch.id = new.release_id
    and batch.status = 'published';
  if not found then
    raise exception 'Archive operation Release is missing or unpublished'
      using errcode = 'P0002';
  end if;

  select coalesce(max(event.aggregate_version), 0) + 1
  into source_version
  from integration.outbox_events event
  where event.source_context = 'archive'
    and event.aggregate_type = 'activity_source'
    and event.aggregate_id = source_id;

  provenance := coalesce(descriptor -> 'provenance', '{}'::jsonb)
    || jsonb_build_object(
      'release_id', release.id,
      'data_version', release.data_version,
      'public_schema_version', release.public_schema_version,
      'projection_code_version', release.projection_code_version
    );

  event_payload := (
    descriptor
      - 'source_id'
      - 'action'
      - 'retraction_reason'
      - 'provenance'
  ) || jsonb_build_object(
    'event_id', source_event_id,
    'source_type', 'archive.release',
    'source_id', source_id,
    'source_version', source_version,
    'action', expected_action,
    'published_at', release.published_at,
    'retraction_reason', descriptor -> 'retraction_reason',
    'correlation_id', new.correlation_id,
    'causation_id', new.operation_id,
    'is_backfill', false,
    'provenance', provenance
  );

  insert into integration.outbox_events (
    event_id, event_type, event_version, source_context, aggregate_type,
    aggregate_id, aggregate_version, idempotency_key, correlation_id,
    causation_id, occurred_at, payload
  ) values (
    source_event_id,
    case
      when expected_action = 'correction' then 'archive.activity.corrected'
      else 'archive.activity.retracted'
    end,
    1,
    'archive',
    'activity_source',
    source_id,
    source_version,
    'archive-operation-activity:' || new.operation_id::text || ':' || source_id,
    new.correlation_id,
    new.operation_id,
    release.published_at,
    event_payload
  );

  insert into public.archive_operation_activity_events (
    operation_id, source_event_id, source_id, source_version, action
  ) values (
    new.operation_id, source_event_id, source_id, source_version, expected_action
  );

  return new;
end;
$activity_source$;

drop trigger if exists trg_archive_operation_activity_source
  on public.archive_operation_records;
create trigger trg_archive_operation_activity_source
after insert on public.archive_operation_records
for each row execute function public.emit_archive_operation_activity_source();

create trigger trg_archive_operation_activity_events_append_only
before update or delete on public.archive_operation_activity_events
for each row execute function public.reject_archive_operation_evidence_mutation();

alter table public.archive_operation_activity_events enable row level security;

do $policy$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    create policy archive_operation_activity_events_backend
      on public.archive_operation_activity_events
      for all to service_role
      using (true)
      with check (true);
  end if;
end
$policy$;

commit;
