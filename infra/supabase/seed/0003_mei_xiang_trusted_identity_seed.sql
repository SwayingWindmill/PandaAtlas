begin;

-- Generated from contracts/golden-dataset/mei-xiang-family.v1.json for the
-- trusted identity slice. Re-run the contract renderer when the fixture changes.

insert into public.pandas (
  id,
  slug,
  name_zh,
  name_en,
  gender,
  birth_date,
  status,
  current_location,
  intro,
  tags,
  is_featured
)
values
  (
    '2939c16f-1938-5629-928c-b36b1d5cd6ed',
    'mei-xiang',
    '美香',
    'Mei Xiang',
    'female',
    '1998-07-22',
    'alive',
    '中国——具体场所尚未公开核实',
    '曾生活于史密森国家动物园的雌性大熊猫，是泰山、宝宝、贝贝和小奇迹的母亲。',
    array['trusted-identity', 'golden-dataset'],
    false
  ),
  (
    '38cd1cad-3e34-5511-bc35-a091ece74e11',
    'tian-tian',
    '添添',
    'Tian Tian',
    'male',
    '1997-08-27',
    'alive',
    '中国——具体场所尚未公开核实',
    '曾生活于史密森国家动物园的雄性大熊猫，是泰山、宝宝、贝贝和小奇迹的父亲。',
    array['trusted-identity', 'golden-dataset'],
    false
  )
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
  is_featured = excluded.is_featured;

insert into public.evidence_sources (
  id,
  publisher,
  title,
  url,
  published_at,
  last_verified_at,
  language_tag,
  access_state,
  publication_status,
  evidence_tier,
  public_summary,
  internal_notes
)
values
  (
    'src_smithsonian_agreement_2020',
    'Smithsonian National Zoo and Conservation Biology Institute',
    'Smithsonian extends giant panda agreement',
    'https://nationalzoo.si.edu/news/smithsonians-national-zoo-and-conservation-biology-institute-extends-giant-panda-agreement',
    '2020-12-07',
    '2026-05-09',
    'en',
    'accessible',
    'published',
    'primary_fact',
    'Family birth dates and the planned 2023 return context.',
    'Golden dataset source registration.'
  ),
  (
    'src_smithsonian_history',
    'Smithsonian National Zoo and Conservation Biology Institute',
    'History of Giant Pandas at the Smithsonian National Zoo and Conservation Biology Institute',
    'https://nationalzoo.si.edu/animals/history-giant-pandas-zoo',
    null,
    '2026-05-09',
    'en',
    'accessible',
    'published',
    'primary_fact',
    'Smithsonian panda timeline, births, returns, and the 2023 departure.',
    'Golden dataset source registration.'
  )
on conflict (id) do update set
  publisher = excluded.publisher,
  title = excluded.title,
  url = excluded.url,
  published_at = excluded.published_at,
  last_verified_at = excluded.last_verified_at,
  language_tag = excluded.language_tag,
  access_state = excluded.access_state,
  publication_status = excluded.publication_status,
  evidence_tier = excluded.evidence_tier,
  public_summary = excluded.public_summary,
  internal_notes = excluded.internal_notes;

insert into public.panda_names (
  id,
  panda_id,
  language_tag,
  name_kind,
  value,
  normalized_value,
  is_primary,
  publication_status
)
values
  ('a0000000-0000-5000-8000-000000000001', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'zh-Hans', 'official', '美香', '美香', true, 'published'),
  ('a0000000-0000-5000-8000-000000000002', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'en', 'official_romanization', 'Mei Xiang', 'meixiang', true, 'published'),
  ('a0000000-0000-5000-8000-000000000003', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'pinyin', 'pinyin', 'Měixiāng', 'meixiang', true, 'published'),
  ('a0000000-0000-5000-8000-000000000004', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'en', 'historic_spelling', 'Mei-Xiang', 'meixiang', false, 'published'),
  ('a0000000-0000-5000-8000-000000000011', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'zh-Hans', 'official', '添添', '添添', true, 'published'),
  ('a0000000-0000-5000-8000-000000000012', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'en', 'official_romanization', 'Tian Tian', 'tiantian', true, 'published'),
  ('a0000000-0000-5000-8000-000000000013', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'pinyin', 'pinyin', 'Tiāntiān', 'tiantian', true, 'published'),
  ('a0000000-0000-5000-8000-000000000014', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'en', 'historic_spelling', 'Tian-Tian', 'tiantian', false, 'published')
on conflict (id) do update set
  panda_id = excluded.panda_id,
  language_tag = excluded.language_tag,
  name_kind = excluded.name_kind,
  value = excluded.value,
  normalized_value = excluded.normalized_value,
  is_primary = excluded.is_primary,
  publication_status = excluded.publication_status;

insert into public.panda_name_sources (panda_name_id, source_id)
select name_id, 'src_smithsonian_history'
from unnest(array[
  'a0000000-0000-5000-8000-000000000001'::uuid,
  'a0000000-0000-5000-8000-000000000002'::uuid,
  'a0000000-0000-5000-8000-000000000003'::uuid,
  'a0000000-0000-5000-8000-000000000004'::uuid,
  'a0000000-0000-5000-8000-000000000011'::uuid,
  'a0000000-0000-5000-8000-000000000012'::uuid,
  'a0000000-0000-5000-8000-000000000013'::uuid,
  'a0000000-0000-5000-8000-000000000014'::uuid
]) as name_id
on conflict do nothing;

insert into public.panda_slugs (
  id,
  panda_id,
  slug,
  slug_kind,
  publication_status
)
values
  ('b0000000-0000-5000-8000-000000000001', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mei-xiang', 'canonical', 'published'),
  ('b0000000-0000-5000-8000-000000000002', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'meixiang', 'legacy', 'published'),
  ('b0000000-0000-5000-8000-000000000003', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mei_xiang', 'legacy', 'published'),
  ('b0000000-0000-5000-8000-000000000011', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'tian-tian', 'canonical', 'published'),
  ('b0000000-0000-5000-8000-000000000012', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'tiantian', 'legacy', 'published'),
  ('b0000000-0000-5000-8000-000000000013', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'tian_tian', 'legacy', 'published')
on conflict (id) do update set
  panda_id = excluded.panda_id,
  slug = excluded.slug,
  slug_kind = excluded.slug_kind,
  publication_status = excluded.publication_status;

insert into public.panda_slug_sources (panda_slug_id, source_id)
select slug_id, 'src_smithsonian_history'
from unnest(array[
  'b0000000-0000-5000-8000-000000000001'::uuid,
  'b0000000-0000-5000-8000-000000000002'::uuid,
  'b0000000-0000-5000-8000-000000000003'::uuid,
  'b0000000-0000-5000-8000-000000000011'::uuid,
  'b0000000-0000-5000-8000-000000000012'::uuid,
  'b0000000-0000-5000-8000-000000000013'::uuid
]) as slug_id
on conflict do nothing;

insert into public.panda_external_identifiers (
  id,
  panda_id,
  system,
  value,
  normalized_value,
  publication_status
)
values
  ('c0000000-0000-5000-8000-000000000001', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'smithsonian_history_key', 'mei-xiang', 'meixiang', 'published'),
  ('c0000000-0000-5000-8000-000000000011', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'smithsonian_history_key', 'tian-tian', 'tiantian', 'published')
on conflict (id) do update set
  panda_id = excluded.panda_id,
  system = excluded.system,
  value = excluded.value,
  normalized_value = excluded.normalized_value,
  publication_status = excluded.publication_status;

insert into public.panda_external_identifier_sources (external_identifier_id, source_id)
values
  ('c0000000-0000-5000-8000-000000000001', 'src_smithsonian_history'),
  ('c0000000-0000-5000-8000-000000000011', 'src_smithsonian_history')
on conflict do nothing;

insert into public.fact_assertions (
  id,
  panda_id,
  field_key,
  value_json,
  certainty,
  publication_status,
  last_verified_at
)
values
  ('fact-mei-xiang-birth-date', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'birth_date', '"1998-07-22"'::jsonb, 'confirmed', 'published', '2026-05-09'),
  ('fact-mei-xiang-current-place', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'current_coarse_location', '"China"'::jsonb, 'confirmed', 'published', '2026-05-09'),
  ('fact-tian-tian-birth-date', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'birth_date', '"1997-08-27"'::jsonb, 'confirmed', 'published', '2026-05-09'),
  ('fact-tian-tian-current-place', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'current_coarse_location', '"China"'::jsonb, 'confirmed', 'published', '2026-05-09')
on conflict (id) do update set
  panda_id = excluded.panda_id,
  field_key = excluded.field_key,
  value_json = excluded.value_json,
  certainty = excluded.certainty,
  publication_status = excluded.publication_status,
  last_verified_at = excluded.last_verified_at;

insert into public.fact_assertion_sources (assertion_id, source_id, stance)
values
  ('fact-mei-xiang-birth-date', 'src_smithsonian_agreement_2020', 'supports'),
  ('fact-mei-xiang-current-place', 'src_smithsonian_history', 'supports'),
  ('fact-tian-tian-birth-date', 'src_smithsonian_agreement_2020', 'supports'),
  ('fact-tian-tian-current-place', 'src_smithsonian_history', 'supports')
on conflict do nothing;

insert into public.public_fact_conclusions (
  id,
  panda_id,
  field_key,
  value_json,
  status,
  last_verified_at,
  conclusion_version,
  is_current,
  publication_status
)
values
  ('d0000000-0000-5000-8000-000000000001', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'birth_date', '"1998-07-22"'::jsonb, 'confirmed', '2026-05-09', 1, true, 'published'),
  ('d0000000-0000-5000-8000-000000000002', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'current_coarse_location', '"China"'::jsonb, 'confirmed', '2026-05-09', 1, true, 'published'),
  ('d0000000-0000-5000-8000-000000000011', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'birth_date', '"1997-08-27"'::jsonb, 'confirmed', '2026-05-09', 1, true, 'published'),
  ('d0000000-0000-5000-8000-000000000012', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'current_coarse_location', '"China"'::jsonb, 'confirmed', '2026-05-09', 1, true, 'published')
on conflict (id) do update set
  panda_id = excluded.panda_id,
  field_key = excluded.field_key,
  value_json = excluded.value_json,
  status = excluded.status,
  last_verified_at = excluded.last_verified_at,
  conclusion_version = excluded.conclusion_version,
  is_current = excluded.is_current,
  publication_status = excluded.publication_status;

insert into public.public_fact_conclusion_assertions (conclusion_id, assertion_id)
values
  ('d0000000-0000-5000-8000-000000000001', 'fact-mei-xiang-birth-date'),
  ('d0000000-0000-5000-8000-000000000002', 'fact-mei-xiang-current-place'),
  ('d0000000-0000-5000-8000-000000000011', 'fact-tian-tian-birth-date'),
  ('d0000000-0000-5000-8000-000000000012', 'fact-tian-tian-current-place')
on conflict do nothing;

commit;
