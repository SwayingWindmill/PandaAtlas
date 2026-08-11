-- Align authoritative domain event storage with the event types already exposed by
-- the current API/public projection. Calendar and Moments remain views over this table.

begin;

alter table public.domain_events
  drop constraint if exists domain_events_event_type_check;

alter table public.domain_events
  add constraint domain_events_event_type_check
  check (
    event_type in (
      'birth',
      'arrival',
      'transfer',
      'return',
      'naming',
      'public_debut',
      'selection',
      'announcement',
      'observation',
      'death'
    )
  );

comment on constraint domain_events_event_type_check on public.domain_events is
  'Canonical Panda domain event types shared by authoritative storage and the public API.';

commit;
