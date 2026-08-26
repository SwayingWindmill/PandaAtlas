-- NestJS V2 fan profile, engagement, and game state.
-- Authentication remains Supabase Auth; these tables own PandaAtlas product state only.

begin;

-- Identity product profile -----------------------------------------------------

create table if not exists identity.profiles (
  account_id uuid primary key references identity.accounts(account_id) on delete cascade,
  nickname text not null default '' check (length(nickname) <= 40),
  bio text not null default '' check (length(bio) <= 280),
  updated_at timestamptz not null default now()
);

-- Engagement ------------------------------------------------------------------
-- Favorite is the only saved-Panda relationship in V2. The legacy follows table
-- remains transitional V1 state and is intentionally not used by NestJS.

create table if not exists engagement.favorites (
  account_id uuid not null references identity.accounts(account_id) on delete cascade,
  panda_id uuid not null references panda.pandas(panda_id) on delete restrict,
  favorited_at timestamptz not null default now(),
  primary key (account_id, panda_id)
);

create index if not exists idx_engagement_favorites_account_time
  on engagement.favorites(account_id, favorited_at desc, panda_id);

-- Game ------------------------------------------------------------------------
-- V2 owns a release-independent curated question bank. Public names/slugs/media
-- are resolved through Publication/PublicRead later; Game stores stable IDs only.

create table if not exists game.questions (
  question_id uuid primary key default gen_random_uuid(),
  target_panda_id uuid not null references panda.pandas(panda_id) on delete restrict,
  media_asset_id uuid not null references media.assets(asset_id) on delete restrict,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  option_panda_ids uuid[] not null,
  recognition_tips jsonb not null default '[]'::jsonb check (jsonb_typeof(recognition_tips) = 'array'),
  state text not null default 'draft' check (state in ('draft', 'published', 'disabled')),
  created_by uuid references identity.accounts(account_id) on delete restrict,
  updated_by uuid references identity.accounts(account_id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_panda_id, media_asset_id),
  check (cardinality(option_panda_ids) = 4),
  check (target_panda_id = any(option_panda_ids)),
  check ((state = 'published' and published_at is not null) or state <> 'published')
);

create index if not exists idx_game_questions_public
  on game.questions(state, difficulty, updated_at desc, question_id);

create table if not exists game.attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete cascade,
  question_id uuid not null references game.questions(question_id) on delete restrict,
  selected_panda_id uuid not null references panda.pandas(panda_id) on delete restrict,
  correct boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_game_attempts_account_time
  on game.attempts(account_id, attempted_at desc, attempt_id desc);

-- Product capabilities --------------------------------------------------------

insert into identity.capabilities (capability_key, description, sensitive) values
  ('account.profile.read', 'Read the signed-in fan PandaAtlas product profile.', false),
  ('account.profile.manage', 'Update the signed-in fan PandaAtlas product profile.', false),
  ('engagement.read', 'Read the signed-in fan favorites, collections, check-ins, and seen pandas.', false),
  ('engagement.manage', 'Manage the signed-in fan favorites, collections, check-ins, and seen pandas.', false),
  ('game.attempt.read', 'Read the signed-in fan saved game attempts.', false),
  ('game.attempt.manage', 'Save or remove the signed-in fan game attempts.', false)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key)
select 'member', capability_key
from (values
  ('account.profile.read'),
  ('account.profile.manage'),
  ('engagement.read'),
  ('engagement.manage'),
  ('game.attempt.read'),
  ('game.attempt.manage')
) as capability(capability_key)
on conflict (role_key, capability_key) do nothing;

-- Database authority ----------------------------------------------------------

revoke all on identity.profiles from public, anon, authenticated;
revoke all on engagement.favorites from public, anon, authenticated;
revoke all on game.questions, game.attempts from public, anon, authenticated;

grant select, insert, update, delete on identity.profiles to zhipanda_app;
grant usage on schema engagement to zhipanda_app;
grant select, insert, update, delete on engagement.favorites to zhipanda_app;
grant select, insert, update, delete on engagement.collections to zhipanda_app;
grant select, insert, update, delete on engagement.collection_pandas to zhipanda_app;
grant select, insert, update, delete on engagement.location_checkins to zhipanda_app;
grant select, insert, update, delete on engagement.seen_pandas to zhipanda_app;
grant usage on schema game to zhipanda_app;
grant select, insert, update, delete on game.questions, game.attempts to zhipanda_app;

commit;
