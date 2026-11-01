-- 问问熊猫: questions answered only from published learning and sourced panda facts.
-- The question text is never stored. These tables hold a per-account daily count, the app-wide
-- daily total, and the map from AI Search items to the sources they quote.

begin;

create schema if not exists ask;

-- One row per signed-in account per Beijing day: how many questions it asked. No question text.
create table ask.account_daily_usage (
  account_id uuid not null references identity.accounts(account_id) on delete cascade,
  usage_on date not null,
  question_count integer not null default 0,
  primary key (account_id, usage_on),
  constraint ask_account_daily_usage_count_range check (question_count between 0 and 1000)
);

-- One row per Beijing day: questions answered app-wide, checked against ASK_GLOBAL_DAILY_CAP.
create table ask.daily_usage (
  usage_on date primary key,
  question_count integer not null default 0,
  constraint ask_daily_usage_count_range check (question_count >= 0)
);

-- One row per passage uploaded to the AI Search instance zhipanda-knowledge. The key is the
-- AI Search item key; answers cite passages, and this table, not the model, supplies the
-- title, app path and source links shown under an answer.
create table ask.index_items (
  item_key text primary key,
  kind text not null,
  title_zh text not null,
  title_en text,
  app_path text not null,
  sources jsonb not null default '[]'::jsonb,
  content_sha256 text not null,
  -- The AI Search item id from the last upload; deleting an item needs it.
  item_id text,
  uploaded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ask_index_items_key_length check (char_length(item_key) between 1 and 128),
  constraint ask_index_items_kind check (kind in ('article', 'card', 'topic', 'term', 'faceGuide', 'challenge', 'panda')),
  constraint ask_index_items_sources_array check (jsonb_typeof(sources) = 'array'),
  constraint ask_index_items_sha check (content_sha256 ~ '^[0-9a-f]{64}$')
);

-- A hash of every passage key and content hash the last completed sync uploaded.
create table ask.index_state (
  state_id smallint primary key default 1,
  fingerprint text not null,
  synced_at timestamptz not null default now(),
  constraint ask_index_state_singleton check (state_id = 1)
);

comment on schema ask is '问问熊猫 quotas and AI Search index bookkeeping. Never holds question or answer text.';

revoke all on schema ask from public, anon, authenticated;
revoke all on all tables in schema ask from public, anon, authenticated;
grant usage on schema ask to zhipanda_app;
grant select, insert, update, delete on ask.account_daily_usage to zhipanda_app;
grant select, insert, update on ask.daily_usage to zhipanda_app;
grant select, insert, update, delete on ask.index_items to zhipanda_app;
grant select, insert, update on ask.index_state to zhipanda_app;

commit;
