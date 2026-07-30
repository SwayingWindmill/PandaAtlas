begin;

create type community_intake.contributor_status as enum (
  'draft',
  'submitted',
  'action_required',
  'duplicate',
  'out_of_scope',
  'not_accepted',
  'accepted',
  'incorporation_in_progress',
  'incorporated_full',
  'incorporated_partial',
  'withdrawn',
  'expired',
  'target_merged',
  'target_unpublished'
);

create type community_intake.assertion_disposition as enum (
  'pending',
  'selected',
  'not_selected',
  'incorporated',
  'not_incorporated',
  'superseded'
);

alter table community_intake.submissions
  add column contributor_status community_intake.contributor_status not null default 'draft',
  add column current_status_event_id uuid,
  add column contributor_status_updated_at timestamptz not null default now();

create table community_intake.contributor_status_events (
  status_event_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references community_intake.submissions(submission_id)
    on delete restrict,
  status community_intake.contributor_status not null,
  active_revision_number integer,
  user_visible_reason text check (
    user_visible_reason is null or length(user_visible_reason) between 3 and 2000
  ),
  action_required_fields jsonb not null default '[]'::jsonb check (
    jsonb_typeof(action_required_fields) = 'array'
  ),
  target_redirect_id text check (
    target_redirect_id is null or length(target_redirect_id) between 1 and 255
  ),
  source_context text not null check (
    source_context in ('contributor', 'review', 'curation', 'projection', 'target_lifecycle')
  ),
  source_event_id uuid,
  actor_subject_hash text not null check (actor_subject_hash ~ '^[0-9a-f]{64}$'),
  correlation_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 1 and 255),
  occurred_at timestamptz not null default now(),
  unique (submission_id, idempotency_key),
  check (
    status <> 'action_required'
    or (user_visible_reason is not null and jsonb_array_length(action_required_fields) > 0)
  ),
  check (
    status <> 'target_merged' or target_redirect_id is not null
  )
);

alter table community_intake.submissions
  add constraint community_submissions_current_status_event_fk
  foreign key (current_status_event_id)
  references community_intake.contributor_status_events(status_event_id)
  on delete restrict;

create index idx_community_status_events_submission
  on community_intake.contributor_status_events(submission_id, occurred_at desc, status_event_id desc);

create index idx_community_submissions_contributor_status
  on community_intake.submissions(account_id, contributor_status, updated_at desc)
  where account_id is not null;

update community_intake.submissions
set contributor_status = case state
      when 'submitted' then 'submitted'::community_intake.contributor_status
      when 'withdrawn' then 'withdrawn'::community_intake.contributor_status
      when 'expired' then 'expired'::community_intake.contributor_status
      when 'closed' then 'not_accepted'::community_intake.contributor_status
      else 'draft'::community_intake.contributor_status
    end,
    contributor_status_updated_at = updated_at;

with inserted as (
  insert into community_intake.contributor_status_events (
    submission_id, status, active_revision_number, source_context,
    actor_subject_hash, correlation_id, idempotency_key, occurred_at
  )
  select submission_id, contributor_status,
         nullif(latest_revision_number, 0), 'contributor',
         contributor_subject_hash, gen_random_uuid(),
         'migration-0017-initial-status', created_at
  from community_intake.submissions
  returning submission_id, status_event_id
)
update community_intake.submissions submission
set current_status_event_id = inserted.status_event_id
from inserted
where submission.submission_id = inserted.submission_id;

create table community_intake.contributor_assertion_results (
  result_id uuid primary key default gen_random_uuid(),
  status_event_id uuid not null references community_intake.contributor_status_events(status_event_id)
    on delete restrict,
  submission_id uuid not null references community_intake.submissions(submission_id)
    on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  assertion_key text not null check (assertion_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'),
  disposition community_intake.assertion_disposition not null,
  explanation text check (explanation is null or length(explanation) between 3 and 2000),
  public_reference_id text check (
    public_reference_id is null or length(public_reference_id) between 1 and 255
  ),
  created_at timestamptz not null default now(),
  unique (status_event_id, assertion_key)
);

create index idx_community_assertion_results_submission
  on community_intake.contributor_assertion_results(
    submission_id, revision_number, assertion_key, created_at desc
  );

create table community_intake.contributor_journey_events (
  journey_event_id uuid primary key default gen_random_uuid(),
  submission_id uuid references community_intake.submissions(submission_id)
    on delete set null,
  contributor_subject_hash text not null check (
    contributor_subject_hash ~ '^[0-9a-f]{64}$'
  ),
  event_type text not null check (length(event_type) between 3 and 100),
  locale text check (locale is null or locale in ('zh', 'en')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);

create index idx_community_journey_events_subject
  on community_intake.contributor_journey_events(
    contributor_subject_hash, occurred_at desc
  );

create trigger trg_contributor_status_events_append_only
before update or delete on community_intake.contributor_status_events
for each row execute function community_intake.reject_append_only_mutation();

create trigger trg_contributor_assertion_results_append_only
before update or delete on community_intake.contributor_assertion_results
for each row execute function community_intake.reject_append_only_mutation();

create trigger trg_contributor_journey_events_append_only
before update or delete on community_intake.contributor_journey_events
for each row execute function community_intake.reject_append_only_mutation();

insert into identity.capabilities (capability_key, description, sensitive) values
  ('community_intake.status.project',
   'Project contributor-visible submission status without exposing review internals.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('reviewer', 'community_intake.status.project'),
  ('moderator', 'community_intake.status.project')
on conflict do nothing;

revoke all on all tables in schema community_intake from public;
revoke all on all sequences in schema community_intake from public;
revoke all on all functions in schema community_intake from public;

commit;
