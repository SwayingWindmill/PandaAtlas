# Deployment runtime status

- Status date: 2026-10-04
- Application architecture: [ZhiPanda V2 Architecture Baseline](../architecture/zhipanda-v2-architecture-baseline.md)
- Historical managed-cloud decision: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)

This page is the current deployment source of truth. Historical migration, Vercel, V1 Worker/D1, and cutover documents remain evidence of earlier states; they do not override this page for the live provider/runtime topology.

## Current production topology

| Responsibility | Current production | Repository source of truth |
|---|---|---|
| Public Web | Cloudflare Worker `zhipanda-v2-web`; Next.js 16-compatible source through vinext 1.0 + Vite + the Cloudflare Vite plugin | `apps/web/cloudflare.config.ts`, `apps/web/vite.config.ts`, `apps/web/worker/index.mjs` |
| Business/public API | Cloudflare Worker `zhipanda-v2-api`; NestJS 11 + Fastify 5 | `services/api/cloudflare.config.ts`, `services/api/worker/index.mjs` |
| Web -> API transport | Cloudflare service binding `V2_API`; canonical external origin `https://api.zhipanda.com` remains the build/browser API origin | `apps/web/cloudflare.config.ts`, `apps/web/lib/server/v2-api.ts` |
| API -> database | Cloudflare Hyperdrive -> Supabase PostgreSQL/PostGIS | `services/api/cloudflare.config.ts`, `services/api/src/platform/database/database.service.ts` |
| API -> Web transport | Cloudflare service binding `PUBLIC_WEB` | `services/api/cloudflare.config.ts` |
| Identity | Supabase Auth | Nest Identity/auth modules and Supabase configuration |
| Public media | Cloudflare R2 | Web Worker `HOME_MEDIA` binding and reviewed media publication inputs |
| Web incremental cache | No dedicated R2/DO topology; the current Web application has no positive ISR/tag/data-cache contract | `apps/web/cloudflare.config.ts`, `docs/research/vinext-cloudflare-web-runtime-2026-10-03.md` |
| DNS/custom domains | Cloudflare | Web domains `zhipanda.com` / `www.zhipanda.com`; API domain `api.zhipanda.com` |
| Short async trigger | GitHub Actions invokes the authenticated bounded Nest internal job endpoint | `.github/workflows/v2-async-downstream.yml` |
| Long/heavy data work | GitHub Actions and independent `tools/panda-data` Python runtime | repository workflows and `tools/panda-data` |

## Verified live resources

The Cloudflare account currently serves:

- `zhipanda-v2-web`, compatibility date `2026-10-01`, with `nodejs_compat`, the `HOME_MEDIA` R2 binding, and a `V2_API` service binding to `zhipanda-v2-api`; the retired OpenNext cache R2/DO/self bindings are absent;
- `zhipanda-v2-api`, compatibility date `2026-10-01`, with `nodejs_compat`, `enable_nodejs_http_server_modules`, Hyperdrive, and a service binding to `zhipanda-v2-web`.

`https://zhipanda.com/zh` is served by the vinext-based `zhipanda-v2-web` Worker. `https://api.zhipanda.com/health` is served through Cloudflare. The former stable Vercel Web/API URLs return `DEPLOYMENT_DISABLED` and are not production fallbacks.

## Build and deployment ownership

From a clean checkout, the deployable Cloudflare artifacts are built with:

```powershell
npm run build:cloudflare
```

This builds the Nest API Worker artifact and the vinext + Vite Web Worker artifact without deploying them. `.github/workflows/cloudflare-deployability.yml` runs this one deployment seam for relevant pull requests; it does not duplicate lint, typecheck, browser, accessibility, or release-gate suites.

`cf` is the primary Cloudflare operator/deployment CLI for resource discovery, deployment inspection, and deployment actions. The Web workspace no longer carries Wrangler or OpenNext as deployment dependencies.

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
- OpenNext Web adapter/configuration, generated-worker delegation, and its R2/Durable Object cache topology;
- V1 Worker/D1 authority and rollback paths.

Historical Vercel contracts, research, release reports, and cutover evidence stay in Git as history. Do not reactivate them through new compatibility code.

## Vinext Web runtime

Issue #385 evaluated vinext and #388 executed the migration. The Web repository now has one production adapter: vinext + Vite + the Cloudflare Vite plugin. `HOME_MEDIA` remains a custom public R2 request seam, while application server calls reach the API through the native `V2_API` Cloudflare binding. OpenNext is not retained as a fallback.

`vinext check` is 97% compatible on the migrated tree: 18 supported, one partial (`typedRoutes`), and zero production-code issues. Next remains a development-only route type-generation dependency so the existing typed-link contract is preserved; it does not serve requests or build a production artifact.

See [Vinext evaluation for the Cloudflare Web runtime](../research/vinext-cloudflare-web-runtime-2026-10-03.md) for the decision evidence and migration constraints.
