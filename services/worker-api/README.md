# Panda Atlas Cloudflare Worker read projection

This service is an optional public read projection for Panda Atlas. It is not a replacement for the authoritative FastAPI/PostgreSQL path.

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

## Production setup

Create the Cloudflare resources used by the read projection:

```powershell
npx wrangler d1 create panda-atlas
npx wrangler r2 bucket create panda-atlas-geo
npx wrangler r2 bucket create panda-atlas-media
```

Update `wrangler.jsonc`:

- replace `database_id` with the D1 id returned by Cloudflare;
- keep `DB` as the D1 binding name;
- add `GEO_BUCKET` and `MEDIA_BUCKET` only after R2 is enabled.

Production data must come from a reviewed, versioned projection artifact built from authoritative PostgreSQL data. Apply it through D1 migrations or a controlled deployment job outside the public Worker runtime. Do not treat `infra/cloudflare/d1/seed.sql` as an independent production fact source.

The release builder and atomic rollback/withdrawal procedure are documented in `docs/release/versioned-public-projection.md`. Every `/api/v1/*` Worker response is gated by `current_public_release` and exposes the active dataset, Public Schema, and database migration versions in response headers.

Deploy after the projection contract and migration checks pass:

```powershell
npm run check:public-api-boundary
npm run typecheck:api:cf
npm run smoke:api:cf
npm run deploy:api:cf
```

Point the web app at the Worker URL with `NEXT_PUBLIC_API_BASE_URL` only when that projection version has passed the shared contract checks.
