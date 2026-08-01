# Managed-cloud migration Phase 0 inventory

- Status: Complete
- Inventory date: 2026-08-01
- Decision: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)
- Machine-readable register: [`contracts/managed-cloud-deployment-inventory.v1.json`](../../contracts/managed-cloud-deployment-inventory.v1.json)
- Validation command: `node scripts/release/check-managed-cloud-inventory.mjs`

## Purpose

This inventory establishes the current production boundary and assigns a target managed runtime, owner, migration phase, and retirement or retention decision to every identified deployment responsibility. It is the Phase 0 exit artifact required by ADR 0002.

The inventory does not change production traffic. Cloudflare remains the active Web and public API platform until the relevant cutover phase passes its acceptance and rollback requirements.

## Fixed operating model

ZhiPanda production must use managed services only. A virtual machine, persistent Docker host, self-managed PostgreSQL server, Nginx host, or manually administered application server is not an allowed target dependency.

The approved target split is:

| Responsibility | Target platform |
|---|---|
| Next.js production, staging, and preview | Vercel |
| Bounded HTTP API and FastAPI functions | Vercel |
| Authoritative PostgreSQL/PostGIS | Supabase |
| Authentication and database authorization | Supabase, with server-side enforcement in the API |
| Public media and immutable large objects | Cloudflare R2 |
| DNS and domain records | Cloudflare |
| Research, imports, media processing, releases, deployments, and recovery workflows | GitHub Actions |
| Local Docker and local PostgreSQL | Development and recovery testing only |

## Current production boundary

```text
zhipanda.com / www.zhipanda.com
  -> Cloudflare Worker: panda-atlas-web
  -> OpenNext-built Next.js application
  -> NEXT_PUBLIC_API_BASE_URL=https://api.zhipanda.com

api.zhipanda.com
  -> Cloudflare Worker: panda-atlas-api
  -> D1: panda-atlas
  -> R2: panda-atlas-media and panda-atlas-geo

Authoritative domain and write path
  -> FastAPI in services/api
  -> PostgreSQL/PostGIS through DATABASE_URL
  -> Supabase migrations and seed layout

Release execution
  -> guarded scripts on an operator workstation
  -> Wrangler deployment, D1 activation or rollback, R2 upload, Web/API smoke

CI
  -> GitHub Actions development gate, Linux/Windows release gate, crawler PoC
```

At Phase 0 capture time, the repository did not record a managed production host for the authoritative FastAPI runtime, a Vercel project, or sufficient Supabase project metadata to configure a production serverless connection safely. Phase 1 has since created and recorded the Vercel project; the FastAPI production host and Supabase connection metadata remain unresolved Phase 2 work.

## Resource disposition

| Current resource | Environment | Decision | Phase |
|---|---|---|---:|
| Cloudflare Worker `panda-atlas-web` | Production | Retire after Vercel Web cutover rollback window | 4 |
| Cloudflare Worker `panda-atlas-web-staging` | Staging | Retire after Vercel staging acceptance | 1 |
| Cloudflare Worker `panda-atlas-api` | Production | Retire after managed API cutover rollback window | 5 |
| Cloudflare Worker `panda-atlas-api-staging` | Staging | Retire after managed API acceptance | 2/5 |
| D1 `panda-atlas` | Production | Retire | 5 |
| D1 `panda-atlas-staging` | Staging | Retire | 5 |
| R2 `panda-atlas-media` | Production | Retain | 3 onward |
| R2 `panda-atlas-media-staging` | Staging | Retain until staging-media policy is replaced | 3 onward |
| R2 `panda-atlas-geo` | Production | Retain pending actual-usage review | 3 |
| R2 `panda-atlas-geo-staging` | Staging | Retain pending actual-usage review | 3 |
| Supabase PostgreSQL/PostGIS | Production | Retain as the single authority | 2 onward |
| Vercel project `zhipanda` | Production and preview | Created and retained for Phase 1 acceptance | 1 |

## Workload classification

### Request-response workloads

These may run on Vercel after their compatibility, performance, security, and database-connection behavior is verified:

- Next.js route rendering, static assets, SSR, ISR, metadata, and Route Handlers.
- Public panda, lineage, map, release, and statistics requests.
- Bounded FastAPI administrative requests.
- Authentication and authorization checks.
- Health and deployment smoke endpoints.

A request handler must not become the execution host for crawling, large imports, media processing, full release construction, or recovery drills.

### Stateful data workloads

- Supabase PostgreSQL/PostGIS is the only target authoritative database.
- D1 remains a temporary public projection and rollback dependency only.
- Public release artifacts remain immutable and evidence-backed.
- R2 remains the target media and large-object store.

### Bounded batch workloads

These move from an operator workstation to GitHub Actions with environment approvals, artifacts, concurrency controls, and idempotency protections:

- Source discovery and controlled crawling.
- Research batch construction and validation.
- Curation and authoritative imports.
- Media download, transformation, hashing, review, and upload.
- Immutable release construction.
- Production deployment and post-deploy verification.
- Database recovery and release rollback drills.

### Development-only workloads

The following remain supported locally but cannot become production dependencies:

- `docker-compose.yml` FastAPI and PostGIS stack.
- Local Next.js and FastAPI development servers.
- Local admin proxy bound to loopback.
- Local browser matrices and recovery drills.

## Domain plan

| Hostname | Current destination | Target destination | DNS owner | Cutover phase |
|---|---|---|---|---:|
| `zhipanda.com` | Cloudflare OpenNext Web Worker | Vercel Next.js production | Cloudflare | 4 |
| `www.zhipanda.com` | Cloudflare OpenNext Web Worker | Vercel Next.js production | Cloudflare | 4 |
| `api.zhipanda.com` | Cloudflare public API Worker | Vercel-hosted API backed by Supabase | Cloudflare | 5 |

Before any cutover, the actual Cloudflare DNS records, TTL values, Vercel verification records, and rollback values must be captured outside this repository inventory. The Wrangler custom-domain declarations are evidence of the active routes but are not a complete DNS-zone export.

## Environment and secret ownership

The machine-readable inventory records runtime, release, test, and browser variables. The production-critical decisions are:

| Variable | Target owner | Rule |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Vercel project environment | Public configuration; initially continue to use `https://api.zhipanda.com` |
| `APP_ENV` | Vercel project environment | Explicit production/staging value |
| `DATABASE_URL` | Vercel and GitHub Actions secrets | Use a reviewed Supabase connection suitable for serverless execution |
| `DB_USE_MOCK_FALLBACK` | Vercel project environment | Must be `false` in production |
| `CORS_ALLOW_ORIGINS` | Vercel project environment | Restrict to approved production and preview origins |
| `ADMIN_API_TOKEN` | Temporary managed secret | Remove from the final production authentication design |
| `WORKFLOW_ACTOR_TOKENS_JSON` | Temporary managed secret or replaced identity | Do not expose to browser clients |
| Cloudflare deployment credentials | GitHub environment secrets | Restrict to R2/DNS duties retained by the target architecture |
| Vercel deployment credentials or project linkage | Vercel/GitHub managed integration | No repository secret material |
| Supabase service credentials | Vercel/GitHub managed secrets | Never use privileged keys in browser code |

## Phase blockers

### Phase 1 remaining blockers

- Complete deployment-matched browser smoke against the branch preview URL.
- Complete deployment-matched automated accessibility checks against the branch preview URL.
- Record platform observability, budget, and rollback ownership.

The Vercel project, Root Directory, Git integration, and Preview/Production `NEXT_PUBLIC_API_BASE_URL` configuration are already recorded by the Phase 1 deployment plan.

### Phase 2 blockers

- FastAPI has no Vercel serverless entrypoint.
- The current SQLAlchemy engine uses default pooling and has no documented serverless connection policy.
- The Supabase project reference, region, pooled connection endpoint, backup policy, Auth configuration, and RLS baseline are not recorded.
- Administrative authentication still uses static bearer tokens.
- The authoritative FastAPI production host is not identified in repository configuration.

### Phase 3 blockers

- Production research, import, media, release, deploy, and recovery commands are operator-run.
- GitHub environments, approvals, production concurrency, artifact retention, and provider credentials are not defined.
- Some workflows write repository artifacts and require an explicit review/commit strategy rather than direct mutation of the default branch.

### Phase 4 blockers

- Cloudflare DNS records and rollback values are not versioned in the repository.
- Vercel production domain verification and cache behavior have not been tested.
- Existing Cloudflare Web staging withdrawal evidence must be replaced with equivalent Vercel acceptance evidence.

### Phase 5 blockers

- Public media URLs are currently served through the API Worker route.
- Public release activation and rollback semantics are currently D1-specific.
- The managed API must prove public contract compatibility against immutable releases before D1 can stop receiving new projections.

## Phase 0 exit assessment

Phase 0 is complete because:

- Every identified production responsibility has a current owner and runtime.
- Every responsibility has a target managed runtime, target owner, migration phase, and disposition.
- Current public domains and Cloudflare resources are recorded.
- Runtime and release-affecting environment variables are inventoried.
- Request, stateful data, batch, network, operations, and development workloads are separated.
- Known blockers for Phases 1 through 5 are recorded.
- A validator rejects missing evidence, unapproved target runtimes, incorrect secret classification, and any reintroduction of self-managed production infrastructure.

## Phase 1 entry backlog

Phase 1 should begin with a parallel, non-production Vercel Web deployment. The first implementation slice is:

1. Add repository-owned Vercel project configuration only where it is required; keep the `apps/web` root explicit.
2. Define preview, staging, and production environment-variable ownership without adding secrets to the repository.
3. Deploy `apps/web` to a Vercel preview URL while continuing to call `https://api.zhipanda.com`.
4. Add an external-base-URL Web acceptance workflow that runs the existing route, browser, accessibility, no-JavaScript, locale, media, and performance checks against Vercel.
5. Record Vercel project identifiers, regions, domains, observability, budgets, and rollback ownership in a non-secret deployment manifest.
6. Do not change `zhipanda.com`, `www.zhipanda.com`, the Cloudflare Web Worker, D1, R2, or `api.zhipanda.com` during this slice.

Phase 1 is complete only after the Vercel staging deployment passes equivalent observable Web evidence and can be discarded or redeployed without affecting current production.
