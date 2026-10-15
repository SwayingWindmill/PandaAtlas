-- Retire the V1 capability catalog, the staff roles that grant no duty, and the contribution
-- storage nothing reads (#633). Production held 2 active role assignments (both member), 0
-- authorization audit events naming a capability or role, and 0 submissions, status events and
-- assertion results (read-only check on 2026-10-15, recorded on #633).

begin;

-- Capabilities no code checks ------------------------------------------------------------------
create temporary table retired_capabilities (capability_key text primary key) on commit drop;
insert into retired_capabilities values
  ('activity.editorial.publish'), ('activity.pin.manage'), ('activity.sitewide.publish'),
  ('archive.accountable.correct'), ('archive.accountable.metrics'),
  ('archive.accountable.operation_metrics'), ('archive.accountable.publish'),
  ('archive.accountable.rollback'), ('archive.accountable.validate'),
  ('archive.batch.create'), ('archive.batch.preview'), ('archive.batch.publish'),
  ('archive.batch.rollback'), ('archive.batch.withdraw'),
  ('archive.change_set.create'), ('archive.change_set.submit'), ('archive.cutover.manage'),
  ('archive.review'),
  ('archive.sensitive.correct'), ('archive.sensitive.merge_split'), ('archive.sensitive.publish'),
  ('archive.sensitive.rollback'), ('archive.sensitive.takedown'), ('archive.workbench.read'),
  ('audit.export'), ('audit.integrity.manage'), ('audit.maintain'),
  ('community_curation.bridge.consume'), ('community_curation.bridge.create'),
  ('community_curation.bridge.metrics'), ('community_curation.bridge.read'),
  ('community_intake.evidence.read'), ('community_intake.retention.manage'),
  ('community_intake.scan.record'), ('community_intake.status.project'),
  ('evidence.manage'), ('evidence.read'),
  ('game.question.edit'), ('game.question.publish'), ('game.question.read'),
  ('import.execute'), ('import.read'),
  ('life_history.manage'), ('life_history.read'), ('lineage.manage'), ('lineage.read'),
  ('media.manage'), ('media.read'), ('media.upload'),
  ('panda.manage'), ('panda.read'), ('places.manage'), ('places.read'),
  ('privacy.operate');

-- Roles that grant no duty the API checks: contributor, editorial_publisher, import_operator and
-- privacy_operator held only V1 keys; community_scanner was a V1 service role; moderator and
-- audit_exporter grant exactly what reviewer and audit_reader grant.
create temporary table retired_roles (role_key text primary key) on commit drop;
insert into retired_roles values
  ('contributor'), ('editorial_publisher'), ('import_operator'), ('privacy_operator'),
  ('community_scanner'), ('moderator'), ('audit_exporter');

delete from identity.role_capabilities
where capability_key in (select capability_key from retired_capabilities)
   or role_key in (select role_key from retired_roles);
delete from identity.capabilities where capability_key in (select capability_key from retired_capabilities);
delete from identity.roles where role_key in (select role_key from retired_roles);

-- The remaining staff roles, described by the duty they grant.
update identity.roles set display_name = 'Reviewer',
  description = 'May claim and decide contribution review cases; accepting writes the facts.'
where role_key = 'reviewer';
update identity.roles set display_name = 'Release Editor',
  description = 'May build and inspect candidate public releases.'
where role_key = 'archive_editor';
update identity.roles set display_name = 'Release Publisher',
  description = 'May activate, roll back and take down public releases.'
where role_key = 'senior_archive_editor';
update identity.roles set description = 'May search unified Audit evidence.'
where role_key = 'audit_reader';

-- Contribution storage nothing reads -----------------------------------------------------------
drop table community_intake.contributor_assertion_results;
drop type community_intake.assertion_disposition;

-- The columns of statuses the API never writes; their check constraints go with them.
alter table community_intake.contributor_status_events
  drop column action_required_fields,
  drop column target_redirect_id;

alter table community_intake.contributor_status_events
  drop constraint contributor_status_events_source_context_check,
  add constraint contributor_status_events_source_context_check
    check (source_context in ('contributor', 'review'));

-- The contributor status is submitted, then one review outcome.
drop view review_moderation.review_case_queue;
alter table community_intake.submissions alter column contributor_status drop default;
alter type community_intake.contributor_status rename to contributor_status_retired;
create type community_intake.contributor_status as enum
  ('submitted', 'accepted', 'not_accepted', 'duplicate', 'out_of_scope');
alter table community_intake.submissions
  alter column contributor_status type community_intake.contributor_status
    using contributor_status::text::community_intake.contributor_status,
  alter column contributor_status set default 'submitted';
alter table community_intake.contributor_status_events
  alter column status type community_intake.contributor_status
    using status::text::community_intake.contributor_status;
drop type community_intake.contributor_status_retired;

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

commit;
