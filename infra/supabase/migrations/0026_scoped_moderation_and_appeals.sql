begin;

create type review_moderation.sanction_kind as enum (
  'warning',
  'submission_restricted',
  'attachment_restricted',
  'notification_restricted',
  'account_suspended',
  'account_closed_for_abuse'
);

create type review_moderation.sanction_scope as enum (
  'account',
  'submission',
  'attachment',
  'notification'
);

create type review_moderation.appeal_state as enum (
  'open',
  'under_review',
  'closed'
);

create type review_moderation.appeal_decision_outcome as enum (
  'upheld',
  'modified',
  'overturned',
  'dismissed'
);

create table review_moderation.sanctions (
  sanction_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  kind review_moderation.sanction_kind not null,
  scope review_moderation.sanction_scope not null,
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  internal_explanation text not null check (
    length(trim(internal_explanation)) between 10 and 4000
  ),
  user_visible_explanation text not null check (
    length(trim(user_visible_explanation)) between 10 and 2000
  ),
  starts_at timestamptz not null,
  ends_at timestamptz,
  issued_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  subject_version_before integer not null check (subject_version_before >= 1),
  subject_version_after integer not null check (subject_version_after = subject_version_before + 1),
  correlation_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  created_at timestamptz not null default now(),
  unique (issued_by_account_id, idempotency_key),
  check (ends_at is null or ends_at > starts_at),
  check (
    (kind = 'warning' and scope = 'account')
    or (kind = 'submission_restricted' and scope = 'submission')
    or (kind = 'attachment_restricted' and scope = 'attachment')
    or (kind = 'notification_restricted' and scope = 'notification')
    or (kind in ('account_suspended', 'account_closed_for_abuse') and scope = 'account')
  ),
  check (kind <> 'account_closed_for_abuse' or ends_at is null)
);
create index idx_moderation_sanctions_account
  on review_moderation.sanctions(account_id, created_at desc);
create index idx_moderation_sanctions_expiry
  on review_moderation.sanctions(ends_at)
  where ends_at is not null;

create table review_moderation.moderation_subjects (
  account_id uuid primary key references identity.accounts(account_id) on delete restrict,
  version integer not null default 1 check (version >= 1),
  submission_restricted boolean not null default false,
  submission_restricted_until timestamptz,
  submission_sanction_id uuid references review_moderation.sanctions(sanction_id) on delete restrict,
  attachment_restricted boolean not null default false,
  attachment_restricted_until timestamptz,
  attachment_sanction_id uuid references review_moderation.sanctions(sanction_id) on delete restrict,
  notification_restricted boolean not null default false,
  notification_restricted_until timestamptz,
  notification_sanction_id uuid references review_moderation.sanctions(sanction_id) on delete restrict,
  account_suspended boolean not null default false,
  account_closed_for_abuse boolean not null default false,
  account_restricted_until timestamptz,
  account_sanction_id uuid references review_moderation.sanctions(sanction_id) on delete restrict,
  latest_warning_at timestamptz,
  repeat_abuse_count integer not null default 0 check (repeat_abuse_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (submission_restricted or submission_sanction_id is null),
  check (attachment_restricted or attachment_sanction_id is null),
  check (notification_restricted or notification_sanction_id is null),
  check (account_suspended or account_sanction_id is null),
  check (not account_closed_for_abuse or account_suspended)
);
create index idx_moderation_subjects_active
  on review_moderation.moderation_subjects(
    account_suspended,
    submission_restricted,
    attachment_restricted,
    notification_restricted
  );

create table review_moderation.restoration_events (
  restoration_id uuid primary key default gen_random_uuid(),
  sanction_id uuid not null references review_moderation.sanctions(sanction_id) on delete restrict,
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  internal_explanation text not null check (
    length(trim(internal_explanation)) between 10 and 4000
  ),
  user_visible_explanation text not null check (
    length(trim(user_visible_explanation)) between 10 and 2000
  ),
  restored_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  subject_version_before integer not null check (subject_version_before >= 1),
  subject_version_after integer not null check (subject_version_after = subject_version_before + 1),
  correlation_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  restored_at timestamptz not null default now(),
  unique (sanction_id),
  unique (restored_by_account_id, idempotency_key)
);

create table review_moderation.appeal_cases (
  appeal_case_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  sanction_id uuid not null references review_moderation.sanctions(sanction_id) on delete restrict,
  state review_moderation.appeal_state not null default 'open',
  version integer not null default 1 check (version >= 1),
  user_statement text not null check (length(trim(user_statement)) between 20 and 4000),
  first_response_due_at timestamptz not null default review_moderation.add_business_days(now(), 5),
  first_responded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'closed') = (closed_at is not null))
);
create unique index idx_moderation_one_open_appeal_per_sanction
  on review_moderation.appeal_cases(sanction_id)
  where state <> 'closed';
create index idx_moderation_appeal_queue
  on review_moderation.appeal_cases(state, first_response_due_at, created_at);

create table review_moderation.appeal_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  appeal_case_id uuid not null references review_moderation.appeal_cases(appeal_case_id)
    on delete restrict,
  outcome review_moderation.appeal_decision_outcome not null,
  internal_explanation text not null check (
    length(trim(internal_explanation)) between 10 and 4000
  ),
  user_visible_explanation text not null check (
    length(trim(user_visible_explanation)) between 10 and 2000
  ),
  decided_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  decided_at timestamptz not null default now(),
  unique (appeal_case_id)
);

create table review_moderation.moderation_audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  account_id uuid references identity.accounts(account_id) on delete restrict,
  sanction_id uuid references review_moderation.sanctions(sanction_id) on delete restrict,
  appeal_case_id uuid references review_moderation.appeal_cases(appeal_case_id) on delete restrict,
  actor_account_id uuid references identity.accounts(account_id) on delete restrict,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  outcome text not null check (outcome in ('succeeded', 'denied')),
  reason text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  correlation_id uuid not null,
  idempotency_key text,
  occurred_at timestamptz not null default now()
);
create index idx_moderation_audit_account
  on review_moderation.moderation_audit_events(account_id, occurred_at desc);
create index idx_moderation_audit_actor
  on review_moderation.moderation_audit_events(actor_account_id, occurred_at desc);

create table review_moderation.moderation_command_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 255),
  command_name text not null check (length(command_name) between 3 and 127),
  result_type text not null check (result_type in ('sanction', 'restoration', 'appeal', 'appeal_decision')),
  result_id uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (actor_account_id, idempotency_key)
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

create or replace function review_moderation.enforce_appeal_case_version()
returns trigger
language plpgsql
as $$
begin
  if new.account_id <> old.account_id or new.sanction_id <> old.sanction_id then
    raise exception 'appeal case identity is immutable' using errcode = '55000';
  end if;
  if old.state = 'closed' then
    raise exception 'closed appeal cases are immutable' using errcode = '55000';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'appeal case version must increase by exactly one'
      using errcode = '40001';
  end if;
  if new.state <> old.state and not (
    (old.state = 'open' and new.state in ('under_review', 'closed'))
    or (old.state = 'under_review' and new.state = 'closed')
  ) then
    raise exception 'invalid appeal state transition' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_moderation_subject_version
before update on review_moderation.moderation_subjects
for each row execute function review_moderation.enforce_moderation_subject_version();

create trigger trg_moderation_appeal_version
before update on review_moderation.appeal_cases
for each row execute function review_moderation.enforce_appeal_case_version();

create trigger trg_moderation_sanctions_append_only
before update or delete on review_moderation.sanctions
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_moderation_restorations_append_only
before update or delete on review_moderation.restoration_events
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_moderation_appeal_decisions_append_only
before update or delete on review_moderation.appeal_decisions
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_moderation_audit_append_only
before update or delete on review_moderation.moderation_audit_events
for each row execute function review_moderation.reject_append_only_mutation();
create trigger trg_moderation_receipts_append_only
before update or delete on review_moderation.moderation_command_receipts
for each row execute function review_moderation.reject_append_only_mutation();

create or replace view review_moderation.moderation_subject_status as
select
  subject.*,
  account.state::text as account_state,
  (subject.submission_restricted and (
    subject.submission_restricted_until is null or subject.submission_restricted_until > now()
  )) as effective_submission_restricted,
  (subject.attachment_restricted and (
    subject.attachment_restricted_until is null or subject.attachment_restricted_until > now()
  )) as effective_attachment_restricted,
  (subject.notification_restricted and (
    subject.notification_restricted_until is null or subject.notification_restricted_until > now()
  )) as effective_notification_restricted,
  (subject.account_suspended and (
    subject.account_restricted_until is null or subject.account_restricted_until > now()
  )) as effective_account_suspended,
  (
    (subject.account_suspended and account.state::text <> 'suspended')
    or (not subject.account_suspended and account.state::text = 'suspended'
      and coalesce(account.state_reason, '') like 'moderation:%')
  ) as inconsistent_account_state,
  (
    (subject.submission_restricted and subject.submission_restricted_until <= now())
    or (subject.attachment_restricted and subject.attachment_restricted_until <= now())
    or (subject.notification_restricted and subject.notification_restricted_until <= now())
    or (subject.account_suspended and subject.account_restricted_until <= now())
  ) as expired_restriction_projected
from review_moderation.moderation_subjects subject
join identity.accounts account on account.account_id = subject.account_id;

create or replace view review_moderation.appeal_queue as
select
  appeal.*,
  (appeal.first_responded_at is null
    and appeal.state <> 'closed'
    and now() > appeal.first_response_due_at) as appeal_sla_overdue,
  greatest(0, extract(epoch from (now() - appeal.created_at))::bigint) as age_seconds
from review_moderation.appeal_cases appeal;

create or replace view review_moderation.moderation_alerts as
select 'appeal_sla_overdue'::text as alert_type, appeal_case_id::text as subject_id
from review_moderation.appeal_queue
where appeal_sla_overdue
union all
select 'inconsistent_account_state', account_id::text
from review_moderation.moderation_subject_status
where inconsistent_account_state
union all
select 'expired_restriction_projected', account_id::text
from review_moderation.moderation_subject_status
where expired_restriction_projected;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('moderation.sanction.read', 'Read bounded account sanction state and user-visible notices.', true),
  ('moderation.sanction.apply', 'Issue warnings and scoped or account-wide sanctions.', true),
  ('moderation.sanction.restore', 'Append a restoration decision and remove the current sanction projection.', true),
  ('moderation.temporary_submission_freeze', 'Apply a maximum 24-hour submission freeze.', true),
  ('moderation.appeal.read', 'Read bounded moderation appeal cases.', true),
  ('moderation.appeal.decide', 'Acknowledge and decide moderation appeals.', true),
  ('moderation.metrics', 'Read sanction, appeal, expiry, restoration, denial, and consistency metrics.', true)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('reviewer', 'moderation.sanction.read'),
  ('reviewer', 'moderation.temporary_submission_freeze'),
  ('moderator', 'moderation.sanction.read'),
  ('moderator', 'moderation.sanction.apply'),
  ('moderator', 'moderation.sanction.restore'),
  ('moderator', 'moderation.temporary_submission_freeze'),
  ('moderator', 'moderation.appeal.read'),
  ('moderator', 'moderation.appeal.decide'),
  ('moderator', 'moderation.metrics')
on conflict do nothing;

revoke all on all tables in schema review_moderation from public;
revoke all on all sequences in schema review_moderation from public;
revoke all on all functions in schema review_moderation from public;

commit;
