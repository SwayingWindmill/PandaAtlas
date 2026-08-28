-- Independent panda-data runtime boundary.
-- Python owns only technical pipeline state and reads owner-published export views.
-- It never receives direct authoritative business-table writes or generic PGMQ access.

begin;

create schema if not exists pipeline;
comment on schema pipeline is
  'Private technical state for the independent panda-data batch runtime; never authoritative PandaAtlas business truth.';

-- Technical pipeline state -----------------------------------------------------

create table pipeline.jobs (
  job_id uuid primary key,
  job_type text not null check (job_type ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  contract_version text not null default 'panda-data.pipeline-job/v1'
    check (contract_version = 'panda-data.pipeline-job/v1'),
  correlation_id uuid not null,
  state text not null default 'queued'
    check (state in ('queued', 'running', 'completed', 'failed')),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  input_artifacts jsonb not null default '[]'::jsonb check (jsonb_typeof(input_artifacts) = 'array'),
  requested_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state in ('running', 'completed', 'failed')) = (started_at is not null)),
  check ((state in ('completed', 'failed')) = (completed_at is not null)),
  check (
    (state = 'failed' and error_code is not null and error_message is not null)
    or (state <> 'failed' and error_code is null and error_message is null)
  ),
  check (started_at is null or started_at >= requested_at),
  check (completed_at is null or (started_at is not null and completed_at >= started_at))
);

create index idx_pipeline_jobs_state_requested
  on pipeline.jobs(state, requested_at, job_id);

create table pipeline.attempts (
  job_id uuid not null references pipeline.jobs(job_id) on delete restrict,
  attempt_number integer not null check (attempt_number >= 1),
  worker_id text not null check (length(trim(worker_id)) between 1 and 200),
  started_at timestamptz not null,
  completed_at timestamptz,
  outcome text check (outcome in ('completed', 'failed')),
  error_code text,
  error_message text,
  primary key (job_id, attempt_number),
  check ((outcome is null) = (completed_at is null)),
  check (
    outcome is null
    or (outcome = 'completed' and error_code is null and error_message is null)
    or (outcome = 'failed' and error_code is not null and error_message is not null)
  ),
  check (completed_at is null or completed_at >= started_at)
);

create table pipeline.artifacts (
  artifact_id uuid primary key,
  job_id uuid not null references pipeline.jobs(job_id) on delete restrict,
  artifact_kind text not null check (artifact_kind ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  storage_bucket text not null check (length(trim(storage_bucket)) between 1 and 255),
  storage_key text not null check (length(trim(storage_key)) between 1 and 1024),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size >= 0),
  media_type text not null check (length(trim(media_type)) between 1 and 255),
  contract_schema_id text,
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  created_at timestamptz not null,
  unique (storage_bucket, storage_key),
  check (position(content_sha256 in storage_key) > 0)
);

create index idx_pipeline_artifacts_job on pipeline.artifacts(job_id, artifact_kind, artifact_id);

-- Job request metadata is immutable. The only legal mutations are lifecycle
-- transitions controlled by the worker: queued -> running -> completed|failed.
create or replace function pipeline.guard_job_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if row(
    old.job_id,
    old.job_type,
    old.contract_version,
    old.correlation_id,
    old.parameters,
    old.input_artifacts,
    old.requested_at,
    old.created_at
  ) is distinct from row(
    new.job_id,
    new.job_type,
    new.contract_version,
    new.correlation_id,
    new.parameters,
    new.input_artifacts,
    new.requested_at,
    new.created_at
  ) then
    raise exception 'pipeline job request metadata is immutable' using errcode = '55000';
  end if;

  if old.state = 'queued' and new.state = 'running' then
    if new.started_at is null or new.completed_at is not null then
      raise exception 'running pipeline jobs require started_at only' using errcode = '55000';
    end if;
    return new;
  end if;

  if old.state = 'running' and new.state in ('completed', 'failed') then
    if new.started_at is distinct from old.started_at or new.completed_at is null then
      raise exception 'terminal pipeline jobs must preserve started_at and set completed_at'
        using errcode = '55000';
    end if;
    return new;
  end if;

  raise exception 'invalid pipeline job state transition: % -> %', old.state, new.state
    using errcode = '55000';
end
$function$;

create trigger pipeline_jobs_guard_update
before update on pipeline.jobs
for each row execute function pipeline.guard_job_update();

-- Attempts and artifact metadata are evidence, not mutable work state.
create or replace function pipeline.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end
$function$;

create trigger pipeline_attempts_append_only
before update or delete on pipeline.attempts
for each row execute function pipeline.reject_append_only_mutation();

create trigger pipeline_artifacts_append_only
before update or delete on pipeline.artifacts
for each row execute function pipeline.reject_append_only_mutation();

-- Owner-published, versioned pipeline exports ----------------------------------
-- These are read-only integration contracts. The pipeline role receives SELECT
-- on the views, never on the private owner tables beneath them.

create or replace view panda.pipeline_identity_export_v1
with (security_barrier = true)
as
select
  p.panda_id,
  canonical.slug as canonical_slug,
  coalesce(names.names, '[]'::jsonb) as names,
  coalesce(external_ids.external_identifiers, '[]'::jsonb) as external_identifiers,
  p.updated_at
from panda.pandas p
left join lateral (
  select s.slug
  from panda.slugs s
  where s.panda_id = p.panda_id
    and s.slug_kind = 'canonical'
    and s.valid_to is null
  order by s.created_at desc, s.slug_id desc
  limit 1
) canonical on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'languageTag', n.language_tag,
      'nameKind', n.name_kind,
      'value', n.value,
      'normalizedValue', n.normalized_value,
      'isPrimary', n.is_primary
    ) order by n.is_primary desc, n.language_tag, n.name_kind, n.value
  ) as names
  from panda.names n
  where n.panda_id = p.panda_id
    and n.valid_to is null
) names on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'system', e.system,
      'value', e.value,
      'normalizedValue', e.normalized_value
    ) order by e.system, e.normalized_value
  ) as external_identifiers
  from panda.external_identifiers e
  where e.panda_id = p.panda_id
) external_ids on true;

comment on view panda.pipeline_identity_export_v1 is
  'Versioned Panda-owned read contract for offline identity-resolution/enrichment assistance.';

create or replace view evidence.pipeline_source_export_v1
with (security_barrier = true)
as
select
  source_id,
  publisher,
  title,
  url,
  published_on,
  last_verified_on,
  language_tag,
  access_state,
  evidence_tier,
  public_summary,
  content_sha256
from evidence.sources;

comment on view evidence.pipeline_source_export_v1 is
  'Versioned Evidence-owned source metadata contract for panda-data; excludes internal notes and attachment storage metadata.';

create or replace view media.pipeline_asset_export_v1
with (security_barrier = true)
as
select
  a.asset_id,
  a.source_id,
  a.storage_bucket,
  a.storage_key,
  a.content_sha256,
  a.media_type,
  a.byte_size,
  a.title,
  a.creator,
  a.copyright_text,
  a.license,
  a.attribution_text,
  a.rights_status,
  a.eligibility_status,
  a.taken_at,
  coalesce(associations.pandas, '[]'::jsonb) as pandas,
  a.updated_at
from media.assets a
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'pandaId', pa.panda_id,
      'usageRole', pa.usage_role,
      'displayOrder', pa.display_order
    ) order by pa.display_order, pa.panda_id, pa.usage_role
  ) as pandas
  from media.panda_assets pa
  where pa.asset_id = a.asset_id
) associations on true;

comment on view media.pipeline_asset_export_v1 is
  'Versioned Media-owned read contract for offline media processing and analysis.';

-- Dedicated pipeline queues ----------------------------------------------------

do $queues$
declare queue_name text;
begin
  if to_regprocedure('pgmq.create(text)') is not null then
    foreach queue_name in array array['panda_data_jobs', 'panda_data_results'] loop
      if to_regclass('pgmq.q_' || queue_name) is null then
        perform pgmq.create(queue_name);
      end if;
    end loop;
  end if;
end
$queues$;

-- The pipeline role deliberately cannot call arbitrary pgmq functions. Wrappers
-- below bind it to exactly its two queues. The function owner (migration owner)
-- retains the underlying PGMQ rights via SECURITY DEFINER.
create or replace function pipeline.enqueue_job(message jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $function$
  select pgmq.send('panda_data_jobs'::text, message, 0::integer);
$function$;

create or replace function pipeline.read_jobs(visibility_timeout_seconds integer, quantity integer)
returns table(msg_id bigint, read_ct integer, message jsonb)
language sql
security definer
set search_path = ''
as $function$
  select q.msg_id, q.read_ct, q.message
  from pgmq.read(
    'panda_data_jobs'::text,
    greatest(1, visibility_timeout_seconds),
    greatest(1, least(quantity, 100)),
    '{}'::jsonb
  ) q;
$function$;

create or replace function pipeline.archive_job(message_id bigint)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select pgmq.archive('panda_data_jobs'::text, message_id);
$function$;

create or replace function pipeline.set_job_visibility(message_id bigint, visibility_timeout_seconds integer)
returns table(msg_id bigint, read_ct integer, message jsonb)
language sql
security definer
set search_path = ''
as $function$
  select q.msg_id, q.read_ct, q.message
  from pgmq.set_vt(
    'panda_data_jobs'::text,
    message_id,
    greatest(1, visibility_timeout_seconds)
  ) q;
$function$;

create or replace function pipeline.enqueue_result(message jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $function$
  select pgmq.send('panda_data_results'::text, message, 0::integer);
$function$;

-- Least-privilege database role -----------------------------------------------

do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'zhipanda_pipeline') then
    create role zhipanda_pipeline nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$role$;

-- PGMQ extension functions are transport internals, not a public SQL API. Nest's
-- zhipanda_app already has explicit direct grants from the platform migration.
revoke usage on schema pgmq from public;
revoke execute on all functions in schema pgmq from public;

revoke all on schema pipeline from public, anon, authenticated;
revoke all on all tables in schema pipeline from public, anon, authenticated;
revoke all on all functions in schema pipeline from public, anon, authenticated;

revoke all on schema evidence, panda, lineage, place, life_history, media,
  identity, engagement, game, publication, public_read, updates, notification, privacy, audit
  from zhipanda_pipeline;
revoke all on all tables in schema evidence from zhipanda_pipeline;
revoke all on all tables in schema panda from zhipanda_pipeline;
revoke all on all tables in schema lineage from zhipanda_pipeline;
revoke all on all tables in schema place from zhipanda_pipeline;
revoke all on all tables in schema life_history from zhipanda_pipeline;
revoke all on all tables in schema media from zhipanda_pipeline;
revoke all on all tables in schema identity from zhipanda_pipeline;
revoke all on all tables in schema engagement from zhipanda_pipeline;
revoke all on all tables in schema game from zhipanda_pipeline;
revoke all on all tables in schema publication from zhipanda_pipeline;
revoke all on all tables in schema public_read from zhipanda_pipeline;
revoke all on all tables in schema updates from zhipanda_pipeline;
revoke all on all tables in schema notification from zhipanda_pipeline;
revoke all on all tables in schema privacy from zhipanda_pipeline;
revoke all on all tables in schema audit from zhipanda_pipeline;
revoke all on schema pgmq from zhipanda_pipeline;
revoke execute on all functions in schema pgmq from zhipanda_pipeline;

-- Technical state is the only writable database surface for panda-data.
grant usage on schema pipeline to zhipanda_pipeline;
grant select, insert, update on pipeline.jobs to zhipanda_pipeline;
grant select, insert on pipeline.attempts, pipeline.artifacts to zhipanda_pipeline;
grant execute on function pipeline.enqueue_job(jsonb) to zhipanda_pipeline;
grant execute on function pipeline.read_jobs(integer, integer) to zhipanda_pipeline;
grant execute on function pipeline.archive_job(bigint) to zhipanda_pipeline;
grant execute on function pipeline.set_job_visibility(bigint, integer) to zhipanda_pipeline;
grant execute on function pipeline.enqueue_result(jsonb) to zhipanda_pipeline;

-- Read access is only through owner-published views.
grant usage on schema panda, evidence, media to zhipanda_pipeline;
grant select on panda.pipeline_identity_export_v1 to zhipanda_pipeline;
grant select on evidence.pipeline_source_export_v1 to zhipanda_pipeline;
grant select on media.pipeline_asset_export_v1 to zhipanda_pipeline;

commit;
