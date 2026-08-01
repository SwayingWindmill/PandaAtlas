begin;

-- Preserve compatibility for trusted Archive callers created before
-- origin_actor_id became mandatory. Newer callers may provide a distinct
-- origin actor explicitly; legacy callers inherit the authoritative creator.
create or replace function public.fill_change_set_origin_actor()
returns trigger
language plpgsql
as $$
begin
  if new.origin_actor_id is null then
    new.origin_actor_id := new.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_change_sets_origin_actor_compatibility
  on public.change_sets;
create trigger trg_change_sets_origin_actor_compatibility
before insert on public.change_sets
for each row execute function public.fill_change_set_origin_actor();

commit;
