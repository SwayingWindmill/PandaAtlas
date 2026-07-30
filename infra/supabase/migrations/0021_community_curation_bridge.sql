begin;

create schema if not exists community_curation;
comment on schema community_curation is
  'Private anti-corruption bridge from accepted ReviewCase assertions to Curation Change Sets.';

do $types$
begin
  if not exists (
    select 1
    from pg_type type
    join pg_namespace namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'community_curation'
      and type.typname = 'bridge_assertion_disposition'
  ) then
    create type community_curation.bridge_assertion_disposition as enum (
      'selected',
      'not_recommended',
      'incorporated',
      'not_incorporated'
    );
  end if;

  if not exists (
    select 1
    from pg_type type
    join pg_namespace namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'community_curation'
      and type.typname = 'bridge_status'
  ) then
    create type community_curation.bridge_status as enum (
      'created',
      'release_seen',
      'projected',
      'projection_failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type type
    join pg_namespace namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'community_curation'
      and type.typname = 'projection_outcome'
  ) then
    create type community_curation.projection_outcome as enum (
      'projected',
      'failed'
    );
  end if;
end
$types$;

create table if not exists community_curation.assertion_bridges (
  bridge_id uuid primary key default gen_random_uuid(),
  review_case_id uuid not null unique references review_moderation.review_cases(review_case_id)
    on delete restrict,
  submission_id uuid not null references community_intake.submissions(submission_id)
    on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  decision_id uuid not null unique references review_moderation.decisions(decision_id)
    on delete restrict,
  change_set_id uuid not null unique references public.change_sets(id) on delete restrict,
  contributor_account_id uuid references identity.accounts(account_id) on delete restrict,
  contributor_subject_hash text not null check (contributor_subject_hash ~ '^[0-9a-f]{64}$'),
  target_type text not null check (length(target_type) between 1 and 100),
  target_id text not null check (length(target_id) between 1 and 255),
  base_archive_version text not null check (length(trim(base_archive_version)) > 0),
  risk_level text not null check (risk_level in ('ordinary', 'sensitive')),
  selected_assertion_keys jsonb not null check (jsonb_typeof(selected_assertion_keys) = 'array'),
  not_recommended_assertion_keys jsonb not null check (
    jsonb_typeof(not_recommended_assertion_keys) = 'array'
  ),
  source_ids jsonb not null check (jsonb_typeof(source_ids) = 'array'),
  attachment_ids jsonb not null check (jsonb_typeof(attachment_ids) = 'array'),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  actor_role_snapshot jsonb not null check (jsonb_typeof(actor_role_snapshot) = 'array'),
  status community_curation.bridge_status not null default 'created',
  reason text not null check (length(trim(reason)) between 3 and 2000),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_array_length(selected_assertion_keys) > 0)
);

create index if not exists idx_assertion_bridges_submission
  on community_curation.assertion_bridges(submission_id, revision_number, created_at desc);
create index if not exists idx_assertion_bridges_change_set
  on community_curation.assertion_bridges(change_set_id);
create index if not exists idx_assertion_bridges_status
  on community_curation.assertion_bridges(status, updated_at desc);

create table if not exists community_curation.assertion_bridge_items (
  bridge_id uuid not null references community_curation.assertion_bridges(bridge_id)
    on delete restrict,
  assertion_key text not null check (assertion_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'),
  disposition community_curation.bridge_assertion_disposition not null,
  assertion_payload jsonb not null check (jsonb_typeof(assertion_payload) = 'object'),
  source_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(source_ids) = 'array'),
  created_at timestamptz not null default now(),
  primary key (bridge_id, assertion_key)
);

create table if not exists community_curation.release_observations (
  release_observation_id uuid primary key default gen_random_uuid(),
  bridge_id uuid not null references community_curation.assertion_bridges(bridge_id)
    on delete restrict,
  release_id uuid not null references public.publication_batches(id) on delete restrict,
  outbox_event_id uuid references integration.outbox_events(event_id) on delete restrict,
  data_version text not null check (length(trim(data_version)) > 0),
  observed_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  unique (bridge_id, release_id),
  unique (idempotency_key)
);

create table if not exists community_curation.projection_results (
  projection_result_id uuid primary key default gen_random_uuid(),
  bridge_id uuid not null references community_curation.assertion_bridges(bridge_id)
    on delete restrict,
  release_id uuid not null references public.publication_batches(id) on delete restrict,
  projection_event_id uuid not null,
  outcome community_curation.projection_outcome not null,
  public_version text check (public_version is null or length(trim(public_version)) > 0),
  incorporated_assertion_keys jsonb not null default '[]'::jsonb check (
    jsonb_typeof(incorporated_assertion_keys) = 'array'
  ),
  contributor_status_event_id uuid references community_intake.contributor_status_events(status_event_id)
    on delete restrict,
  notification_intent_id uuid references notification.intents(intent_id) on delete restrict,
  user_visible_message text check (
    user_visible_message is null or length(trim(user_visible_message)) between 3 and 2000
  ),
  correlation_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  created_at timestamptz not null default now(),
  unique (bridge_id, projection_event_id),
  unique (bridge_id, idempotency_key),
  check (outcome <> 'projected' or public_version is not null)
);

create table if not exists community_curation.command_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid references identity.accounts(account_id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  command_name text not null check (
    command_name in ('create_bridge', 'record_release', 'record_projection')
  ),
  command_payload_sha256 text not null check (command_payload_sha256 ~ '^[a-f0-9]{64}$'),
  bridge_id uuid references community_curation.assertion_bridges(bridge_id) on delete restrict,
  change_set_id uuid references public.change_sets(id) on delete restrict,
  release_id uuid references public.publication_batches(id) on delete restrict,
  projection_result_id uuid references community_curation.projection_results(projection_result_id)
    on delete restrict,
  created_at timestamptz not null default now(),
  unique (actor_account_id, idempotency_key),
  check (
    (command_name = 'create_bridge' and bridge_id is not null and change_set_id is not null)
    or (command_name = 'record_release' and bridge_id is not null and release_id is not null)
    or (command_name = 'record_projection' and bridge_id is not null and projection_result_id is not null)
  )
);

create or replace function community_curation.reject_bridge_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create trigger trg_assertion_bridge_items_append_only
before update or delete on community_curation.assertion_bridge_items
for each row execute function community_curation.reject_bridge_evidence_mutation();

create trigger trg_release_observations_append_only
before update or delete on community_curation.release_observations
for each row execute function community_curation.reject_bridge_evidence_mutation();

create trigger trg_projection_results_append_only
before update or delete on community_curation.projection_results
for each row execute function community_curation.reject_bridge_evidence_mutation();

create trigger trg_bridge_command_receipts_append_only
before update or delete on community_curation.command_receipts
for each row execute function community_curation.reject_bridge_evidence_mutation();

create or replace function community_curation.touch_assertion_bridge()
returns trigger
language plpgsql
as $$
begin
  if new.review_case_id <> old.review_case_id
    or new.submission_id <> old.submission_id
    or new.revision_number <> old.revision_number
    or new.decision_id <> old.decision_id
    or new.change_set_id <> old.change_set_id
    or new.contributor_subject_hash <> old.contributor_subject_hash then
    raise exception 'assertion bridge identity is immutable' using errcode = '55000';
  end if;
  if new.status <> old.status and not (
    (old.status = 'created' and new.status in ('release_seen', 'projection_failed'))
    or (old.status = 'release_seen' and new.status in ('projected', 'projection_failed'))
    or (old.status = 'projection_failed' and new.status = 'projected')
  ) then
    raise exception 'invalid assertion bridge status transition' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_assertion_bridge_transition
before update on community_curation.assertion_bridges
for each row execute function community_curation.touch_assertion_bridge();

create or replace function community_curation.create_assertion_bridge(
  requested_review_case_id uuid,
  requested_actor_id uuid,
  requested_expected_version integer,
  requested_idempotency_key text,
  requested_payload_sha256 text,
  requested_reason text,
  requested_base_archive_version text,
  requested_risk_level text,
  requested_correlation_id uuid,
  requested_actor_roles jsonb
)
returns table (bridge_id uuid, change_set_id uuid)
language plpgsql
security definer
set search_path = community_curation, review_moderation, community_intake, public
as $bridge$
declare
  replay community_curation.command_receipts;
  review_case review_moderation.review_cases;
  submission community_intake.submissions;
  decision review_moderation.decisions;
  revision community_intake.submission_revisions;
  selected_keys text[];
  all_keys text[];
  not_recommended_keys text[];
  source_ids jsonb;
  attachment_ids jsonb;
  source_evidence jsonb;
  attachment_evidence jsonb;
  selected_assertions jsonb;
  bridge_payload jsonb;
  next_revision_number integer;
  revision_id uuid;
  new_change_set_id uuid;
  new_bridge_id uuid;
  status_event_id uuid;
  actor_hash text;
begin
  select * into replay
  from community_curation.command_receipts receipt
  where receipt.actor_account_id = requested_actor_id
    and receipt.idempotency_key = requested_idempotency_key;

  if found then
    if replay.command_name <> 'create_bridge'
      or replay.command_payload_sha256 <> requested_payload_sha256 then
      raise exception 'Idempotency key was reused with a different bridge command'
        using errcode = '23505';
    end if;
    return query select replay.bridge_id, replay.change_set_id;
    return;
  end if;

  if requested_risk_level not in ('ordinary', 'sensitive') then
    raise exception 'Unsupported bridge risk level' using errcode = '23514';
  end if;

  select * into review_case
  from review_moderation.review_cases item
  where item.review_case_id = requested_review_case_id
  for update;

  if not found then
    raise exception 'ReviewCase not found' using errcode = 'P0002';
  end if;
  if review_case.version <> requested_expected_version then
    raise exception 'ReviewCase version conflict' using errcode = '40001';
  end if;
  if review_case.state <> 'incorporation_recommended' then
    raise exception 'ReviewCase is not recommended for incorporation' using errcode = '23514';
  end if;
  if review_case.primary_assignee_id is distinct from requested_actor_id then
    raise exception 'Only the assigned Reviewer can bridge accepted assertions'
      using errcode = '42501';
  end if;

  select * into submission
  from community_intake.submissions item
  where item.submission_id = review_case.submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if submission.account_id = requested_actor_id then
    raise exception 'Reviewer cannot bridge their own submission' using errcode = '42501';
  end if;

  select * into decision
  from review_moderation.decisions item
  where item.review_case_id = review_case.review_case_id
    and item.active_revision_number = review_case.active_revision_number
    and item.outcome = 'accepted'
  order by item.decided_at desc, item.decision_id desc
  limit 1;

  if not found then
    raise exception 'Accepted active ReviewCase decision is required' using errcode = '23514';
  end if;
  if decision.decided_by_account_id <> requested_actor_id then
    raise exception 'Only the deciding assigned Reviewer can bridge selected assertions'
      using errcode = '42501';
  end if;
  if jsonb_array_length(decision.selected_assertion_keys) = 0 then
    raise exception 'Accepted decision has no selected assertions' using errcode = '23514';
  end if;

  select * into revision
  from community_intake.submission_revisions item
  where item.submission_id = review_case.submission_id
    and item.revision_number = review_case.active_revision_number;

  if not found then
    raise exception 'Active submission revision is missing' using errcode = 'P0002';
  end if;

  select array_agg(value order by value) into selected_keys
  from jsonb_array_elements_text(decision.selected_assertion_keys) selected(value);

  select coalesce(array_agg(assertion->>'assertion_key' order by assertion->>'assertion_key'), array[]::text[])
  into all_keys
  from jsonb_array_elements(coalesce(revision.content->'assertions', '[]'::jsonb)) assertion
  where assertion ? 'assertion_key';

  if exists (
    select 1
    from unnest(selected_keys) selected(key)
    where not (selected.key = any(all_keys))
  ) then
    raise exception 'Selected assertion is not present on the active revision'
      using errcode = '23514';
  end if;

  select coalesce(array_agg(key order by key), array[]::text[])
  into not_recommended_keys
  from unnest(all_keys) key
  where not key = any(selected_keys);

  select coalesce(jsonb_agg(assertion order by assertion->>'assertion_key'), '[]'::jsonb)
  into selected_assertions
  from jsonb_array_elements(coalesce(revision.content->'assertions', '[]'::jsonb)) assertion
  where assertion->>'assertion_key' = any(selected_keys);

  select coalesce(jsonb_agg(source.source_id order by source.created_at, source.source_id), '[]'::jsonb)
  into source_ids
  from community_intake.submitted_sources source
  where source.submission_id = review_case.submission_id
    and source.revision_number = review_case.active_revision_number;

  select coalesce(jsonb_agg(attachment.attachment_id order by attachment.created_at, attachment.attachment_id), '[]'::jsonb)
  into attachment_ids
  from community_intake.attachments attachment
  where attachment.submission_id = review_case.submission_id
    and attachment.bound_revision_number = review_case.active_revision_number
    and attachment.state <> 'deleted';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'source_id', source.source_id,
      'source_kind', source.source_kind::text,
      'title', source.title,
      'normalized_locator', latest.normalized_locator,
      'canonical_source_id', latest.canonical_source_id,
      'verification_outcome', latest.outcome
    )
    order by source.created_at, source.source_id
  ), '[]'::jsonb)
  into source_evidence
  from community_intake.submitted_sources source
  left join lateral (
    select verification.outcome::text as outcome,
           verification.normalized_locator,
           verification.canonical_source_id
    from review_moderation.source_verifications verification
    where verification.review_case_id = review_case.review_case_id
      and verification.source_id = source.source_id
    order by verification.verified_at desc, verification.source_verification_id desc
    limit 1
  ) latest on true
  where source.submission_id = review_case.submission_id
    and source.revision_number = review_case.active_revision_number;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'attachment_id', attachment.attachment_id,
      'media_type', attachment.media_type,
      'content_sha256', attachment.content_sha256,
      'state', attachment.state::text,
      'metadata_stripped', attachment.metadata_stripped
    )
    order by attachment.created_at, attachment.attachment_id
  ), '[]'::jsonb)
  into attachment_evidence
  from community_intake.attachments attachment
  where attachment.submission_id = review_case.submission_id
    and attachment.bound_revision_number = review_case.active_revision_number
    and attachment.state <> 'deleted';

  bridge_payload := jsonb_build_object(
    'public_record', jsonb_build_object(
      'community_assertions', selected_assertions,
      'source_submission_id', review_case.submission_id,
      'source_revision_number', review_case.active_revision_number
    ),
    'publication_checks', jsonb_build_object(
      'references', '[]'::jsonb,
      'residencies', '[]'::jsonb,
      'translations', '[]'::jsonb,
      'sources', source_evidence,
      'media', attachment_evidence
    ),
    'community_provenance', jsonb_build_object(
      'submission_id', review_case.submission_id,
      'revision_number', review_case.active_revision_number,
      'review_case_id', review_case.review_case_id,
      'decision_id', decision.decision_id,
      'selected_assertion_keys', decision.selected_assertion_keys,
      'not_recommended_assertion_keys', to_jsonb(not_recommended_keys),
      'contributor_account_id', submission.account_id,
      'target_type', submission.target_type::text,
      'target_id', submission.target_id,
      'base_archive_version', requested_base_archive_version,
      'risk_level', requested_risk_level,
      'bridge_actor_id', requested_actor_id
    )
  );

  select coalesce(max(entity.revision_number), 0) + 1
  into next_revision_number
  from public.entity_revisions entity
  where entity.entity_type = submission.target_type::text
    and entity.entity_id = submission.target_id;

  insert into public.entity_revisions (
    entity_type, entity_id, revision_number, payload, created_by, substantive_modified_by
  ) values (
    submission.target_type::text, submission.target_id, next_revision_number,
    bridge_payload, requested_actor_id, requested_actor_id
  ) returning id into revision_id;

  insert into public.change_sets (
    title, reason, status, created_by, governance_mode, validation_state,
    base_archive_version, risk_level, origin_context, origin_actor_id
  ) values (
    'Community assertion bridge ' || review_case.review_case_id::text,
    requested_reason, 'draft', requested_actor_id, 'single-accountable-approver-v1',
    'not_validated', requested_base_archive_version, requested_risk_level,
    'community_intake', submission.account_id
  ) returning id into new_change_set_id;

  insert into public.change_set_revisions (change_set_id, revision_id)
  values (new_change_set_id, revision_id);

  insert into community_curation.assertion_bridges (
    review_case_id, submission_id, revision_number, decision_id, change_set_id,
    contributor_account_id, contributor_subject_hash, target_type, target_id,
    base_archive_version, risk_level, selected_assertion_keys,
    not_recommended_assertion_keys, source_ids, attachment_ids, actor_account_id,
    actor_role_snapshot, reason, correlation_id
  ) values (
    review_case.review_case_id, review_case.submission_id, review_case.active_revision_number,
    decision.decision_id, new_change_set_id, submission.account_id,
    submission.contributor_subject_hash, submission.target_type::text, submission.target_id,
    requested_base_archive_version, requested_risk_level, decision.selected_assertion_keys,
    to_jsonb(not_recommended_keys), source_ids, attachment_ids, requested_actor_id,
    requested_actor_roles, requested_reason, requested_correlation_id
  ) returning bridge_id into new_bridge_id;

  insert into community_curation.assertion_bridge_items (
    bridge_id, assertion_key, disposition, assertion_payload, source_ids
  )
  select new_bridge_id, assertion->>'assertion_key',
         case
           when assertion->>'assertion_key' = any(selected_keys)
             then 'selected'::community_curation.bridge_assertion_disposition
           else 'not_recommended'::community_curation.bridge_assertion_disposition
         end,
         assertion,
         coalesce(assertion->'source_ids', '[]'::jsonb)
  from jsonb_array_elements(coalesce(revision.content->'assertions', '[]'::jsonb)) assertion
  where assertion ? 'assertion_key';

  actor_hash := encode(digest(requested_actor_id::text, 'sha256'), 'hex');

  insert into community_intake.contributor_status_events (
    submission_id, status, active_revision_number, user_visible_reason,
    action_required_fields, source_context, source_event_id, actor_subject_hash,
    correlation_id, idempotency_key
  ) values (
    review_case.submission_id, 'incorporation_in_progress',
    review_case.active_revision_number,
    'Your accepted contribution is being prepared for Archive incorporation.',
    '[]'::jsonb, 'curation', new_bridge_id, actor_hash,
    requested_correlation_id, 'curation-bridge:' || requested_idempotency_key
  ) returning status_event_id into status_event_id;

  insert into community_intake.contributor_assertion_results (
    status_event_id, submission_id, revision_number, assertion_key, disposition, explanation
  )
  select status_event_id, review_case.submission_id, review_case.active_revision_number,
         item.assertion_key,
         case
           when item.disposition = 'selected'
             then 'selected'::community_intake.assertion_disposition
           else 'not_selected'::community_intake.assertion_disposition
         end,
         case
           when item.disposition = 'selected'
             then 'Selected for independent Curation validation.'
           else 'Not recommended for this Curation Change Set.'
         end
  from community_curation.assertion_bridge_items item
  where item.bridge_id = new_bridge_id;

  update community_intake.submissions
  set contributor_status = 'incorporation_in_progress',
      current_status_event_id = status_event_id,
      contributor_status_updated_at = now(),
      version = version + 1,
      updated_at = now()
  where submission_id = review_case.submission_id;

  update review_moderation.review_cases
  set version = version + 1
  where review_case_id = review_case.review_case_id;

  insert into review_moderation.audit_events (
    review_case_id, submission_id, actor_account_id, event_type, outcome,
    reason, details, correlation_id, idempotency_key
  ) values (
    review_case.review_case_id, review_case.submission_id, requested_actor_id,
    'community_curation.bridge.created', 'succeeded', requested_reason,
    jsonb_build_object(
      'bridge_id', new_bridge_id,
      'change_set_id', new_change_set_id,
      'decision_id', decision.decision_id,
      'selected_assertion_keys', decision.selected_assertion_keys,
      'not_recommended_assertion_keys', to_jsonb(not_recommended_keys)
    ),
    requested_correlation_id, requested_idempotency_key
  );

  insert into community_curation.command_receipts (
    actor_account_id, idempotency_key, command_name, command_payload_sha256,
    bridge_id, change_set_id
  ) values (
    requested_actor_id, requested_idempotency_key, 'create_bridge',
    requested_payload_sha256, new_bridge_id, new_change_set_id
  );

  return query select new_bridge_id, new_change_set_id;
end;
$bridge$;

create or replace function community_curation.record_archive_release(
  requested_release_id uuid,
  requested_actor_id uuid,
  requested_idempotency_key text,
  requested_payload_sha256 text,
  requested_correlation_id uuid
)
returns table (bridge_id uuid, change_set_id uuid, release_id uuid)
language plpgsql
security definer
set search_path = community_curation, public, integration
as $release$
declare
  replay community_curation.command_receipts;
  bridge community_curation.assertion_bridges;
  evidence public.archive_release_evidence;
  batch public.publication_batches;
begin
  select * into replay
  from community_curation.command_receipts receipt
  where receipt.actor_account_id = requested_actor_id
    and receipt.idempotency_key = requested_idempotency_key;

  if found then
    if replay.command_name <> 'record_release'
      or replay.command_payload_sha256 <> requested_payload_sha256 then
      raise exception 'Idempotency key was reused with a different release command'
        using errcode = '23505';
    end if;
    return query
    select replay.bridge_id, replay.change_set_id, replay.release_id;
    return;
  end if;

  select * into evidence
  from public.archive_release_evidence item
  where item.release_id = requested_release_id;

  if not found then
    raise exception 'Release evidence not found for community bridge' using errcode = 'P0002';
  end if;

  select * into bridge
  from community_curation.assertion_bridges item
  where item.change_set_id = evidence.change_set_id
  for update;

  if not found then
    raise exception 'Release does not belong to a community bridge' using errcode = 'P0002';
  end if;

  select * into batch
  from public.publication_batches item
  where item.id = requested_release_id;

  insert into community_curation.release_observations (
    bridge_id, release_id, outbox_event_id, data_version, correlation_id, idempotency_key
  ) values (
    bridge.bridge_id, requested_release_id, evidence.outbox_event_id,
    batch.data_version, requested_correlation_id, requested_idempotency_key
  );

  update community_curation.assertion_bridges
  set status = 'release_seen'
  where assertion_bridges.bridge_id = bridge.bridge_id
    and status = 'created';

  insert into community_curation.command_receipts (
    actor_account_id, idempotency_key, command_name, command_payload_sha256,
    bridge_id, change_set_id, release_id
  ) values (
    requested_actor_id, requested_idempotency_key, 'record_release',
    requested_payload_sha256, bridge.bridge_id, bridge.change_set_id, requested_release_id
  );

  return query select bridge.bridge_id, bridge.change_set_id, requested_release_id;
end;
$release$;

create or replace function community_curation.record_projection_result(
  requested_bridge_id uuid,
  requested_release_id uuid,
  requested_actor_id uuid,
  requested_projection_event_id uuid,
  requested_outcome text,
  requested_public_version text,
  requested_incorporated_assertion_keys jsonb,
  requested_user_visible_message text,
  requested_idempotency_key text,
  requested_payload_sha256 text,
  requested_correlation_id uuid
)
returns table (
  projection_result_id uuid,
  contributor_status text,
  notification_intent_id uuid
)
language plpgsql
security definer
set search_path = community_curation, community_intake, notification, public
as $projection$
declare
  replay community_curation.command_receipts;
  bridge community_curation.assertion_bridges;
  observation community_curation.release_observations;
  selected_count integer;
  incorporated_count integer;
  next_status community_intake.contributor_status;
  status_event_id uuid;
  result_id uuid;
  intent_id uuid;
  actor_hash text;
begin
  select * into replay
  from community_curation.command_receipts receipt
  where receipt.actor_account_id = requested_actor_id
    and receipt.idempotency_key = requested_idempotency_key;

  if found then
    if replay.command_name <> 'record_projection'
      or replay.command_payload_sha256 <> requested_payload_sha256 then
      raise exception 'Idempotency key was reused with a different projection command'
        using errcode = '23505';
    end if;
    select result.projection_result_id,
           status_event.status::text,
           result.notification_intent_id
    into projection_result_id, contributor_status, notification_intent_id
    from community_curation.projection_results result
    left join community_intake.contributor_status_events status_event
      on status_event.status_event_id = result.contributor_status_event_id
    where result.projection_result_id = replay.projection_result_id;
    return next;
    return;
  end if;

  if requested_outcome not in ('projected', 'failed') then
    raise exception 'Unsupported projection outcome' using errcode = '23514';
  end if;
  if requested_outcome = 'projected' and requested_public_version is null then
    raise exception 'Projected incorporation requires a public version' using errcode = '23514';
  end if;

  select * into bridge
  from community_curation.assertion_bridges item
  where item.bridge_id = requested_bridge_id
  for update;

  if not found then
    raise exception 'Assertion bridge not found' using errcode = 'P0002';
  end if;

  select * into observation
  from community_curation.release_observations item
  where item.bridge_id = requested_bridge_id
    and item.release_id = requested_release_id;

  if not found then
    raise exception 'Projection cannot complete before matching release observation'
      using errcode = '23514';
  end if;

  select jsonb_array_length(bridge.selected_assertion_keys) into selected_count;

  select count(*) into incorporated_count
  from jsonb_array_elements_text(requested_incorporated_assertion_keys) incorporated(key)
  where exists (
    select 1
    from jsonb_array_elements_text(bridge.selected_assertion_keys) selected(key)
    where selected.key = incorporated.key
  );

  actor_hash := encode(digest(requested_actor_id::text, 'sha256'), 'hex');

  if requested_outcome = 'projected' then
    next_status := case
      when incorporated_count = selected_count then 'incorporated_full'::community_intake.contributor_status
      else 'incorporated_partial'::community_intake.contributor_status
    end;

    insert into community_intake.contributor_status_events (
      submission_id, status, active_revision_number, user_visible_reason,
      action_required_fields, source_context, source_event_id, actor_subject_hash,
      correlation_id, idempotency_key
    ) values (
      bridge.submission_id, next_status, bridge.revision_number,
      requested_user_visible_message, '[]'::jsonb, 'projection',
      requested_projection_event_id, actor_hash, requested_correlation_id,
      'projection:' || requested_idempotency_key
    ) returning status_event_id into status_event_id;

    insert into community_intake.contributor_assertion_results (
      status_event_id, submission_id, revision_number, assertion_key,
      disposition, explanation, public_reference_id
    )
    select status_event_id, bridge.submission_id, bridge.revision_number,
           item.assertion_key,
           case
             when exists (
               select 1
               from jsonb_array_elements_text(requested_incorporated_assertion_keys) incorporated(key)
               where incorporated.key = item.assertion_key
             ) then 'incorporated'::community_intake.assertion_disposition
             else 'not_incorporated'::community_intake.assertion_disposition
           end,
           requested_user_visible_message,
           requested_public_version
    from community_curation.assertion_bridge_items item
    where item.bridge_id = bridge.bridge_id
      and item.disposition = 'selected';

    update community_intake.submissions
    set contributor_status = next_status,
        current_status_event_id = status_event_id,
        contributor_status_updated_at = now(),
        version = version + 1,
        updated_at = now()
    where submission_id = bridge.submission_id;

    if bridge.contributor_account_id is not null then
      insert into notification.intents (
        logical_key, source_event_id, source_event_type, source_context,
        source_id, source_version, account_id, category, mandatory,
        audience_snapshot, preference_snapshot, content_snapshot, correlation_id
      ) values (
        'incorporation:' || bridge.bridge_id::text || ':' || requested_release_id::text,
        requested_projection_event_id, 'community_curation.projection_result',
        'community_curation', bridge.bridge_id::text, 1,
        bridge.contributor_account_id, 'incorporation', false,
        jsonb_build_object('account_id', bridge.contributor_account_id),
        '{}'::jsonb,
        jsonb_build_object(
          'submission_id', bridge.submission_id,
          'bridge_id', bridge.bridge_id,
          'release_id', requested_release_id,
          'status', next_status::text,
          'public_version', requested_public_version,
          'message', requested_user_visible_message
        ),
        requested_correlation_id
      )
      on conflict (logical_key) do update
      set content_snapshot = excluded.content_snapshot
      returning intent_id into intent_id;

      insert into notification.inbox_items (
        intent_id, account_id, category, body
      ) values (
        intent_id, bridge.contributor_account_id, 'incorporation',
        jsonb_build_object(
          'submission_id', bridge.submission_id,
          'bridge_id', bridge.bridge_id,
          'status', next_status::text,
          'message', requested_user_visible_message
        )
      )
      on conflict (intent_id) do nothing;
    end if;
  else
    next_status := null;
  end if;

  insert into community_curation.projection_results (
    bridge_id, release_id, projection_event_id, outcome, public_version,
    incorporated_assertion_keys, contributor_status_event_id,
    notification_intent_id, user_visible_message, correlation_id, idempotency_key
  ) values (
    bridge.bridge_id, requested_release_id, requested_projection_event_id,
    requested_outcome::community_curation.projection_outcome,
    requested_public_version, requested_incorporated_assertion_keys,
    status_event_id, intent_id, requested_user_visible_message,
    requested_correlation_id, requested_idempotency_key
  ) returning projection_result_id into result_id;

  update community_curation.assertion_bridges
  set status = case
    when requested_outcome = 'projected' then 'projected'::community_curation.bridge_status
    else 'projection_failed'::community_curation.bridge_status
  end
  where assertion_bridges.bridge_id = bridge.bridge_id;

  insert into community_curation.command_receipts (
    actor_account_id, idempotency_key, command_name, command_payload_sha256,
    bridge_id, release_id, projection_result_id
  ) values (
    requested_actor_id, requested_idempotency_key, 'record_projection',
    requested_payload_sha256, bridge.bridge_id, requested_release_id, result_id
  );

  projection_result_id := result_id;
  contributor_status := next_status::text;
  notification_intent_id := intent_id;
  return next;
end;
$projection$;

create or replace view community_curation.assertion_bridge_queue as
select
  bridge.*,
  change_set.status as change_set_status,
  change_set.governance_mode,
  change_set.validation_state,
  change_set.published_release_id,
  release_observation.release_id as observed_release_id,
  release_observation.data_version as observed_data_version,
  projection.projection_result_id,
  projection.outcome::text as projection_outcome,
  projection.public_version,
  projection.notification_intent_id,
  (
    bridge.status in ('created', 'release_seen')
    and now() > bridge.updated_at + interval '2 days'
  ) as stuck
from community_curation.assertion_bridges bridge
join public.change_sets change_set on change_set.id = bridge.change_set_id
left join lateral (
  select observation.release_id, observation.data_version
  from community_curation.release_observations observation
  where observation.bridge_id = bridge.bridge_id
  order by observation.observed_at desc
  limit 1
) release_observation on true
left join lateral (
  select result.projection_result_id, result.outcome, result.public_version,
         result.notification_intent_id
  from community_curation.projection_results result
  where result.bridge_id = bridge.bridge_id
  order by result.created_at desc, result.projection_result_id desc
  limit 1
) projection on true;

create or replace view community_curation.chain_integrity_metrics as
select
  (select count(*)
   from review_moderation.decisions decision
   where decision.outcome = 'accepted')::bigint as accepted_decisions,
  count(*)::bigint as bridged_decisions,
  count(*) filter (where observed_release_id is not null)::bigint as release_observed_bridges,
  count(*) filter (where projection_outcome = 'projected')::bigint as projected_bridges,
  count(*) filter (where projection_outcome = 'failed')::bigint as projection_failed_bridges,
  count(*) filter (where stuck)::bigint as stuck_bridges,
  count(*) filter (
    where observed_release_id is not null
      and published_release_id is distinct from observed_release_id
  )::bigint as broken_release_links
from community_curation.assertion_bridge_queue;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('community_curation.bridge.create',
   'Bridge accepted ReviewCase assertions into a Curation Change Set.', true),
  ('community_curation.bridge.read',
   'Read community-to-curation bridge provenance and incorporation state.', true),
  ('community_curation.bridge.consume',
   'Consume Archive Release and Public Projection events for community bridges.', true),
  ('community_curation.bridge.metrics',
   'Read community-to-curation chain integrity metrics.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('reviewer', 'community_curation.bridge.create'),
  ('reviewer', 'community_curation.bridge.read'),
  ('reviewer', 'community_curation.bridge.metrics'),
  ('moderator', 'community_curation.bridge.create'),
  ('moderator', 'community_curation.bridge.read'),
  ('moderator', 'community_curation.bridge.consume'),
  ('moderator', 'community_curation.bridge.metrics'),
  ('archive_editor', 'community_curation.bridge.read'),
  ('archive_editor', 'community_curation.bridge.consume'),
  ('archive_editor', 'community_curation.bridge.metrics'),
  ('senior_archive_editor', 'community_curation.bridge.read'),
  ('senior_archive_editor', 'community_curation.bridge.consume'),
  ('senior_archive_editor', 'community_curation.bridge.metrics')
on conflict do nothing;

alter table community_curation.assertion_bridges enable row level security;
alter table community_curation.assertion_bridge_items enable row level security;
alter table community_curation.release_observations enable row level security;
alter table community_curation.projection_results enable row level security;
alter table community_curation.command_receipts enable row level security;

revoke all on schema community_curation from public;
revoke all on all tables in schema community_curation from public;
revoke all on all sequences in schema community_curation from public;
revoke all on all functions in schema community_curation from public;

comment on table community_curation.assertion_bridges is
  'Provenance-complete anti-corruption link from an accepted ReviewCase decision to one Curation Change Set.';
comment on table community_curation.assertion_bridge_items is
  'Per-assertion disposition at bridge creation and later incorporation.';
comment on table community_curation.release_observations is
  'Idempotent Archive Release event consumption for bridged community Change Sets.';
comment on table community_curation.projection_results is
  'Idempotent Public Projection incorporation result and notification linkage.';
comment on function community_curation.create_assertion_bridge(
  uuid, uuid, integer, text, text, text, text, text, uuid, jsonb
) is 'Creates one community-derived Curation Change Set and moves contributor state only to incorporation_in_progress.';
comment on function community_curation.record_projection_result(
  uuid, uuid, uuid, uuid, text, text, jsonb, text, text, text, uuid
) is 'Records an idempotent Public Projection result; only projected results set full or partial incorporation and create notification evidence.';

commit;
