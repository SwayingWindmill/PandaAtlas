# Panda Atlas API workspace

This directory now contains the **NestJS V2 target runtime** alongside the **transitional FastAPI V1 source** that remains only until the V2 migration/cutover sequence retires it.

- V2 implementation authority: [`docs/architecture/zhipanda-v2-architecture-baseline.md`](../../docs/architecture/zhipanda-v2-architecture-baseline.md)
- V2 execution map: [`docs/implementation/nestjs-v2-implementation-map.md`](../../docs/implementation/nestjs-v2-implementation-map.md)
- Current production status: [`docs/deployment/runtime-status.md`](../../docs/deployment/runtime-status.md)
- V2 runtime: Node 24 + NestJS 11 + Fastify 5
- V1 transitional source: `app/`, Python `scripts/`, `tests/`, `pyproject.toml`, and `uv.lock`

## V2 NestJS runtime

From the repository root on Windows:

```powershell
npm run dev:api
npm run typecheck:v2
npm run test:v2
npm run lint:v2
npm run check:architecture:v2
npm run build:v2
```

`GET /health` is version-neutral and does not call remote dependencies. `GET /ready` currently uses a replaceable local readiness probe; V2-02 replaces that probe with the bounded PostgreSQL readiness check.

## V1 transitional Python runtime

The remaining Python instructions describe the legacy runtime and local migration/recovery tooling. They are not the NestJS V2 target and must not gain new V2 business architecture.

The Dockerfile, local Uvicorn process, and local database workflows support development and recovery verification only. They must not be used to introduce a persistent self-managed production server.

The request-runtime import boundary is enforced from `app.main`. Acquisition, enrichment, identity-resolution batch code, executable scripts, dynamic imports, and heavy crawler or media dependencies cannot enter the transitive request closure. See [`docs/architecture/api-request-runtime-boundary.md`](../../docs/architecture/api-request-runtime-boundary.md) and run `npm run check:api-runtime-boundary` from the repository root.

Do not extend FastAPI architecture, `/api/v1`, Worker/D1 compatibility, or the old FastAPI-on-Vercel serverless closure. The existing `index.py` and FastAPI `vercel.json` remain V1-transition-only assets until production cutover; NestJS does not import or depend on them and uses the conventional `src/main.ts` composition root.

## Run (uv)

```bash
uv sync --extra dev --extra local-server
uv run --extra local-server uvicorn app.main:app --reload
```

The `local-server` group keeps Uvicorn out of the managed request dependency set while preserving local and Docker workflows.

## Serverless verification

Validate the entrypoint, request modules, dependency set, package data, and deterministic file hashes:

```bash
npm run check:api-runtime-boundary
npm run check:api-serverless-closure
```

Write the ignored evidence artifact to `.release-gate/api-serverless-closure.json`:

```bash
npm run build:api-serverless-closure
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

## Build local-only container

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
