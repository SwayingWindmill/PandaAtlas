-- Reviewed panda-data acquisition results enter V2 Curation without pretending to
-- originate from Community Intake/Review. Curation remains the only governance
-- workflow; authoritative writes still route through the owning NestJS modules.

begin;

alter table curation.change_sets
  add column if not exists origin_kind text not null default 'review';

alter table curation.change_sets
  add column if not exists origin_pipeline_artifact_id uuid
    references pipeline.artifacts(artifact_id) on delete restrict,
  add column if not exists origin_acquisition_bundle_id text;

alter table curation.change_sets
  alter column origin_review_case_id drop not null,
  alter column origin_decision_id drop not null,
  alter column origin_submission_id drop not null,
  alter column origin_revision_number drop not null;

alter table curation.change_sets
  add constraint curation_change_sets_origin_kind_check
    check (origin_kind in ('review', 'acquisition')),
  add constraint curation_change_sets_origin_shape_check
    check (
      (
        origin_kind = 'review'
        and origin_review_case_id is not null
        and origin_decision_id is not null
        and origin_submission_id is not null
        and origin_revision_number is not null
        and origin_pipeline_artifact_id is null
        and origin_acquisition_bundle_id is null
      )
      or
      (
        origin_kind = 'acquisition'
        and origin_review_case_id is null
        and origin_decision_id is null
        and origin_submission_id is null
        and origin_revision_number is null
        and origin_pipeline_artifact_id is not null
        and length(trim(origin_acquisition_bundle_id)) > 0
      )
    );

create unique index if not exists idx_curation_change_sets_acquisition_artifact
  on curation.change_sets(origin_pipeline_artifact_id)
  where origin_kind = 'acquisition';

create table if not exists curation.owner_changes (
  change_id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null references curation.change_sets(change_set_id) on delete restrict,
  origin_candidate_id text not null
    check (length(trim(origin_candidate_id)) between 1 and 200),
  owner_module text not null
    check (owner_module in ('panda', 'lineage', 'life_history')),
  operation text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  last_verified_on date not null,
  source_ids text[] not null check (cardinality(source_ids) > 0),
  applied_reference text,
  created_at timestamptz not null default now(),
  unique (change_set_id, origin_candidate_id),
  check (applied_reference is null or length(trim(applied_reference)) > 0),
  check (
    (owner_module = 'panda' and operation in (
      'fact.propose',
      'fact.corroborate',
      'fact.dispute',
      'name.add',
      'name.corroborate',
      'external_identifier.add',
      'external_identifier.corroborate'
    ))
    or (owner_module = 'lineage' and operation = 'parentage.create')
    or (owner_module = 'life_history' and operation in ('residency.create', 'event.create'))
  )
);

create index if not exists idx_curation_owner_changes_set
  on curation.owner_changes(change_set_id, created_at, change_id);

revoke all on curation.owner_changes from public, anon, authenticated;
grant select, insert, update on curation.owner_changes to zhipanda_app;

commit;
