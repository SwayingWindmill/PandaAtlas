# Panda Atlas API

FastAPI service for panda encyclopedia and distribution map data. This is the authoritative runtime for validation, domain rules, imports, admin behavior, and PostgreSQL/PostGIS writes. The Cloudflare Worker is only a versioned public read projection; see [`ADR 0001`](../../docs/architecture/adr-0001-single-source-api-boundary.md).

## Run (uv)

```bash
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

## Environment

Key settings:

- `DATABASE_URL`: Postgres connection string (Supabase or local Postgres).
- `DB_USE_MOCK_FALLBACK`: `true/false`; when true, read endpoints fall back to mock data on DB failure.
- `ADMIN_API_TOKEN`: bearer token for admin import endpoints. The built-in development default is local-only and must be replaced outside development.
- `RUN_ADMIN_IMPORT_SMOKE`: `0/1`; when `1`, `smoke_test_api.py` also runs the explicit local admin import smoke flow.

## Release Gate

Default release gate from the repo root:

```powershell
npm run release:default
```

Extended release gate from the repo root:

```powershell
$env:RUN_REAL_DB_TESTS="1"
$env:DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/panda_atlas"
$env:RUN_ADMIN_IMPORT_SMOKE="1"
$env:ADMIN_API_TOKEN= [REDACTED_SECRET]
npm run release:extended
```

The default gate runs frontend lint/typecheck/build, backend compile/lint/test, the OpenAPI contract check, read-only public API smoke, and browser smoke. The extended gate adds the opt-in real-DB and admin import checks only when those env flags are enabled.

## Database Setup

1. Apply migration SQL:

```bash
psql "$env:DATABASE_URL" -f ../../infra/supabase/migrations/0001_panda_atlas_init.sql
```

2. Import demo data:

```bash
uv run python scripts/import_demo_seed.py
```

3. Verify real DB endpoints:

```bash
curl "http://localhost:8000/api/v1/pandas"
curl "http://localhost:8000/api/v1/map/snapshots"
curl "http://localhost:8000/api/v1/map/distribution?bbox=100,25,110,36&layer=wild"
curl "http://localhost:8000/api/v1/stats/overview"
```

## Local operator flow

The web proxy is disabled by default. For the supported local-only topology, configure the server-side administrator token and start the dedicated loopback launcher with `npm run dev:admin -w web`. Do not enable the proxy manually or expose it through a LAN listener, reverse proxy, or tunnel. See [`docs/security/local-admin-proxy.md`](../../docs/security/local-admin-proxy.md) for the threat model and verification commands.

The browser admin page proxies requests through same-origin Next.js server routes. The backend token stays on the server side; the browser should not receive or store `ADMIN_API_TOKEN`.

Create + execute + poll an import job from the API:

```bash
curl "http://localhost:8000/api/v1/admin/import-sources" \
  -H "Authorization: Bearer [REDACTED_SECRET]"

curl -X POST "http://localhost:8000/api/v1/admin/import-jobs" \
  -H "Authorization: Bearer [REDACTED_SECRET]" \
  -H "Content-Type: application/json" \
  -d "{\"source_name\":\"0001_demo_seed.sql\"}"

curl -X POST "http://localhost:8000/api/v1/admin/import-jobs/<job_id>/run" \
  -H "Authorization: Bearer [REDACTED_SECRET]"

curl "http://localhost:8000/api/v1/admin/import-jobs/<job_id>" \
  -H "Authorization: Bearer [REDACTED_SECRET]"
```

Outside development, set a non-default `ADMIN_API_TOKEN` before using any admin endpoint.

## Test

```bash
uv run pytest -q
```

Run real-DB anti-regression tests:

```bash
$env:RUN_REAL_DB_TESTS="1"
$env:DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/panda_atlas"
uv run pytest -q tests/integration/test_real_db_chain.py
```

## Lint

```bash
uv run ruff check app tests
```

## Build Container

```bash
docker build -t panda-atlas-api .
docker run --rm -p 8000:8000 --env-file ../../.env panda-atlas-api
```

## Smoke Tests

Public/read-only smoke only:

```bash
$env:API_BASE_URL="http://localhost:8000"
$env:RUN_ADMIN_IMPORT_SMOKE="0"
uv run python scripts/smoke_test_api.py
```

Explicit local admin import smoke:

```bash
$env:API_BASE_URL="http://localhost:8000"
$env:ADMIN_API_TOKEN= [REDACTED_SECRET]
$env:SMOKE_IMPORT_SOURCE_NAME="0001_demo_seed.sql"
uv run python scripts/smoke_test_admin_import.py
```

Combined smoke, with admin import enabled explicitly:

```bash
$env:API_BASE_URL="http://localhost:8000"
$env:ADMIN_API_TOKEN= [REDACTED_SECRET]
$env:RUN_ADMIN_IMPORT_SMOKE="1"
uv run python scripts/smoke_test_api.py
```
