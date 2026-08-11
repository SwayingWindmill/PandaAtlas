-- Fan-owned panda library: named Collections over the existing saved-panda relation.
-- FastAPI remains the sole command authority; browser roles receive no grants.

begin;

create table if not exists engagement.collections (
  collection_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references identity.accounts(account_id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engagement_collections_name check (length(trim(name)) between 1 and 80)
);

create unique index if not exists idx_engagement_collections_account_name
  on engagement.collections (account_id, lower(trim(name)));

create table if not exists engagement.collection_pandas (
  collection_id uuid not null references engagement.collections(collection_id) on delete cascade,
  panda_id text not null,
  added_at timestamptz not null default now(),
  primary key (collection_id, panda_id),
  constraint engagement_collection_pandas_panda_id check (
    length(trim(panda_id)) between 1 and 255
  )
);

create index if not exists idx_engagement_collection_pandas_time
  on engagement.collection_pandas (collection_id, added_at, panda_id);

revoke all on engagement.collections from public;
revoke all on engagement.collection_pandas from public;

do $roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on engagement.collections from %I', role_name);
      execute format('revoke all on engagement.collection_pandas from %I', role_name);
    end if;
  end loop;
end
$roles$;

commit;
