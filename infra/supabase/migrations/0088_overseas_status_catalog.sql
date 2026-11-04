-- 海外大熊猫状态 catalog (归国熊猫). Holds location, announced return and
-- quarantine stage per panda; every entry carries sourceUrl, sourcePublisher and
-- updatedAt (validated by the API). This migration creates the table only and
-- stores no entries: data comes from data/curation/overseas-status/overseas-status.json
-- through scripts/curation/build_overseas_status_migration.py in a later migration.
-- GET /api/v2/overseas-status returns published entries only.

begin;

create table if not exists place.overseas_status_catalog (
  catalog_id smallint primary key default 1,
  version text not null,
  document jsonb not null,
  updated_at timestamptz not null default now(),
  constraint overseas_status_catalog_singleton check (catalog_id = 1),
  constraint overseas_status_catalog_document_object check (jsonb_typeof(document) = 'object'),
  constraint overseas_status_catalog_items_array check (jsonb_typeof(document -> 'items') = 'array')
);

grant select on place.overseas_status_catalog to zhipanda_app;

commit;
