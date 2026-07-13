# ADR 0001: Single authoritative API boundary

- Status: Accepted
- Date: 2026-07-13
- Issue: #4

## Context

Panda Atlas currently has two implementations of parts of `/api/v1`: FastAPI backed by PostgreSQL/PostGIS and a Cloudflare Worker backed by D1/R2. Allowing both runtimes to execute imports or define domain rules would create two fact sources and make field meaning, validation, and release behavior drift over time.

The product decision is that professional curation, validation, import execution, and all persistent writes belong to the PostgreSQL/PostGIS and FastAPI path. The Worker is an optional public read projection optimized for edge delivery.

## Decision

### Authoritative write path

1. Operators use the local-only web admin proxy or another trusted operator client.
2. The client calls FastAPI admin endpoints.
3. FastAPI applies authentication, validation, domain rules, import state transitions, and write orchestration.
4. PostgreSQL/PostGIS is the system of record for curated panda, lineage, habitat, distribution, media metadata, and import-job state.
5. Supabase/PostgreSQL migrations remain forward-only and define authoritative persistent schema changes.

The Cloudflare Worker exposes no `/api/v1/admin/**` routes and does not accept import or domain writes.

### Public read path

- FastAPI remains the reference implementation of the public `/api/v1` contract.
- The checked OpenAPI document is the authoritative public transport contract.
- The Worker may serve the same versioned public read endpoints from D1/R2.
- D1 contains only approved, versioned projection data. It is not an independent fact source, a live admin database, or a runtime import executor.
- The frontend may point at FastAPI or the Worker only when both satisfy the same Public Schema contract.

### Projection lifecycle

1. Curated data is written and validated in PostgreSQL/PostGIS through FastAPI.
2. A release process selects an approved source revision and public schema version.
3. A projection artifact is built from authoritative data, excluding private or sensitive fields.
4. Automated checks validate field names, nullability, schema version, and projection completeness.
5. The artifact is applied to D1/R2 through versioned migrations or a controlled deployment job outside the public Worker runtime.
6. The Worker switches to the new projection only after validation succeeds.
7. The previous projection version remains recoverable for rollback.

Each published projection must identify its source revision, public schema version, and projection version. A projection is immutable after publication; corrections produce a new version.

### Shared field semantics

`contracts/public-api-v1.json` records the shared field set, nullability, and human-readable meaning for public schemas used by FastAPI, Worker, frontend, and distribution snapshots.

- FastAPI generated OpenAPI and the checked OpenAPI file must match requiredness and nullability in the manifest.
- Worker and frontend TypeScript declarations must retain the same field set and nullability.
- Runtime-specific storage columns may differ, but published field names and meanings may not.

## Migration sequence

1. **Remove Worker writes:** delete Worker admin/import routes and runtime import execution.
2. **Freeze the public schema:** introduce the shared Public Schema manifest and drift checks.
3. **Keep reads compatible:** preserve current Worker public GET endpoints while FastAPI remains the reference behavior.
4. **Version projection builds:** replace ad hoc D1 seed/import behavior with reproducible, reviewed projection artifacts and migrations.
5. **Add provenance:** record source revision, schema version, projection version, creation time, and checksum for every public projection.
6. **Add controlled promotion and rollback:** validate a candidate projection before switching traffic and retain the previous version.
7. **Remove obsolete D1 admin tables:** after no deployment or rollback tooling depends on them, remove legacy import-job tables in a forward-only D1 migration.

## Consequences

- Domain rules and writes have one owner.
- Worker deployments can be rebuilt from authoritative data and versioned artifacts.
- Public reads may still be served from either runtime without changing frontend semantics.
- D1 freshness is release-driven rather than real-time.
- A projection publication pipeline is required before D1 can be treated as production-complete.

## Enforcement

Run from the repository root on Windows:

```powershell
npm run check:public-api-boundary
npm run typecheck:web
npm run typecheck:api:cf
```

Run the authoritative contract check:

```powershell
cd services/api
uv run --isolated --extra dev python scripts/check_openapi_contract.py
```
