-- Demo seed data for Panda Atlas
-- Safe to run repeatedly (idempotent upserts)

begin;

-- habitats
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
    'Core rehabilitation and public-education habitat around Dujiangyan.'
  ),
  (
    '245b64cc-7304-4d4a-b818-e30e30126e8c',
    'MS-001',
    'Minshan Habitat',
    'Sichuan',
    'national',
    1200.00,
    st_setsrid(st_point(103.6, 31.3), 4326),
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[103.2,30.9],[104.0,30.9],[104.0,31.7],[103.2,31.7],[103.2,30.9]]]]}'),
      4326
    ),
    'National protected habitat used as the public atlas baseline.'
  ),
  (
    '4fd709b8-23a9-4bf8-b302-40a65b0def01',
    'QL-001',
    'Qinling Habitat',
    'Shaanxi',
    'national',
    980.00,
    st_setsrid(st_point(107.9, 33.8), 4326),
    st_setsrid(
      st_geomfromgeojson('{"type":"MultiPolygon","coordinates":[[[[107.4,33.3],[108.4,33.3],[108.4,34.2],[107.4,34.2],[107.4,33.3]]]]}'),
      4326
    ),
    'Northwestern habitat sector used for Qinling-aligned records.'
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

-- demo pandas
insert into public.pandas (
  id,
  slug,
  name_zh,
  name_en,
  gender,
  birth_date,
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
    '1d08f72f-7550-42e9-a4d5-bd74bc505955',
    'he-hua',
    '和花',
    'He Hua',
    'female',
    '2020-07-04',
    'alive',
    'Chengdu Research Base',
    'Chengdu Research Base',
    null,
    null,
    'Current focus panda whose public profile anchors the profile-to-lineage journey.',
    array['featured','star-profile','social'],
    true
  ),
  (
    'e2f0ff4a-4a98-413a-a0d2-64e12d68db43',
    'meng-lan',
    '萌兰',
    'Meng Lan',
    'male',
    '2015-07-04',
    'alive',
    'Beijing Zoo',
    'Beijing Zoo',
    null,
    null,
    'Highly recognizable male known for activity and exploratory behavior.',
    array['featured','active','public-attention'],
    true
  ),
  (
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b',
    'bi-li',
    '比力',
    'Bi Li',
    'male',
    '1990-09-16',
    'alive',
    'Dujiangyan Panda Valley',
    'Dujiangyan Panda Valley',
    null,
    null,
    'Senior male with long-running archival value across breeding and behavior records.',
    array['featured','archive','founder'],
    true
  )
on conflict (id) do update set
  slug = excluded.slug,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  gender = excluded.gender,
  birth_date = excluded.birth_date,
  status = excluded.status,
  birthplace = excluded.birthplace,
  current_location = excluded.current_location,
  father_id = excluded.father_id,
  mother_id = excluded.mother_id,
  intro = excluded.intro,
  tags = excluded.tags,
  is_featured = excluded.is_featured,
  updated_at = now();

-- minimal sighting coverage
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
    '1d68500c-f5ab-4fd9-8b90-a7a788647ef9',
    '1d08f72f-7550-42e9-a4d5-bd74bc505955',
    '245b64cc-7304-4d4a-b818-e30e30126e8c',
    now() - interval '15 days',
    'research',
    0.96,
    st_setsrid(st_point(103.62, 31.28), 4326),
    'Featured public-profile habitat link.',
    'DEMO-OBS-001'
  ),
  (
    '2bd6734e-9f40-49ca-99c4-1bbceee1cf8d',
    'e2f0ff4a-4a98-413a-a0d2-64e12d68db43',
    '4fd709b8-23a9-4bf8-b302-40a65b0def01',
    now() - interval '21 days',
    'captive',
    0.94,
    st_setsrid(st_point(107.92, 33.82), 4326),
    'Qinling-aligned public record for local DB verification.',
    'DEMO-OBS-002'
  ),
  (
    '75f8c31b-bfd7-49f1-b5fb-7dc4ad307ff6',
    '4e0e5e7d-02af-480d-b3b2-2d25a6211f4b',
    '08e2f4a3-0eaa-4c6a-a7e2-c2dc8cf3b871',
    now() - interval '40 days',
    'research',
    0.97,
    st_setsrid(st_point(103.66, 30.98), 4326),
    'Foundational demo record for archival male profile.',
    'DEMO-OBS-003'
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

-- latest snapshot baseline
insert into public.distribution_snapshots (
  id,
  snapshot_date,
  version,
  notes
) values (
  '5f775297-b2ed-4d5f-bf17-2defd2b60573',
  '2026-03-05',
  'atlas-2026-03-05',
  'Latest baseline snapshot used by public-read smoke and DB verification.'
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

commit;
