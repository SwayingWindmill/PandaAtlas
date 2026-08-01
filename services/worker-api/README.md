# Panda Atlas Cloudflare Worker read projection

- Runtime status: **Current production / Transitional**
- Retirement phase: ADR 0002 Phase 5, after managed API cutover and rollback acceptance
- Governing status page: [`docs/deployment/runtime-status.md`](../../docs/deployment/runtime-status.md)

This service currently serves the public read API and remains required for production and rollback. It is not the approved long-term API target and is not a replacement for the authoritative FastAPI/PostgreSQL path.

Under [ADR 0002](../../docs/architecture/adr-0002-managed-cloud-deployment-target.md), maintenance is limited to current-production reliability, public-contract compatibility, migration safety, rollback, and retirement work. Do not add new authoritative state, write paths, or unrelated product features to D1 or this Worker.

Ownership is defined in [`docs/architecture/adr-0001-single-source-api-boundary.md`](../../docs/architecture/adr-0001-single-source-api-boundary.md):

- FastAPI and PostgreSQL/PostGIS own validation, domain rules, imports, admin behavior, and all writes.
- The Worker exposes only versioned public read endpoints under `/api/v1`.
- D1 stores approved projection rows; R2 may store large published GeoJSON or media objects referenced by those rows.
- The Worker exposes no `/api/v1/admin/**` routes and does not execute imports or repository SQL at runtime.

The checked OpenAPI document remains the authoritative transport contract. `contracts/public-api-v1.json` records the shared field set, nullability, and meaning used by FastAPI, this Worker, the frontend, and published snapshots.

## Local setup

From the repository root on Windows:

```powershell
npm install
npm run check:public-api-boundary
npm run typecheck:api:cf
```

Initialize the local D1 projection database with the repository's development schema and sample projection:

```powershell
Set-Location services/worker-api
npx wrangler d1 execute panda-atlas --local --file=../../infra/cloudflare/d1/schema.sql
npx wrangler d1 execute panda-atlas --local --file=../../infra/cloudflare/d1/seed.sql
npm run dev
```

Then test read endpoints:

```powershell
curl.exe http://127.0.0.1:8787/health
curl.exe "http://127.0.0.1:8787/api/v1/pandas?page_size=3"
curl.exe "http://127.0.0.1:8787/api/v1/map/distribution?bbox=100,25,110,36&layer=wild"
```

Requests to `/api/v1/admin/**` return `404` because the projection runtime has no write surface.

## Current transitional production setup

The following resources are retained while this Worker remains the active public API and rollback path:

```powershell
npx wrangler d1 create panda-atlas
npx wrangler r2 bucket create panda-atlas-geo
npx wrangler r2 bucket create panda-atlas-media
```

Update `wrangler.jsonc`:

- replace `database_id` with the D1 id returned by Cloudflare;
- keep `DB` as the D1 binding name;
- add `GEO_BUCKET` and `MEDIA_BUCKET` only after R2 is enabled.

Production data must come from a reviewed, versioned projection artifact built from authoritative PostgreSQL data. Apply schema changes through the migration runner and activate immutable Public Releases through the guarded root commands documented below. Do not treat `infra/cloudflare/d1/seed.sql` as an independent production fact source and do not hand-edit a tracked release artifact for D1 compatibility.

The release builder and atomic rollback/withdrawal procedure are documented in `docs/release/versioned-public-projection.md`. Every `/api/v1/*` Worker response is gated by `current_public_release` and exposes the active dataset, Public Schema, and database migration versions in response headers.

From the repository root, use `npm run release:d1:preflight -- ...` before any candidate write, `npm run release:d1:apply -- ...` only after review, and the corresponding `release:d1:rollback:preflight` / `release:d1:rollback` commands for pointer-only rollback. Remote writes always require the explicit write script; the preflight variants are read-only.

Deploy only for current-production maintenance, migration safety, or rollback after the projection contract and migration checks pass:

```powershell
npm run check:public-api-boundary
npm run typecheck:api:cf
npm run smoke:api:cf
npm run deploy:api:cf
```

Point the web app at the Worker URL with `NEXT_PUBLIC_API_BASE_URL` only when that projection version has passed the shared contract checks. The managed API cutover and Worker retirement require separate Phase 5 evidence and are not implied by a Vercel Web deployment.
