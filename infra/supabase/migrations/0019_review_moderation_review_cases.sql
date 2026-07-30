begin;

create schema if not exists review_moderation;

create type review_moderation.review_case_state as enum (
  'new',
  'triage',
  'assigned',
  'waiting',
  'decision_ready',
  'incorporation_recommended',
  'closed'
);

create type review_moderation.review_decision_outcome as enum (
  'accepted',
  'not_accepted',
  'duplicate',
  'out_of_scope',
  'abuse'
);

create type review_moderation.source_verification_outcome as enum (
  'verified',
  'rejected'
);

create or replace function review_moderation.add_business_days(
  start_at timestamptz,
  business_days integer
)
returns timestamptz
language plpgsql
immutable
as $$
declare
  candidate timestamptz := start_at;
  remaining integer := business_days;
begin
  if business_days < 0 then
    raise exception 'business_days must not be negative' using errcode = '22023';
  end if;
  while remaining > 0 loop
    candidate := candidate + interval '1 day';
    if extract(isodow from candidate) between 1 and 5 then
      remaining := remaining - 1;
    end if;
  end loop;
  return candidate;
end;
$$;

create table review_moderation.review_cases (
  review_case_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references community_intake.submissions(submission_id)
    on delete restrict,
  opened_revision_number integer not null check (opened_revision_number >= 1),
  active_revision_number integer not null check (active_revision_number >= 1),
  state review_moderation.review_case_state not null default 'new',
  version integer not null default 1 check (version >= 1),
  primary_assignee_id uuid references identity.accounts(account_id) on delete restrict,
  risk_level text not null default 'normal' check (risk_level in ('normal', 'elevated', 'high')),
  duplicate_of_review_case_id uuid references review_moderation.review_cases(review_case_id)
    on delete restrict,
  reopened_from_review_case_id uuid references review_moderation.review_cases(review_case_id)
    on delete restrict,
  first_response_due_at timestamptz not null default review_moderation.add_business_days(now(), 3),
  first_responded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (submission_id, opened_revision_number)
    references community_intake.submission_revisions(submission_id, revision_number)
    on delete restrict,
  foreign key (submission_id, active_revision_number)
    references community_intake.submission_revisions(submission_id, revision_number)
    on delete restrict,
  check ((state = 'closed') = (closed_at is not null)),
  check (duplicate_of_review_case_id is null or duplicate_of_review_case_id <> review_case_id),
  check (reopened_from_review_case_id is null or reopened_from_review_case_id <> review_case_id)
);

create unique index idx_review_cases_one_active_submission
  on review_moderation.review_cases(submission_id)
  where state <> 'closed';
create index idx_review_cases_queue
  on review_moderation.review_cases(state, first_response_due_at, created_at);
create index idx_review_cases_assignee
  on review_moderation.review_cases(primary_assignee_id, state, updated_at desc);

create table review_moderation.information_requests (
  information_request_id uuid primary key default gen_random_uuid(),
  review_case_id uuid not null references review_moderation.review_cases(review_case_id)
    on delete restrict,
  active_revision_number integer not null check (active_revision_number >= 1),
  requested_fields jsonb not null check (jsonb_typeof(requested_fields) = 'array'),
  user_visible_message text not null check (length(trim(user_visible_message)) between 10 and 2000),
  internal_note text check (internal_note is null or length(trim(internal_note)) between 3 and 4000),
  requested_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table review_moderation.source_verifications (
  source_verification_id uuid primary key default gen_random_uuid(),
  review_case_id uuid not null references review_moderation.review_cases(review_case_id)
    on delete restrict,
  source_id uuid not null references community_intake.submitted_sources(source_id)
    on delete restrict,
  active_revision_number integer not null check (active_revision_number >= 1),
  outcome review_moderation.source_verification_outcome not null,
  normalized_locator text check (
    normalized_locator is null or length(trim(normalized_locator)) between 3 and 2000
  ),
  canonical_source_id text check (
    canonical_source_id is null or length(trim(canonical_source_id)) between 1 and 255
  ),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  verified_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  verified_at timestamptz not null default now(),
  check (outcome <> 'verified' or normalized_locator is not null)
);
create index idx_review_source_verifications_latest
  on review_moderation.source_verifications(review_case_id, source_id, verified_at desc);

create table review_moderation.decisions (
  decision_id uuid primary key default gen_random_uuid(),
  review_case_id uuid not null references review_moderation.review_cases(review_case_id)
    on delete restrict,
  active_revision_number integer not null check (active_revision_number >= 1),
  outcome review_moderation.review_decision_outcome not null,
  user_visible_explanation text not null check (
    length(trim(user_visible_explanation)) between 10 and 2000
  ),
  internal_reason text check (internal_reason is null or length(trim(internal_reason)) between 3 and 4000),
  selected_assertion_keys jsonb not null default '[]'::jsonb check (
    jsonb_typeof(selected_assertion_keys) = 'array'
  ),
  duplicate_of_review_case_id uuid references review_moderation.review_cases(review_case_id)
    on delete restrict,
  decided_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  decided_at timestamptz not null default now(),
  check (outcome <> 'accepted' or jsonb_array_length(selected_assertion_keys) > 0),
  check (outcome <> 'duplicate' or duplicate_of_review_case_id is not null)
);
create index idx_review_decisions_case
  on review_moderation.decisions(review_case_id, decided_at desc);

create table review_moderation.curation_recommendations (
  recommendation_id uuid primary key default gen_random_uuid(),
  review_case_id uuid not null references review_moderation.review_cases(review_case_id)
    on delete restrict,
  decision_id uuid not null references review_moderation.decisions(decision_id) on delete restrict,
  assertion_key text not null check (
    assertion_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'
  ),
  recommended_by_account_id uuid not null references identity.accounts(account_id)
    on delete restrict,
  reason text not null check (length(trim(reason)) between 3 and 2000),
  recommended_at timestamptz not null default now(),
  unique (review_case_id, decision_id, assertion_key)
);

create table review_moderation.audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  review_case_id uuid references review_moderation.review_cases(review_case_id)
    on delete restrict,
  submission_id uuid references community_intake.submissions(submission_id)
    on delete restrict,
  actor_account_id uuid references identity.accounts(account_id) on delete restrict,
  event_type text not null check (length(event_type) between 3 and 160),
  outcome text not null check (outcome in ('succeeded', 'denied')),
  reason text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  correlation_id uuid not null,
  idempotency_key text,
  occurred_at timestamptz not null default now()
);
create index idx_review_audit_case
  on review_moderation.audit_events(review_case_id, occurred_at desc);

create table review_moderation.command_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  command_name text not null check (length(command_name) between 3 and 160),
  review_case_id uuid references review_moderation.review_cases(review_case_id)
    on delete restrict,
  created_at timestamptz not null default now(),
  unique (actor_account_id, idempotency_key)
);

create or replace function review_moderation.reject_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create or replace function review_moderation.enforce_review_case_transition()
returns trigger
language plpgsql
as $$
declare
  contributor_account_id uuid;
begin
  if new.submission_id <> old.submission_id
    or new.opened_revision_number <> old.opened_revision_number
    or new.reopened_from_review_case_id is distinct from old.reopened_from_review_case_id then
    raise exception 'review case identity is immutable' using errcode = '55000';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'review case version must increase by exactly one' using errcode = '40001';
  end if;
  if old.state = 'closed' then
    raise exception 'closed review cases are immutable; reopen creates a new record'
      using errcode = '55000';
  end if;
  if new.state <> old.state and not (
    (old.state = 'new' and new.state in ('triage', 'assigned', 'waiting', 'decision_ready', 'closed'))
    or (old.state = 'triage' and new.state in ('assigned', 'waiting', 'decision_ready', 'closed'))
    or (old.state = 'assigned' and new.state in ('waiting', 'decision_ready', 'closed'))
    or (old.state = 'waiting' and new.state in ('assigned', 'decision_ready', 'closed'))
    or (old.state = 'decision_ready' and new.state in ('assigned', 'waiting', 'incorporation_recommended', 'closed'))
    or (old.state = 'incorporation_recommended' and new.state = 'closed')
  ) then
    raise exception 'invalid review case state transition' using errcode = '23514';
  end if;
  if new.primary_assignee_id is not null then
    select account_id into contributor_account_id
    from community_intake.submissions
    where submission_id = new.submission_id;
    if contributor_account_id = new.primary_assignee_id then
      raise exception 'reviewer cannot be assigned to their own submission' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function review_moderation.enforce_decision_conflict()
returns trigger
language plpgsql
as $$
declare
  contributor_account_id uuid;
begin
  select submission.account_id into contributor_account_id
  from review_moderation.review_cases review_case
  join community_intake.submissions submission
    on submission.submission_id = review_case.submission_id
  where review_case.review_case_id = new.review_case_id;
  if contributor_account_id = new.decided_by_account_id then
    raise exception 'reviewer cannot decide their own submission' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_review_case_transition
before update on review_moderation.review_cases
for each row execute function review_moderation.enforce_review_case_transition();

create trigger trg_review_decision_conflict
before insert on review_moderation.decisions
for each row execute function review_moderation.enforce_decision_conflict();

create trigger trg_review_information_requests_append_only
before update or delete on review_moderation.information_requests
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_review_source_verifications_append_only
before update or delete on review_moderation.source_verifications
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_review_decisions_append_only
before update or delete on review_moderation.decisions
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_review_recommendations_append_only
before update or delete on review_moderation.curation_recommendations
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_review_audit_events_append_only
before update or delete on review_moderation.audit_events
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_review_command_receipts_append_only
before update or delete on review_moderation.command_receipts
for each row execute function review_moderation.reject_append_only_mutation();

create or replace view review_moderation.review_case_queue as
select
  review_case.*,
  submission.target_type,
  submission.target_id,
  submission.contributor_status,
  (review_case.first_responded_at is null
    and review_case.state <> 'closed'
    and now() > review_case.first_response_due_at) as sla_overdue,
  greatest(
    0,
    extract(epoch from (now() - review_case.created_at))::bigint
  ) as queue_age_seconds
from review_moderation.review_cases review_case
join community_intake.submissions submission
  on submission.submission_id = review_case.submission_id;

create or replace view review_moderation.sla_alerts as
select *
from review_moderation.review_case_queue
where sla_overdue;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('review.case.read', 'Read bounded ReviewCase queues and clean evidence metadata.', true),
  ('review.case.intake', 'Create a ReviewCase for a submitted contribution.', true),
  ('review.case.triage', 'Triage risk, duplicate support, and active revision.', true),
  ('review.case.claim', 'Claim one active ReviewCase with conflict checks.', true),
  ('review.case.request_information', 'Request contributor-visible information with a private internal note.', true),
  ('review.case.verify_source', 'Verify and normalize a contributor SubmittedSource.', true),
  ('review.case.decide', 'Record an append-only ReviewCase decision.', true),
  ('review.case.recommend', 'Recommend selected accepted assertions for Curation.', true),
  ('review.case.reopen', 'Reopen a closed review by creating a new ReviewCase.', true),
  ('review.case.metrics', 'Read ReviewCase queue and SLA metrics.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key)
select role_key, capability_key
from (values ('reviewer'), ('moderator')) roles(role_key)
cross join (values
  ('review.case.read'),
  ('review.case.intake'),
  ('review.case.triage'),
  ('review.case.claim'),
  ('review.case.request_information'),
  ('review.case.verify_source'),
  ('review.case.decide'),
  ('review.case.recommend'),
  ('review.case.reopen'),
  ('review.case.metrics')
) capabilities(capability_key)
on conflict do nothing;

revoke all on schema review_moderation from public;
revoke all on all tables in schema review_moderation from public;
revoke all on all sequences in schema review_moderation from public;
revoke all on all functions in schema review_moderation from public;

commit;
