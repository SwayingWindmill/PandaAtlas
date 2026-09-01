-- Publication is operated by authenticated accounts over HTTP, but managed
-- migration/recovery jobs also need truthful provenance without inventing a
-- Supabase Auth user. Exactly one actor shape is required on every operation.

begin;

alter table publication.releases
  alter column created_by_account_id drop not null,
  add column created_by_system_key text;

alter table publication.releases
  add constraint publication_releases_actor_shape_check
  check (
    (created_by_account_id is not null and created_by_system_key is null)
    or
    (
      created_by_account_id is null
      and created_by_system_key ~ '^[a-z][a-z0-9_.-]{2,63}$'
    )
  );

alter table publication.release_transitions
  alter column actor_account_id drop not null,
  add column actor_system_key text;

alter table publication.release_transitions
  add constraint publication_release_transitions_actor_shape_check
  check (
    (actor_account_id is not null and actor_system_key is null)
    or
    (
      actor_account_id is null
      and actor_system_key ~ '^[a-z][a-z0-9_.-]{2,63}$'
    )
  );

alter table publication.delivery_control_events
  alter column actor_account_id drop not null,
  add column actor_system_key text;

alter table publication.delivery_control_events
  add constraint publication_delivery_control_actor_shape_check
  check (
    (actor_account_id is not null and actor_system_key is null)
    or
    (
      actor_account_id is null
      and actor_system_key ~ '^[a-z][a-z0-9_.-]{2,63}$'
    )
  );

comment on column publication.releases.created_by_system_key is
  'Code-controlled system actor for managed publication jobs; mutually exclusive with created_by_account_id.';
comment on column publication.release_transitions.actor_system_key is
  'Code-controlled system actor for managed publication jobs; mutually exclusive with actor_account_id.';
comment on column publication.delivery_control_events.actor_system_key is
  'Code-controlled system actor for managed publication jobs; mutually exclusive with actor_account_id.';

commit;
