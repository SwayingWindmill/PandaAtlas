# Panda Profile Curation

This folder is the working intake layer for Panda Atlas profile data. It is intentionally separate from `infra/supabase/seed/` so facts can be collected, sourced, reviewed, and normalized before they become importable database records.

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

Only panda rows with `evidence_status=verified` and `review_status=approved` may be treated as public-ready. An approved panda must also have the trusted identity and current-location fields required by `contracts/panda-expansion.v1.json`, at least three approved verified events, and at least one approved photo.

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

Approved photos require all fields except `notes`. The pipeline, not the curator, owns media IDs, hashes, dimensions, MIME types, and derivatives.

Place local reviewed files below `media-inbox/`, then run:

```bash
npm run test:panda-media
npm run process:panda-media
```

Remote HTTPS assets remain disabled unless the operator explicitly adds `--allow-network`. See [Panda photo intake and processing](../../../docs/release/panda-photo-processing.md) for the complete workflow.

## Promotion Path

Curated records should move through these layers:

1. `data/curation/pandas/*.csv` for source-backed working data.
2. Reviewed PostgreSQL records and publication workflow.
3. Immutable Public Release projection and media processing.
4. D1/API, CSV/JSON snapshots, and the public frontend.

## Source Priority

Use this order when facts conflict:

1. Studbook or official panda center record.
2. Current/holding institution official profile.
3. Official institution news release.
4. Government or Xinhua-style official wire record.
5. Peer-reviewed paper or conservation report.
6. Secondary site as discovery hint only.
