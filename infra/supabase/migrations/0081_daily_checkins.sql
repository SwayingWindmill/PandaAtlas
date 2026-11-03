-- Daily check-in (每日打卡): one row per account per local calendar day.
-- kind = 'visit' when the member opened 每日一猫 that day, 'leave' when the
-- member took one of the monthly leave days (请假). retroactive marks a leave
-- requested after the day had already passed (补请). Quotas live in the API
-- (DAILY_CHECKIN_RULES) so they can change without a migration.

begin;

create table if not exists engagement.daily_checkins (
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  checkin_on date not null,
  kind text not null,
  retroactive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engagement_daily_checkins_pkey primary key (account_id, checkin_on),
  constraint engagement_daily_checkins_kind check (kind in ('visit', 'leave')),
  constraint engagement_daily_checkins_retroactive_leave check (not retroactive or kind = 'leave')
);

revoke all on engagement.daily_checkins from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on engagement.daily_checkins from %I', role_name);
    end if;
  end loop;
end
$roles$;

grant select, insert, update, delete on engagement.daily_checkins to zhipanda_app;

commit;
