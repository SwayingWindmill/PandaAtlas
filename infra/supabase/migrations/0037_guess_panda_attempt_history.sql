-- Private, optional Guess Panda result history.
-- Anonymous play remains persistence-free; rows exist only when a signed-in fan saves a result.

begin;

create table if not exists engagement.game_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  game_type text not null default 'guess_panda' check (game_type = 'guess_panda'),
  target_panda_id text not null,
  selected_panda_id text not null,
  correct boolean not null,
  public_release_version text,
  attempted_at timestamptz not null default now(),
  constraint engagement_game_attempts_target_panda_id check (
    length(trim(target_panda_id)) between 1 and 255
  ),
  constraint engagement_game_attempts_selected_panda_id check (
    length(trim(selected_panda_id)) between 1 and 255
  ),
  constraint engagement_game_attempts_release_version check (
    public_release_version is null or length(trim(public_release_version)) between 1 and 120
  )
);

create index if not exists idx_engagement_game_attempts_account_time
  on engagement.game_attempts (account_id, attempted_at desc, attempt_id desc);

revoke all on engagement.game_attempts from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on engagement.game_attempts from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
