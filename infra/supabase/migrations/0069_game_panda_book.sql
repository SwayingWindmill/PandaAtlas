-- Panda book (熊猫图鉴): the pandas a signed-in fan has met through the games. Only results the
-- fan chose to save add a panda: a saved Guess Panda attempt, or a finished Daily Panda the fan
-- saved. It holds personal progress only; nothing here is ranked against other fans.

begin;

create table game.encounters (
  account_id uuid not null references identity.accounts(account_id) on delete cascade,
  panda_id uuid not null references panda.pandas(panda_id) on delete restrict,
  first_game text not null check (first_game in ('guess_panda', 'daily_panda')),
  first_met_at timestamptz not null default now(),
  last_met_at timestamptz not null default now(),
  times_met integer not null default 1 check (times_met > 0),
  primary key (account_id, panda_id)
);

create index idx_game_encounters_account_time on game.encounters(account_id, first_met_at desc, panda_id);

-- One saved Daily Panda result per fan and day, so saving the same day twice adds nothing.
create table game.daily_panda_results (
  account_id uuid not null references identity.accounts(account_id) on delete cascade,
  puzzle_date date not null,
  panda_id uuid not null references panda.pandas(panda_id) on delete restrict,
  solved boolean not null,
  guess_count integer not null check (guess_count between 1 and 6),
  saved_at timestamptz not null default now(),
  primary key (account_id, puzzle_date)
);

-- Guess Panda attempts saved before the panda book existed already met their question's panda.
insert into game.encounters (account_id, panda_id, first_game, first_met_at, last_met_at, times_met)
select attempts.account_id, questions.target_panda_id, 'guess_panda',
  min(attempts.attempted_at), max(attempts.attempted_at), count(*)::integer
from game.attempts attempts
join game.questions questions on questions.question_id = attempts.question_id
group by attempts.account_id, questions.target_panda_id
on conflict (account_id, panda_id) do nothing;

revoke all on game.encounters, game.daily_panda_results from public, anon, authenticated;
grant select, insert, update, delete on game.encounters, game.daily_panda_results to zhipanda_app;

commit;
