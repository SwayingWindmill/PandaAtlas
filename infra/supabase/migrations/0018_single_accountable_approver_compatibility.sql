begin;

-- Additive compatibility layer for the transition from the historical
-- modifier-plus-independent-review workflow to one accountable Archive Editor.
-- This migration does not convert any record to ready and does not publish data.
alter table public.change_sets
  add column if not exists governance_mode text not null default 'four-eyes-v1',
  add column if not exists validation_state text not null default 'not_validated',
  add column if not exists validated_by uuid,
  add column if not exists validated_at timestamptz,
  add column if not exists validation_reason text,
  add column if not exists base_archive_version text,
  add column if not exists governance_version integer not null default 1;

alter table public.change_sets
  drop constraint if exists change_sets_status_check;
alter table public.change_sets
  add constraint change_sets_status_check check (
    status in (
      'draft',
      'submitted',
      'approved',
      'rejected',
      'validation_failed',
      'ready',
      'publishing',
      'published',
      'publish_failed',
      'superseded',
      'rolled_back',
      'withdrawn'
    )
  );

alter table public.change_sets
  drop constraint if exists change_sets_governance_mode_check;
alter table public.change_sets
  add constraint change_sets_governance_mode_check check (
    governance_mode in ('four-eyes-v1', 'single-accountable-approver-v1')
  );

alter table public.change_sets
  drop constraint if exists change_sets_validation_state_check;
alter table public.change_sets
  add constraint change_sets_validation_state_check check (
    validation_state in ('not_validated', 'legacy_approved', 'validation_failed', 'ready')
  );

alter table public.change_sets
  drop constraint if exists change_sets_governance_version_positive;
alter table public.change_sets
  add constraint change_sets_governance_version_positive check (governance_version >= 1);

-- Preserve historical attribution. An old approval remains an old approval; it
-- is exposed as legacy_approved rather than silently reinterpreted as ready.
update public.change_sets
set
  validation_state = case
    when status = 'approved' then 'legacy_approved'
    when status = 'rejected' then 'validation_failed'
    else validation_state
  end,
  validated_by = case
    when status in ('approved', 'rejected') then reviewed_by
    else validated_by
  end,
  validated_at = case
    when status in ('approved', 'rejected') then reviewed_at
    else validated_at
  end,
  validation_reason = case
    when status in ('approved', 'rejected') then review_reason
    else validation_reason
  end
where status in ('approved', 'rejected');

create or replace function public.apply_change_set_review()
returns trigger
language plpgsql
as $governance$
declare
  current_status text;
  current_governance_mode text;
begin
  select status, governance_mode into current_status, current_governance_mode
  from public.change_sets
  where id = new.change_set_id
  for update;

  if current_governance_mode <> 'four-eyes-v1' then
    raise exception 'Legacy review command is disabled for this governance mode'
      using errcode = '23514';
  end if;
  if current_status <> 'submitted' then
    raise exception 'Only a submitted change set can be reviewed' using errcode = '23514';
  end if;
  if new.decision = 'approved' and exists (
    select 1
    from public.change_set_revisions csr
    join public.entity_revisions revision on revision.id = csr.revision_id
    where csr.change_set_id = new.change_set_id
      and revision.substantive_modified_by = new.reviewer_id
  ) then
    raise exception 'Reviewer cannot approve their own substantive revision'
      using errcode = '23514';
  end if;

  update public.change_sets
  set
    status = new.decision,
    reviewed_by = new.reviewer_id,
    reviewed_at = new.created_at,
    review_reason = new.reason,
    validation_state = case
      when new.decision = 'approved' then 'legacy_approved'
      else 'validation_failed'
    end,
    validated_by = new.reviewer_id,
    validated_at = new.created_at,
    validation_reason = new.reason
  where id = new.change_set_id;

  return new;
end;
$governance$;

create index if not exists idx_change_sets_governance_queue
  on public.change_sets(governance_mode, validation_state, status, created_at);
create index if not exists idx_change_sets_revalidation_candidates
  on public.change_sets(status, reviewed_at)
  where governance_mode = 'four-eyes-v1'
    and status in ('submitted', 'approved');

create table if not exists public.archive_governance_revalidations (
  id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null references public.change_sets(id) on delete restrict,
  source_status text not null,
  result text not null check (result in ('ready', 'validation_failed')),
  actor_id uuid not null,
  actor_role_snapshot jsonb not null,
  reason text not null,
  validation_hash text not null check (validation_hash ~ '^[a-f0-9]{64}$'),
  base_archive_version text not null,
  policy_version text not null default 'single-accountable-approver-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_archive_governance_revalidations_change_set
  on public.archive_governance_revalidations(change_set_id, created_at desc);

create table if not exists public.archive_governance_migration_runs (
  id uuid primary key default gen_random_uuid(),
  source_mode text not null check (source_mode = 'four-eyes-v1'),
  target_mode text not null check (target_mode = 'single-accountable-approver-v1'),
  outcome text not null check (outcome in ('dry_run', 'passed', 'failed')),
  actor_id uuid not null,
  reason text not null,
  source_counts jsonb not null,
  target_counts jsonb not null,
  orphan_counts jsonb not null,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  target_hash text not null check (target_hash ~ '^[a-f0-9]{64}$'),
  release_count_before bigint not null check (release_count_before >= 0),
  release_count_after bigint not null check (release_count_after >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_archive_governance_migration_runs_created
  on public.archive_governance_migration_runs(created_at desc);

-- One compatibility read model for old and new records. Publication eligibility
-- deliberately preserves the current legacy rule only. A new ready record is
-- not eligible until #191 installs the accountable publish command.
create or replace view public.change_set_governance_compatibility as
select
  change_set.id,
  change_set.status as stored_status,
  change_set.governance_mode,
  change_set.validation_state,
  change_set.created_by,
  change_set.reviewed_by as legacy_reviewed_by,
  change_set.reviewed_at as legacy_reviewed_at,
  change_set.review_reason as legacy_review_reason,
  change_set.validated_by,
  change_set.validated_at,
  change_set.validation_reason,
  change_set.base_archive_version,
  change_set.governance_version,
  case
    when change_set.status = 'approved' then 'legacy_approved'
    when change_set.validation_state = 'ready' then 'ready'
    when change_set.validation_state = 'validation_failed' then 'validation_failed'
    else change_set.status
  end as effective_state,
  (
    change_set.governance_mode = 'four-eyes-v1'
    and change_set.status in ('submitted', 'approved')
  ) as requires_explicit_revalidation,
  (
    change_set.governance_mode = 'four-eyes-v1'
    and change_set.status = 'approved'
  ) as legacy_publication_eligible
from public.change_sets change_set;

create or replace function public.reject_archive_governance_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '23514';
end;
$$;

drop trigger if exists trg_archive_governance_revalidations_append_only
  on public.archive_governance_revalidations;
create trigger trg_archive_governance_revalidations_append_only
before update or delete on public.archive_governance_revalidations
for each row execute function public.reject_archive_governance_evidence_mutation();

drop trigger if exists trg_archive_governance_migration_runs_append_only
  on public.archive_governance_migration_runs;
create trigger trg_archive_governance_migration_runs_append_only
before update or delete on public.archive_governance_migration_runs
for each row execute function public.reject_archive_governance_evidence_mutation();

alter table public.archive_governance_revalidations enable row level security;
alter table public.archive_governance_migration_runs enable row level security;

create policy archive_governance_revalidations_staff_read
  on public.archive_governance_revalidations
  for select
  using (public.has_any_role(array['admin', 'editor', 'reviewer']::public.app_user_role[]));
create policy archive_governance_migration_runs_staff_read
  on public.archive_governance_migration_runs
  for select
  using (public.has_any_role(array['admin', 'editor', 'reviewer']::public.app_user_role[]));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'create policy archive_governance_revalidations_backend_write on public.archive_governance_revalidations for all to service_role using (true) with check (true)';
    execute 'create policy archive_governance_migration_runs_backend_write on public.archive_governance_migration_runs for all to service_role using (true) with check (true)';
  end if;
end
$$;

comment on view public.change_set_governance_compatibility is
  'Compatibility read model. legacy_approved is historical evidence and is never silently rewritten to ready.';
comment on table public.archive_governance_revalidations is
  'Append-only evidence for explicit legacy-to-ready revalidation. Migration 0018 writes no rows.';
comment on table public.archive_governance_migration_runs is
  'Append-only rehearsal and cutover invariants including counts, hashes, orphans, and Release stability.';

commit;
