-- Retire PostgreSQL objects that belonged only to the pre-NestJS V1 runtime.
--
-- This migration is intentionally forward-only. It keeps every table reused by V2,
-- keeps habitat/distribution data pending a future owner decision, and uses RESTRICT
-- semantics everywhere an object crosses a preserved schema boundary.

begin;

-- The habitat/distribution model is intentionally retained outside V2 ownership for
-- now. Its old write policies depended on public.user_roles, which is a retired V1
-- authorization projection. Keep these relations public-read-only and move the one
-- retained Panda FK to the canonical V2 Panda identity table before removing
-- public.pandas.
drop policy if exists habitats_admin_write on public.habitats;
drop policy if exists sightings_admin_write on public.sightings;
drop policy if exists distribution_snapshots_admin_write on public.distribution_snapshots;
drop policy if exists distribution_cells_admin_write on public.distribution_cells;

alter table public.sightings
  drop constraint if exists sightings_panda_id_fkey;
alter table public.sightings
  add constraint sightings_panda_id_fkey
  foreign key (panda_id) references panda.pandas(panda_id) on delete set null;

-- V1 privacy finalization added request IDs to the retained Community Intake table.
-- Nest V2 Privacy has a different request authority and does not use these columns;
-- remove the legacy coupling rather than pointing old workflow provenance at a new
-- request model with different semantics.
drop trigger if exists trg_submission_subject_anonymization on community_intake.submissions;
alter table community_intake.submissions
  drop constraint if exists submissions_contributor_subject_privacy_shape;
alter table community_intake.submissions
  drop column if exists contributor_subject_anonymized_at,
  drop column if exists contributor_subject_anonymization_request_id;

do $drop_community_intake_legacy_function$
declare
  routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'community_intake'
      and p.proname = 'protect_submission_subject_anonymization'
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_community_intake_legacy_function$;

-- The old bridge may contain completed historical rows, but it must not carry
-- unfinished editorial work into retirement. #332 classified projected rows as
-- disposable bridge history; every other status still represents unresolved work.
do $community_curation_preflight$
begin
  if to_regclass('community_curation.assertion_bridges') is not null
     and exists (
       select 1
       from community_curation.assertion_bridges
       where status <> 'projected'
     ) then
    raise exception 'cannot retire community_curation: unfinished bridge work remains';
  end if;
end
$community_curation_preflight$;

-- Legacy Privacy requests were required to be closed before the V2 cutover. A late
-- open request is a hard stop; completed historical rows are already covered by the
-- cutover backup/evidence and may be retired with the V1 workflow tables.
do $privacy_preflight$
begin
  if to_regclass('privacy.requests') is not null
     and exists (
       select 1
       from privacy.requests
       where state in ('requested', 'verified', 'processing')
     ) then
    raise exception 'cannot retire V1 privacy workflow: an open legacy request remains';
  end if;
end
$privacy_preflight$;

-- An active V1 Follow must already be represented by V2 Favorite before its old
-- state-machine row can disappear. UUID and canonical-slug resolution mirror the
-- deterministic V1-to-V2 migration boundary.
do $follow_preflight$
begin
  if to_regclass('engagement.follows') is not null
     and exists (
       select 1
       from engagement.follows follow_row
       left join public.pandas legacy_panda
         on legacy_panda.id::text = follow_row.panda_id
         or legacy_panda.slug = follow_row.panda_id
       left join engagement.favorites favorite
         on favorite.account_id = follow_row.account_id
        and favorite.panda_id = legacy_panda.id
       where follow_row.state = 'active'
         and favorite.account_id is null
     ) then
    raise exception 'cannot retire V1 follows: an active follow is missing its V2 favorite';
  end if;
end
$follow_preflight$;

-- The V1 Community Curation bridge references public.change_sets and
-- public.publication_batches, so retire the bridge before those public objects. Its
-- own preflight above guarantees that no unfinished editorial bridge state is being
-- discarded.
drop view if exists community_curation.chain_integrity_metrics;
drop view if exists community_curation.assertion_bridge_queue;

drop table if exists
  community_curation.assertion_bridge_items,
  community_curation.release_observations,
  community_curation.projection_results,
  community_curation.command_receipts,
  community_curation.assertion_bridges
restrict;

do $drop_community_curation_functions$
declare routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'community_curation'
      and p.proname = any(array[
        'reject_bridge_evidence_mutation',
        'touch_assertion_bridge',
        'create_assertion_bridge',
        'record_archive_release',
        'record_projection_result'
      ])
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_community_curation_functions$;

drop type if exists community_curation.bridge_assertion_disposition restrict;
drop type if exists community_curation.bridge_status restrict;
drop type if exists community_curation.projection_outcome restrict;
drop schema if exists community_curation restrict;

-- V1 public/archive views depend on the tables retired below. Drop the two legacy
-- source policies that depend on public.public_evidence_sources first, then keep the
-- view/table retirement itself on RESTRICT rather than hiding dependencies in a broad
-- CASCADE.
drop policy if exists residency_sources_public_read on public.residency_sources;
drop policy if exists event_sources_public_read on public.domain_event_sources;
drop view if exists public.public_evidence_sources;
drop view if exists public.change_set_governance_compatibility;
drop view if exists public.archive_publication_metrics;
drop view if exists public.archive_operation_metrics;
drop view if exists public.archive_workbench_metrics;
drop view if exists public.archive_workbench_queue;

-- These V1 commands return row types from tables retired below. They have no trigger
-- callers, so retire them before the table composite types disappear.
do $drop_public_v1_composite_commands$
declare routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'publish_publication_batch',
        'complete_emergency_takedown_followup',
        'set_archive_publication_cutover'
      ])
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_public_v1_composite_commands$;

-- Public V1 knowledge, publication/workbench, bootstrap-role and transient import
-- state. habitat/sightings/distribution_* are deliberately not in this list.
drop table if exists
  public.panda_name_sources,
  public.panda_slug_sources,
  public.panda_external_identifier_sources,
  public.fact_assertion_sources,
  public.public_fact_conclusion_assertions,
  public.parentage_assertion_sources,
  public.residency_sources,
  public.domain_event_participants,
  public.domain_event_sources,
  public.panda_media,
  public.evidence_attachments,
  public.evidence_sources,
  public.publication_batch_change_sets,
  public.change_set_revisions,
  public.change_set_reviews,
  public.archive_release_evidence,
  public.archive_command_receipts,
  public.archive_publication_failures,
  public.archive_operation_command_receipts,
  public.archive_emergency_followup_completions,
  public.archive_operation_activity_events,
  public.archive_cutover_command_receipts,
  public.archive_cutover_audit,
  public.panda_names,
  public.panda_slugs,
  public.panda_external_identifiers,
  public.fact_assertions,
  public.public_fact_conclusions,
  public.parentage_assertions,
  public.panda_residencies,
  public.domain_events,
  public.media_assets,
  public.institutions,
  public.facilities,
  public.entity_revisions,
  public.change_sets,
  public.publication_batches,
  public.public_release_pointer,
  public.audit_events,
  public.public_api_release_withdrawals,
  public.archive_governance_revalidations,
  public.archive_governance_migration_runs,
  public.archive_validation_results,
  public.archive_release_pointer,
  public.archive_operation_records,
  public.archive_publication_cutover_control,
  public.admin_import_jobs,
  public.user_roles,
  public.pandas
restrict;

-- Retire the public-schema routines whose only purpose was V1 publication,
-- archive/workbench, bootstrap-role or privacy-redaction behavior. public.set_updated_at
-- remains because retained habitats and sightings still use it.
do $drop_public_v1_functions$
declare
  routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'has_any_role',
        'reject_append_only_mutation',
        'protect_published_batch',
        'apply_change_set_review',
        'require_approved_batch_change_set',
        'require_draft_workflow_container',
        'publish_publication_batch',
        'reject_public_api_withdrawal_mutation',
        'reject_archive_governance_evidence_mutation',
        'reject_accountable_evidence_mutation',
        'protect_published_change_set',
        'publish_accountable_change_set',
        'reject_archive_operation_evidence_mutation',
        'execute_accountable_archive_operation',
        'complete_emergency_takedown_followup',
        'emit_archive_operation_activity_source',
        'reject_archive_cutover_evidence_mutation',
        'block_publication_batch_when_cutover_held',
        'set_archive_publication_cutover',
        'fill_change_set_origin_actor',
        'protect_entity_revision_privacy_redaction'
      ])
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_public_v1_functions$;

drop type if exists public.panda_status restrict;
drop type if exists public.import_job_status restrict;
drop type if exists public.app_user_role restrict;

-- V1 Follow/Passport/notification projection and the old Guess Panda attempt model.
drop table if exists
  engagement.follow_events,
  engagement.notification_preference_events,
  engagement.passport_contribution_events,
  engagement.passport_entries,
  engagement.last_viewed_profiles,
  engagement.audit_events,
  engagement.pending_follow_intents,
  engagement.follows,
  engagement.notification_preferences,
  engagement.game_attempts
restrict;

do $drop_engagement_v1_functions$
declare routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'engagement'
      and p.proname = 'reject_append_only_mutation'
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_engagement_v1_functions$;

drop type if exists engagement.pending_follow_status restrict;
drop type if exists engagement.pending_follow_outcome restrict;
drop type if exists engagement.follow_state restrict;

drop table if exists game.guess_questions restrict;

-- V1 Activity and Feed are projection/cursor schemas. Enumerate their contents, then
-- use RESTRICT for the schema itself so an unexpected object stops the migration.
drop table if exists
  activity.targets,
  activity.projection_receipts,
  activity.projection_failures,
  activity.editorial_announcements,
  activity.audit_events,
  activity.items
restrict;

do $drop_activity_v1_functions$
declare routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'activity'
      and p.proname = 'reject_append_only_mutation'
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_activity_v1_functions$;

drop schema if exists activity restrict;

drop table if exists feed.last_viewed_events, feed.account_state restrict;

do $drop_feed_v1_functions$
declare routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'feed'
      and p.proname = 'reject_append_only_mutation'
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_feed_v1_functions$;

drop schema if exists feed restrict;

-- V1 Notification orchestration/worker state. Keep only the V2 tables introduced by
-- 0047: channel_preferences, messages, message_channels, provider_jobs,
-- provider_attempts and provider_dead_letters.
drop table if exists
  notification.preference_events,
  notification.source_receipts,
  notification.intent_channels,
  notification.inbox_state_events,
  notification.delivery_attempts,
  notification.digest_items,
  notification.transport_outbox_receipts,
  notification.transport_attempts,
  notification.provider_webhook_events,
  notification.email_suppressions,
  notification.worker_events,
  notification.audit_events,
  notification.intents,
  notification.inbox_items,
  notification.digest_batches,
  notification.delivery_jobs,
  notification.preferences
restrict;

do $drop_notification_v1_functions$
declare routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'notification'
      and p.proname = any(array[
        'reject_append_only_mutation',
        'protect_queued_digest',
        'protect_delivery_attempt',
        'protect_digest_item',
        'reject_transport_append_only_mutation',
        'protect_transport_attempt'
      ])
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_notification_v1_functions$;

drop type if exists notification.category restrict;
drop type if exists notification.channel restrict;
drop type if exists notification.intent_state restrict;
drop type if exists notification.delivery_state restrict;
drop type if exists notification.digest_frequency restrict;
drop type if exists notification.digest_state restrict;
drop type if exists notification.transport_job_state restrict;

-- V1 Privacy workflow. identity.account_tombstones was part of that workflow and
-- points directly at privacy.requests, so it retires with the old request model.
drop table if exists identity.account_tombstones restrict;

drop table if exists
  privacy.request_events,
  privacy.request_contexts,
  privacy.context_events,
  privacy.hold_events,
  privacy.export_artifacts,
  privacy.archive_anonymization_events,
  privacy.audit_events,
  privacy.maintenance_runs,
  privacy.deletion_tombstones,
  privacy.holds,
  privacy.retention_policies,
  privacy.requests
restrict;

do $drop_privacy_v1_functions$
declare routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'privacy'
      and p.proname = any(array['set_updated_at', 'reject_append_only_mutation'])
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_privacy_v1_functions$;

drop type if exists privacy.request_kind restrict;
drop type if exists privacy.request_state restrict;
drop type if exists privacy.context_state restrict;
drop type if exists privacy.hold_state restrict;
drop type if exists privacy.export_state restrict;

-- V1 audit projection/export/maintenance state. Keep audit.evidence_events and its
-- V2 append-only guard. Remove legacy projection triggers from tables that V2 keeps
-- before retiring their audit projector functions.
drop trigger if exists trg_audit_project_identity on identity.authorization_audit_events;
drop trigger if exists trg_audit_project_community on community_intake.audit_events;
drop trigger if exists trg_audit_project_community_sensitive_read on community_intake.sensitive_read_events;
drop trigger if exists trg_audit_project_review on review_moderation.audit_events;

drop table if exists
  audit.rejected_payloads,
  audit.integrity_checks,
  audit.integrity_summaries,
  audit.export_artifacts,
  audit.maintenance_runs,
  audit.event_facts
restrict;

do $drop_audit_v1_functions$
declare routine regprocedure;
begin
  for routine in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'audit'
      and p.proname = any(array[
        'reject_append_only_mutation',
        'role_snapshot',
        'json_hash',
        'project_identity_authorization',
        'project_engagement',
        'project_activity',
        'project_notification',
        'project_community_intake',
        'project_review_moderation',
        'project_archive',
        'protect_export_artifact',
        'project_community_sensitive_read',
        'reject_maintenance_mutation'
      ])
  loop
    execute format('drop function %s restrict', routine);
  end loop;
end
$drop_audit_v1_functions$;

-- admin_media.uploads is intentionally retained. It predates V2, but unlike the
-- objects above it has not yet received an explicit V2 Media ownership/discard
-- decision. #356 does not turn absence of a current code reference into permission
-- to destroy potentially useful private-upload provenance.

comment on schema public is
  'Public PostGIS habitat/distribution compatibility data only; canonical Panda knowledge is owned by V2 private schemas and PublicRead.';
comment on schema engagement is
  'Private V2 fan favorites, collections, check-ins and seen-Panda state.';
comment on schema notification is
  'Private V2 Notification messages, channel preferences, provider jobs and delivery evidence.';
comment on schema privacy is
  'Private V2 Privacy subject-request orchestration and bounded export state.';
comment on schema audit is
  'Private append-only V2 Audit evidence projected from selected durable integration events.';

commit;
