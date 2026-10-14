-- Retire the moderation storage (#612): sanctions, moderation subjects, restorations and appeals
-- have no reader since the release of #627. Production held 0 rows in every relation dropped here,
-- 0 moderation-suspended accounts and 0 authorization audit events referencing the deleted
-- capabilities (read-only check on 2026-10-14, recorded on #612).

begin;

drop view review_moderation.appeal_queue;

drop table review_moderation.appeal_decisions;
drop table review_moderation.appeal_cases;
drop table review_moderation.restoration_events;
drop table review_moderation.moderation_subjects;
drop table review_moderation.sanctions;

drop function review_moderation.enforce_moderation_subject_version();
drop function review_moderation.enforce_appeal_case_version();

drop type review_moderation.appeal_decision_outcome;
drop type review_moderation.appeal_state;
drop type review_moderation.sanction_scope;
drop type review_moderation.sanction_kind;

delete from identity.role_capabilities where capability_key like 'moderation.%';
delete from identity.capabilities where capability_key like 'moderation.%';

commit;
