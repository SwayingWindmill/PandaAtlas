begin;

-- Immutable Trusted Archive revisions grouped into independently reviewed change sets.
create table if not exists public.entity_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  revision_number integer not null check (revision_number >= 1),
  payload jsonb not null,
  created_by uuid not null,
  substantive_modified_by uuid not null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, revision_number)
);

create table if not exists public.change_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reason text not null,
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'approved', 'rejected')
  ),
  created_by uuid not null,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.change_set_revisions (
  change_set_id uuid not null references public.change_sets(id) on delete restrict,
  revision_id uuid not null references public.entity_revisions(id) on delete restrict,
  primary key (change_set_id, revision_id),
  unique (revision_id)
);

create table if not exists public.change_set_reviews (
  id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null references public.change_sets(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  reviewer_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Publication batches become immutable as soon as they are published. Rollback and
-- withdrawal are new batches, never rewrites of an earlier public version.
create table if not exists public.publication_batches (
  id uuid primary key default gen_random_uuid(),
  public_schema_version text not null,
  data_version text not null unique,
  reason text not null,
  correlation_id uuid not null,
  operation text not null default 'release' check (
    operation in ('release', 'rollback', 'withdrawal')
  ),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null,
  published_by uuid,
  published_at timestamptz,
  previous_batch_id uuid references public.publication_batches(id) on delete restrict,
  rollback_target_id uuid references public.publication_batches(id) on delete restrict,
  withdrawal_target_id uuid references public.publication_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (operation = 'release' and rollback_target_id is null and withdrawal_target_id is null)
    or (operation = 'rollback' and rollback_target_id is not null and withdrawal_target_id is null)
    or (operation = 'withdrawal' and withdrawal_target_id is not null and rollback_target_id is null)
  )
);

create table if not exists public.publication_batch_change_sets (
  batch_id uuid not null references public.publication_batches(id) on delete restrict,
  change_set_id uuid not null references public.change_sets(id) on delete restrict,
  primary key (batch_id, change_set_id)
);

create table if not exists public.public_release_pointer (
  singleton boolean primary key default true check (singleton),
  active_batch_id uuid references public.publication_batches(id) on delete restrict,
  switched_at timestamptz,
  check (singleton)
);

insert into public.public_release_pointer (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  subject_type text not null,
  subject_id uuid not null,
  actor_id uuid not null,
  reason text not null,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_entity_revisions_entity
  on public.entity_revisions(entity_type, entity_id, revision_number desc);
create index if not exists idx_change_sets_status on public.change_sets(status, created_at);
create index if not exists idx_publication_batches_published
  on public.publication_batches(published_at desc) where status = 'published';
create index if not exists idx_audit_events_subject
  on public.audit_events(subject_type, subject_id, occurred_at);

create or replace function public.reject_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '23514';
end;
$$;

drop trigger if exists trg_entity_revisions_append_only on public.entity_revisions;
create trigger trg_entity_revisions_append_only
before update or delete on public.entity_revisions
for each row execute function public.reject_append_only_mutation();

drop trigger if exists trg_change_set_reviews_append_only on public.change_set_reviews;
create trigger trg_change_set_reviews_append_only
before update or delete on public.change_set_reviews
for each row execute function public.reject_append_only_mutation();

drop trigger if exists trg_audit_events_append_only on public.audit_events;
create trigger trg_audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.reject_append_only_mutation();

create or replace function public.protect_published_batch()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    raise exception 'Published publication batches are immutable' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_published_batches_immutable on public.publication_batches;
create trigger trg_published_batches_immutable
before update or delete on public.publication_batches
for each row execute function public.protect_published_batch();

create or replace function public.apply_change_set_review()
returns trigger
language plpgsql
as $$
declare
  current_status text;
begin
  select status into current_status
  from public.change_sets
  where id = new.change_set_id
  for update;

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
    review_reason = new.reason
  where id = new.change_set_id;

  return new;
end;
$$;

drop trigger if exists trg_apply_change_set_review on public.change_set_reviews;
create trigger trg_apply_change_set_review
before insert on public.change_set_reviews
for each row execute function public.apply_change_set_review();

create or replace function public.require_approved_batch_change_set()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.change_sets
    where id = new.change_set_id and status = 'approved'
  ) then
    raise exception 'Only approved change sets can enter a publication batch'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_approved_batch_change_set
  on public.publication_batch_change_sets;
create trigger trg_require_approved_batch_change_set
before insert or update on public.publication_batch_change_sets
for each row execute function public.require_approved_batch_change_set();

create or replace function public.require_draft_workflow_container()
returns trigger
language plpgsql
as $$
declare
  container_status text;
begin
  if tg_table_name = 'change_set_revisions' then
    select status into container_status
    from public.change_sets
    where id = coalesce(new.change_set_id, old.change_set_id)
    for share;
  else
    select status into container_status
    from public.publication_batches
    where id = coalesce(new.batch_id, old.batch_id)
    for share;
  end if;

  if container_status <> 'draft' then
    raise exception 'Reviewed or published workflow containers are immutable'
      using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_change_set_revisions_draft_only
  on public.change_set_revisions;
create trigger trg_change_set_revisions_draft_only
before insert or update or delete on public.change_set_revisions
for each row execute function public.require_draft_workflow_container();

drop trigger if exists trg_publication_batch_change_sets_draft_only
  on public.publication_batch_change_sets;
create trigger trg_publication_batch_change_sets_draft_only
before insert or update or delete on public.publication_batch_change_sets
for each row execute function public.require_draft_workflow_container();

create or replace function public.publish_publication_batch(
  requested_batch_id uuid,
  requested_actor_id uuid
)
returns public.publication_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  current_batch_id uuid;
  requested_batch_status text;
  published_batch public.publication_batches;
begin
  select active_batch_id into current_batch_id
  from public.public_release_pointer
  where singleton = true
  for update;

  select status into requested_batch_status
  from public.publication_batches
  where id = requested_batch_id and operation = 'release'
  for update;

  if requested_batch_status is distinct from 'draft' then
    raise exception 'Publication batch is missing or immutable' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.publication_batch_change_sets where batch_id = requested_batch_id
  ) or exists (
    select 1
    from public.publication_batch_change_sets pbcs
    join public.change_sets cs on cs.id = pbcs.change_set_id
    where pbcs.batch_id = requested_batch_id and cs.status <> 'approved'
  ) then
    raise exception 'Publication batch contains an unreviewed change set'
      using errcode = '23514';
  end if;

  -- A release batch is a complete immutable snapshot. Inherit the currently
  -- active snapshot before adding the newly approved change sets already linked
  -- to the requested batch. A withdrawal intentionally starts from no snapshot.
  insert into public.publication_batch_change_sets (batch_id, change_set_id)
  select requested_batch_id, existing.change_set_id
  from public.publication_batch_change_sets existing
  join public.publication_batches active on active.id = current_batch_id
  where existing.batch_id = current_batch_id
    and active.operation <> 'withdrawal'
  on conflict (batch_id, change_set_id) do nothing;

  update public.publication_batches
  set
    status = 'published',
    published_by = requested_actor_id,
    published_at = now(),
    previous_batch_id = current_batch_id
  where id = requested_batch_id
  returning * into published_batch;

  update public.public_release_pointer
  set active_batch_id = requested_batch_id, switched_at = published_batch.published_at
  where singleton = true;

  insert into public.audit_events (
    event_type, subject_type, subject_id, actor_id, reason, correlation_id,
    metadata
  ) values (
    'publication_batch.published', 'publication_batch', published_batch.id,
    requested_actor_id, published_batch.reason, published_batch.correlation_id,
    jsonb_build_object(
      'public_schema_version', published_batch.public_schema_version,
      'data_version', published_batch.data_version,
      'previous_batch_id', current_batch_id
    )
  );

  return published_batch;
end;
$$;

revoke all on function public.publish_publication_batch(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.publish_publication_batch(uuid, uuid) to service_role';
  end if;
end
$$;

alter table public.entity_revisions enable row level security;
alter table public.change_sets enable row level security;
alter table public.change_set_revisions enable row level security;
alter table public.change_set_reviews enable row level security;
alter table public.publication_batches enable row level security;
alter table public.publication_batch_change_sets enable row level security;
alter table public.public_release_pointer enable row level security;
alter table public.audit_events enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'entity_revisions',
    'change_sets',
    'change_set_revisions',
    'change_set_reviews',
    'publication_batches',
    'publication_batch_change_sets',
    'public_release_pointer',
    'audit_events'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_staff_access',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_staff_read',
      table_name
    );
    execute format(
      'create policy %I on public.%I for select using '
      || '(public.has_any_role(array[''admin'', ''editor'', ''reviewer'']::public.app_user_role[]))',
      table_name || '_staff_read',
      table_name
    );
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format(
        'drop policy if exists %I on public.%I',
        table_name || '_backend_write',
        table_name
      );
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        table_name || '_backend_write',
        table_name
      );
    end if;
  end loop;
end
$$;

commit;
