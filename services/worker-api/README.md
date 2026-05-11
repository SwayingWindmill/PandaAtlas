# Panda Atlas Cloudflare Worker API

This service is the Cloudflare-native replacement data access layer for the FastAPI/Postgres path.

It keeps the existing `/api/v1` response contract stable while moving reads and admin job metadata to:

- Cloudflare Workers for HTTP routing
- Cloudflare D1 for relational metadata and bbox-indexed map rows
- Cloudflare R2 for large GeoJSON/media payloads referenced by D1 keys

## Local Setup

From the repository root:

```powershell
npm install
npm run typecheck:api:cf
```

Initialize the local D1 database:

```powershell
cd services/worker-api
npx wrangler d1 execute panda-atlas --local --file=../../infra/cloudflare/d1/schema.sql
npx wrangler d1 execute panda-atlas --local --file=../../infra/cloudflare/d1/seed.sql
npm run dev
```

Then test:

```powershell
curl http://127.0.0.1:8787/health
curl "http://127.0.0.1:8787/api/v1/pandas?page_size=3"
curl "http://127.0.0.1:8787/api/v1/map/distribution?bbox=100,25,110,36&layer=wild"
```

## Production Setup

Create Cloudflare resources. D1 is required for the current API. R2 is optional until large GeoJSON/media objects are moved out of D1 inline fields.

```powershell
npx wrangler d1 create panda-atlas
npx wrangler r2 bucket create panda-atlas-geo
npx wrangler r2 bucket create panda-atlas-media
```

If `wrangler r2 bucket list` returns `Please enable R2 through the Cloudflare Dashboard`, deploy the D1-only API first and add the R2 bindings after R2 is enabled.

Update `wrangler.jsonc`:

- replace `database_id` with the D1 id returned by Cloudflare
- keep `DB` as the D1 binding name
- after R2 is enabled, add `GEO_BUCKET` and `MEDIA_BUCKET` bindings for large object storage

Apply schema and baseline data:

```powershell
npx wrangler d1 execute panda-atlas --remote --file=../../infra/cloudflare/d1/schema.sql
npx wrangler d1 execute panda-atlas --remote --file=../../infra/cloudflare/d1/seed.sql
```

Set the admin token secret:

```powershell
npx wrangler secret put ADMIN_API_TOKEN
```

Deploy:

```powershell
npm run deploy:api:cf
```

Point the web app at the Worker URL with `NEXT_PUBLIC_API_BASE_URL`.
