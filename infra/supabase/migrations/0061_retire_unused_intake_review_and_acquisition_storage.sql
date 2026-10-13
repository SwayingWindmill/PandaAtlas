-- Retire storage no runtime reads or writes (#575). Production held 0 rows in every relation dropped
-- here (read-only check on 2026-10-13, recorded on #575), and the owner approved the drop.
--
-- V1-era Community Intake and Review & Moderation event, receipt and alert storage: #356 retained
-- both schemas wholesale, but no V2 code uses these relations.
drop view review_moderation.moderation_alerts;
drop view review_moderation.sla_alerts;
drop view review_moderation.moderation_subject_status;
drop table review_moderation.moderation_command_receipts;
drop table review_moderation.moderation_audit_events;
drop table review_moderation.command_receipts;
drop table review_moderation.audit_events;
drop table community_intake.sensitive_read_events;
drop table community_intake.retention_events;
drop table community_intake.contributor_journey_events;
drop table community_intake.audit_events;
drop table community_intake.attachment_scan_events;

-- Acquisition-origin Curation storage: the acquisition intake was removed (#576), so every change set
-- is review-origin.
drop table curation.owner_changes;
alter table curation.change_sets drop constraint curation_change_sets_origin_shape_check;
alter table curation.change_sets drop constraint curation_change_sets_origin_kind_check;
alter table curation.change_sets
  drop column origin_pipeline_artifact_id,
  drop column origin_acquisition_bundle_id;
alter table curation.change_sets
  add constraint curation_change_sets_origin_kind_check check (origin_kind = 'review'),
  alter column origin_review_case_id set not null,
  alter column origin_decision_id set not null,
  alter column origin_submission_id set not null,
  alter column origin_revision_number set not null;
