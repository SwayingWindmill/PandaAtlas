-- Admin Design requires editors to preserve unknown date precision rather than
-- inventing a day/month. Extend canonical residency/event precision accordingly.

begin;

alter table public.panda_residencies
  drop constraint if exists panda_residencies_start_precision_check,
  drop constraint if exists panda_residencies_end_precision_check;

alter table public.panda_residencies
  add constraint panda_residencies_start_precision_check
    check (start_precision in ('day', 'month', 'year', 'unknown')),
  add constraint panda_residencies_end_precision_check
    check (end_precision is null or end_precision in ('day', 'month', 'year', 'unknown'));

alter table public.domain_events
  drop constraint if exists domain_events_event_date_precision_check;

alter table public.domain_events
  add constraint domain_events_event_date_precision_check
    check (event_date_precision in ('day', 'month', 'year', 'unknown'));

commit;
