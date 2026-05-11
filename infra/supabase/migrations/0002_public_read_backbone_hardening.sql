begin;

create index if not exists idx_sightings_habitat_panda
  on public.sightings using btree (habitat_id, panda_id);

create index if not exists idx_habitats_level
  on public.habitats using btree (level);

create index if not exists idx_distribution_snapshots_date
  on public.distribution_snapshots using btree (snapshot_date desc);

commit;
