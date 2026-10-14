# Deployment runtime status

- Status date: 2026-10-14
- Application architecture: [ZhiPanda V2 Architecture Baseline](../architecture/zhipanda-v2-architecture-baseline.md)
- Managed-only principle: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)

This page is the current deployment source of truth for the live provider/runtime topology.

## Current production topology

| Responsibility | Current production | Repository source of truth |
|---|---|---|
| Public Web | Cloudflare Worker `zhipanda-v2-web`; Next.js 16-compatible source through vinext 1.1 + Vite + the Cloudflare Vite plugin | `apps/web/cloudflare.config.ts`, `apps/web/vite.config.ts`, `apps/web/worker/index.mjs` |
| Business/public API | Cloudflare Worker `zhipanda-v2-api`; NestJS 11 on the Express adapter, served through `httpServerHandler` (Fastify cannot boot on Workers: it relies on `new Function` and on timers outside a request, both unavailable; #524). `npm run check:worker-boot -w @zhipanda/api` boots the built Worker in workerd in CI | `services/api/cloudflare.config.ts`, `services/api/worker/index.mjs` |
| Web -> API transport | Cloudflare service binding `V2_API`; canonical external origin `https://api.zhipanda.com` remains the build/browser API origin | `apps/web/cloudflare.config.ts`, `apps/web/lib/server/v2-api.ts` |
| API -> database | Cloudflare Hyperdrive -> Supabase PostgreSQL/PostGIS (AWS `ap-northeast-1`); the API Worker uses `placement.region: "aws:ap-northeast-1"` so its sequential queries stay near the database. Hyperdrive config `zhipanda-v2-postgres` (`988de17966ba42dd81bca021c134925a`) has **query caching disabled** (verified 2026-10-13 with `cf hyperdrive get`; origin connection limit 5) and keeps only connection pooling: identity, permission, suspension and post-write admin reads must be fresh, and a cached read could re-store an old release in the Web page cache right after a delivery-change purge. Public reads are cached at the edge by Workers Cache instead. Keep caching disabled on this config; a read that could tolerate staleness would need a separate cached config, not a change here | `services/api/cloudflare.config.ts`, `services/api/src/platform/database/database.service.ts` |
| API -> Web transport | Cloudflare service binding `PUBLIC_WEB` with `props: { publicCachePurge: true }`, used only to purge the Web public page cache | `services/api/cloudflare.config.ts` |
| Identity | Supabase Auth | Nest Identity/auth modules and Supabase configuration |
| Public media | Cloudflare R2 (private bucket); allowlisted photos (immutable) and home videos are served through Workers Cache, which also answers conditional and range requests | Web Worker `HOME_MEDIA` binding, `apps/web/worker/media.mjs`, and reviewed media publication inputs |
| Public page cache | Workers Cache on the Web Worker: successful public page and RSC renders and `sitemap.xml` carry `Cloudflare-CDN-Cache-Control: public, max-age=600, stale-while-revalidate=86400`; every other response is `private, no-store`; each deploy starts a cold cache, and every release activation, rollback, suspension, restore and resource takedown or restore purges it through the `integration_public_cache` queue on the next five-minute async cycle | `cache.enabled` in `apps/web/cloudflare.config.ts`, `apps/web/worker/edge-cache.mjs` |
| Security headers | Every Web Worker response (pages, RSC, media, redirects, errors, and responses it stores in Workers Cache) carries HSTS (one year, `includeSubDomains`, no `preload`), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` denying camera/microphone/geolocation/payment/USB, and `frame-ancestors 'none'` plus `X-Frame-Options: DENY`. Static assets served without running the Worker (`robots.txt`, `favicon.ico`, build assets) get the same headers from `apps/web/public/_headers`, which a Worker test keeps identical to the Worker policy. Every API response carries HSTS, `nosniff`, `Referrer-Policy: no-referrer` (a JSON-only API has no links to refer from), the same `Permissions-Policy`, and `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`. A full Web `script-src`/`connect-src` CSP is not yet defined | `apps/web/worker/security-headers.mjs`, `apps/web/public/_headers`, `services/api/src/bootstrap.ts` |
| Staff console | Not served in production: `ADMIN_SHELL_ENABLED` is fixed to `false` for the production Web Worker regardless of the deployer's environment, and `proxy.ts` answers every `/admin` and `/api/admin/*` request with 404 while it is off. Local and admin test runtimes enable it explicitly | `apps/web/cloudflare.config.ts`, `apps/web/proxy.ts`, enforced by `scripts/release/tests/cloudflare-production-surface.test.mjs` and the Web smoke suite |
| Crawler policy | Static `robots.txt` served from Web assets without running the Worker: content signals `search=yes, ai-train=no`, private paths and the filter query variants of `/moments` and `/pandas` disallowed, sitemap at `https://www.zhipanda.com/sitemap.xml` | `apps/web/public/robots.txt` |
| Site icon | Static `favicon.ico` (approved v09 resting-panda mark in `#003e40` on a `#f7f6f1` rounded tile, 16–64 px) served from Web assets without running the Worker | `apps/web/public/favicon.ico` |
| Web incremental cache | No dedicated R2/DO topology; the current Web application has no positive ISR/tag/data-cache contract | `apps/web/cloudflare.config.ts` |
| DNS/custom domains | Cloudflare; production is served only through these custom domains (`workersDev: false`), so zone WAF, rate-limit and HTTPS rules cover every public request | Web domains `zhipanda.com` / `www.zhipanda.com`; API domain `api.zhipanda.com`; enforced by `scripts/release/tests/cloudflare-production-surface.test.mjs` |
| Short async trigger | Cloudflare Cron Trigger (`*/5 * * * *`) on `zhipanda-v2-api` runs one bounded Nest downstream cycle in the Worker `scheduled` handler | `services/api/cloudflare.config.ts`, `services/api/worker/index.mjs` |
| Logs | Workers Logs (`observability.enabled`) on both Workers. The API writes each log entry as one structured object to `console`, so Workers Logs indexes its fields; every 5xx response logs `Request failed` with its request id, method, path (no query string), status and error, and every Cron Trigger cycle logs its per-stage counts or its failure. `npm run check:worker-boot -w @zhipanda/api` proves a failed request is logged by the built Worker | `services/api/src/platform/observability/structured-logger.service.ts`, `services/api/src/platform/http/problem-details.filter.ts`, `services/api/src/jobs/scheduled-cycle.ts` |
| Production probe | `.github/workflows/production-probe.yml` runs every 15 minutes (and on demand) from GitHub Actions and fails when `https://api.zhipanda.com/ready` (API and database), `https://api.zhipanda.com/health/async` (async downstream) or an uncached render of `https://www.zhipanda.com/zh` fails. `/health/async` is separate from `/ready` because a stalled background cycle does not stop the API serving requests. It answers 503 once no Cron Trigger cycle has completed every stage for more than 20 minutes (four missed cycles), read from the `integration.async_downstream_heartbeat` row the runner updates after its last stage. A heartbeat rather than queue age is the signal because the runner fails fast: a failing stage or poison message stops every later stage and leaves the heartbeat ageing, a dead trigger is caught even when no work arrives, and legitimate waits (provider retry backoff up to 30 minutes, a fan-out larger than one cycle's batch) do not look like stalls. GitHub emails the account that last changed the workflow's schedule when a scheduled run fails, provided that account keeps Actions failure notifications enabled; GitHub disables schedules in a repository with no activity for 60 days and warns by email before doing so | `.github/workflows/production-probe.yml`, `services/api/src/platform/integration/async-downstream-heartbeat.ts`, `services/api/src/platform/health/health.controller.ts` |
| Deploy toolchain and updates | Two Cloudflare packages are pinned to exact prereleases because no stable release offers what the deployment uses: `cf` (`1.0.0-beta.12`; npm has no stable 1.x `cf`) provides `cf/config` (`defineConfig`, bindings, Workers Cache, Durable Object retirement exports) and `cf deploy --prebuilt`; `@cloudflare/vite-plugin` (`2.0.0-beta.sha-52b0dc0e9`) is the 2.0 line that reads `cf/config` and writes the prebuilt build output `cf deploy --prebuilt` consumes (the stable 1.x line instead requires Wrangler as a peer, which the repository no longer carries). Exit criterion: move each to its first stable release (`cf` 1.0.0, plugin 2.0.0) as soon as it is published. Pin rule: `package.json` pins exactly only prereleases, `vite` (built and verified together with the prerelease plugin) and the `supabase` CLI (the local stack and the operations catalog run that exact version); every other dependency uses a caret range and `package-lock.json` fixes the installed version. `.github/dependabot.yml` opens weekly grouped version-update pull requests for npm (the Cloudflare/Vite toolchain moves as one group; minor and patch updates of everything else share one pull request; every major version arrives as its own pull request), GitHub Actions and the `tools/panda-data` uv project. It does not propose `@cloudflare/vite-plugin` betas (their commit-hash names do not sort by release), the `supabase` CLI, or `lightningcss-linux-x64-gnu` (it must equal the `lightningcss` that `@tailwindcss/node` pins); those move by hand | `apps/web/package.json`, `services/api/package.json`, `.github/dependabot.yml` |
| Long/heavy data work | GitHub Actions and independent `tools/panda-data` Python runtime | repository workflows and `tools/panda-data` |

## Verified live resources

The Cloudflare account currently serves:

- `zhipanda-v2-web`, compatibility date `2026-10-01`, with `nodejs_compat`, Workers Cache enabled, the `HOME_MEDIA` R2 binding, and a `V2_API` service binding to `zhipanda-v2-api`; the retired OpenNext cache R2/self bindings are absent, and the OpenNext `DOQueueHandler` / `DOShardedTagCache` Durable Object namespaces are retired by `state: "deleted"` exports in `apps/web/cloudflare.config.ts`;
- `zhipanda-v2-api`, compatibility date `2026-10-01`, with `nodejs_compat`, `enable_nodejs_http_server_modules`, Hyperdrive, and a service binding to `zhipanda-v2-web`.

`https://zhipanda.com/zh` is served by the vinext-based `zhipanda-v2-web` Worker and `https://api.zhipanda.com/health` by `zhipanda-v2-api`.

## Build and deployment ownership

From a clean checkout, the deployable Cloudflare artifacts are built with:

```powershell
npm run build:cloudflare
```

This builds the Nest API Worker artifact and the vinext + Vite Web Worker artifact without deploying them. `.github/workflows/cloudflare-deployability.yml` checks this deployment seam, with the Web browser suites, for relevant pull requests; it does not duplicate lint, typecheck, browser, accessibility, or release-gate suites.

`cf` is the primary Cloudflare operator/deployment CLI for resource discovery, deployment inspection, and deployment actions. The Web workspace no longer carries Wrangler or OpenNext as deployment dependencies.

Production is deployed only by `.github/workflows/production-deploy.yml`:

1. A push to `main` that touches the Web, API, API client, migrations or root manifests (or a manual dispatch) builds both Workers once on Linux and boots the API Worker in workerd.
2. The `deploy` job, which runs only for `main`, waits for approval on the GitHub `production` Environment, whose reviewers the owner configures; its `CLOUDFLARE_API_TOKEN` and `SUPABASE_DB_URL` secrets are available only after approval.
3. It applies pending Supabase migrations with `supabase db push` (expand-first, so the running API keeps working), then deploys the approved build output with `cf deploy --prebuilt`, the API Worker first and then the Web Worker. The Web Worker's `V2_API` binding targets the API. Each Worker version is tagged with the commit (`--tag`/`--message`).
4. It probes `api.zhipanda.com/health`, `/ready` and an uncached `www.zhipanda.com/zh`.

Pull requests never deploy, and there is no workstation deploy script. Rolling back means deploying the previous Worker version with `cf`; [Production release and rollback](../runbooks/production-release.md) covers the procedure.

## Vinext Web runtime

The Web has one production adapter: vinext + Vite + the Cloudflare Vite plugin. `HOME_MEDIA` is the R2 media seam; application server calls reach the API through the `V2_API` binding.

`vinext check` is 97% compatible on the migrated tree: 18 supported, one partial (`typedRoutes`), and zero production-code issues. Next remains a development-only route type-generation dependency so the existing typed-link contract is preserved; it does not serve requests or build a production artifact.
