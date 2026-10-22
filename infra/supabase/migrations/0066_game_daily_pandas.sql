-- Daily Panda: one published panda per calendar day (Asia/Shanghai), the same for every player.
-- The API picks the day's panda on the first request of that day and keeps it here, so the answer
-- stays fixed when a later release changes which pandas are eligible.

begin;

create table game.daily_pandas (
  puzzle_date date primary key,
  panda_id uuid not null references panda.pandas(panda_id) on delete restrict,
  chosen_at timestamptz not null default now()
);

create index idx_game_daily_pandas_panda on game.daily_pandas(panda_id, puzzle_date desc);

revoke all on game.daily_pandas from public, anon, authenticated;
grant select, insert on game.daily_pandas to zhipanda_app;

commit;
