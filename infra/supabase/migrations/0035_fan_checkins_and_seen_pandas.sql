-- Private fan memory: place check-ins and pandas personally seen.
-- These concepts are intentionally separate: a place visit does not imply seeing a panda.

begin;

create table if not exists engagement.location_checkins (
  checkin_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  place_id text not null,
  visited_on date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint engagement_location_checkins_place_id check (length(trim(place_id)) between 1 and 255),
  constraint engagement_location_checkins_note check (note is null or length(note) <= 280),
  constraint engagement_location_checkins_account_place_day unique (account_id, place_id, visited_on)
);

create table if not exists engagement.seen_pandas (
  seen_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  panda_id text not null,
  place_id text,
  seen_on date,
  note text,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engagement_seen_pandas_account_panda unique (account_id, panda_id),
  constraint engagement_seen_pandas_panda_id check (length(trim(panda_id)) between 1 and 255),
  constraint engagement_seen_pandas_place_id check (
    place_id is null or length(trim(place_id)) between 1 and 255
  ),
  constraint engagement_seen_pandas_note check (note is null or length(note) <= 280)
);

create index if not exists idx_engagement_location_checkins_account_date
  on engagement.location_checkins (account_id, visited_on desc, created_at desc);
create index if not exists idx_engagement_seen_pandas_account_date
  on engagement.seen_pandas (account_id, seen_on desc nulls last, first_seen_at desc);

revoke all on engagement.location_checkins from public;
revoke all on engagement.seen_pandas from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on engagement.location_checkins from %I', role_name);
      execute format('revoke all on engagement.seen_pandas from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
