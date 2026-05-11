# Panda Profile Curation

This folder is the working intake layer for Panda Atlas profile data. It is intentionally separate from `infra/supabase/seed/` so facts can be collected, sourced, reviewed, and normalized before they become importable database records.

## Workflow

1. Add every source to `sources.csv` before using it in another file.
2. Add or update individuals in `pandas.csv`.
3. Use `events.csv` for births, arrivals, transfers, returns, naming events, and public debuts.
4. Use `sightings.csv` only for location/observation records that should eventually map to `public.sightings`.
5. Use `media.csv` only for media metadata. Do not save copyrighted images in Git.
6. Run the validator:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/curation/validate_panda_curation.ps1
```

There is also a Python version at `scripts/curation/validate_panda_curation.py` for environments with a working Python interpreter.

## Evidence Rules

- `verified`: the row is supported by an official institution, government source, official news release, or studbook-quality reference.
- `partial`: the row has a reliable source but still misses at least one database-critical field, such as exact birth date, current facility, or parent identity.
- `needs_primary_source`: the row is only supported by secondary reporting or needs a stronger source before promotion.

Only rows with `evidence_status=verified` and `review_status=approved` should be converted to SQL seed files.

## Promotion Path

Curated records should move through these layers:

1. `data/curation/pandas/*.csv` for source-backed working data.
2. `infra/supabase/seed/0003_panda_profiles_seed.sql` for reviewed import data.
3. `services/api/app/data/import_sources.py` whitelist update after the SQL seed is ready.
4. Supabase/Postgres import through the existing admin import path.

## Source Priority

Use this order when facts conflict:

1. Studbook or official panda center record.
2. Current/holding institution official profile.
3. Official institution news release.
4. Government or Xinhua-style official wire record.
5. Peer-reviewed paper or conservation report.
6. Secondary site as discovery hint only.
