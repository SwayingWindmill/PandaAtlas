# Panda Atlas

Panda Atlas is a full-stack monorepo for a giant panda encyclopedia and distribution map.

## Stack

- Frontend: Next.js App Router + Tailwind CSS v4 + shadcn/ui
- Backend: FastAPI with PostgreSQL/PostGIS is authoritative for domain rules and writes; the Cloudflare Worker with D1/R2 is an optional versioned public read projection
- Data: Supabase Postgres/PostGIS/Auth/Storage
- Deployment: OpenNext/Cloudflare for `apps/web`; Cloudflare Worker for `services/worker-api`; container runtime for `services/api`

## API authority

FastAPI and PostgreSQL/PostGIS own validation, imports, admin behavior, and every persistent write. The Cloudflare Worker exposes only compatible public read endpoints from an approved D1/R2 projection; it has no admin or import routes.

- Architecture decision: [ADR 0001](docs/architecture/adr-0001-single-source-api-boundary.md)
- Shared public field semantics: [Public API v1 manifest](contracts/public-api-v1.json)
- Drift check: `npm run check:public-api-boundary`

## Quick Start (Scaffold)

### 1) Frontend

```bash
cd apps/web
npm install
npm run dev
```

### 2) Backend (uv)

```bash
cd services/api
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

### 3) Container (API + Postgres)

```bash
docker compose up --build
```

## Database Behavior

- If `DATABASE_URL` is configured and SQLAlchemy dependencies are installed, API read endpoints query Postgres/PostGIS.
- If DB connection is unavailable and `DB_USE_MOCK_FALLBACK=true`, endpoints automatically use in-memory mock data.
- Health endpoint returns database status in `db` field: `ok`, `disabled`, `error`, or `driver_missing`.

## Release Gate

Run the Windows-first default gate from the repository root:

```powershell
npm run release:default
```

It runs Web, FastAPI, Worker projection, contract, and browser checks serially. Reports are written to `.release-gate/default.json` and `.release-gate/default.md`. Windows records Worker HTTP as an explicit platform skip; Linux CI executes the complete Workerd HTTP smoke.

The extended gate adds opt-in real-database and admin-import verification. See [the cross-platform release-gate runbook](docs/release/release-gate.md) for pinned tool versions, clean-checkout reproduction, browser selection, report status definitions, and extended configuration.

## Real DB Verification Flow

1. Apply schema migration (Supabase SQL editor or `psql`):

```bash
psql "$env:DATABASE_URL" -f infra/supabase/migrations/0001_panda_atlas_init.sql
```

2. Import demo dataset:

```bash
cd services/api
uv run python scripts/import_demo_seed.py
```

3. Start API and verify endpoints:

```bash
uv run uvicorn app.main:app --reload
curl "http://localhost:8000/api/v1/pandas"
curl "http://localhost:8000/api/v1/map/snapshots"
curl "http://localhost:8000/api/v1/map/distribution?bbox=100,25,110,36&layer=wild"
curl "http://localhost:8000/api/v1/stats/overview"
```

4. Execute import jobs via admin API:

```bash
curl -X POST "http://localhost:8000/api/v1/admin/import-jobs" \
  -H "Authorization: Bearer dev-admin-token" \
  -H "Content-Type: application/json" \
  -d "{\"source_name\":\"0001_demo_seed.sql\"}"

curl -X POST "http://localhost:8000/api/v1/admin/import-jobs/<job_id>/run" \
  -H "Authorization: Bearer dev-admin-token"
```

5. Real-DB anti-regression + smoke test:

```bash
cd services/api
$env:RUN_REAL_DB_TESTS="1"
$env:DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/panda_atlas"
uv run pytest -q tests/integration/test_real_db_chain.py

$env:API_BASE_URL="http://localhost:8000"
$env:ADMIN_API_TOKEN="dev-admin-token"
uv run python scripts/smoke_test_api.py
```

## Project Docs

- Architecture: `docs/monorepo-structure.md`
- API contract: `services/api/openapi/panda-atlas-v1.yaml`
- DB migration draft: `infra/supabase/migrations/0001_panda_atlas_init.sql`
- Demo seed SQL: `infra/supabase/seed/0001_demo_seed.sql`
