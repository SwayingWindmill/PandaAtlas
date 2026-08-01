begin;

create type review_moderation.moderation_action_kind as enum (
  'warning',
  'submission_restricted',
  'attachment_restricted',
  'notification_restricted',
  'account_suspended',
  'account_closed_for_abuse',
  'restoration'
);

create type review_moderation.appeal_case_state as enum (
  'open',
  'under_review',
  'closed'
);

create type review_moderation.appeal_decision_outcome as enum (
  'upheld',
  'modified',
  'overturned'
);

create table review_moderation.moderation_subjects (
  account_id uuid primary key references identity.accounts(account_id) on delete restrict,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);

create table review_moderation.moderation_actions (
  action_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  kind review_moderation.moderation_action_kind not null,
  scope text not null check (scope ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  internal_explanation text not null check (
    length(trim(internal_explanation)) between 3 and 4000
  ),
  user_visible_explanation text not null check (
    length(trim(user_visible_explanation)) between 10 and 2000
  ),
  starts_at timestamptz not null,
  ends_at timestamptz,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  expected_version integer not null check (expected_version >= 1),
  resulting_version integer not null check (resulting_version >= 2),
  supersedes_action_id uuid references review_moderation.moderation_actions(action_id)
    on delete restrict,
  correlation_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  created_at timestamptz not null default now(),
  unique (actor_account_id, idempotency_key),
  unique (account_id, resulting_version),
  check (ends_at is null or ends_at > starts_at),
  check ((kind = 'restoration') = (supersedes_action_id is not null)),
  check (kind <> 'restoration' or ends_at is null)
);
create index idx_moderation_actions_account_time
  on review_moderation.moderation_actions(account_id, created_at desc);
create index idx_moderation_actions_effective
  on review_moderation.moderation_actions(account_id, starts_at, ends_at)
  where kind <> 'restoration';

create table review_moderation.appeal_cases (
  appeal_case_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  sanction_action_id uuid not null references review_moderation.moderation_actions(action_id)
    on delete restrict,
  state review_moderation.appeal_case_state not null default 'open',
  version integer not null default 1 check (version >= 1),
  appellant_message text not null check (length(trim(appellant_message)) between 10 and 4000),
  primary_assignee_id uuid references identity.accounts(account_id) on delete restrict,
  first_response_due_at timestamptz not null default review_moderation.add_business_days(now(), 5),
  first_responded_at timestamptz,
  outcome review_moderation.appeal_decision_outcome,
  user_visible_resolution text,
  internal_resolution text,
  closed_at timestamptz,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key),
  check ((state = 'closed') = (closed_at is not null)),
  check ((state = 'closed') = (outcome is not null)),
  check (user_visible_resolution is null or length(trim(user_visible_resolution)) between 10 and 2000),
  check (internal_resolution is null or length(trim(internal_resolution)) between 3 and 4000)
);
create unique index idx_appeal_cases_one_open_per_sanction
  on review_moderation.appeal_cases(sanction_action_id)
  where state <> 'closed';
create index idx_appeal_cases_queue
  on review_moderation.appeal_cases(state, first_response_due_at, created_at);

create table review_moderation.appeal_events (
  appeal_event_id uuid primary key default gen_random_uuid(),
  appeal_case_id uuid not null references review_moderation.appeal_cases(appeal_case_id)
    on delete restrict,
  event_type text not null check (event_type ~ '^appeal\.[a-z][a-z0-9_.-]{1,127}$'),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  outcome review_moderation.appeal_decision_outcome,
  reason text not null check (length(trim(reason)) between 3 and 4000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  correlation_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  occurred_at timestamptz not null default now(),
  unique (actor_account_id, idempotency_key)
);

create table review_moderation.moderation_audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  action_id uuid references review_moderation.moderation_actions(action_id) on delete restrict,
  appeal_case_id uuid references review_moderation.appeal_cases(appeal_case_id) on delete restrict,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  event_type text not null check (length(event_type) between 3 and 160),
  outcome text not null check (outcome in ('succeeded', 'denied')),
  reason text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  correlation_id uuid not null,
  idempotency_key text,
  occurred_at timestamptz not null default now()
);
create index idx_moderation_audit_account_time
  on review_moderation.moderation_audit_events(account_id, occurred_at desc);

create table review_moderation.moderation_outbox_events (
  outbox_event_id uuid primary key default gen_random_uuid(),
  event_type text not null check (length(event_type) between 3 and 160),
  aggregate_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create or replace function review_moderation.enforce_moderation_subject_version()
returns trigger
language plpgsql
as $$
begin
  if new.account_id <> old.account_id then
    raise exception 'moderation subject identity is immutable' using errcode = '55000';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'moderation subject version must increase by exactly one'
      using errcode = '40001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function review_moderation.enforce_appeal_case_transition()
returns trigger
language plpgsql
as $$
begin
  if new.account_id <> old.account_id
    or new.sanction_action_id <> old.sanction_action_id
    or new.appellant_message <> old.appellant_message then
    raise exception 'appeal case identity and submission are immutable' using errcode = '55000';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'appeal case version must increase by exactly one' using errcode = '40001';
  end if;
  if old.state = 'closed' then
    raise exception 'closed appeal cases are immutable' using errcode = '55000';
  end if;
  if new.state <> old.state and not (
    (old.state = 'open' and new.state in ('under_review', 'closed'))
    or (old.state = 'under_review' and new.state = 'closed')
  ) then
    raise exception 'invalid appeal case transition' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_moderation_subject_version
before update on review_moderation.moderation_subjects
for each row execute function review_moderation.enforce_moderation_subject_version();

create trigger trg_appeal_case_transition
before update on review_moderation.appeal_cases
for each row execute function review_moderation.enforce_appeal_case_transition();

create trigger trg_moderation_actions_append_only
before update or delete on review_moderation.moderation_actions
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_appeal_events_append_only
before update or delete on review_moderation.appeal_events
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_moderation_audit_events_append_only
before update or delete on review_moderation.moderation_audit_events
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_moderation_outbox_events_append_only
before update or delete on review_moderation.moderation_outbox_events
for each row execute function review_moderation.reject_append_only_mutation();

create or replace view review_moderation.effective_sanctions as
select action.*
from review_moderation.moderation_actions action
where action.kind <> 'restoration'
  and action.starts_at <= now()
  and (action.ends_at is null or action.ends_at > now())
  and not exists (
    select 1
    from review_moderation.moderation_actions superseding
    where superseding.supersedes_action_id = action.action_id
  );

create or replace view review_moderation.appeal_queue as
select
  appeal.*,
  sanction.kind as sanction_kind,
  sanction.scope as sanction_scope,
  sanction.user_visible_explanation as sanction_user_visible_explanation,
  (appeal.first_responded_at is null
    and appeal.state <> 'closed'
    and now() > appeal.first_response_due_at) as sla_overdue,
  greatest(0, extract(epoch from (now() - appeal.created_at))::bigint) as queue_age_seconds
from review_moderation.appeal_cases appeal
join review_moderation.moderation_actions sanction
  on sanction.action_id = appeal.sanction_action_id;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('moderation.case.read', 'Read moderation sanctions, appeals, and bounded evidence.', true),
  ('moderation.sanction.issue', 'Issue a bounded moderation action.', true),
  ('moderation.sanction.manage', 'Issue, modify, lift, suspend, close, or restore moderation actions.', true),
  ('moderation.appeal.decide', 'Claim and decide append-only moderation appeals.', true),
  ('moderation.metrics', 'Read moderation and appeal SLA metrics.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('reviewer', 'moderation.sanction.issue'),
  ('moderator', 'moderation.case.read'),
  ('moderator', 'moderation.sanction.issue'),
  ('moderator', 'moderation.sanction.manage'),
  ('moderator', 'moderation.appeal.decide'),
  ('moderator', 'moderation.metrics')
on conflict do nothing;

revoke all on all tables in schema review_moderation from public;
revoke all on all sequences in schema review_moderation from public;
revoke all on all functions in schema review_moderation from public;

commit;
