-- Merge duplicate places. One real place sometimes entered the database twice, under two slugs
-- (the Wolong Gengda and Shenshuping bases, the Ya'an and Bifengxia bases, the Chengdu base and
-- three free-text copies of it). A merge moves every reference to the surviving place, keeps the
-- retired slug in legacy_slugs so old links still resolve, then removes the duplicate row.
-- Expand only: a new column with a default the running API does not select, and a function.

begin;

alter table place.places
  add column if not exists legacy_slugs text[] not null default '{}';

comment on column place.places.legacy_slugs is
  'Slugs of duplicate places merged into this one; old links resolve here.';

alter table public_read.places
  add column if not exists legacy_slugs text[] not null default '{}';

-- Moves residencies, life events, check-ins and seen-panda places from the retired place to the
-- surviving one, records the retired slug, and deletes the retired row. Running it again after the
-- retired place is gone only re-records the slug, so content migrations can repeat it; a surviving
-- place that does not exist is skipped, like the content migrations' other updates.
create or replace function place.merge_place(retired_slug text, into_slug text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  retired uuid;
  survivor uuid;
  carried text[];
begin
  if retired_slug = into_slug then
    raise exception 'place.merge_place: % cannot merge into itself', retired_slug;
  end if;
  select place_id into survivor from place.places where slug = into_slug;
  -- Content migrations also run on fresh databases that never had the place: nothing to merge.
  if survivor is null then
    raise notice 'place.merge_place: surviving place % does not exist; skipped', into_slug;
    return;
  end if;
  if exists (select 1 from place.places where place_id <> survivor and retired_slug = any(legacy_slugs)) then
    raise exception 'place.merge_place: % was already merged into another place', retired_slug;
  end if;

  update place.places
  set legacy_slugs = legacy_slugs || retired_slug, updated_at = now()
  where place_id = survivor and not (retired_slug = any(legacy_slugs));

  select place_id into retired from place.places where slug = retired_slug;
  if retired is null then
    return;
  end if;

  update life_history.residencies set place_id = survivor, updated_at = now() where place_id = retired;

  -- A move between the two copies becomes a move with no known origin, never a move to itself.
  update life_history.events set from_place_id = null, updated_at = now()
  where (from_place_id = retired and to_place_id = survivor) or (from_place_id = survivor and to_place_id = retired);
  update life_history.events set from_place_id = survivor, updated_at = now() where from_place_id = retired;
  update life_history.events set to_place_id = survivor, updated_at = now() where to_place_id = retired;

  -- Check-ins and seen pandas store the place id as text; a slug is accepted too.
  delete from engagement.location_checkins old
  where old.place_id in (retired::text, retired_slug)
    and exists (
      select 1 from engagement.location_checkins kept
      where kept.account_id = old.account_id
        and kept.visited_on = old.visited_on
        and kept.place_id = survivor::text
    );
  delete from engagement.location_checkins old
  where old.place_id = retired_slug
    and exists (
      select 1 from engagement.location_checkins other
      where other.account_id = old.account_id
        and other.visited_on = old.visited_on
        and other.place_id = retired::text
    );
  update engagement.location_checkins set place_id = survivor::text where place_id in (retired::text, retired_slug);
  update engagement.seen_pandas set place_id = survivor::text, updated_at = now()
  where place_id in (retired::text, retired_slug);

  -- Slugs merged into the retired place earlier now resolve to the survivor too.
  select legacy_slugs into carried from place.places where place_id = retired;
  update place.places
  set legacy_slugs = legacy_slugs || array(
        select carried_slug from unnest(carried) as carried_slug
        where not (carried_slug = any(legacy_slugs))
      ),
      updated_at = now()
  where place_id = survivor and cardinality(carried) > 0;

  delete from place.places where place_id = retired;
end;
$$;

comment on function place.merge_place(text, text) is
  'Merges a duplicate place into the surviving one, moving every reference and keeping the old slug.';

revoke all on function place.merge_place(text, text) from public;

commit;
