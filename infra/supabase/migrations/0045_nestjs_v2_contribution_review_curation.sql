-- NestJS V2 editorial trust and governance.
-- Existing Community Intake and Review/Moderation tables are reused where their
-- physical semantics are already correct. Nest V2 owns them through separate
-- Contribution, Review, and Moderation modules; the legacy package/schema names
-- are not V2 domain language. The community_curation bridge is intentionally not
-- reused: Curation owns a new workflow and reaches fact owners only through ports.

begin;

create schema if not exists curation;

create table if not exists curation.change_sets (
  change_set_id uuid primary key default gen_random_uuid(),
  origin_review_case_id uuid not null unique
    references review_moderation.review_cases(review_case_id) on delete restrict,
  origin_decision_id uuid not null unique
    references review_moderation.decisions(decision_id) on delete restrict,
  origin_submission_id uuid not null
    references community_intake.submissions(submission_id) on delete restrict,
  origin_revision_number integer not null check (origin_revision_number >= 1),
  target_panda_id uuid not null,
  state text not null default 'draft'
    check (state in ('draft', 'validated', 'approved', 'applied', 'rejected')),
  version integer not null default 1 check (version >= 1),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  created_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  validated_by_account_id uuid references identity.accounts(account_id) on delete restrict,
  validated_at timestamptz,
  approved_by_account_id uuid references identity.accounts(account_id) on delete restrict,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approved_by_account_id is null or approved_by_account_id <> created_by_account_id),
  check ((validated_at is null) = (validated_by_account_id is null)),
  check ((approved_at is null) = (approved_by_account_id is null)),
  check (state not in ('validated', 'approved', 'applied') or validated_at is not null),
  check (state not in ('approved', 'applied') or approved_at is not null),
  check (state <> 'applied' or applied_at is not null),
  foreign key (origin_submission_id, origin_revision_number)
    references community_intake.submission_revisions(submission_id, revision_number)
    on delete restrict
);

create index if not exists idx_curation_change_sets_state
  on curation.change_sets(state, updated_at desc, change_set_id);
create index if not exists idx_curation_change_sets_panda
  on curation.change_sets(target_panda_id, created_at desc);

create table if not exists curation.panda_fact_changes (
  change_id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null references curation.change_sets(change_set_id) on delete restrict,
  origin_assertion_key text not null
    check (origin_assertion_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'),
  field_key text not null check (length(trim(field_key)) between 1 and 160),
  proposed_value jsonb not null,
  certainty text not null check (certainty in ('confirmed', 'provisional')),
  last_verified_on date not null,
  source_ids text[] not null check (cardinality(source_ids) > 0),
  applied_assertion_id text,
  created_at timestamptz not null default now(),
  unique (change_set_id, origin_assertion_key),
  check (applied_assertion_id is null or length(trim(applied_assertion_id)) > 0)
);

create index if not exists idx_curation_panda_fact_changes_set
  on curation.panda_fact_changes(change_set_id, created_at, change_id);

create table if not exists curation.approval_decisions (
  approval_id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null unique references curation.change_sets(change_set_id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  decided_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  decided_at timestamptz not null default now()
);

-- V2 capability vocabulary ----------------------------------------------------

insert into identity.capabilities (
  capability_key,
  description,
  sensitive,
  requires_recent_auth,
  minimum_aal,
  requires_live_session
) values
  ('contribution.read', 'Read the signed-in account contribution status and immutable revisions.', false, false, 'aal1', false),
  ('contribution.manage', 'Create and manage the signed-in account contributions.', false, false, 'aal1', false),
  ('moderation.appeal.submit', 'Submit an appeal for a sanction applied to the signed-in account.', false, false, 'aal1', false),
  ('curation.change.read', 'Read bounded V2 Curation change sets and provenance.', true, true, 'aal1', false),
  ('curation.change.manage', 'Validate V2 Curation change sets through fact-owner ports.', true, true, 'aal1', false),
  ('curation.change.approve', 'Approve and apply validated V2 Curation changes through fact-owner ports.', true, true, 'aal2', true)
on conflict (capability_key) do update
set description = excluded.description,
    sensitive = excluded.sensitive,
    requires_recent_auth = excluded.requires_recent_auth,
    minimum_aal = excluded.minimum_aal,
    requires_live_session = excluded.requires_live_session;

insert into identity.role_capabilities (role_key, capability_key) values
  ('member', 'contribution.read'),
  ('member', 'contribution.manage'),
  ('member', 'moderation.appeal.submit'),
  ('archive_editor', 'curation.change.read'),
  ('archive_editor', 'curation.change.manage'),
  ('senior_archive_editor', 'curation.change.read'),
  ('senior_archive_editor', 'curation.change.manage'),
  ('senior_archive_editor', 'curation.change.approve')
on conflict (role_key, capability_key) do nothing;

-- Existing Review/Moderation capabilities predate the V2 policy columns. Keep
-- ordinary review commands at recent-auth/AAL1, but require a live AAL2 session
-- for sanctions, restoration, appeal decisions, and final fact approval.
update identity.capabilities
set requires_recent_auth = true,
    minimum_aal = 'aal2',
    requires_live_session = true
where capability_key in (
  'moderation.sanction.apply',
  'moderation.sanction.restore',
  'moderation.appeal.decide'
);

-- Database authority ----------------------------------------------------------
-- No browser/Supabase role receives direct governance-table authority.

revoke all on schema curation from public, anon, authenticated;
revoke all on all tables in schema curation from public, anon, authenticated;

grant usage on schema community_intake to zhipanda_app;
grant select, insert, update on community_intake.submissions to zhipanda_app;
grant select, insert on community_intake.submission_revisions to zhipanda_app;
grant select, insert on community_intake.submitted_sources to zhipanda_app;
grant select, insert, update on community_intake.attachments to zhipanda_app;
grant select, insert on community_intake.contributor_status_events to zhipanda_app;
grant select, insert on community_intake.contributor_assertion_results to zhipanda_app;

grant usage on schema review_moderation to zhipanda_app;
grant select, insert, update on review_moderation.review_cases to zhipanda_app;
grant select, insert on review_moderation.information_requests to zhipanda_app;
grant select, insert on review_moderation.source_verifications to zhipanda_app;
grant select, insert on review_moderation.decisions to zhipanda_app;
grant select, insert on review_moderation.curation_recommendations to zhipanda_app;
grant select, insert on review_moderation.sanctions to zhipanda_app;
grant select, insert, update on review_moderation.moderation_subjects to zhipanda_app;
grant select, insert on review_moderation.restoration_events to zhipanda_app;
grant select, insert, update on review_moderation.appeal_cases to zhipanda_app;
grant select, insert on review_moderation.appeal_decisions to zhipanda_app;

grant usage on schema curation to zhipanda_app;
grant select, insert, update on curation.change_sets to zhipanda_app;
grant select, insert, update on curation.panda_fact_changes to zhipanda_app;
grant select, insert on curation.approval_decisions to zhipanda_app;

commit;
