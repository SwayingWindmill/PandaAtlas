-- Irreversible contributor provenance anonymization and non-contactable Identity tombstones.

begin;

alter table public.change_sets
  add column if not exists origin_actor_subject_hash text,
  add column if not exists origin_actor_anonymized_at timestamptz,
  add column if not exists origin_actor_anonymization_request_id uuid
    references privacy.requests(request_id) on delete restrict;

alter table public.change_sets
  alter column origin_actor_id drop not null;

alter table public.change_sets
  drop constraint if exists change_sets_origin_actor_privacy_shape;
alter table public.change_sets
  add constraint change_sets_origin_actor_privacy_shape check (
    (
      origin_context = 'archive'
      and origin_actor_id is not null
      and origin_actor_subject_hash is null
      and origin_actor_anonymized_at is null
      and origin_actor_anonymization_request_id is null
    )
    or (
      origin_context = 'community_intake'
      and (
        (
          origin_actor_id is not null
          and origin_actor_subject_hash is null
          and origin_actor_anonymized_at is null
          and origin_actor_anonymization_request_id is null
        )
        or (
          origin_actor_id is null
          and origin_actor_subject_hash ~ '^[a-f0-9]{64}$'
          and origin_actor_anonymized_at is not null
          and origin_actor_anonymization_request_id is not null
        )
      )
    )
  );

create or replace function public.protect_published_change_set()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'Published change sets are immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.origin_actor_anonymized_at is not null and (
    new.origin_actor_id is distinct from old.origin_actor_id
    or new.origin_actor_subject_hash is distinct from old.origin_actor_subject_hash
    or new.origin_actor_anonymized_at is distinct from old.origin_actor_anonymized_at
    or new.origin_actor_anonymization_request_id
      is distinct from old.origin_actor_anonymization_request_id
  ) then
    raise exception 'Archive provenance anonymization is irreversible' using errcode = '55000';
  end if;

  if old.status = 'published' then
    if old.origin_context = 'community_intake'
      and old.origin_actor_id is not null
      and new.origin_actor_id is null
      and new.origin_actor_subject_hash ~ '^[a-f0-9]{64}$'
      and new.origin_actor_anonymized_at is not null
      and new.origin_actor_anonymization_request_id is not null
      and (
        to_jsonb(new) - array[
          'origin_actor_id',
          'origin_actor_subject_hash',
          'origin_actor_anonymized_at',
          'origin_actor_anonymization_request_id'
        ]
      ) = (
        to_jsonb(old) - array[
          'origin_actor_id',
          'origin_actor_subject_hash',
          'origin_actor_anonymized_at',
          'origin_actor_anonymization_request_id'
        ]
      ) then
      return new;
    end if;
    raise exception 'Published change sets are immutable' using errcode = '55000';
  end if;

  if old.origin_actor_id is null and new.origin_actor_id is not null then
    raise exception 'Archive provenance anonymization cannot be reversed' using errcode = '55000';
  end if;
  return new;
end;
$$;

alter table public.entity_revisions
  add column if not exists privacy_redacted_at timestamptz,
  add column if not exists privacy_redaction_request_id uuid
    references privacy.requests(request_id) on delete restrict;

alter table public.entity_revisions
  drop constraint if exists entity_revisions_privacy_redaction_shape;
alter table public.entity_revisions
  add constraint entity_revisions_privacy_redaction_shape check (
    (privacy_redacted_at is null and privacy_redaction_request_id is null)
    or (privacy_redacted_at is not null and privacy_redaction_request_id is not null)
  );

create or replace function public.protect_entity_revision_privacy_redaction()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'entity_revisions is append-only' using errcode = '55000';
  end if;
  if old.privacy_redacted_at is not null then
    raise exception 'Entity revision privacy redaction is irreversible' using errcode = '55000';
  end if;
  if new.id = old.id
    and new.entity_type = old.entity_type
    and new.entity_id = old.entity_id
    and new.revision_number = old.revision_number
    and new.created_by = old.created_by
    and new.substantive_modified_by = old.substantive_modified_by
    and new.created_at = old.created_at
    and new.privacy_redacted_at is not null
    and new.privacy_redaction_request_id is not null
    and old.payload #>> '{community_provenance,contributor_account_id}' is not null
    and new.payload #>> '{community_provenance,contributor_account_id}' is null
    and new.payload #>> '{community_provenance,contributor_subject_hash}'
      ~ '^[a-f0-9]{64}$'
    and (
      new.payload
        #- '{community_provenance,contributor_account_id}'
        #- '{community_provenance,contributor_subject_hash}'
    ) = (
      old.payload
        #- '{community_provenance,contributor_account_id}'
        #- '{community_provenance,contributor_subject_hash}'
    ) then
    return new;
  end if;
  raise exception 'entity_revisions is append-only' using errcode = '55000';
end;
$$;

drop trigger if exists trg_entity_revisions_append_only on public.entity_revisions;
create trigger trg_entity_revisions_append_only
before update or delete on public.entity_revisions
for each row execute function public.protect_entity_revision_privacy_redaction();

alter table community_intake.submissions
  add column if not exists contributor_subject_anonymized_at timestamptz,
  add column if not exists contributor_subject_anonymization_request_id uuid
    references privacy.requests(request_id) on delete restrict;

alter table community_intake.submissions
  drop constraint if exists submissions_contributor_subject_privacy_shape;
alter table community_intake.submissions
  add constraint submissions_contributor_subject_privacy_shape check (
    (
      contributor_subject_anonymized_at is null
      and contributor_subject_anonymization_request_id is null
    )
    or (
      account_id is null
      and anonymized_at is not null
      and contributor_subject_anonymized_at is not null
      and contributor_subject_anonymization_request_id is not null
    )
  );

create or replace function community_intake.protect_submission_subject_anonymization()
returns trigger
language plpgsql
as $$
begin
  if old.contributor_subject_anonymized_at is not null and (
    new.contributor_subject_hash is distinct from old.contributor_subject_hash
    or new.contributor_subject_anonymized_at
      is distinct from old.contributor_subject_anonymized_at
    or new.contributor_subject_anonymization_request_id
      is distinct from old.contributor_subject_anonymization_request_id
  ) then
    raise exception 'Submission contributor anonymization is irreversible'
      using errcode = '55000';
  end if;
  if new.contributor_subject_hash is distinct from old.contributor_subject_hash and not (
    old.account_id is null
    and new.account_id is null
    and old.anonymized_at is not null
    and old.contributor_subject_anonymized_at is null
    and new.contributor_subject_hash ~ '^[a-f0-9]{64}$'
    and new.contributor_subject_anonymized_at is not null
    and new.contributor_subject_anonymization_request_id is not null
  ) then
    raise exception 'Submission contributor identity cannot be reassigned'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger trg_submission_subject_anonymization
before update on community_intake.submissions
for each row execute function community_intake.protect_submission_subject_anonymization();

alter table community_curation.assertion_bridges
  add column if not exists contributor_anonymized_at timestamptz,
  add column if not exists contributor_anonymization_request_id uuid
    references privacy.requests(request_id) on delete restrict;

alter table community_curation.assertion_bridges
  drop constraint if exists assertion_bridges_contributor_privacy_shape;
alter table community_curation.assertion_bridges
  add constraint assertion_bridges_contributor_privacy_shape check (
    (
      contributor_account_id is not null
      and contributor_anonymized_at is null
      and contributor_anonymization_request_id is null
    )
    or (
      contributor_account_id is null
      and contributor_subject_hash ~ '^[a-f0-9]{64}$'
      and contributor_anonymized_at is not null
      and contributor_anonymization_request_id is not null
    )
  );

create or replace function community_curation.touch_assertion_bridge()
returns trigger
language plpgsql
as $$
begin
  if new.review_case_id <> old.review_case_id
    or new.submission_id <> old.submission_id
    or new.revision_number <> old.revision_number
    or new.decision_id <> old.decision_id
    or new.change_set_id <> old.change_set_id then
    raise exception 'assertion bridge identity is immutable' using errcode = '55000';
  end if;
  if old.contributor_anonymized_at is not null and (
    new.contributor_account_id is distinct from old.contributor_account_id
    or new.contributor_subject_hash is distinct from old.contributor_subject_hash
    or new.contributor_anonymized_at is distinct from old.contributor_anonymized_at
    or new.contributor_anonymization_request_id
      is distinct from old.contributor_anonymization_request_id
  ) then
    raise exception 'Contributor anonymization is irreversible' using errcode = '55000';
  end if;
  if new.contributor_account_id is distinct from old.contributor_account_id
    or new.contributor_subject_hash is distinct from old.contributor_subject_hash then
    if not (
      old.contributor_account_id is not null
      and new.contributor_account_id is null
      and new.contributor_subject_hash ~ '^[a-f0-9]{64}$'
      and new.contributor_subject_hash <> old.contributor_subject_hash
      and new.contributor_anonymized_at is not null
      and new.contributor_anonymization_request_id is not null
    ) then
      raise exception 'assertion bridge identity is immutable' using errcode = '55000';
    end if;
  end if;
  if new.status <> old.status and not (
    (old.status = 'created' and new.status in ('release_seen', 'projection_failed'))
    or (old.status = 'release_seen' and new.status in ('projected', 'projection_failed'))
    or (old.status = 'projection_failed' and new.status = 'projected')
  ) then
    raise exception 'invalid assertion bridge status transition' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists identity.account_tombstones (
  account_id uuid primary key references identity.accounts(account_id) on delete restrict,
  privacy_request_id uuid not null unique references privacy.requests(request_id) on delete restrict,
  tombstone_id uuid not null unique,
  tombstone_email text not null unique,
  contributor_subject_hash text not null unique,
  role_snapshot jsonb not null,
  staff_role_snapshot jsonb not null,
  command_hash text not null,
  created_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  created_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint identity_account_tombstone_email check (
    length(tombstone_email) = 56
    and tombstone_email like 'deleted-%@deleted.invalid'
    and substring(tombstone_email from 9 for 32) similar to '[a-f0-9]{32}'
  ),
  constraint identity_account_tombstone_hashes check (
    contributor_subject_hash ~ '^[a-f0-9]{64}$'
    and command_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint identity_account_tombstone_roles check (
    jsonb_typeof(role_snapshot) = 'array'
    and jsonb_typeof(staff_role_snapshot) = 'array'
  )
);

create trigger trg_identity_account_tombstones_append_only
before update or delete on identity.account_tombstones
for each row execute function identity.reject_append_only_mutation();

create table if not exists privacy.archive_anonymization_events (
  event_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references privacy.requests(request_id) on delete restrict,
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  actor_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  contributor_subject_hash text not null,
  counts jsonb not null,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  idempotency_key text not null unique,
  constraint privacy_archive_anonymization_subject_hash check (
    contributor_subject_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint privacy_archive_anonymization_counts check (jsonb_typeof(counts) = 'object')
);

create trigger trg_archive_anonymization_events_append_only
before update or delete on privacy.archive_anonymization_events
for each row execute function privacy.reject_append_only_mutation();

revoke all on identity.account_tombstones from public;
revoke all on privacy.archive_anonymization_events from public;
revoke all on function public.protect_published_change_set() from public;
revoke all on function public.protect_entity_revision_privacy_redaction() from public;
revoke all on function community_intake.protect_submission_subject_anonymization() from public;
revoke all on function community_curation.touch_assertion_bridge() from public;

do $roles$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on identity.account_tombstones from %I', role_name);
      execute format('revoke all on privacy.archive_anonymization_events from %I', role_name);
    end if;
  end loop;
end
$roles$;

comment on table identity.account_tombstones is
  'Non-contactable account identity retained only to preserve historical foreign keys and role snapshots.';
comment on table privacy.archive_anonymization_events is
  'Append-only evidence that community contributor provenance was irreversibly anonymized.';

commit;
