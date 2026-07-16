-- Keep each D1 trigger in its own migration so Cloudflare's remote parser
-- receives one complete trigger statement per migration.

create trigger if not exists prevent_primary_residency_overlap_update
before update on panda_residencies
when new.residency_type = 'primary' and exists (
  select 1 from panda_residencies existing
  where existing.id <> new.id
    and existing.panda_id = new.panda_id
    and existing.residency_type = 'primary'
    and new.start_date < coalesce(existing.end_date, '9999-12-31')
    and existing.start_date < coalesce(new.end_date, '9999-12-31')
)
begin
  select raise(abort, 'primary residency intervals overlap');
end;
