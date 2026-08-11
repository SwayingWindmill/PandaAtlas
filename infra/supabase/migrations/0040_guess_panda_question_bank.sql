-- Curated Guess Panda question bank.
-- Questions reference canonical Panda identities and current public media by stable IDs;
-- Panda names, slugs, and image URLs are resolved from the active Public Release at read time.

begin;

create schema if not exists game;
revoke all on schema game from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema game from %I', role_name);
    end if;
  end loop;
end
$roles$;

create table if not exists game.guess_questions (
  question_id uuid primary key default gen_random_uuid(),
  panda_id uuid not null,
  media_id text not null check (length(trim(media_id)) between 1 and 200),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  option_panda_ids uuid[] not null,
  recognition_tips jsonb not null default '[]'::jsonb check (jsonb_typeof(recognition_tips) = 'array'),
  state text not null default 'draft' check (state in ('draft', 'published', 'disabled')),
  attempt_count bigint not null default 0 check (attempt_count >= 0),
  correct_count bigint not null default 0 check (correct_count >= 0 and correct_count <= attempt_count),
  created_by uuid references identity.accounts(account_id) on delete restrict,
  updated_by uuid references identity.accounts(account_id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(option_panda_ids, 1) = 4),
  check (panda_id = any(option_panda_ids)),
  check ((state = 'published' and published_at is not null) or state <> 'published'),
  unique (panda_id, media_id)
);

create index if not exists idx_game_guess_questions_state_difficulty
  on game.guess_questions (state, difficulty, updated_at desc);

revoke all on game.guess_questions from public;

do $table_roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on game.guess_questions from %I', role_name);
    end if;
  end loop;
end
$table_roles$;

insert into identity.capabilities (capability_key, description, sensitive) values
  ('game.question.read', 'Read the curated Guess Panda question bank.', false),
  ('game.question.edit', 'Create and edit draft Guess Panda questions.', false),
  ('game.question.publish', 'Publish or disable Guess Panda questions.', false)
on conflict (capability_key) do nothing;

insert into identity.role_capabilities (role_key, capability_key) values
  ('archive_editor', 'game.question.read'),
  ('archive_editor', 'game.question.edit'),
  ('archive_editor', 'game.question.publish'),
  ('senior_archive_editor', 'game.question.read'),
  ('senior_archive_editor', 'game.question.edit'),
  ('senior_archive_editor', 'game.question.publish'),
  ('administrator', 'game.question.read'),
  ('administrator', 'game.question.edit'),
  ('administrator', 'game.question.publish')
on conflict do nothing;

-- Baseline curated question. Stable IDs reference the approved 2026.07.31.1 Public Release;
-- names, slugs, and image URLs remain resolved from the active release at request time.
insert into game.guess_questions (
  question_id, panda_id, media_id, difficulty, option_panda_ids,
  recognition_tips, state, published_at
) values (
  '55ad14ea-cc08-4aa2-bba2-4e77823f74db',
  '01878819-1eda-5d9c-96ab-bab66d3b0b09',
  'media-shin-shin-6b36624de9829665',
  'medium',
  array[
    '01878819-1eda-5d9c-96ab-bab66d3b0b09'::uuid,
    '0f7f494a-ec00-5e43-92e0-d299fe858d95'::uuid,
    '275ad0df-c700-5991-a13a-0ca47c56eeba'::uuid,
    '2a589b9f-1700-5b1e-8c2f-8203190da905'::uuid
  ],
  '["观察脸型、耳朵轮廓与眼圈形状。"]'::jsonb,
  'published',
  '2026-08-11T00:00:00Z'
)
on conflict (panda_id, media_id) do nothing;

commit;
