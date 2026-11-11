-- 关注场馆: a signed-in fan follows a venue (an institution), as they follow a panda in
-- engagement.favorites. The map's place sheet sets it; the privacy export and account
-- deletion include it.

begin;

create table if not exists engagement.venue_follows (
  account_id uuid not null references identity.accounts(account_id) on delete cascade,
  institution_id uuid not null references place.institutions(institution_id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (account_id, institution_id)
);

create index if not exists idx_engagement_venue_follows_account_time
  on engagement.venue_follows(account_id, followed_at desc, institution_id);

revoke all on engagement.venue_follows from public, anon, authenticated;
grant select, insert, delete on engagement.venue_follows to zhipanda_app;

commit;
