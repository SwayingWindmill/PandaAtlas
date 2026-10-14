-- One-step contribution approval (#611): a Review decision writes its accepted facts, so the
-- Curation change-set lifecycle, the review recommendation step and the review case states that fed
-- them have no reader since the release of #625. Production held 0 rows in every relation dropped
-- here and 0 review cases (read-only check on 2026-10-14, recorded on #611).

begin;

drop table curation.approval_decisions;
drop table curation.panda_fact_changes;
drop table curation.change_sets;
drop schema curation;

drop table review_moderation.curation_recommendations;
drop table review_moderation.information_requests;

-- Review cases move new -> assigned -> closed.
drop view review_moderation.review_case_queue;
drop index review_moderation.idx_review_cases_one_active_submission;
alter table review_moderation.review_cases drop constraint review_cases_check;

alter type review_moderation.review_case_state rename to review_case_state_retired;
create type review_moderation.review_case_state as enum ('new', 'assigned', 'closed');
alter table review_moderation.review_cases
  alter column state drop default,
  alter column state type review_moderation.review_case_state
    using state::text::review_moderation.review_case_state,
  alter column state set default 'new';
drop type review_moderation.review_case_state_retired;

alter table review_moderation.review_cases
  add constraint review_cases_check check ((state = 'closed') = (closed_at is not null));
create unique index idx_review_cases_one_active_submission
  on review_moderation.review_cases(submission_id)
  where state <> 'closed';

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
    (old.state = 'new' and new.state in ('assigned', 'closed'))
    or (old.state = 'assigned' and new.state = 'closed')
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

create view review_moderation.review_case_queue as
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

revoke all on review_moderation.review_case_queue from public, anon, authenticated;
grant select on review_moderation.review_case_queue to zhipanda_app;

-- Capabilities of the retired steps.
delete from identity.role_capabilities
where capability_key in (
  'curation.change.read',
  'curation.change.manage',
  'curation.change.approve',
  'review.case.recommend',
  'review.case.triage',
  'review.case.request_information',
  'review.case.reopen',
  'review.case.metrics'
);
delete from identity.capabilities
where capability_key in (
  'curation.change.read',
  'curation.change.manage',
  'curation.change.approve',
  'review.case.recommend',
  'review.case.triage',
  'review.case.request_information',
  'review.case.reopen',
  'review.case.metrics'
);

commit;
