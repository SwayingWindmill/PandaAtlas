-- Revoke residual table and sequence privileges granted to public/anon/authenticated
-- on retained public PostGIS compatibility tables (TRUNCATE bypasses RLS).
begin;

revoke all on table
  public.distribution_cells,
  public.distribution_snapshots,
  public.habitats,
  public.sightings
from public, anon, authenticated;

revoke all on sequence public.distribution_cells_id_seq from public, anon, authenticated;

commit;
