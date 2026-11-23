-- High-frequency query indexes for public_read lookups, engagement reads, and privacy history.
-- CONCURRENTLY cannot run inside the transaction supabase db push uses; tables are small so the
-- share lock is brief.

begin;

-- Fan collections list orders one account's collections by updated_at desc, collection_id.
create index if not exists idx_engagement_collections_account_updated
  on engagement.collections (account_id, updated_at desc, collection_id);

-- Popular-panda follow counts filter engagement.favorites by favorited_at >= since and group by panda_id.
create index if not exists idx_engagement_favorites_time_panda
  on engagement.favorites (favorited_at, panda_id, account_id);

-- Privacy request history lists one account's requests newest first.
create index if not exists idx_privacy_subject_requests_account_time
  on privacy.subject_requests (account_id, requested_at desc);

-- Public life-event feed lists a release's events ordered by occurred_on desc, event_id.
create index if not exists idx_public_read_life_events_release_order
  on public_read.life_events (release_id, occurred_on desc, event_id);

-- Legacy slug fallback lookups use array containment (`@>`) against GIN indexes.
create index if not exists idx_public_read_pandas_legacy_slugs
  on public_read.pandas using gin (legacy_slugs);

create index if not exists idx_public_read_places_legacy_slugs
  on public_read.places using gin (legacy_slugs);

-- Open residency scans for panda listings and guess-candidate generation filter end_on is null.
create index if not exists idx_public_read_residencies_current
  on public_read.residencies (release_id, panda_id, residency_id)
  where end_on is null;

-- Institution detail loads all residencies for an institution's places ordered by panda_id, start_on, residency_id.
create index if not exists idx_public_read_residencies_place
  on public_read.residencies (release_id, place_id, panda_id, start_on, residency_id);

commit;
