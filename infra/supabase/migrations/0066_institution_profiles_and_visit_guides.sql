-- Fan-facing visitor content for zoos and breeding centers. An institution carries a profile (what
-- kind of place it is, a short introduction, its website and live camera); each facility carries a
-- visit guide (opening hours, admission, where the pandas are, tips). Both are dated and sourced,
-- because hours and prices change. Expand only: nullable columns the running API does not select.

begin;

alter table place.institutions
  add column if not exists profile jsonb
    check (profile is null or jsonb_typeof(profile) = 'object');

alter table place.places
  add column if not exists visit_guide jsonb
    check (visit_guide is null or jsonb_typeof(visit_guide) = 'object'),
  add constraint places_visit_guide_facility_only
    check (visit_guide is null or place_type = 'facility');

comment on column place.institutions.profile is
  'Public institution profile: kind, bilingual summary, website, live camera link, verifiedOn and sourceUrls.';
comment on column place.places.visit_guide is
  'Public visit guide for a facility: bilingual address, opening hours, admission, panda area and tips, with verifiedOn and sourceUrls.';

alter table public_read.institutions
  add column if not exists profile jsonb
    check (profile is null or jsonb_typeof(profile) = 'object');

alter table public_read.places
  add column if not exists visit_guide jsonb
    check (visit_guide is null or jsonb_typeof(visit_guide) = 'object');

commit;
