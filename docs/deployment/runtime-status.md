# Deployment runtime status

- Status date: 2026-10-04
- Application architecture: [ZhiPanda V2 Architecture Baseline](../architecture/zhipanda-v2-architecture-baseline.md)
- Historical managed-cloud decision: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)

This page is the current deployment source of truth. Historical migration, Vercel, V1 Worker/D1, and cutover documents remain evidence of earlier states; they do not override this page for the live provider/runtime topology.

## Current production topology

| Responsibility | Current production | Repository source of truth |
|---|---|---|
| Public Web | Cloudflare Worker `zhipanda-v2-web`; Next.js 16-compatible source through vinext 1.0 + Vite + the Cloudflare Vite plugin | `apps/web/cloudflare.config.ts`, `apps/web/vite.config.ts`, `apps/web/worker/index.mjs` |
| Business/public API | Cloudflare Worker `zhipanda-v2-api`; NestJS 11 on the Express adapter, served through `httpServerHandler` (Fastify cannot boot on Workers: it relies on `new Function` and on timers outside a request, both unavailable; #524). `npm run check:worker-boot -w @zhipanda/api` boots the built Worker in workerd in CI | `services/api/cloudflare.config.ts`, `services/api/worker/index.mjs` |
| Web -> API transport | Cloudflare service binding `V2_API`; canonical external origin `https://api.zhipanda.com` remains the build/browser API origin | `apps/web/cloudflare.config.ts`, `apps/web/lib/server/v2-api.ts` |
| API -> database | Cloudflare Hyperdrive -> Supabase PostgreSQL/PostGIS (AWS `ap-northeast-1`); the API Worker uses `placement.region: "aws:ap-northeast-1"` so its sequential queries stay near the database | `services/api/cloudflare.config.ts`, `services/api/src/platform/database/database.service.ts` |
| API -> Web transport | Cloudflare service binding `PUBLIC_WEB` with `props: { publicCachePurge: true }`, used only to purge the Web public page cache | `services/api/cloudflare.config.ts` |
| Identity | Supabase Auth | Nest Identity/auth modules and Supabase configuration |
| Public media | Cloudflare R2 (private bucket); allowlisted photos (immutable) and home videos are served through Workers Cache, which also answers conditional and range requests | Web Worker `HOME_MEDIA` binding, `apps/web/worker/media.mjs`, and reviewed media publication inputs |
| Public page cache | Workers Cache on the Web Worker: successful public page and RSC renders and `sitemap.xml` carry `Cloudflare-CDN-Cache-Control: public, max-age=600, stale-while-revalidate=86400`; every other response is `private, no-store`; each deploy starts a cold cache, and every release activation, rollback, suspension, restore and resource takedown or restore purges it through the `integration_public_cache` queue on the next five-minute async cycle | `cache.enabled` in `apps/web/cloudflare.config.ts`, `apps/web/worker/edge-cache.mjs` |
| Staff console | Not served in production: `ADMIN_SHELL_ENABLED` is fixed to `false` for the production Web Worker regardless of the deployer's environment, and `proxy.ts` answers every `/admin` and `/api/admin/*` request with 404 while it is off. Local and admin test runtimes enable it explicitly | `apps/web/cloudflare.config.ts`, `apps/web/proxy.ts`, enforced by `scripts/release/tests/cloudflare-production-surface.test.mjs` and the Web smoke suite |
| Crawler policy | Static `robots.txt` served from Web assets without running the Worker: content signals `search=yes, ai-train=no`, private paths and the filter query variants of `/moments` and `/pandas` disallowed, sitemap at `https://www.zhipanda.com/sitemap.xml` | `apps/web/public/robots.txt` |
| Site icon | Static `favicon.ico` (approved v09 resting-panda mark in `#003e40` on a `#f7f6f1` rounded tile, 16–64 px) served from Web assets without running the Worker | `apps/web/public/favicon.ico` |
| Web incremental cache | No dedicated R2/DO topology; the current Web application has no positive ISR/tag/data-cache contract | `apps/web/cloudflare.config.ts`, `docs/research/vinext-cloudflare-web-runtime-2026-10-03.md` |
| DNS/custom domains | Cloudflare; production is served only through these custom domains (`workersDev: false`), so zone WAF, rate-limit and HTTPS rules cover every public request | Web domains `zhipanda.com` / `www.zhipanda.com`; API domain `api.zhipanda.com`; enforced by `scripts/release/tests/cloudflare-production-surface.test.mjs` |
| Short async trigger | Cloudflare Cron Trigger (`*/5 * * * *`) on `zhipanda-v2-api` runs one bounded Nest downstream cycle in the Worker `scheduled` handler | `services/api/cloudflare.config.ts`, `services/api/worker/index.mjs` |
| Logs | Workers Logs (`observability.enabled`) on both Workers. The API writes each log entry as one structured object to `console`, so Workers Logs indexes its fields; every 5xx response logs `Request failed` with its request id, method, path (no query string), status and error, and every Cron Trigger cycle logs its per-stage counts or its failure. `npm run check:worker-boot -w @zhipanda/api` proves a failed request is logged by the built Worker | `services/api/src/platform/observability/structured-logger.service.ts`, `services/api/src/platform/http/problem-details.filter.ts`, `services/api/src/jobs/scheduled-cycle.ts` |
| Production probe | `.github/workflows/production-probe.yml` runs every 15 minutes (and on demand) from GitHub Actions and fails when `https://api.zhipanda.com/ready` (API and database), `https://api.zhipanda.com/health/async` (async downstream) or an uncached render of `https://www.zhipanda.com/zh` fails. `/health/async` answers 503 once due work has waited more than 20 minutes (four missed Cron Trigger cycles): an undispatched outbox event, a visible unconsumed message in a consumed PGMQ queue (deferred retries stay invisible until their backoff ends), or a pending privacy request. GitHub emails the account that last changed the workflow schedule when a scheduled run fails | `.github/workflows/production-probe.yml`, `services/api/src/platform/health/async-downstream-health.ts` |
| Long/heavy data work | GitHub Actions and independent `tools/panda-data` Python runtime | repository workflows and `tools/panda-data` |

## Verified live resources

The Cloudflare account currently serves:

- `zhipanda-v2-web`, compatibility date `2026-10-01`, with `nodejs_compat`, Workers Cache enabled, the `HOME_MEDIA` R2 binding, and a `V2_API` service binding to `zhipanda-v2-api`; the retired OpenNext cache R2/self bindings are absent, and the OpenNext `DOQueueHandler` / `DOShardedTagCache` Durable Object namespaces are retired by `state: "deleted"` exports in `apps/web/cloudflare.config.ts`;
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
