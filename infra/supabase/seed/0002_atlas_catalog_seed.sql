-- Atlas catalog expansion seed
-- Aligns checked-in DB seed data with the fallback public-record model

begin;

-- habitat catalog
insert into public.habitats (
  id,
  code,
  name,
  province,
  level,
  area_km2,
  center,
  boundary,
  description
) values
  (
    '245b64cc-7304-4d4a-b818-e30e30126e8c',
    'MS-001',
    'Minshan Habitat',
    'Sichuan',
    'national',
    1200.00,
    st_setsrid(st_point(103.60, 31.30), 4326),
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[103.2,30.9],[104.0,30.9],[104.0,31.7],[103.2,31.7],[103.2,30.9]]]]}'),
      4326
    ),
    'National habitat anchor for the public atlas baseline.'
  ),
  (
    '08e2f4a3-0eaa-4c6a-a7e2-c2dc8cf3b871',
    'DJ-001',
    'Dujiangyan Habitat',
    'Sichuan',
    'municipal',
    220.00,
    st_setsrid(st_point(103.64, 30.99), 4326),
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[103.4,30.8],[103.9,30.8],[103.9,31.2],[103.4,31.2],[103.4,30.8]]]]}'),
      4326
    ),
    'Dujiangyan rehabilitation and visitor-education habitat.'
  ),
  (
    '73d0c38d-fce6-4264-b636-37e6526e1989',
    'WL-001',
    'Wolong Habitat',
    'Sichuan',
    'national',
    840.00,
    st_setsrid(st_point(103.15, 30.95), 4326),
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[102.7,30.4],[103.6,30.4],[103.6,31.2],[102.7,31.2],[102.7,30.4]]]]}'),
      4326
    ),
    'Wolong habitat used for lineage-linked conservation records.'
  ),
  (
    '9305f098-0d57-4706-b998-fa52ea08db0d',
    'BFX-001',
    'Bifengxia Habitat',
    'Sichuan',
    'national',
    410.00,
    st_setsrid(st_point(103.04, 30.06), 4326),
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[102.7,29.8],[103.3,29.8],[103.3,30.3],[102.7,30.3],[102.7,29.8]]]]}'),
      4326
    ),
    'Breeding and rescue habitat used in the maternal branch records.'
  ),
  (
    '4fd709b8-23a9-4bf8-b302-40a65b0def01',
    'QL-001',
    'Qinling Habitat',
    'Shaanxi',
    'national',
    980.00,
    st_setsrid(st_point(107.90, 33.80), 4326),
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[107.4,33.3],[108.4,33.3],[108.4,34.2],[107.4,34.2],[107.4,33.3]]]]}'),
      4326
    ),
    'Northwestern habitat anchor for Qinling-linked public profiles.'
  ),
  (
    'd6f99066-62f2-45d8-901d-a6f131f7d1de',
    'INTL-001',
    'International Collaboration Zone',
    null,
    'cooperation',
    100.00,
    st_setsrid(st_point(104.00, 31.00), 4326),
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[103.8,30.8],[104.2,30.8],[104.2,31.2],[103.8,31.2],[103.8,30.8]]]]}'),
      4326
    ),
    'International holding zone used for collaboration and archive records.'
  )
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  province = excluded.province,
  level = excluded.level,
  area_km2 = excluded.area_km2,
  center = excluded.center,
  boundary = excluded.boundary,
  description = excluded.description,
  updated_at = now();

-- canonical panda catalog
insert into public.pandas (
  id,
  slug,
  name_zh,
  name_en,
  gender,
  birth_date,
  death_date,
  status,
  birthplace,
  current_location,
  father_id,
  mother_id,
  intro,
  tags,
  is_featured
) values
  (
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b',
    'bi-li',
    '比力',
    'Bi Li',
    'male',
    '1990-09-16',
    null,
    'alive',
    'Dujiangyan Panda Valley',
    'Dujiangyan Panda Valley',
    null,
    null,
    'Senior male with long-running archival value across breeding and behavior records.',
    array['featured','archive','founder'],
    true
  ),
  (
    'b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df',
    'hua-mei',
    '华美',
    'Hua Mei',
    'female',
    '1999-08-21',
    '2022-11-17',
    'deceased',
    'San Diego Zoo',
    'Historical archive',
    null,
    null,
    'Historic female profile used as a stable lineage reference anchor.',
    array['archive','founder','lineage'],
    false
  ),
  (
    '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e',
    'xi-yue',
    '喜月',
    'Xi Yue',
    'female',
    '2010-03-14',
    '2024-01-05',
    'deceased',
    'Chengdu Research Base',
    'Historical archive',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b',
    'b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df',
    'Archived female with complete maternal-line notes and stable reference value.',
    array['archive','maternal-line','lineage'],
    false
  ),
  (
    'a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f',
    'zhen-zhen',
    '珍珍',
    'Zhen Zhen',
    'female',
    '2007-08-03',
    null,
    'alive',
    'San Diego Zoo',
    'International Collaboration Center',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b',
    'b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df',
    'Internationally documented female with complete breeding and transfer records.',
    array['featured','international','breeding'],
    true
  ),
  (
    '6f61fd4f-1c4d-4db0-8f10-67ea58f98f80',
    'qing-shan',
    '青山',
    'Qing Shan',
    'male',
    '2017-05-02',
    null,
    'alive',
    'Qinling Science Park',
    'Qinling Science Park',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b',
    '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e',
    'Behaviorally steady male used as a reliable connector between public family branches.',
    array['research','connector','steady'],
    false
  ),
  (
    '89264f73-d0e2-44e0-aad6-8d8fca58f879',
    'yun-chuan',
    '云川',
    'Yun Chuan',
    'male',
    '2019-06-16',
    null,
    'alive',
    'Chengdu Research Base',
    'Chengdu Research Base',
    '6f61fd4f-1c4d-4db0-8f10-67ea58f98f80',
    'a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f',
    'Core male branch in the current public atlas, linking archived lines to current profiles.',
    array['featured','core-branch','public-profile'],
    true
  ),
  (
    '53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7',
    'jin-hu',
    '金虎',
    'Jin Hu',
    'female',
    '2018-08-11',
    null,
    'alive',
    'Bifengxia Base',
    'Bifengxia Base',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b',
    '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e',
    'Female profile with strong adaptation notes and good public-facing relation coverage.',
    array['featured','maternal-branch','adaptive'],
    true
  ),
  (
    'e2f0ff4a-4a98-413a-a0d2-64e12d68db43',
    'meng-lan',
    '萌兰',
    'Meng Lan',
    'male',
    '2015-07-04',
    null,
    'alive',
    'Beijing Zoo',
    'Beijing Zoo',
    '6f61fd4f-1c4d-4db0-8f10-67ea58f98f80',
    'a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f',
    'Highly recognizable male known for activity and exploratory behavior.',
    array['featured','active','public-attention'],
    true
  ),
  (
    '95f8e2e0-a8f1-45e5-8b4f-bdb7235d7ce2',
    'xin-bao',
    '鑫宝',
    'Xin Bao',
    'male',
    '2020-09-02',
    null,
    'alive',
    'Dujiangyan Panda Valley',
    'Dujiangyan Panda Valley',
    '89264f73-d0e2-44e0-aad6-8d8fca58f879',
    '53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7',
    'Younger male with a pronounced daytime activity window and clear public profile identity.',
    array['active','monitoring','young-profile'],
    false
  ),
  (
    '1d08f72f-7550-42e9-a4d5-bd74bc505955',
    'he-hua',
    '和花',
    'He Hua',
    'female',
    '2020-07-04',
    null,
    'alive',
    'Chengdu Research Base',
    'Chengdu Research Base',
    '89264f73-d0e2-44e0-aad6-8d8fca58f879',
    '53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7',
    'Current focus panda whose public profile anchors the profile-to-lineage journey.',
    array['featured','star-profile','social'],
    true
  ),
  (
    '31d1f8be-7b95-4f0d-8f65-1e030fd22d71',
    'fu-bao',
    '福宝',
    'Fu Bao',
    'female',
    '2020-07-20',
    null,
    'alive',
    'Everland Panda World',
    'Wolong Shenshuping Base',
    'e2f0ff4a-4a98-413a-a0d2-64e12d68db43',
    '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e',
    'Widely followed female with a strong youth-growth narrative and stable archive potential.',
    array['featured','youth-archive','cross-base'],
    true
  )
on conflict (id) do update set
  slug = excluded.slug,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  gender = excluded.gender,
  birth_date = excluded.birth_date,
  death_date = excluded.death_date,
  status = excluded.status,
  birthplace = excluded.birthplace,
  current_location = excluded.current_location,
  father_id = excluded.father_id,
  mother_id = excluded.mother_id,
  intro = excluded.intro,
  tags = excluded.tags,
  is_featured = excluded.is_featured,
  updated_at = now();

-- habitat links / public sightings
insert into public.sightings (
  id,
  panda_id,
  habitat_id,
  observed_at,
  source_type,
  confidence,
  location,
  note,
  source_ref
) values
  (
    '7d7704d1-3b5d-4f0d-a698-df418f7ce5a1',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b',
    '08e2f4a3-0eaa-4c6a-a7e2-c2dc8cf3b871',
    '2026-02-10T10:00:00Z',
    'research',
    0.97,
    st_setsrid(st_point(103.66, 30.98), 4326),
    'Archival male baseline record.',
    'ATLAS-S-001'
  ),
  (
    'd38a5f0e-94c3-4f4d-b6d6-cabf6cd8a5f2',
    'b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df',
    '245b64cc-7304-4d4a-b818-e30e30126e8c',
    '2025-08-12T09:00:00Z',
    'research',
    0.90,
    st_setsrid(st_point(103.58, 31.22), 4326),
    'Historical founder reference record.',
    'ATLAS-S-002'
  ),
  (
    '2fca6408-30d4-4710-920e-6a0702057598',
    '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e',
    '245b64cc-7304-4d4a-b818-e30e30126e8c',
    '2024-02-18T11:30:00Z',
    'research',
    0.91,
    st_setsrid(st_point(103.54, 31.18), 4326),
    'Maternal branch archive record.',
    'ATLAS-S-003'
  ),
  (
    '7828e4af-17f7-4b0a-8fe8-d68c38ea08f9',
    'a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f',
    'd6f99066-62f2-45d8-901d-a6f131f7d1de',
    '2026-01-19T08:20:00Z',
    'research',
    0.94,
    st_setsrid(st_point(104.01, 31.01), 4326),
    'International collaboration profile anchor.',
    'ATLAS-S-004'
  ),
  (
    'ec6d82bc-5226-489d-8c44-936623c85a49',
    '6f61fd4f-1c4d-4db0-8f10-67ea58f98f80',
    '4fd709b8-23a9-4bf8-b302-40a65b0def01',
    '2026-01-08T07:50:00Z',
    'research',
    0.95,
    st_setsrid(st_point(107.92, 33.82), 4326),
    'Connector branch habitat observation.',
    'ATLAS-S-005'
  ),
  (
    '28c7d3a7-952a-43b8-af15-1f48e7fba2d3',
    '89264f73-d0e2-44e0-aad6-8d8fca58f879',
    '245b64cc-7304-4d4a-b818-e30e30126e8c',
    '2026-02-20T14:30:00Z',
    'research',
    0.96,
    st_setsrid(st_point(103.61, 31.27), 4326),
    'Core branch monitoring record.',
    'ATLAS-S-006'
  ),
  (
    '4d9d7f74-a39d-4418-84b0-8f2eab5d2f47',
    '53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7',
    '9305f098-0d57-4706-b998-fa52ea08db0d',
    '2026-01-30T09:45:00Z',
    'research',
    0.95,
    st_setsrid(st_point(103.03, 30.05), 4326),
    'Maternal branch Bifengxia record.',
    'ATLAS-S-007'
  ),
  (
    'a10c3fdd-d358-4272-b276-56572c403f37',
    'e2f0ff4a-4a98-413a-a0d2-64e12d68db43',
    '4fd709b8-23a9-4bf8-b302-40a65b0def01',
    '2026-02-02T12:05:00Z',
    'captive',
    0.93,
    st_setsrid(st_point(107.95, 33.80), 4326),
    'Beijing public attention profile tied to Qinling habitat cluster.',
    'ATLAS-S-008'
  ),
  (
    '378ecb98-bfbe-4ddd-a6cb-ec7e3930f7f2',
    '95f8e2e0-a8f1-45e5-8b4f-bdb7235d7ce2',
    '08e2f4a3-0eaa-4c6a-a7e2-c2dc8cf3b871',
    '2026-02-24T10:40:00Z',
    'research',
    0.94,
    st_setsrid(st_point(103.67, 30.97), 4326),
    'Young male daytime activity record.',
    'ATLAS-S-009'
  ),
  (
    '2afed4bb-d3bf-4c17-bce5-7f2f9a6930a0',
    '1d08f72f-7550-42e9-a4d5-bd74bc505955',
    '245b64cc-7304-4d4a-b818-e30e30126e8c',
    '2026-03-01T13:15:00Z',
    'research',
    0.98,
    st_setsrid(st_point(103.63, 31.29), 4326),
    'Current public-profile verification record.',
    'ATLAS-S-010'
  ),
  (
    '7004d0e1-1f66-4ab7-85ee-c435e54ef4ce',
    '31d1f8be-7b95-4f0d-8f65-1e030fd22d71',
    '73d0c38d-fce6-4264-b636-37e6526e1989',
    '2026-02-28T15:05:00Z',
    'research',
    0.95,
    st_setsrid(st_point(103.10, 30.92), 4326),
    'Wolong-linked youth archive record.',
    'ATLAS-S-011'
  )
on conflict (id) do update set
  panda_id = excluded.panda_id,
  habitat_id = excluded.habitat_id,
  observed_at = excluded.observed_at,
  source_type = excluded.source_type,
  confidence = excluded.confidence,
  location = excluded.location,
  note = excluded.note,
  source_ref = excluded.source_ref,
  updated_at = now();

-- snapshot catalog
insert into public.distribution_snapshots (
  id,
  snapshot_date,
  version,
  notes
) values
  (
    '5f775297-b2ed-4d5f-bf17-2defd2b60573',
    '2026-03-05',
    'atlas-2026-03-05',
    'Latest atlas snapshot used by public-read smoke and stats.'
  ),
  (
    '8b0e5c24-d0fe-4a77-8a5d-673e5b5b8f0a',
    '2025-12-05',
    'atlas-2025-12-05',
    'Previous wild-distribution comparison snapshot.'
  ),
  (
    '3ddc0cf7-4dc9-44e0-bc81-318e9b9d6211',
    '2025-09-05',
    'atlas-2025-09-05',
    'Older seasonal wild-distribution comparison snapshot.'
  )
on conflict (id) do update set
  snapshot_date = excluded.snapshot_date,
  version = excluded.version,
  notes = excluded.notes;

insert into public.distribution_cells (
  id,
  snapshot_id,
  layer,
  cell_code,
  density,
  geom
) values
  (
    10001,
    '5f775297-b2ed-4d5f-bf17-2defd2b60573',
    'wild',
    'QXL-001',
    14.2,
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[103.5,31.2],[103.9,31.2],[103.9,31.6],[103.5,31.6],[103.5,31.2]]]]}'),
      4326
    )
  ),
  (
    10002,
    '8b0e5c24-d0fe-4a77-8a5d-673e5b5b8f0a',
    'wild',
    'MS-003',
    10.6,
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[104.2,30.8],[104.6,30.8],[104.6,31.1],[104.2,31.1],[104.2,30.8]]]]}'),
      4326
    )
  ),
  (
    10003,
    '3ddc0cf7-4dc9-44e0-bc81-318e9b9d6211',
    'wild',
    'LM-011',
    8.8,
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[103.2,30.5],[103.6,30.5],[103.6,30.9],[103.2,30.9],[103.2,30.5]]]]}'),
      4326
    )
  ),
  (
    10004,
    '5f775297-b2ed-4d5f-bf17-2defd2b60573',
    'captive',
    'CD-010',
    6.1,
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[104.6,31.2],[104.9,31.2],[104.9,31.5],[104.6,31.5],[104.6,31.2]]]]}'),
      4326
    )
  )
on conflict (id) do update set
  snapshot_id = excluded.snapshot_id,
  layer = excluded.layer,
  cell_code = excluded.cell_code,
  density = excluded.density,
  geom = excluded.geom;

-- public media and cover mapping
insert into public.media_assets (
  id,
  storage_bucket,
  storage_path,
  title,
  photographer,
  copyright_text,
  license,
  metadata
) values
  (
    'c9b7df0b-9f6e-4c82-bf3d-fdbf34d0c101',
    'public-media',
    'https://images.panda-atlas.example/he-hua-cover.jpg',
    'He Hua portrait',
    'Panda Atlas Editorial',
    'Panda Atlas',
    'editorial-reference',
    '{"surface":"profile"}'::jsonb
  ),
  (
    '76586a07-768f-4a39-beca-60cebb4ff7d9',
    'public-media',
    'https://images.panda-atlas.example/meng-lan-cover.jpg',
    'Meng Lan portrait',
    'Panda Atlas Editorial',
    'Panda Atlas',
    'editorial-reference',
    '{"surface":"profile"}'::jsonb
  ),
  (
    '16d5d7c3-a31d-4725-9dda-7b1ec71f5370',
    'public-media',
    'https://images.panda-atlas.example/bi-li-cover.jpg',
    'Bi Li archive cover',
    'Panda Atlas Archive',
    'Panda Atlas',
    'editorial-reference',
    '{"surface":"archive"}'::jsonb
  ),
  (
    'b2ad45f7-5e8d-4890-b207-5f3e7f850cc1',
    'public-media',
    'https://images.panda-atlas.example/fu-bao-cover.jpg',
    'Fu Bao portrait',
    'Panda Atlas Editorial',
    'Panda Atlas',
    'editorial-reference',
    '{"surface":"profile"}'::jsonb
  ),
  (
    '9f6ee5ad-e362-40d5-9cf7-62366bce0b02',
    'public-media',
    'https://images.panda-atlas.example/yun-chuan-cover.jpg',
    'Yun Chuan portrait',
    'Panda Atlas Editorial',
    'Panda Atlas',
    'editorial-reference',
    '{"surface":"profile"}'::jsonb
  ),
  (
    'f5018283-f999-4b67-a502-c4cdb2a5dfc6',
    'public-media',
    'https://images.panda-atlas.example/jin-hu-cover.jpg',
    'Jin Hu portrait',
    'Panda Atlas Editorial',
    'Panda Atlas',
    'editorial-reference',
    '{"surface":"profile"}'::jsonb
  )
on conflict (id) do update set
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  title = excluded.title,
  photographer = excluded.photographer,
  copyright_text = excluded.copyright_text,
  license = excluded.license,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.panda_media (
  panda_id,
  media_id,
  is_cover,
  display_order
) values
  ('1d08f72f-7550-42e9-a4d5-bd74bc505955', 'c9b7df0b-9f6e-4c82-bf3d-fdbf34d0c101', true, 0),
  ('e2f0ff4a-4a98-413a-a0d2-64e12d68db43', '76586a07-768f-4a39-beca-60cebb4ff7d9', true, 0),
  ('4e0e5e7d-02af-480d-b3b2-2d25a6211f4b', '16d5d7c3-a31d-4725-9dda-7b1ec71f5370', true, 0),
  ('31d1f8be-7b95-4f0d-8f65-1e030fd22d71', 'b2ad45f7-5e8d-4890-b207-5f3e7f850cc1', true, 0),
  ('89264f73-d0e2-44e0-aad6-8d8fca58f879', '9f6ee5ad-e362-40d5-9cf7-62366bce0b02', true, 0),
  ('53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7', 'f5018283-f999-4b67-a502-c4cdb2a5dfc6', true, 0)
on conflict (panda_id, media_id) do update set
  is_cover = excluded.is_cover,
  display_order = excluded.display_order;

commit;
