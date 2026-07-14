-- Panda Atlas Cloudflare D1 seed.
-- Mirrors the public-read baseline from infra/supabase/seed/0002_atlas_catalog_seed.sql
-- using GeoJSON text plus bbox columns instead of PostGIS geometries.

pragma foreign_keys = on;

insert into habitats (
  id, code, name, province, level, area_km2, center_lng, center_lat,
  boundary_geojson, boundary_r2_key, min_lng, min_lat, max_lng, max_lat, description
) values
  (
    '245b64cc-7304-4d4a-b818-e30e30126e8c', 'MS-001', 'Minshan Habitat', 'Sichuan',
    'national', 1200.00, 103.60, 31.30,
    '{"type":"MultiPolygon","coordinates":[[[[103.2,30.9],[104.0,30.9],[104.0,31.7],[103.2,31.7],[103.2,30.9]]]]}',
    null, 103.2, 30.9, 104.0, 31.7,
    'National habitat anchor for the public atlas baseline.'
  ),
  (
    '08e2f4a3-0eaa-4c6a-a7e2-c2dc8cf3b871', 'DJ-001', 'Dujiangyan Habitat', 'Sichuan',
    'municipal', 220.00, 103.64, 30.99,
    '{"type":"MultiPolygon","coordinates":[[[[103.4,30.8],[103.9,30.8],[103.9,31.2],[103.4,31.2],[103.4,30.8]]]]}',
    null, 103.4, 30.8, 103.9, 31.2,
    'Dujiangyan rehabilitation and visitor-education habitat.'
  ),
  (
    '73d0c38d-fce6-4264-b636-37e6526e1989', 'WL-001', 'Wolong Habitat', 'Sichuan',
    'national', 840.00, 103.15, 30.95,
    '{"type":"MultiPolygon","coordinates":[[[[102.7,30.4],[103.6,30.4],[103.6,31.2],[102.7,31.2],[102.7,30.4]]]]}',
    null, 102.7, 30.4, 103.6, 31.2,
    'Wolong habitat used for lineage-linked conservation records.'
  ),
  (
    '9305f098-0d57-4706-b998-fa52ea08db0d', 'BFX-001', 'Bifengxia Habitat', 'Sichuan',
    'national', 410.00, 103.04, 30.06,
    '{"type":"MultiPolygon","coordinates":[[[[102.7,29.8],[103.3,29.8],[103.3,30.3],[102.7,30.3],[102.7,29.8]]]]}',
    null, 102.7, 29.8, 103.3, 30.3,
    'Breeding and rescue habitat used in the maternal branch records.'
  ),
  (
    '4fd709b8-23a9-4bf8-b302-40a65b0def01', 'QL-001', 'Qinling Habitat', 'Shaanxi',
    'national', 980.00, 107.90, 33.80,
    '{"type":"MultiPolygon","coordinates":[[[[107.4,33.3],[108.4,33.3],[108.4,34.2],[107.4,34.2],[107.4,33.3]]]]}',
    null, 107.4, 33.3, 108.4, 34.2,
    'Northwestern habitat anchor for Qinling-linked public profiles.'
  ),
  (
    'd6f99066-62f2-45d8-901d-a6f131f7d1de', 'INTL-001', 'International Collaboration Zone', null,
    'cooperation', 100.00, 104.00, 31.00,
    '{"type":"MultiPolygon","coordinates":[[[[103.8,30.8],[104.2,30.8],[104.2,31.2],[103.8,31.2],[103.8,30.8]]]]}',
    null, 103.8, 30.8, 104.2, 31.2,
    'International holding zone used for collaboration and archive records.'
  )
on conflict(id) do update set
  code = excluded.code,
  name = excluded.name,
  province = excluded.province,
  level = excluded.level,
  area_km2 = excluded.area_km2,
  center_lng = excluded.center_lng,
  center_lat = excluded.center_lat,
  boundary_geojson = excluded.boundary_geojson,
  boundary_r2_key = excluded.boundary_r2_key,
  min_lng = excluded.min_lng,
  min_lat = excluded.min_lat,
  max_lng = excluded.max_lng,
  max_lat = excluded.max_lat,
  description = excluded.description,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

insert into pandas (
  id, slug, name_zh, name_en, gender, birth_date, death_date, status, birthplace,
  current_location, father_id, mother_id, intro, tags_json, is_featured
) values
  (
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b', 'bi-li', '比力', 'Bi Li', 'male',
    '1990-09-16', null, 'alive', 'Dujiangyan Panda Valley', 'Dujiangyan Panda Valley',
    null, null,
    'Senior male with long-running archival value across breeding and behavior records.',
    '["featured","archive","founder"]', 1
  ),
  (
    'b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df', 'hua-mei', '华美', 'Hua Mei', 'female',
    '1999-08-21', '2022-11-17', 'deceased', 'San Diego Zoo', 'Historical archive',
    null, null,
    'Historic female profile used as a stable lineage reference anchor.',
    '["archive","founder","lineage"]', 0
  ),
  (
    '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e', 'xi-yue', '喜月', 'Xi Yue', 'female',
    '2010-03-14', '2024-01-05', 'deceased', 'Chengdu Research Base', 'Historical archive',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b', 'b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df',
    'Archived female with complete maternal-line notes and stable reference value.',
    '["archive","maternal-line","lineage"]', 0
  ),
  (
    'a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f', 'zhen-zhen', '珍珍', 'Zhen Zhen', 'female',
    '2007-08-03', null, 'alive', 'San Diego Zoo', 'International Collaboration Center',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b', 'b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df',
    'Internationally documented female with complete breeding and transfer records.',
    '["featured","international","breeding"]', 1
  ),
  (
    '6f61fd4f-1c4d-4db0-8f10-67ea58f98f80', 'qing-shan', '青山', 'Qing Shan', 'male',
    '2017-05-02', null, 'alive', 'Qinling Science Park', 'Qinling Science Park',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b', '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e',
    'Behaviorally steady male used as a reliable connector between public family branches.',
    '["research","connector","steady"]', 0
  ),
  (
    '89264f73-d0e2-44e0-aad6-8d8fca58f879', 'yun-chuan', '云川', 'Yun Chuan', 'male',
    '2019-06-16', null, 'alive', 'Chengdu Research Base', 'Chengdu Research Base',
    '6f61fd4f-1c4d-4db0-8f10-67ea58f98f80', 'a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f',
    'Core male branch in the current public atlas, linking archived lines to current profiles.',
    '["featured","core-branch","public-profile"]', 1
  ),
  (
    '53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7', 'jin-hu', '金虎', 'Jin Hu', 'female',
    '2018-08-11', null, 'alive', 'Bifengxia Base', 'Bifengxia Base',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b', '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e',
    'Female profile with strong adaptation notes and good public-facing relation coverage.',
    '["featured","maternal-branch","adaptive"]', 1
  ),
  (
    'e2f0ff4a-4a98-413a-a0d2-64e12d68db43', 'meng-lan', '萌兰', 'Meng Lan', 'male',
    '2015-07-04', null, 'alive', 'Beijing Zoo', 'Beijing Zoo',
    '6f61fd4f-1c4d-4db0-8f10-67ea58f98f80', 'a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f',
    'Highly recognizable male known for activity and exploratory behavior.',
    '["featured","active","public-attention"]', 1
  ),
  (
    '95f8e2e0-a8f1-45e5-8b4f-bdb7235d7ce2', 'xin-bao', '鑫宝', 'Xin Bao', 'male',
    '2020-09-02', null, 'alive', 'Dujiangyan Panda Valley', 'Dujiangyan Panda Valley',
    '89264f73-d0e2-44e0-aad6-8d8fca58f879', '53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7',
    'Younger male with a pronounced daytime activity window and clear public profile identity.',
    '["active","monitoring","young-profile"]', 0
  ),
  (
    '1d08f72f-7550-42e9-a4d5-bd74bc505955', 'he-hua', '和花', 'He Hua', 'female',
    '2020-07-04', null, 'alive', 'Chengdu Research Base', 'Chengdu Research Base',
    '89264f73-d0e2-44e0-aad6-8d8fca58f879', '53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7',
    'Current focus panda whose public profile anchors the profile-to-lineage journey.',
    '["featured","star-profile","social"]', 1
  ),
  (
    '31d1f8be-7b95-4f0d-8f65-1e030fd22d71', 'fu-bao', '福宝', 'Fu Bao', 'female',
    '2020-07-20', null, 'alive', 'Everland Panda World', 'Wolong Shenshuping Base',
    'e2f0ff4a-4a98-413a-a0d2-64e12d68db43', '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e',
    'Widely followed female with a strong youth-growth narrative and stable archive potential.',
    '["featured","youth-archive","cross-base"]', 1
  )
on conflict(id) do update set
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
  tags_json = excluded.tags_json,
  is_featured = excluded.is_featured,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

insert into sightings (
  id, panda_id, habitat_id, observed_at, source_type, confidence, longitude, latitude, note, source_ref
) values
  ('7d7704d1-3b5d-4f0d-a698-df418f7ce5a1', '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b', '08e2f4a3-0eaa-4c6a-a7e2-c2dc8cf3b871', '2026-02-10T10:00:00Z', 'research', 0.97, 103.66, 30.98, 'Archival male baseline record.', 'ATLAS-S-001'),
  ('d38a5f0e-94c3-4f4d-b6d6-cabf6cd8a5f2', 'b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df', '245b64cc-7304-4d4a-b818-e30e30126e8c', '2025-08-12T09:00:00Z', 'research', 0.90, 103.58, 31.22, 'Historical founder reference record.', 'ATLAS-S-002'),
  ('2fca6408-30d4-4710-920e-6a0702057598', '7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e', '245b64cc-7304-4d4a-b818-e30e30126e8c', '2024-02-18T11:30:00Z', 'research', 0.91, 103.54, 31.18, 'Maternal branch archive record.', 'ATLAS-S-003'),
  ('7828e4af-17f7-4b0a-8fe8-d68c38ea08f9', 'a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f', 'd6f99066-62f2-45d8-901d-a6f131f7d1de', '2026-01-19T08:20:00Z', 'research', 0.94, 104.01, 31.01, 'International collaboration profile anchor.', 'ATLAS-S-004'),
  ('ec6d82bc-5226-489d-8c44-936623c85a49', '6f61fd4f-1c4d-4db0-8f10-67ea58f98f80', '4fd709b8-23a9-4bf8-b302-40a65b0def01', '2026-01-08T07:50:00Z', 'research', 0.95, 107.92, 33.82, 'Connector branch habitat observation.', 'ATLAS-S-005'),
  ('28c7d3a7-952a-43b8-af15-1f48e7fba2d3', '89264f73-d0e2-44e0-aad6-8d8fca58f879', '245b64cc-7304-4d4a-b818-e30e30126e8c', '2026-02-20T14:30:00Z', 'research', 0.96, 103.61, 31.27, 'Core branch monitoring record.', 'ATLAS-S-006'),
  ('4d9d7f74-a39d-4418-84b0-8f2eab5d2f47', '53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7', '9305f098-0d57-4706-b998-fa52ea08db0d', '2026-01-30T09:45:00Z', 'research', 0.95, 103.03, 30.05, 'Maternal branch Bifengxia record.', 'ATLAS-S-007'),
  ('a10c3fdd-d358-4272-b276-56572c403f37', 'e2f0ff4a-4a98-413a-a0d2-64e12d68db43', '4fd709b8-23a9-4bf8-b302-40a65b0def01', '2026-02-02T12:05:00Z', 'captive', 0.93, 107.95, 33.80, 'Beijing public attention profile tied to Qinling habitat cluster.', 'ATLAS-S-008'),
  ('378ecb98-bfbe-4ddd-a6cb-ec7e3930f7f2', '95f8e2e0-a8f1-45e5-8b4f-bdb7235d7ce2', '08e2f4a3-0eaa-4c6a-a7e2-c2dc8cf3b871', '2026-02-24T10:40:00Z', 'research', 0.94, 103.67, 30.97, 'Young male daytime activity record.', 'ATLAS-S-009'),
  ('2afed4bb-d3bf-4c17-bce5-7f2f9a6930a0', '1d08f72f-7550-42e9-a4d5-bd74bc505955', '245b64cc-7304-4d4a-b818-e30e30126e8c', '2026-03-01T13:15:00Z', 'research', 0.98, 103.63, 31.29, 'Current public-profile verification record.', 'ATLAS-S-010'),
  ('7004d0e1-1f66-4ab7-85ee-c435e54ef4ce', '31d1f8be-7b95-4f0d-8f65-1e030fd22d71', '73d0c38d-fce6-4264-b636-37e6526e1989', '2026-02-28T15:05:00Z', 'research', 0.95, 103.10, 30.92, 'Wolong-linked youth archive record.', 'ATLAS-S-011')
on conflict(id) do update set
  panda_id = excluded.panda_id,
  habitat_id = excluded.habitat_id,
  observed_at = excluded.observed_at,
  source_type = excluded.source_type,
  confidence = excluded.confidence,
  longitude = excluded.longitude,
  latitude = excluded.latitude,
  note = excluded.note,
  source_ref = excluded.source_ref,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

insert into distribution_snapshots (id, snapshot_date, version, notes, geojson_r2_prefix) values
  ('5f775297-b2ed-4d5f-bf17-2defd2b60573', '2026-03-05', 'atlas-2026-03-05', 'Latest atlas snapshot used by public-read smoke and stats.', 'distribution/2026-03-05/'),
  ('8b0e5c24-d0fe-4a77-8a5d-673e5b5b8f0a', '2025-12-05', 'atlas-2025-12-05', 'Previous wild-distribution comparison snapshot.', 'distribution/2025-12-05/'),
  ('3ddc0cf7-4dc9-44e0-bc81-318e9b9d6211', '2025-09-05', 'atlas-2025-09-05', 'Older seasonal wild-distribution comparison snapshot.', 'distribution/2025-09-05/')
on conflict(id) do update set
  snapshot_date = excluded.snapshot_date,
  version = excluded.version,
  notes = excluded.notes,
  geojson_r2_prefix = excluded.geojson_r2_prefix;

insert into distribution_cells (
  id, snapshot_id, layer, cell_code, density, geometry_geojson, geometry_r2_key,
  min_lng, min_lat, max_lng, max_lat
) values
  (10001, '5f775297-b2ed-4d5f-bf17-2defd2b60573', 'wild', 'QXL-001', 14.2, '{"type":"MultiPolygon","coordinates":[[[[103.5,31.2],[103.9,31.2],[103.9,31.6],[103.5,31.6],[103.5,31.2]]]]}', null, 103.5, 31.2, 103.9, 31.6),
  (10002, '8b0e5c24-d0fe-4a77-8a5d-673e5b5b8f0a', 'wild', 'MS-003', 10.6, '{"type":"MultiPolygon","coordinates":[[[[104.2,30.8],[104.6,30.8],[104.6,31.1],[104.2,31.1],[104.2,30.8]]]]}', null, 104.2, 30.8, 104.6, 31.1),
  (10003, '3ddc0cf7-4dc9-44e0-bc81-318e9b9d6211', 'wild', 'LM-011', 8.8, '{"type":"MultiPolygon","coordinates":[[[[103.2,30.5],[103.6,30.5],[103.6,30.9],[103.2,30.9],[103.2,30.5]]]]}', null, 103.2, 30.5, 103.6, 30.9),
  (10004, '5f775297-b2ed-4d5f-bf17-2defd2b60573', 'captive', 'CD-010', 6.1, '{"type":"MultiPolygon","coordinates":[[[[104.6,31.2],[104.9,31.2],[104.9,31.5],[104.6,31.5],[104.6,31.2]]]]}', null, 104.6, 31.2, 104.9, 31.5)
on conflict(id) do update set
  snapshot_id = excluded.snapshot_id,
  layer = excluded.layer,
  cell_code = excluded.cell_code,
  density = excluded.density,
  geometry_geojson = excluded.geometry_geojson,
  geometry_r2_key = excluded.geometry_r2_key,
  min_lng = excluded.min_lng,
  min_lat = excluded.min_lat,
  max_lng = excluded.max_lng,
  max_lat = excluded.max_lat;

insert into media_assets (
  id, storage_bucket, storage_path, title, photographer, copyright_text, license, metadata_json
) values
  ('c9b7df0b-9f6e-4c82-bf3d-fdbf34d0c101', 'public-media', 'https://images.panda-atlas.example/he-hua-cover.jpg', 'He Hua portrait', 'Panda Atlas Editorial', 'Panda Atlas', 'editorial-reference', '{"surface":"profile"}'),
  ('76586a07-768f-4a39-beca-60cebb4ff7d9', 'public-media', 'https://images.panda-atlas.example/meng-lan-cover.jpg', 'Meng Lan portrait', 'Panda Atlas Editorial', 'Panda Atlas', 'editorial-reference', '{"surface":"profile"}'),
  ('16d5d7c3-a31d-4725-9dda-7b1ec71f5370', 'public-media', 'https://images.panda-atlas.example/bi-li-cover.jpg', 'Bi Li archive cover', 'Panda Atlas Archive', 'Panda Atlas', 'editorial-reference', '{"surface":"archive"}'),
  ('b2ad45f7-5e8d-4890-b207-5f3e7f850cc1', 'public-media', 'https://images.panda-atlas.example/fu-bao-cover.jpg', 'Fu Bao portrait', 'Panda Atlas Editorial', 'Panda Atlas', 'editorial-reference', '{"surface":"profile"}'),
  ('9f6ee5ad-e362-40d5-9cf7-62366bce0b02', 'public-media', 'https://images.panda-atlas.example/yun-chuan-cover.jpg', 'Yun Chuan portrait', 'Panda Atlas Editorial', 'editorial-reference', 'editorial-reference', '{"surface":"profile"}'),
  ('f5018283-f999-4b67-a502-c4cdb2a5dfc6', 'public-media', 'https://images.panda-atlas.example/jin-hu-cover.jpg', 'Jin Hu portrait', 'Panda Atlas Editorial', 'Panda Atlas', 'editorial-reference', '{"surface":"profile"}')
on conflict(id) do update set
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  title = excluded.title,
  photographer = excluded.photographer,
  copyright_text = excluded.copyright_text,
  license = excluded.license,
  metadata_json = excluded.metadata_json,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

insert into panda_media (panda_id, media_id, is_cover, display_order) values
  ('1d08f72f-7550-42e9-a4d5-bd74bc505955', 'c9b7df0b-9f6e-4c82-bf3d-fdbf34d0c101', 1, 0),
  ('e2f0ff4a-4a98-413a-a0d2-64e12d68db43', '76586a07-768f-4a39-beca-60cebb4ff7d9', 1, 0),
  ('4e0e5e7d-02af-480d-b3b2-2d25a6211f4b', '16d5d7c3-a31d-4725-9dda-7b1ec71f5370', 1, 0),
  ('31d1f8be-7b95-4f0d-8f65-1e030fd22d71', 'b2ad45f7-5e8d-4890-b207-5f3e7f850cc1', 1, 0),
  ('89264f73-d0e2-44e0-aad6-8d8fca58f879', '9f6ee5ad-e362-40d5-9cf7-62366bce0b02', 1, 0),
  ('53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7', 'f5018283-f999-4b67-a502-c4cdb2a5dfc6', 1, 0)
on conflict(panda_id, media_id) do update set
  is_cover = excluded.is_cover,
  display_order = excluded.display_order;

-- Mei Xiang–Tian Tian trusted identity public projection.
insert into pandas (
  id, slug, name_zh, name_en, gender, birth_date, death_date, status, birthplace,
  current_location, father_id, mother_id, intro, tags_json, is_featured
) values
  (
    '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mei-xiang', '美香', 'Mei Xiang', 'female',
    '1998-07-22', null, 'alive', 'Wolong, China', '中国——具体场所尚未公开核实',
    null, null,
    '曾生活于史密森国家动物园的雌性大熊猫，是泰山、宝宝、贝贝和小奇迹的母亲。',
    '["trusted-identity","golden-dataset"]', 0
  ),
  (
    '38cd1cad-3e34-5511-bc35-a091ece74e11', 'tian-tian', '添添', 'Tian Tian', 'male',
    '1997-08-27', null, 'alive', 'Wolong, China', '中国——具体场所尚未公开核实',
    null, null,
    '曾生活于史密森国家动物园的雄性大熊猫，是泰山、宝宝、贝贝和小奇迹的父亲。',
    '["trusted-identity","golden-dataset"]', 0
  )
on conflict(id) do update set
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
  tags_json = excluded.tags_json,
  is_featured = excluded.is_featured,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

insert into evidence_sources (
  id, publisher, title, url, published_at, last_verified_at, language_tag,
  access_state, evidence_tier, public_summary
) values
  (
    'src_smithsonian_agreement_2020',
    'Smithsonian National Zoo and Conservation Biology Institute',
    'Smithsonian extends giant panda agreement',
    'https://nationalzoo.si.edu/news/smithsonians-national-zoo-and-conservation-biology-institute-extends-giant-panda-agreement',
    '2020-12-07', '2026-05-09', 'en', 'accessible', 'primary_fact',
    'Family birth dates and the planned 2023 return context.'
  ),
  (
    'src_smithsonian_history',
    'Smithsonian National Zoo and Conservation Biology Institute',
    'History of Giant Pandas at the Smithsonian National Zoo and Conservation Biology Institute',
    'https://nationalzoo.si.edu/animals/history-giant-pandas-zoo',
    null, '2026-05-09', 'en', 'accessible', 'primary_fact',
    'Smithsonian panda timeline, births, returns, and the 2023 departure.'
  ),
  (
    'src_smithsonian_giant_panda_faq',
    'Smithsonian National Zoo and Conservation Biology Institute',
    'Giant Panda FAQs',
    'https://nationalzoo.si.edu/animals/giant-panda-faqs',
    null, '2026-05-09', 'en', 'accessible', 'primary_fact',
    'Bao Li identity and reviewed maternal parentage.'
  )
on conflict(id) do update set
  publisher = excluded.publisher,
  title = excluded.title,
  url = excluded.url,
  published_at = excluded.published_at,
  last_verified_at = excluded.last_verified_at,
  language_tag = excluded.language_tag,
  access_state = excluded.access_state,
  evidence_tier = excluded.evidence_tier,
  public_summary = excluded.public_summary;

insert into panda_names (
  id, panda_id, language_tag, name_kind, value, normalized_value, is_primary
) values
  ('a0000000-0000-5000-8000-000000000001', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'zh-Hans', 'official', '美香', '美香', 1),
  ('a0000000-0000-5000-8000-000000000002', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'en', 'official_romanization', 'Mei Xiang', 'meixiang', 1),
  ('a0000000-0000-5000-8000-000000000003', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'pinyin', 'pinyin', 'Měixiāng', 'meixiang', 1),
  ('a0000000-0000-5000-8000-000000000004', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'en', 'historic_spelling', 'Mei-Xiang', 'meixiang', 0),
  ('a0000000-0000-5000-8000-000000000011', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'zh-Hans', 'official', '添添', '添添', 1),
  ('a0000000-0000-5000-8000-000000000012', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'en', 'official_romanization', 'Tian Tian', 'tiantian', 1),
  ('a0000000-0000-5000-8000-000000000013', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'pinyin', 'pinyin', 'Tiāntiān', 'tiantian', 1),
  ('a0000000-0000-5000-8000-000000000014', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'en', 'historic_spelling', 'Tian-Tian', 'tiantian', 0)
on conflict(id) do update set
  panda_id = excluded.panda_id,
  language_tag = excluded.language_tag,
  name_kind = excluded.name_kind,
  value = excluded.value,
  normalized_value = excluded.normalized_value,
  is_primary = excluded.is_primary;

insert into panda_name_sources (panda_name_id, source_id) values
  ('a0000000-0000-5000-8000-000000000001', 'src_smithsonian_history'),
  ('a0000000-0000-5000-8000-000000000002', 'src_smithsonian_history'),
  ('a0000000-0000-5000-8000-000000000003', 'src_smithsonian_history'),
  ('a0000000-0000-5000-8000-000000000004', 'src_smithsonian_history'),
  ('a0000000-0000-5000-8000-000000000011', 'src_smithsonian_history'),
  ('a0000000-0000-5000-8000-000000000012', 'src_smithsonian_history'),
  ('a0000000-0000-5000-8000-000000000013', 'src_smithsonian_history'),
  ('a0000000-0000-5000-8000-000000000014', 'src_smithsonian_history')
on conflict do nothing;

insert into panda_slugs (id, panda_id, slug, slug_kind) values
  ('b0000000-0000-5000-8000-000000000001', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mei-xiang', 'canonical'),
  ('b0000000-0000-5000-8000-000000000002', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'meixiang', 'legacy'),
  ('b0000000-0000-5000-8000-000000000003', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mei_xiang', 'legacy'),
  ('b0000000-0000-5000-8000-000000000011', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'tian-tian', 'canonical'),
  ('b0000000-0000-5000-8000-000000000012', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'tiantian', 'legacy'),
  ('b0000000-0000-5000-8000-000000000013', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'tian_tian', 'legacy')
on conflict(id) do update set
  panda_id = excluded.panda_id,
  slug = excluded.slug,
  slug_kind = excluded.slug_kind;

insert into panda_slug_sources (panda_slug_id, source_id) values
  ('b0000000-0000-5000-8000-000000000001', 'src_smithsonian_history'),
  ('b0000000-0000-5000-8000-000000000002', 'src_smithsonian_history'),
  ('b0000000-0000-5000-8000-000000000003', 'src_smithsonian_history'),
  ('b0000000-0000-5000-8000-000000000011', 'src_smithsonian_history'),
  ('b0000000-0000-5000-8000-000000000012', 'src_smithsonian_history'),
  ('b0000000-0000-5000-8000-000000000013', 'src_smithsonian_history')
on conflict do nothing;

insert into panda_external_identifiers (
  id, panda_id, system, value, normalized_value
) values
  ('c0000000-0000-5000-8000-000000000001', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'smithsonian_history_key', 'mei-xiang', 'meixiang'),
  ('c0000000-0000-5000-8000-000000000011', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'smithsonian_history_key', 'tian-tian', 'tiantian')
on conflict(id) do update set
  panda_id = excluded.panda_id,
  system = excluded.system,
  value = excluded.value,
  normalized_value = excluded.normalized_value;

insert into panda_external_identifier_sources (external_identifier_id, source_id) values
  ('c0000000-0000-5000-8000-000000000001', 'src_smithsonian_history'),
  ('c0000000-0000-5000-8000-000000000011', 'src_smithsonian_history')
on conflict do nothing;

insert into fact_assertions (
  id, panda_id, field_key, value_json, certainty, last_verified_at
) values
  ('fact-mei-xiang-birth-date', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'birth_date', '"1998-07-22"', 'confirmed', '2026-05-09'),
  ('fact-mei-xiang-current-place', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'current_coarse_location', '"China"', 'confirmed', '2026-05-09'),
  ('fact-tian-tian-birth-date', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'birth_date', '"1997-08-27"', 'confirmed', '2026-05-09'),
  ('fact-tian-tian-current-place', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'current_coarse_location', '"China"', 'confirmed', '2026-05-09')
on conflict(id) do update set
  panda_id = excluded.panda_id,
  field_key = excluded.field_key,
  value_json = excluded.value_json,
  certainty = excluded.certainty,
  last_verified_at = excluded.last_verified_at;

insert into fact_assertion_sources (assertion_id, source_id, stance) values
  ('fact-mei-xiang-birth-date', 'src_smithsonian_agreement_2020', 'supports'),
  ('fact-mei-xiang-current-place', 'src_smithsonian_history', 'supports'),
  ('fact-tian-tian-birth-date', 'src_smithsonian_agreement_2020', 'supports'),
  ('fact-tian-tian-current-place', 'src_smithsonian_history', 'supports')
on conflict do nothing;

insert into public_fact_conclusions (
  id, panda_id, field_key, value_json, status, last_verified_at,
  candidate_values_json, superseded_values_json, conclusion_version, is_current
) values
  ('d0000000-0000-5000-8000-000000000001', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'birth_date', '"1998-07-22"', 'confirmed', '2026-05-09', '[]', '[]', 1, 1),
  ('d0000000-0000-5000-8000-000000000002', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'current_coarse_location', '"China"', 'confirmed', '2026-05-09', '[]', '[]', 1, 1),
  ('d0000000-0000-5000-8000-000000000011', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'birth_date', '"1997-08-27"', 'confirmed', '2026-05-09', '[]', '[]', 1, 1),
  ('d0000000-0000-5000-8000-000000000012', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'current_coarse_location', '"China"', 'confirmed', '2026-05-09', '[]', '[]', 1, 1)
on conflict(id) do update set
  panda_id = excluded.panda_id,
  field_key = excluded.field_key,
  value_json = excluded.value_json,
  status = excluded.status,
  last_verified_at = excluded.last_verified_at,
  candidate_values_json = excluded.candidate_values_json,
  superseded_values_json = excluded.superseded_values_json,
  conclusion_version = excluded.conclusion_version,
  is_current = excluded.is_current;

insert into public_fact_conclusion_assertions (conclusion_id, assertion_id) values
  ('d0000000-0000-5000-8000-000000000001', 'fact-mei-xiang-birth-date'),
  ('d0000000-0000-5000-8000-000000000002', 'fact-mei-xiang-current-place'),
  ('d0000000-0000-5000-8000-000000000011', 'fact-tian-tian-birth-date'),
  ('d0000000-0000-5000-8000-000000000012', 'fact-tian-tian-current-place')
on conflict do nothing;

-- Reviewed lineage, residency, and event public projection. Compatibility
-- father_id/mother_id columns remain null for these trusted archive records.
insert into pandas (
  id, slug, name_zh, name_en, gender, birth_date, death_date, status, birthplace,
  current_location, father_id, mother_id, intro, tags_json, is_featured
) values
  ('96d00a39-7865-55db-b5c2-f339ef692258', 'tai-shan', '泰山', 'Tai Shan', 'male', '2005-07-09', null, 'alive', 'Smithsonian National Zoo', 'China', null, null, null, '["golden-dataset"]', 0),
  ('7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', 'bao-bao', '宝宝', 'Bao Bao', 'female', '2013-08-23', null, 'alive', 'Smithsonian National Zoo', 'China', null, null, null, '["golden-dataset"]', 0),
  ('1a05a5dc-1926-5355-9d81-c2a43189d50b', 'bei-bei', '贝贝', 'Bei Bei', 'male', '2015-08-22', null, 'alive', 'Smithsonian National Zoo', 'China', null, null, null, '["golden-dataset"]', 0),
  ('926abc78-1e79-55c6-b24a-d33b4e5f6443', 'xiao-qi-ji', '小奇迹', 'Xiao Qi Ji', 'male', '2020-08-21', null, 'alive', 'Smithsonian National Zoo', 'China', null, null, null, '["golden-dataset"]', 0),
  ('434e10e3-7ba0-5de7-a59e-d3984524c58c', 'bao-li', '宝力', 'Bao Li', 'male', null, null, 'alive', null, null, null, null, null, '["golden-dataset"]', 0)
on conflict(id) do update set
  slug = excluded.slug,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  gender = excluded.gender,
  birth_date = excluded.birth_date,
  status = excluded.status,
  current_location = excluded.current_location,
  father_id = null,
  mother_id = null;

insert into institutions (id, name_zh, name_en, publication_status) values
  ('f141af52-52c7-5d2f-a01a-2ce0c547b920', '史密森国家动物园与保护生物学研究所', 'Smithsonian National Zoo and Conservation Biology Institute', 'published')
on conflict(id) do update set
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  publication_status = excluded.publication_status;

insert into facilities (id, institution_id, name_zh, name_en, country_code, publication_status) values
  ('afb0f227-dd5e-5076-88e3-74e9807a6049', 'f141af52-52c7-5d2f-a01a-2ce0c547b920', '史密森国家动物园', 'Smithsonian National Zoo', 'US', 'published'),
  ('60c7e1a3-d286-5366-8d41-32c11df58b5c', null, '中国大熊猫保护研究中心卧龙耿达基地', 'CCRCGP Wolong Gengda Base', 'CN', 'published'),
  ('89f620b2-37d0-51ba-aafa-6844404a5b2c', null, '中国大熊猫保护研究中心卧龙神树坪基地', 'CCRCGP Wolong Shenshuping Base', 'CN', 'published')
on conflict(id) do update set
  institution_id = excluded.institution_id,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  country_code = excluded.country_code,
  publication_status = excluded.publication_status;

insert into parentage_assertions (id, child_id, parent_id, parent_role, status, publication_status) values
  ('parent-tai-shan-father', '96d00a39-7865-55db-b5c2-f339ef692258', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'father', 'confirmed', 'published'),
  ('parent-tai-shan-mother', '96d00a39-7865-55db-b5c2-f339ef692258', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mother', 'confirmed', 'published'),
  ('parent-bao-bao-father', '7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'father', 'confirmed', 'published'),
  ('parent-bao-bao-mother', '7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mother', 'confirmed', 'published'),
  ('parent-bei-bei-father', '1a05a5dc-1926-5355-9d81-c2a43189d50b', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'father', 'confirmed', 'published'),
  ('parent-bei-bei-mother', '1a05a5dc-1926-5355-9d81-c2a43189d50b', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mother', 'confirmed', 'published'),
  ('parent-xiao-qi-ji-father', '926abc78-1e79-55c6-b24a-d33b4e5f6443', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'father', 'confirmed', 'published'),
  ('parent-xiao-qi-ji-mother', '926abc78-1e79-55c6-b24a-d33b4e5f6443', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'mother', 'confirmed', 'published'),
  ('parent-bao-li-mother', '434e10e3-7ba0-5de7-a59e-d3984524c58c', '7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', 'mother', 'confirmed', 'published')
on conflict(id) do update set
  child_id = excluded.child_id,
  parent_id = excluded.parent_id,
  parent_role = excluded.parent_role,
  status = excluded.status,
  publication_status = excluded.publication_status;

insert into parentage_assertion_sources (assertion_id, source_id)
select id, case
  when id = 'parent-bao-li-mother' then 'src_smithsonian_giant_panda_faq'
  else 'src_smithsonian_agreement_2020'
end
from parentage_assertions
where id in (
  'parent-tai-shan-father', 'parent-tai-shan-mother',
  'parent-bao-bao-father', 'parent-bao-bao-mother',
  'parent-bei-bei-father', 'parent-bei-bei-mother',
  'parent-xiao-qi-ji-father', 'parent-xiao-qi-ji-mother',
  'parent-bao-li-mother'
)
on conflict do nothing;

insert into panda_residencies (
  id, panda_id, facility_id, coarse_location, residency_type,
  start_date, start_precision, end_date, end_precision, status, publication_status
) values
  ('res-mei-xiang-smithsonian', '2939c16f-1938-5629-928c-b36b1d5cd6ed', 'afb0f227-dd5e-5076-88e3-74e9807a6049', null, 'primary', '2000-12-06', 'day', '2023-11-08', 'day', 'confirmed', 'published'),
  ('res-mei-xiang-china', '2939c16f-1938-5629-928c-b36b1d5cd6ed', null, 'China', 'primary', '2023-11-08', 'day', null, null, 'confirmed_country_level', 'published'),
  ('res-tian-tian-smithsonian', '38cd1cad-3e34-5511-bc35-a091ece74e11', 'afb0f227-dd5e-5076-88e3-74e9807a6049', null, 'primary', '2000-12-06', 'day', '2023-11-08', 'day', 'confirmed', 'published'),
  ('res-tian-tian-china', '38cd1cad-3e34-5511-bc35-a091ece74e11', null, 'China', 'primary', '2023-11-08', 'day', null, null, 'confirmed_country_level', 'published'),
  ('res-tai-shan-china-country-level', '96d00a39-7865-55db-b5c2-f339ef692258', null, 'China', 'primary', '2010-02-04', 'day', null, null, 'confirmed_country_level', 'published'),
  ('res-bao-bao-china-country-level', '7cf4e916-4801-5b2e-b49b-4e33bb50d5d6', null, 'China', 'primary', '2017-02-21', 'day', null, null, 'confirmed_country_level', 'published'),
  ('res-bei-bei-shenshuping', '1a05a5dc-1926-5355-9d81-c2a43189d50b', '89f620b2-37d0-51ba-aafa-6844404a5b2c', null, 'primary', '2019-11-19', 'day', null, null, 'confirmed', 'published'),
  ('res-xiao-qi-ji-shenshuping', '926abc78-1e79-55c6-b24a-d33b4e5f6443', '89f620b2-37d0-51ba-aafa-6844404a5b2c', null, 'primary', '2023-11-08', 'day', null, null, 'confirmed', 'published')
on conflict(id) do update set
  panda_id = excluded.panda_id,
  facility_id = excluded.facility_id,
  coarse_location = excluded.coarse_location,
  residency_type = excluded.residency_type,
  start_date = excluded.start_date,
  start_precision = excluded.start_precision,
  end_date = excluded.end_date,
  end_precision = excluded.end_precision,
  status = excluded.status,
  publication_status = excluded.publication_status;

insert into residency_sources (residency_id, source_id)
select id, 'src_smithsonian_history'
from panda_residencies
where id in (
  'res-mei-xiang-smithsonian', 'res-mei-xiang-china',
  'res-tian-tian-smithsonian', 'res-tian-tian-china',
  'res-tai-shan-china-country-level', 'res-bao-bao-china-country-level',
  'res-bei-bei-shenshuping', 'res-xiao-qi-ji-shenshuping'
)
on conflict do nothing;

insert into domain_events (
  id, event_type, event_status, event_date, event_date_precision,
  from_facility_id, from_coarse_location, to_facility_id, to_coarse_location,
  publication_status
) values
  ('event-smithsonian-return-plan-2020', 'transfer', 'announced', '2020-12-07', 'day', 'afb0f227-dd5e-5076-88e3-74e9807a6049', null, null, 'China', 'published'),
  ('event-smithsonian-departure-2023', 'transfer', 'completed', '2023-11-08', 'day', 'afb0f227-dd5e-5076-88e3-74e9807a6049', null, null, 'China', 'published')
on conflict(id) do update set
  event_type = excluded.event_type,
  event_status = excluded.event_status,
  event_date = excluded.event_date,
  event_date_precision = excluded.event_date_precision,
  from_facility_id = excluded.from_facility_id,
  from_coarse_location = excluded.from_coarse_location,
  to_facility_id = excluded.to_facility_id,
  to_coarse_location = excluded.to_coarse_location,
  publication_status = excluded.publication_status;

insert into domain_event_participants (event_id, panda_id) values
  ('event-smithsonian-return-plan-2020', '2939c16f-1938-5629-928c-b36b1d5cd6ed'),
  ('event-smithsonian-return-plan-2020', '38cd1cad-3e34-5511-bc35-a091ece74e11'),
  ('event-smithsonian-return-plan-2020', '926abc78-1e79-55c6-b24a-d33b4e5f6443'),
  ('event-smithsonian-departure-2023', '2939c16f-1938-5629-928c-b36b1d5cd6ed'),
  ('event-smithsonian-departure-2023', '38cd1cad-3e34-5511-bc35-a091ece74e11'),
  ('event-smithsonian-departure-2023', '926abc78-1e79-55c6-b24a-d33b4e5f6443')
on conflict do nothing;

insert into domain_event_sources (event_id, source_id) values
  ('event-smithsonian-return-plan-2020', 'src_smithsonian_agreement_2020'),
  ('event-smithsonian-departure-2023', 'src_smithsonian_history')
on conflict do nothing;
