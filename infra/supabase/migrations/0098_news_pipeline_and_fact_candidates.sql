-- Option B live Chinese panda/venue news ingest and human-reviewed fact-change candidate queue.
begin;

create schema if not exists news;
comment on schema news is 'Live Chinese panda and venue news items plus human-reviewed fact-change candidates.';

create table if not exists news.items (
  news_item_id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  platform text not null,
  source_tier text not null,
  source_url text not null,
  source_publisher text not null,
  title_zh text not null,
  summary_zh text not null,
  kind text not null,
  cover_url text,
  panda_ids text[] not null default '{}'::text[],
  panda_slugs text[] not null default '{}'::text[],
  raw_panda_names text[] not null default '{}'::text[],
  institution_id text,
  institution_slug text,
  institution_name text,
  published_at timestamp with time zone not null,
  status text not null default 'pending_review',
  review_note text,
  reviewed_by_account_id uuid references identity.accounts(account_id) on delete set null,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint news_items_platform_check check (
    platform in ('weibo', 'douyin', 'xiaohongshu', 'douban', 'bilibili', 'web', 'x', 'wechat')
  ),
  constraint news_items_source_tier_check check (
    source_tier in ('institution', 'official', 'media', 'fan')
  ),
  constraint news_items_source_url_check check (source_url ~ '^https://'),
  constraint news_items_kind_check check (
    kind in (
      'enclosure', 'schedule', 'closure', 'arrival', 'departure',
      'event', 'birth', 'death', 'transfer', 'naming', 'other'
    )
  ),
  constraint news_items_cover_url_check check (
    cover_url is null or (source_tier = 'institution' and cover_url ~ '^https://')
  ),
  constraint news_items_status_check check (
    status in ('pending_review', 'published', 'rejected', 'hidden')
  )
);

create index if not exists idx_news_items_published
  on news.items (published_at desc, news_item_id desc)
  where (status = 'published');

create index if not exists idx_news_items_status_created
  on news.items (status, created_at desc);

create index if not exists idx_news_items_panda_slugs
  on news.items using gin (panda_slugs);

create index if not exists idx_news_items_institution_slug
  on news.items (institution_slug, published_at desc)
  where (status = 'published' and institution_slug is not null);

create table if not exists news.fact_candidates (
  candidate_id uuid primary key default gen_random_uuid(),
  candidate_key text not null unique,
  news_item_id uuid not null references news.items(news_item_id) on delete cascade,
  kind text not null,
  phase text,
  naming_status text,
  event_date text,
  target_panda_id text,
  target_panda_slug text,
  raw_panda_names text[] not null default '{}'::text[],
  target_institution_id text,
  target_institution_slug text,
  raw_institution_name text,
  change_payload jsonb not null default '{}'::jsonb,
  evidence_items jsonb not null default '[]'::jsonb,
  gate_status text not null,
  review_state text not null default 'pending_review',
  reviewed_by_account_id uuid references identity.accounts(account_id) on delete set null,
  reviewed_at timestamp with time zone,
  review_note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint news_fact_candidates_kind_check check (
    kind in ('birth', 'death', 'transfer', 'naming')
  ),
  constraint news_fact_candidates_phase_check check (
    phase is null or phase in ('announced', 'completed')
  ),
  constraint news_fact_candidates_naming_status_check check (
    naming_status is null or naming_status = 'official'
  ),
  constraint news_fact_candidates_event_date_check check (
    event_date is null or event_date ~ '^\d{4}-\d{2}(-\d{2})?$'
  ),
  constraint news_fact_candidates_change_payload_check check (
    jsonb_typeof(change_payload) = 'object'
  ),
  constraint news_fact_candidates_evidence_items_check check (
    jsonb_typeof(evidence_items) = 'array'
  ),
  constraint news_fact_candidates_gate_status_check check (
    gate_status in (
      'needs_identification', 'conflict', 'insufficient_source', 'eligible_institution_source'
    )
  ),
  constraint news_fact_candidates_review_state_check check (
    review_state in ('pending_review', 'approved', 'rejected')
  )
);

create index if not exists idx_news_fact_candidates_review_state
  on news.fact_candidates (review_state, created_at desc);

create index if not exists idx_news_fact_candidates_news_item
  on news.fact_candidates (news_item_id);

revoke all on schema news from public, anon, authenticated;
grant usage on schema news to zhipanda_app;
revoke all on table news.items, news.fact_candidates from public, anon, authenticated;
grant select, insert, update on table news.items, news.fact_candidates to zhipanda_app;

commit;
