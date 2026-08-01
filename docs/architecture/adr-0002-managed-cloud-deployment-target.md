# ADR 0002: Managed-cloud deployment target

- Status: Accepted
- Date: 2026-08-01
- Supersedes: none
- Related: [ADR 0001](adr-0001-single-source-api-boundary.md)

## Context

Panda Atlas currently runs its public Web application through OpenNext on Cloudflare Workers, serves the public read API through a Cloudflare Worker backed by D1/R2, and retains FastAPI plus PostgreSQL/PostGIS as the authoritative domain and write path. This architecture is operational, but it requires two public data runtimes, a versioned D1 projection, OpenNext compatibility work, and coordinated Worker, D1, R2, and Web releases.

The project owner has selected a managed-only operating model. Panda Atlas must not require a self-managed virtual machine, long-running Docker host, manually administered PostgreSQL server, Nginx instance, or other persistent application server.

The preferred target should also use mainstream managed services, preserve the existing authoritative data model, reduce duplicate infrastructure, and support gradual migration without interrupting the current production site.

## Decision

Panda Atlas will migrate toward the following managed-cloud target:

```text
GitHub
  ├─ source control and pull-request checks
  ├─ bounded batch import, research, media, and release workflows
  └─ deployment triggers

Vercel
  ├─ Next.js Web application
  ├─ SSR, ISR, Route Handlers, and preview deployments
  └─ FastAPI-compatible serverless functions for bounded API requests

Supabase
  ├─ authoritative PostgreSQL/PostGIS database
  ├─ authentication and authorization support
  ├─ Row Level Security where browser-accessible data is exposed
  ├─ managed backups and database operations
  └─ optional database-native jobs and lightweight Edge Functions

Cloudflare
  ├─ authoritative DNS
  ├─ domain and network controls
  └─ R2 for reviewed public media and large immutable objects
```

### Locked platform responsibilities

1. **Vercel is the target runtime for the Next.js application.** The production Web deployment will no longer depend on OpenNext after migration acceptance.
2. **Supabase PostgreSQL/PostGIS remains the single authoritative database.** Curated panda records, lineage, residency, evidence, source provenance, release state, user data, and persistent writes must have one authoritative owner.
3. **FastAPI remains the authoritative domain/API implementation during migration.** Bounded HTTP endpoints may run as Vercel serverless functions. Long-running imports, crawls, media processing, recovery drills, and release construction must not run inside request-bound functions.
4. **GitHub Actions is the default managed execution environment for bounded batch workflows.** Workflows must be reproducible, resumable where necessary, and write through the authoritative API or database contract.
5. **Cloudflare R2 remains the target public-media store unless a later ADR replaces it.** Existing reviewed media URLs should remain stable during the platform migration.
6. **Cloudflare D1 is transitional.** It remains in service only while the current public Worker API is needed for migration safety. It is not part of the final authoritative or public-read target.
7. **Cloudflare remains the DNS provider.** Vercel-served DNS records should use DNS-only behavior during migration unless Cloudflare proxy compatibility is explicitly tested and approved.
8. **No persistent self-managed server is permitted in the target architecture.** Local Docker and local PostgreSQL may be used for development and recovery testing, but not as production dependencies.

## Target request paths

### Public Web

```text
Visitor
  -> Cloudflare DNS
  -> Vercel
  -> Next.js
```

### Public and administrative API

```text
Next.js or trusted operator client
  -> Vercel-hosted API/FastAPI function
  -> Supabase PostgreSQL/PostGIS
```

Public reads may be implemented through the existing FastAPI contract, thin Next.js Route Handlers, or database-backed server functions, but all variants must preserve the checked public API contract and must not create a second source of domain truth.

### Public media

```text
Browser
  -> stable media URL
  -> Cloudflare R2 delivery path
```

### Batch research and publication

```text
GitHub Actions
  -> research/import/media scripts
  -> validation and immutable release artifacts
  -> Supabase authoritative writes
  -> R2 media publication
  -> Vercel deployment or cache revalidation
```

## Migration plan

### Phase 0: Decision and inventory

- Record this ADR as the accepted target.
- Keep the current Cloudflare production path unchanged.
- Inventory every production dependency on OpenNext, the public Worker, D1, R2, FastAPI, Supabase, release scripts, environment variables, and custom domains.
- Classify each endpoint and job as request-bound, scheduled, batch, or operator-only.

**Exit condition:** the migration inventory identifies an owner and target runtime for every production responsibility.

### Phase 1: Parallel Vercel Web deployment

- Connect `apps/web` to Vercel without removing the Cloudflare Web deployment.
- Configure preview and staging deployments.
- Continue using the existing `api.zhipanda.com` Worker API during this phase.
- Verify locale routing, SSR, metadata, canonical URLs, no-JavaScript behavior, accessibility, browser tests, media delivery, and route performance budgets.
- Keep production DNS pointed at the current Cloudflare Web deployment until acceptance is complete.

**Exit condition:** the Vercel staging deployment passes the same observable Web and release evidence required from the current production Web runtime.

### Phase 2: Managed authoritative API deployment

- Package bounded FastAPI endpoints for Vercel serverless execution, preserving the checked OpenAPI and public schema contracts.
- Connect the managed API runtime to Supabase PostgreSQL/PostGIS using production-safe pooling and secret management.
- Move operator authentication to a managed identity path based on Supabase Auth or another explicitly approved managed mechanism.
- Keep imports and heavy processing outside request-bound functions.
- Run the Vercel API in parallel with the existing Worker public API and compare representative responses against immutable release artifacts.

**Exit condition:** public and operator API contracts, authorization, database behavior, performance limits, and failure handling pass staging verification against Supabase.

### Phase 3: Batch workflow migration

- Move bounded research, ingestion, curation, media, and release execution to GitHub Actions workflows.
- Use artifacts, checkpoints, idempotency keys, and explicit approval environments for irreversible production publication.
- Retain local execution for development and recovery drills, but remove any production dependency on a continuously running local process.
- Ensure secrets are stored only in the selected managed platform secret stores.

**Exit condition:** all production jobs can be executed and audited without a self-managed server.

### Phase 4: Production Web cutover

- Freeze production changes for the cutover window.
- Run the affected development acceptance checks and one final candidate release certification.
- Point `zhipanda.com` and `www.zhipanda.com` to Vercel while keeping Cloudflare as authoritative DNS.
- Verify public routes, localized profiles, lineage, maps, media, accessibility, analytics, cache behavior, and rollback readiness.
- Retain the previous Cloudflare Web deployment until the rollback window closes.

**Exit condition:** Vercel serves production Web traffic and the previous Web deployment is no longer required for routine operation.

### Phase 5: API cutover and D1 retirement

- Route production API traffic to the managed Vercel/Supabase API path.
- Verify every public response against the active immutable release and authoritative database expectations.
- Stop generating new D1 public projections after the managed API cutover is stable.
- Retain D1 rollback artifacts for a defined recovery period.
- Remove the Worker API, D1 migrations, projection activation, and D1 rollback machinery only in separately reviewed cleanup changes.

**Exit condition:** production reads and writes use the single Supabase-backed authority, and D1 is no longer a production dependency.

### Phase 6: OpenNext and obsolete release-path cleanup

- Remove OpenNext deployment dependencies, Cloudflare Web Worker configuration, and obsolete Worker-specific release steps.
- Preserve R2 media publication and integrity checks.
- Update architecture, runbooks, diagrams, environment examples, and release gates to describe only the accepted production path.

**Exit condition:** repository documentation, CI, release tooling, and production infrastructure agree on the same target architecture.

## Rollback strategy

Migration must remain reversible until each phase exit condition is accepted.

- Web cutover rollback changes DNS back to the retained Cloudflare Web deployment.
- API cutover rollback routes traffic back to the retained Worker API and active D1 projection.
- Database schema changes remain forward-only and must not depend on D1 for recovery.
- R2 object names and reviewed public URLs remain stable across Web and API cutovers.
- Destructive removal of Cloudflare Web, Worker API, or D1 infrastructure occurs only after the corresponding rollback window closes.

## Security and data rules

- Production secrets must be stored in Vercel, Supabase, GitHub, or Cloudflare managed secret stores and must not be committed.
- Browser clients must not receive privileged Supabase service credentials.
- Browser-direct database access, where used, requires explicit Row Level Security policies and contract tests.
- Administrative writes must remain authenticated, authorized, auditable, and idempotent.
- Public projections and immutable release artifacts must exclude private fields.
- Managed services do not remove the need for backup, restore, withdrawal, and recovery drills.

## Cost and operational controls

- Set platform budgets and alerts before production cutover.
- Measure Vercel function duration, invocation volume, bandwidth, image optimization, and build usage.
- Measure Supabase database size, compute, connection usage, storage, egress, and backup requirements.
- Measure R2 storage, operations, and delivery traffic.
- Batch workflows must have concurrency limits and explicit production approvals to prevent accidental repeated publication.

## Non-goals

This ADR does not:

- immediately change the current production deployment;
- authorize removal of release gates, provenance, rollback, accessibility, or media-integrity checks;
- require rewriting all FastAPI domain logic in TypeScript;
- require moving reviewed public media from R2 to Supabase Storage;
- permit long-running or unbounded work inside Vercel request functions;
- permit a second authoritative database.

## Consequences

### Benefits

- No persistent production server or operating-system maintenance.
- Native Next.js deployment and preview environments on Vercel.
- One authoritative PostgreSQL/PostGIS database.
- Fewer projection, synchronization, and cross-runtime release responsibilities after D1 retirement.
- Stable use of R2 for the project’s media-heavy public surface.
- Gradual cutover with explicit rollback paths.

### Costs and risks

- The migration touches Web deployment, API runtime, authentication, release automation, DNS, and observability.
- Vercel request limits require strict separation of HTTP requests from batch workloads.
- Direct Supabase-backed reads require connection, pooling, authorization, and query-performance discipline.
- Running Vercel, Supabase, GitHub Actions, and Cloudflare creates multi-provider billing and incident boundaries.
- Existing Cloudflare release tooling cannot be removed until equivalent managed-path evidence exists.

## Enforcement

Future infrastructure and deployment changes must conform to these invariants:

1. No new production dependency on a self-managed server.
2. No new authoritative data store outside Supabase PostgreSQL/PostGIS without a superseding ADR.
3. No new D1 feature work except migration safety, rollback, or retirement work.
4. New public media must preserve the R2 publication and integrity contract unless superseded.
5. Deployment pull requests must state which migration phase they advance and which exit condition they satisfy.
6. Current production behavior must remain accurately documented until the relevant cutover is complete.
