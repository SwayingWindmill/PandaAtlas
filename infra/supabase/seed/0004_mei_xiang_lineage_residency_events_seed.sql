begin;

insert into public.evidence_sources (
  id, publisher, title, url, published_at, last_verified_at, language_tag,
  access_state, publication_status, evidence_tier, public_summary
)
values (
  'src_smithsonian_giant_panda_faq',
  'Smithsonian National Zoo and Conservation Biology Institute',
  'Giant Panda FAQs',
  'https://nationalzoo.si.edu/animals/giant-panda-faqs',
  null,
  '2026-05-09',
  'en',
  'accessible',
  'published',
  'primary_fact',
  'Bao Li identity and reviewed maternal parentage.'
)
on conflict (id) do update set
  publisher = excluded.publisher,
  title = excluded.title,
  url = excluded.url,
  last_verified_at = excluded.last_verified_at,
  publication_status = excluded.publication_status,
  public_summary = excluded.public_summary;

-- Reviewed lineage, residency intervals, and shared transfer events for the
-- Mei Xiang golden family. Legacy parent columns remain null by design.
insert into public.pandas (
  id, slug, name_zh, name_en, gender, birth_date, status,
  current_location, intro, tags, is_featured, father_id, mother_id
)
values
  ('96d00a39-7865-55db-b5c2-f339ef692258', 'tai-shan', '泰山', 'Tai Shan', 'male', '2005-07-09', 'alive', '中国', '美香与添添之子。', array['golden-dataset'], false, null, null),
  ('7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', 'bao-bao', '宝宝', 'Bao Bao', 'female', '2013-08-23', 'alive', '中国', '美香与添添之女。', array['golden-dataset'], false, null, null),
  ('1a05a5dc-1926-5355-9d81-c2a43189d50b', 'bei-bei', '贝贝', 'Bei Bei', 'male', '2015-08-22', 'alive', '中国', '美香与添添之子。', array['golden-dataset'], false, null, null),
  ('926abc78-1e79-55c6-b24a-d33b4e5f6443', 'xiao-qi-ji', '小奇迹', 'Xiao Qi Ji', 'male', '2020-08-21', 'alive', '中国', '美香与添添之子。', array['golden-dataset'], false, null, null),
  ('434e10e3-7ba0-5de7-a59e-d3984524c58c', 'bao-li', '宝力', 'Bao Li', 'male', null, 'alive', null, null, array['golden-dataset'], false, null, null)
on conflict (id) do update set
  slug = excluded.slug,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  gender = excluded.gender,
  birth_date = excluded.birth_date,
  status = excluded.status,
  current_location = excluded.current_location,
  intro = excluded.intro,
  tags = excluded.tags,
  is_featured = excluded.is_featured,
  father_id = null,
  mother_id = null;

insert into public.institutions (
  id, name_zh, name_en, publication_status
)
values (
  'f141af52-52c7-5d2f-a01a-2ce0c547b920',
  '史密森国家动物园与保护生物学研究所',
  'Smithsonian National Zoo and Conservation Biology Institute',
  'published'
)
on conflict (id) do update set
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  publication_status = excluded.publication_status;

insert into public.facilities (
  id, institution_id, name_zh, name_en, country_code, publication_status
)
values
  ('afb0f227-dd5e-5076-88e3-74e9807a6049', 'f141af52-52c7-5d2f-a01a-2ce0c547b920', '史密森国家动物园', 'Smithsonian National Zoo', 'US', 'published'),
  ('60c7e1a3-d286-5366-8d41-32c11df58b5c', null, '中国大熊猫保护研究中心卧龙耿达基地', 'CCRCGP Wolong Gengda Base', 'CN', 'published'),
  ('89f620b2-37d0-51ba-aafa-6844404a5b2c', null, '中国大熊猫保护研究中心卧龙神树坪基地', 'CCRCGP Wolong Shenshuping Base', 'CN', 'published')
on conflict (id) do update set
  institution_id = excluded.institution_id,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  country_code = excluded.country_code,
  publication_status = excluded.publication_status;

insert into public.parentage_assertions (
  id, child_id, parent_id, parent_role, status, publication_status, reviewed_at
)
values
  ('parent-tai-shan-father', '96d00a39-7865-55db-b5c2-f339ef692258', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'father', 'confirmed', 'published', '2026-05-09'),
  ('parent-tai-shan-mother', '96d00a39-7865-55db-b5c2-f339ef692258', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mother', 'confirmed', 'published', '2026-05-09'),
  ('parent-bao-bao-father', '7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'father', 'confirmed', 'published', '2026-05-09'),
  ('parent-bao-bao-mother', '7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mother', 'confirmed', 'published', '2026-05-09'),
  ('parent-bei-bei-father', '1a05a5dc-1926-5355-9d81-c2a43189d50b', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'father', 'confirmed', 'published', '2026-05-09'),
  ('parent-bei-bei-mother', '1a05a5dc-1926-5355-9d81-c2a43189d50b', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mother', 'confirmed', 'published', '2026-05-09'),
  ('parent-xiao-qi-ji-father', '926abc78-1e79-55c6-b24a-d33b4e5f6443', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'father', 'confirmed', 'published', '2026-05-09'),
  ('parent-xiao-qi-ji-mother', '926abc78-1e79-55c6-b24a-d33b4e5f6443', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mother', 'confirmed', 'published', '2026-05-09'),
  ('parent-bao-li-mother', '434e10e3-7ba0-5de7-a59e-d3984524c58c', '7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', 'mother', 'confirmed', 'published', '2026-05-09')
on conflict (id) do update set
  child_id = excluded.child_id,
  parent_id = excluded.parent_id,
  parent_role = excluded.parent_role,
  status = excluded.status,
  publication_status = excluded.publication_status,
  reviewed_at = excluded.reviewed_at;

insert into public.parentage_assertion_sources (assertion_id, source_id)
select id, case
  when id = 'parent-bao-li-mother' then 'src_smithsonian_giant_panda_faq'
  else 'src_smithsonian_agreement_2020'
end
from public.parentage_assertions
where id in (
  'parent-tai-shan-father', 'parent-tai-shan-mother',
  'parent-bao-bao-father', 'parent-bao-bao-mother',
  'parent-bei-bei-father', 'parent-bei-bei-mother',
  'parent-xiao-qi-ji-father', 'parent-xiao-qi-ji-mother',
  'parent-bao-li-mother'
)
on conflict do nothing;

insert into public.panda_residencies (
  id, panda_id, facility_id, coarse_location, residency_type,
  start_date, start_precision, end_date, end_precision, status, publication_status
)
values
  ('res-mei-xiang-smithsonian', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'afb0f227-dd5e-5076-88e3-74e9807a6049', null, 'primary', '2000-12-06', 'day', '2023-11-08', 'day', 'confirmed', 'published'),
  ('res-mei-xiang-china', '2939c16f-1938-5629-928c-b36b1d5cd6ed', null, 'China', 'primary', '2023-11-08', 'day', null, null, 'confirmed_country_level', 'published'),
  ('res-tian-tian-smithsonian', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'afb0f227-dd5e-5076-88e3-74e9807a6049', null, 'primary', '2000-12-06', 'day', '2023-11-08', 'day', 'confirmed', 'published'),
  ('res-tian-tian-china', '38cd1cad-3e34-5511-bc35-a091ece74e11', null, 'China', 'primary', '2023-11-08', 'day', null, null, 'confirmed_country_level', 'published'),
  ('res-tai-shan-china-country-level', '96d00a39-7865-55db-b5c2-f339ef692258', null, 'China', 'primary', '2010-02-04', 'day', null, null, 'confirmed_country_level', 'published'),
  ('res-bao-bao-china-country-level', '7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', null, 'China', 'primary', '2017-02-21', 'day', null, null, 'confirmed_country_level', 'published'),
  ('res-bei-bei-shenshuping', '1a05a5dc-1926-5355-9d81-c2a43189d50b', '89f620b2-37d0-51ba-aafa-6844404a5b2c', null, 'primary', '2019-11-19', 'day', null, null, 'confirmed', 'published'),
  ('res-xiao-qi-ji-shenshuping', '926abc78-1e79-55c6-b24a-d33b4e5f6443', '89f620b2-37d0-51ba-aafa-6844404a5b2c', null, 'primary', '2023-11-08', 'day', null, null, 'confirmed', 'published')
on conflict (id) do update set
  facility_id = excluded.facility_id,
  coarse_location = excluded.coarse_location,
  residency_type = excluded.residency_type,
  start_date = excluded.start_date,
  start_precision = excluded.start_precision,
  end_date = excluded.end_date,
  end_precision = excluded.end_precision,
  status = excluded.status,
  publication_status = excluded.publication_status;

insert into public.residency_sources (residency_id, source_id)
select id, 'src_smithsonian_history'
from public.panda_residencies
where id in (
  'res-mei-xiang-smithsonian', 'res-mei-xiang-china',
  'res-tian-tian-smithsonian', 'res-tian-tian-china',
  'res-tai-shan-china-country-level', 'res-bao-bao-china-country-level',
  'res-bei-bei-shenshuping', 'res-xiao-qi-ji-shenshuping'
)
on conflict do nothing;

insert into public.domain_events (
  id, event_type, event_status, event_date, event_date_precision,
  from_facility_id, from_coarse_location, to_facility_id, to_coarse_location,
  publication_status
)
values
  ('event-smithsonian-return-plan-2020', 'transfer', 'announced', '2020-12-07', 'day', 'afb0f227-dd5e-5076-88e3-74e9807a6049', null, null, 'China', 'published'),
  ('event-smithsonian-departure-2023', 'transfer', 'completed', '2023-11-08', 'day', 'afb0f227-dd5e-5076-88e3-74e9807a6049', null, null, 'China', 'published')
on conflict (id) do update set
  event_type = excluded.event_type,
  event_status = excluded.event_status,
  event_date = excluded.event_date,
  event_date_precision = excluded.event_date_precision,
  from_facility_id = excluded.from_facility_id,
  from_coarse_location = excluded.from_coarse_location,
  to_facility_id = excluded.to_facility_id,
  to_coarse_location = excluded.to_coarse_location,
  publication_status = excluded.publication_status;

insert into public.domain_event_participants (event_id, panda_id)
values
  ('event-smithsonian-return-plan-2020', '2939c16f-1938-5629-928c-b36b1d5cd6ed'),
  ('event-smithsonian-return-plan-2020', '38cd1cad-3e34-5511-bc35-a091ece74e11'),
  ('event-smithsonian-return-plan-2020', '926abc78-1e79-55c6-b24a-d33b4e5f6443'),
  ('event-smithsonian-departure-2023', '2939c16f-1938-5629-928c-b36b1d5cd6ed'),
  ('event-smithsonian-departure-2023', '38cd1cad-3e34-5511-bc35-a091ece74e11'),
  ('event-smithsonian-departure-2023', '926abc78-1e79-55c6-b24a-d33b4e5f6443')
on conflict do nothing;

insert into public.domain_event_sources (event_id, source_id)
values
  ('event-smithsonian-return-plan-2020', 'src_smithsonian_agreement_2020'),
  ('event-smithsonian-departure-2023', 'src_smithsonian_history')
on conflict do nothing;

commit;
