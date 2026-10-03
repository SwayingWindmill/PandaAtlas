# Deployment runtime status

- Status date: 2026-10-03
- Application architecture: [ZhiPanda V2 Architecture Baseline](../architecture/zhipanda-v2-architecture-baseline.md)
- Historical managed-cloud decision: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)

This page is the current deployment source of truth. Historical migration, Vercel, V1 Worker/D1, and cutover documents remain evidence of earlier states; they do not override this page for the live provider/runtime topology.

## Current production topology

| Responsibility | Current production | Repository source of truth |
|---|---|---|
| Public Web | Cloudflare Worker `zhipanda-v2-web`; Next.js 16 through OpenNext | `apps/web/cloudflare.config.ts`, `apps/web/open-next.config.ts`, `apps/web/worker/index.mjs` |
| Business/public API | Cloudflare Worker `zhipanda-v2-api`; NestJS 11 + Fastify 5 | `services/api/cloudflare.config.ts`, `services/api/worker/index.mjs` |
| Web -> API transport | Cloudflare service binding `V2_API`; canonical external origin `https://api.zhipanda.com` remains the build/browser API origin | `apps/web/cloudflare.config.ts`, `apps/web/lib/server/v2-api.ts` |
| API -> database | Cloudflare Hyperdrive -> Supabase PostgreSQL/PostGIS | `services/api/cloudflare.config.ts`, `services/api/src/platform/database/database.service.ts` |
| API -> Web transport | Cloudflare service binding `PUBLIC_WEB` | `services/api/cloudflare.config.ts` |
| Identity | Supabase Auth | Nest Identity/auth modules and Supabase configuration |
| Public media | Cloudflare R2 | Web Worker `HOME_MEDIA` binding and reviewed media publication inputs |
| Web cache | Cloudflare R2 + Durable Objects through OpenNext | `apps/web/open-next.config.ts`, `apps/web/cloudflare.config.ts` |
| DNS/custom domains | Cloudflare | Web domains `zhipanda.com` / `www.zhipanda.com`; API domain `api.zhipanda.com` |
| Short async trigger | GitHub Actions invokes the authenticated bounded Nest internal job endpoint | `.github/workflows/v2-async-downstream.yml` |
| Long/heavy data work | GitHub Actions and independent `tools/panda-data` Python runtime | repository workflows and `tools/panda-data` |

## Verified live resources

The Cloudflare account currently serves:

- `zhipanda-v2-web`, compatibility date `2026-10-01`, with `nodejs_compat`, R2/Durable Object cache bindings, and a service binding to `zhipanda-v2-api`;
- `zhipanda-v2-api`, compatibility date `2026-10-01`, with `nodejs_compat`, `enable_nodejs_http_server_modules`, Hyperdrive, and a service binding to `zhipanda-v2-web`.

`https://zhipanda.com/zh` returns the OpenNext runtime marker (`x-opennext: 1`). `https://api.zhipanda.com/health` is served through Cloudflare. The former stable Vercel Web/API URLs return `DEPLOYMENT_DISABLED` and are not production fallbacks.

## Build and deployment ownership

From a clean checkout, the deployable Cloudflare artifacts are built with:

```powershell
npm run build:cloudflare
```

This builds the Nest API Worker artifact and the Next.js -> OpenNext Web Worker artifact without deploying them. `.github/workflows/cloudflare-deployability.yml` runs this one deployment seam for relevant pull requests; it does not duplicate lint, typecheck, browser, accessibility, or release-gate suites.

`cf` is the primary Cloudflare operator/deployment CLI for resource discovery, deployment inspection, and deployment actions. Wrangler remains installed only where the current OpenNext/Cloudflare build adapter requires it; it is not the repository's primary operator interface.

Production deploy commands remain workspace-scoped and explicit:

```powershell
npm run deploy:cloudflare -w @zhipanda/api
npm run deploy:cloudflare -w web
```

The repository does not auto-deploy production from the pull-request validation workflow.

## Retired runtime paths

The following are historical, not supported compatibility surfaces:

- Vercel Web/API deployment and Vercel acceptance CI;
- Vercel-specific Nest instrumentation, serverless entrypoint, database-pool adapter, and deployment configuration;
- FastAPI and `/api/v1`;
- the old `services/worker-api` / D1 projection runtime;
- V1 Worker/D1 authority and rollback paths.

Historical Vercel contracts, research, release reports, and cutover evidence stay in Git as history. Do not reactivate them through new compatibility code.

## OpenNext and vinext

OpenNext is the **current production Web adapter** and must not be described as retired while `zhipanda-v2-web` serves it.

`vinext` is a separate possible runtime migration, not part of current production. A compatibility probe on 2026-10-03 reported 93% compatibility; any switch from OpenNext to vinext requires its own architecture ticket, verification, and PR rather than being folded into CI maintenance.
