-- 场馆动态 catalog. Holds neutral facts taken from institutions' own
-- announcements; every entry carries sourceUrl, sourcePublisher, publishedOn and
-- updatedAt (validated by the API). This migration creates the table only and
-- stores no entries: data comes from data/curation/venue-news/venue-news.json
-- through scripts/curation/build_venue_news_migration.py in a later migration.
-- GET /api/v2/venue-news returns published entries only.

begin;

create table if not exists place.venue_news_catalog (
  catalog_id smallint primary key default 1,
  version text not null,
  document jsonb not null,
  updated_at timestamptz not null default now(),
  constraint venue_news_catalog_singleton check (catalog_id = 1),
  constraint venue_news_catalog_document_object check (jsonb_typeof(document) = 'object'),
  constraint venue_news_catalog_items_array check (jsonb_typeof(document -> 'items') = 'array')
);

grant select on place.venue_news_catalog to zhipanda_app;

commit;
