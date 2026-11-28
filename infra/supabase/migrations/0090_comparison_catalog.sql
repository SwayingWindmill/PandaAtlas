-- 比一比 catalog: pairs of pandas the team publishes side by side on 发现, each with a title
-- and a one-line dek. This migration creates the table only and stores no entries: data comes
-- from data/curation/comparisons/comparisons.json through the curation.content batch.
-- GET /api/v2/comparisons returns published entries only.

begin;

create table if not exists place.comparison_catalog (
  catalog_id smallint primary key default 1,
  version text not null,
  document jsonb not null,
  updated_at timestamptz not null default now(),
  constraint comparison_catalog_singleton check (catalog_id = 1),
  constraint comparison_catalog_document_object check (jsonb_typeof(document) = 'object'),
  constraint comparison_catalog_items_array check (jsonb_typeof(document -> 'items') = 'array')
);

grant select on place.comparison_catalog to zhipanda_app;

commit;
