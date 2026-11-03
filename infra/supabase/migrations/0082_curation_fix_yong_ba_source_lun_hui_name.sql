-- Two curation fixes from data/curation/pandas, approved by the owner before publishing 2026.10.31.1.
-- 1. src_gpg_yongba_death: the Giant Panda Global page returns 404 as of 2026-11-01, so the source
--    points to the Wayback Machine snapshot of 2025-12-11 and is marked archived.
-- 2. lun-hui: the English primary name is Lun Hui, as the Chengdu Base and Giant Panda Global pages
--    show it. "Wu Wu" has no source that still shows it, so it is not kept as a name or an alias.
-- Data only: no schema change. Each update matches the old value, so running it again changes nothing.

begin;

update evidence.sources
set url = 'https://web.archive.org/web/20251211144943/https://www.giantpandaglobal.com/en/news/yong-ba-died',
  access_state = 'archived',
  last_verified_on = date '2026-11-01',
  updated_at = now()
where source_id = 'src_gpg_yongba_death'
  and url = 'https://www.giantpandaglobal.com/en/news/yong-ba-died';

update panda.names n
set value = 'Lun Hui',
  normalized_value = 'lunhui'
from panda.slugs s
where s.panda_id = n.panda_id
  and s.slug = 'lun-hui'
  and n.language_tag = 'en'
  and n.name_kind = 'official_romanization'
  and n.value = 'Lun Hui / Wu Wu';

commit;
