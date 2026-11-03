# Panda Profile Curation

This folder is the intake layer for Panda Atlas profile data: facts collected, sourced and reviewed before they reach the database. **The production database is the source of truth**, not these files. Production holds 942 pandas, most under slugs these CSVs never had (`a-jie-ningbo-2015`, not `a-jie`), so a row here describes a candidate, not what the site shows. To read what is published, use the [release export](../../../docs/runbooks/production-release.md#back-up-the-published-data) or the public API.

## Changing published data

A correction to something the site already shows is a reviewed migration in `infra/supabase/migrations/` that updates the database by stable ID and matches the old value, so a second run changes nothing (for example `0082_curation_fix_yong_ba_source_lun_hui_name.sql`). It reaches the public site with the next content release. Do not also edit the matching CSV row to keep the two in step: the CSVs are not compared with the database, and a copy there only drifts.

New pandas and facts start here, are validated, and are then written to the database the same way.

## Workflow

1. Add every source to `sources.csv` before using it in another file.
2. Add or update individuals in `pandas.csv`.
3. Use `events.csv` for births, arrivals, transfers, returns, naming events, and public debuts.
4. Use `sightings.csv` only for location/observation records that should eventually map to `public.sightings`.
5. Use `media.csv` for the minimum reviewed photo record: panda, asset, original source, rights basis, public credit, bilingual alt text, and review status. Technical metadata is generated later. Do not save copyrighted images in Git.
6. Run the validator:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/curation/validate_panda_curation.ps1
```

The Python entry point is available at `scripts/curation/validate_panda_curation.py`.

## Evidence Rules

- `verified`: the row is supported by an official institution, government source, official news release, or studbook-quality reference.
- `partial`: the row has a reliable source but still misses at least one database-critical field, such as exact birth date, current facility, or parent identity.
- `needs_primary_source`: the row is only supported by secondary reporting or needs a stronger source before promotion.

The collection uses one release policy ([collection release mode](../../../docs/release/collection-release-mode.md)): the validator checks structure, enums, dates and references, not publication completeness. Editorial practice still applies: take parentage only from reviewed assertions, state unknown or disputed values explicitly rather than guessing, and never infer a fact from a photo caption.

## Minimum Photo Record

The human-entered fields in `media.csv` are intentionally small:

- `panda_slug`
- `asset`
- `source_url`
- `rights`
- `credit`
- `alt_zh`
- `alt_en`
- `review_status`
- optional `notes`

`approved` and `collection_only` photos are processed and need an `asset`; rights, credit and alt text are recorded for reference rather than enforced. The pipeline, not the curator, owns media IDs, hashes, dimensions, MIME types, and derivatives.

Place local reviewed files below `media-inbox/`, then run:

```bash
npm run test:panda-media
npm run process:panda-media
```

Remote HTTPS assets remain disabled unless the operator explicitly adds `--allow-network`. See [Panda photo intake and processing](../../../docs/release/panda-photo-processing.md) for the complete workflow.

## Promotion Path

1. `data/curation/pandas/*.csv`: source-backed candidates.
2. A reviewed migration writes them into PostgreSQL, the source of truth.
3. A content release snapshots the database, and its export is kept in R2.
4. The public API and the apps read that release.

## Source Priority

Use this order when facts conflict:

1. Studbook or official panda center record.
2. Current/holding institution official profile.
3. Official institution news release.
4. Government or Xinhua-style official wire record.
5. Peer-reviewed paper or conservation report.
6. Secondary site as discovery hint only.
