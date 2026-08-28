# NestJS V2 managed deployment architecture on Vercel and Supabase

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #318 `Validate the managed NestJS deployment shape on Vercel and Supabase`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

What is the production-safe managed deployment shape for the NestJS V2 modular monolith on Vercel with Supabase PostgreSQL/PostGIS: bootstrap model, Fastify adapter behavior, function bundling, cold starts, database pooling, environment and secret management, request limits, health checks, preview/staging topology, and separation from workers and batch jobs?

## Decision summary

The V2 managed production shape is accepted with no structural blocker:

```text
Cloudflare DNS
      |
      +-------------------------------+
      |                               |
      v                               v
zhipanda.com                    api.zhipanda.com
Vercel Next.js                  Vercel NestJS
existing Web project            dedicated API project
                                      |
                                      | Node 24 / Nest 11 / Fastify 5
                                      | one Fluid Compute function
                                      |
                                      v
                              Supabase PostgreSQL
                              Supavisor transaction mode
                                      |
                         PostgreSQL / PostGIS / PGMQ

Cloudflare R2 <--------- direct browser uploads / public immutable media

GitHub Actions --------> SQL migrations + long/heavy Python/data jobs
Vercel Cron -----------> short bounded PGMQ/Outbox pumps
```

Core decisions:

1. Keep the existing Web Vercel project and deploy NestJS as a **separate Vercel project** rooted at `services/api`.
2. Use a second stable API project for staging, backed by a distinct staging Supabase project.
3. Pin Node `24.x`, keep conventional Nest `src/main.ts`, Fastify 5, and let Vercel deploy the whole Nest app as one Fluid Compute Function.
4. Run request traffic through Supabase transaction pooling; default each warm Nest instance to **one application-side `pg` connection** and increase only from load evidence.
5. Never run migrations from Vercel build/bootstrap/request execution.
6. Keep ordinary API bodies at **1 MiB max**, below Vercel's platform ceiling; send media/large files directly to R2 using scoped presigned uploads.
7. `/health` is cheap liveness; `/ready` is a bounded database readiness probe. Neither performs migration or eager dependency initialization.
8. Use Vercel Cron only for short bounded idempotent queue pumps. Use GitHub Actions for long/heavy work.
9. Do not make current public-content correctness depend on long CDN/static caches during initial V2 cutover. Add cache optimization only after takedown-aware behavior is proven.
10. Cloudflare remains DNS + R2. Vercel API DNS records stay DNS-only unless an explicit later test justifies a second proxy layer.

## 1. Prototype evidence

A minimal local prototype was built specifically for this ticket using the currently selected runtime stack:

```text
Node 24.18.0
Nest CLI / NestJS 11
@nestjs/platform-fastify 11
Fastify 5
pg 8
Kysely 0.29.5
strict TypeScript
```

It used a conventional `src/main.ts` and a reusable application factory:

```ts
const app = await createApplication();
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
```

with:

```ts
new FastifyAdapter({
  bodyLimit: 1024 * 1024,
  trustProxy: process.env.VERCEL === '1',
})
```

The prototype passed:

- `npm run build`;
- Fastify/Nest bootstrap test;
- small JSON request test;
- request larger than 1 MiB rejected with HTTP 413.

The database prototype constructed Kysely over node-postgres with:

```text
max                         1
min                         0
connectionTimeoutMillis     5000
idleTimeoutMillis           10000
maxLifetimeSeconds          300
```

without opening a real database connection.

The throwaway prototype is not V2 source code and must be deleted after this decision is recorded.

## 2. Vercel project topology

### Production Web

Retain the existing Vercel project:

```text
project: zhipanda
root: apps/web
```

The existing repository deployment manifest already records this project and an accepted Vercel deployment.

### Production API

Create a separate project conceptually named:

```text
zhipanda-api
root: services/api
```

Reasons to keep Web and API as separate projects rather than one multi-service project:

- independent production domains;
- independent region choice;
- API-specific secrets and DB credentials;
- independent rollback;
- independent function/bundle limits;
- independent Cron configuration;
- independent deployment cadence;
- existing Web project remains simple and does not need restructuring;
- API incidents/build failures do not have to change the Web deployment artifact.

Vercel Services may be useful elsewhere, but it does not simplify this established two-deployment boundary enough to justify changing the Web project architecture.

### Stable staging API

Create another stable project conceptually named:

```text
zhipanda-api-staging
root: services/api
```

backed by a **separate staging Supabase project**.

This is important because Vercel Cron targets a production deployment. A stable staging Vercel project gives PandaAtlas a production-class staging runtime where Cron, PGMQ, Supabase Auth, publication, takedown and release behavior can be exercised without production data.

### Web previews

Web previews should target the stable staging API, not the production API, once V2 staging is available.

Do not provision one Supabase project per pull request in the baseline.

PR/schema changes are validated against local/CI Supabase. Shared remote staging is migrated only by the controlled staging migration workflow.

## 3. Production plan baseline

### Vercel

Use **Vercel Pro or higher** for the production API baseline.

The architecture from #315 requires minute-level bounded Cron pumps. Current Vercel Cron cadence supports minute-level schedules on Pro/Enterprise while Hobby is too limited for this background model.

Do not require Enterprise-only features for V2 baseline.

### Supabase

Use **Supabase Pro or higher** for production.

Reasons:

- production database should not rely on free-tier inactivity behavior;
- daily managed backups are included;
- paid compute/pool options are more appropriate to the authoritative production database;
- future PITR remains available as an add-on if the recovery objective requires it.

PITR is **not automatically required** by this ticket. #321 must define the acceptable RPO/RTO. If daily-backup RPO is insufficient, enable PITR before production cutover.

## 4. Node runtime

`services/api/package.json` should explicitly pin:

```json
{
  "engines": {
    "node": "24.x"
  }
}
```

Node 24 is the selected V2 LTS baseline from #311 and is supported by current Vercel Node runtimes.

Do not silently inherit whatever Node major becomes Vercel's default later.

## 5. Nest bootstrap on Vercel

Keep one conventional Nest composition root:

```text
services/api/src/main.ts
```

Vercel currently supports conventional Nest applications and packages the whole Nest app as one Vercel Function. Therefore do not add:

```text
api/index.ts handler wrappers
one Vercel function per controller
Vercel-specific business modules
alternate serverless composition roots
manual router duplication
```

Local, test and Vercel runtimes use the same application factory/module graph.

## 6. Fluid Compute

Use Fluid Compute for the API project and verify that it is enabled on the deployed project.

Important consequence:

> A warm function instance can process concurrent invocations.

Therefore process-level clients such as `pg.Pool`, JWKS cache, logging exporters and R2 clients can be reused by concurrent requests in the same warm instance.

They must be concurrency-safe and must never contain mutable authoritative request/business state.

Correctness must still survive cold starts and instance replacement.

## 7. Function bundle

Target the normal Vercel Function packaging envelope.

Do **not** design V2 around the newer large-function beta.

The API package should contain only online application/runtime dependencies.

The #316 split is a deployment requirement as much as an architecture requirement:

```text
Nest API bundle                  Python data runtime
--------------                   -------------------
Nest/Fastify                     crawlers/browser automation
Kysely/pg                        research libraries
jose                             image/media processing
OpenAPI/runtime validation       scientific/LLM tooling
small provider SDKs              large batch dependencies
```

Crawler/browser/media/scientific Python dependencies never enter the Nest function bundle.

## 8. API region

Run the Nest API in **one primary Vercel compute region nearest the Supabase primary database**.

Do not enable multi-region API compute by default.

Supabase PostgreSQL has one primary region. Sending ordinary DB-heavy API traffic from multiple distant compute regions adds cross-region latency and creates more independent client pools without making the database multi-primary.

Examples of intended geographic pairing:

```text
Supabase N. Virginia     -> Vercel iad1
Supabase Frankfurt       -> Vercel fra1
Supabase Singapore       -> Vercel sin1
Supabase Tokyo           -> Vercel hnd1
```

The exact mapping must be verified from the actual project region at provisioning time rather than inferred from old documentation.

Staging should use the same geographic pattern as production so latency/pooling behavior is representative.

## 9. Current project metadata gap

The repository already records a Vercel Web project, but does not currently record the production Supabase project's:

- project reference;
- region;
- plan/compute size;
- transaction/session/direct connection endpoints;
- configured pool size;
- backup/PITR policy;
- current Auth signing-key state.

The local tool environment also currently has:

```text
SUPABASE_ACCESS_TOKEN: unavailable
DATABASE_URL: unset
```

so this ticket cannot truthfully claim a live Supabase production smoke test.

This is a **provisioning/cutover prerequisite**, not a blocker to the target architecture.

Before creating/configuring `zhipanda-api`, record the non-secret Supabase metadata in a V2 deployment manifest.

## 10. Request database connection

Use the Supabase transaction-mode pooler for Vercel request/runtime traffic.

Conceptually:

```text
DATABASE_URL
  -> Supavisor transaction mode
  -> port 6543
```

Transaction mode is the appropriate Supabase path for serverless/auto-scaling clients and does not support prepared statements.

Kysely/node-postgres must therefore continue to avoid named prepared statements on this connection path.

If the paid project has a dedicated transaction pooler that materially reduces latency and the Vercel network path supports it, it may be selected during provisioning after measurement. The architectural requirement is transaction pooling, not one hard-coded hostname.

## 11. Application-side `pg.Pool`

Create one singleton `pg.Pool` per warm Nest process/function instance.

Initial production baseline:

```text
DB_POOL_MAX=1
min=0
connection timeout ~= 5s
idle timeout ~= 10s
max connection lifetime ~= 5min
bounded statement timeout ~= 10s
bounded query timeout slightly above statement timeout
bounded idle-in-transaction timeout ~= 5s
```

Why `max=1` initially:

- Vercel can create multiple warm instances;
- Fluid Compute adds in-instance invocation concurrency;
- Supavisor already multiplexes client connections;
- current Supabase guidance says serverless functions usually need very few application-side connections and often one is sufficient;
- opening 5-10 connections per warm instance multiplies total clients unnecessarily.

This is a safe starting value, not a permanent performance dogma.

Observe:

```text
pool.totalCount
pool.idleCount
pool.waitingCount
query latency
connection acquisition latency
Supabase client/backend connection metrics
```

Increase to `2` only if load tests show pool wait is a material bottleneck and Supabase headroom is healthy.

Do not jump from 1 to a large default pool without evidence.

## 12. Pool lifecycle

Rules:

- lazy-create physical DB connections;
- reuse the singleton Pool across warm invocations;
- never `pool.end()` after each request;
- install a Pool `error` listener;
- never depend on shutdown hooks to close the pool for correctness;
- after a cold start, the application can create a new pool and continue;
- no transaction state is kept outside the checked-out PoolClient/Kysely transaction executor.

## 13. Migration connection is separate

Vercel runtime does not receive migration authority.

Use a separate GitHub Actions/operator secret conceptually:

```text
DATABASE_MIGRATION_URL
```

Preferred path:

```text
direct PostgreSQL 5432
```

for migrations, dumps and database-native management commands.

If the GitHub runner cannot reach the project's direct IPv6 endpoint, explicitly choose a supported management connection such as session pooling or an IPv4 add-on. Do not silently reuse the request-time 6543 URL for schema migration.

Never run migration commands:

- in Nest `main.ts`;
- in `onModuleInit`;
- in Vercel build hooks;
- on the first user request;
- from a Cron pump.

## 14. Migration/deployment order

Baseline deployment order:

```text
1. CI validates SQL migrations against clean/local Supabase
2. CI validates supported upgrade path
3. protected migration job applies additive/new V2 schema changes
4. deploy Vercel API candidate
5. verify /health
6. verify /ready
7. run DB/Auth/public-contract smoke tests
8. activate/switch product traffic according to #321
9. destructive legacy cleanup only after rollback window
```

Because V2 uses new module-private schemas and new read models, most pre-cutover schema work can be expansion-style without adding application compatibility adapters.

Exact migration/cutover sequencing remains #321.

## 15. Fastify request body boundary

Set an explicit global Fastify body limit of **1 MiB**.

Fastify already uses a 1 MiB default, but V2 should configure it explicitly so a future framework/default change cannot silently expand the API upload surface.

This is intentionally well under Vercel's current 4.5 MB request/response function payload ceiling.

Ordinary JSON API requests should remain far below 1 MiB.

## 16. Large files do not traverse Nest

Do not proxy original image/document uploads through the Nest Vercel function.

Use:

```text
Browser
  -> Nest asks authorization/policy and reserves upload identity
  <- short-lived scoped R2 presigned PUT URL
Browser
  -> R2 S3 API directly
  -> Nest finalize/verify command
```

Benefits:

- bypasses Vercel request body limit;
- avoids consuming Function bandwidth/time for object bytes;
- keeps Nest responsible for authorization and metadata/workflow state;
- keeps R2 credentials out of the browser.

Presigned URLs are bearer credentials: keep expiration short and bind them to one specific object key/operation.

The browser needs an R2 CORS policy that permits only the intended Web origins and upload methods/headers.

## 17. R2 storage surfaces

Use separate security surfaces for:

```text
private original/pipeline input
private processing/staging derivatives
reviewed public media derivatives
```

This can be separate buckets or sufficiently strict separate credentials/prefixes, but a Python processing credential must not automatically have public publication authority.

For public production media use an R2 **custom domain**, conceptually:

```text
media.zhipanda.com
```

Do not use `r2.dev` as the production media origin.

Public immutable object keys may use long cache lifetimes.

## 18. Media takedown and CDN cache

#317 requires emergency media takedown to take effect even when historical releases remain immutable.

R2 custom-domain caching means deleting an object from R2 does not guarantee an already cached copy immediately disappears.

Therefore emergency public-media withdrawal must include a delivery action such as:

```text
Publication/Media takedown
  -> block public API URL exposure
  -> delete/disable public object when required
  -> purge Cloudflare cache for affected public URL(s)
```

This is a correctness action, not merely a performance cache operation.

## 19. DNS/proxy topology

Keep Cloudflare as authoritative DNS.

For Vercel Web/API records, use **DNS-only** routing in the V2 baseline.

Do not put the Vercel API behind an additional Cloudflare proxy layer merely because Cloudflare hosts DNS.

Reasons:

- Vercel already provides its own edge/network/firewall path;
- preserving Vercel's trusted forwarded-IP semantics is simpler;
- one less caching/proxy/WAF layer on authenticated API traffic;
- incident ownership stays clearer.

A Cloudflare proxy in front of Vercel may be introduced only after a specific need and an explicit forwarded-header/cache/security test.

R2 media custom-domain traffic naturally continues through Cloudflare.

## 20. Trusted client IP

Do not trust arbitrary incoming `X-Forwarded-For` in generic environments.

On Vercel, use the platform's sanitized forwarding headers/client-IP semantics through one platform adapter/request-context initializer.

Fastify `trustProxy` must be configured deliberately for the Vercel deployment environment, not globally because a developer can send an `X-Forwarded-For` header locally.

Client IP is diagnostic/security context; it is not authentication identity.

## 21. Liveness

Expose a version-neutral endpoint:

```text
GET /health
```

Semantics:

- no database query;
- no JWKS fetch;
- no R2 call;
- no queue read;
- no migration check requiring remote I/O;
- proves the Nest application booted and can serve HTTP.

Response is intentionally small and public-safe.

## 22. Readiness

Expose:

```text
GET /ready
```

Semantics:

- bounded `SELECT 1` through the normal request-time DB pool;
- strict short timeout;
- returns 200 when the authoritative database path is usable;
- returns 503 when it is not;
- no credentials, hostnames, SQL errors, pool sizes or internal exception detail in the public response.

This endpoint is an operational probe/acceptance signal. It is not Kubernetes-style traffic gating by Vercel.

Detailed dependency state belongs behind an authenticated operator surface/observability system from #319.

## 23. Public-release state is not global readiness

An intentionally suspended Public Release from #317 does **not** make the whole Nest service unready.

The API can still be operational for:

- identity/admin workflows;
- recovery;
- publication controls;
- health diagnostics.

Public knowledge routes themselves fail closed according to publication state.

## 24. Cold-start rules

Production bootstrap must not perform remote work whose failure prevents otherwise-recoverable instance initialization.

Specifically:

- no migrations;
- no queue polling;
- no publication rebuild;
- no crawler/import;
- no eager R2 check;
- no required database write;
- no required `auth.sessions` scan.

`pg.Pool` is constructed lazily and opens physical connections on query.

JWKS uses a reusable remote-set/cache mechanism, with network work only when verification needs it.

Provider clients may be singleton/configured at bootstrap but do not make mandatory network calls at bootstrap.

## 25. OpenAPI in production

Generate and validate the OpenAPI document during build/CI from #313.

Do not regenerate a full Swagger document as necessary runtime work for every cold start if production does not need the interactive documentation endpoint.

Production may expose the checked API spec/documentation only by deliberate policy. It is not needed for request correctness.

## 26. CORS

Production API CORS is allowlisted.

Expected production origins:

```text
https://zhipanda.com
https://www.zhipanda.com
```

Because API authentication is Bearer JWT rather than cross-origin cookie authentication, do not enable broad credentialed CORS by default.

Staging/preview origins are configured separately.

Never use production `Access-Control-Allow-Origin: *` for authenticated/application API routes.

## 27. Public API caching baseline

During initial V2 cutover, prefer correctness over aggressive cache complexity.

Current-release public knowledge API responses should initially use conservative caching, potentially `no-store` for correctness-sensitive routes, while retaining `ETag` support.

Why:

- #317 includes emergency takedown/suspension semantics;
- the product dataset is modest enough that PostgreSQL release-scoped reads are appropriate;
- this avoids needing a second cache-invalidation control plane before V2 is proven.

After production measurements, selected release-scoped/current endpoints may adopt CDN/Next caching with release-generation/takedown-aware keys and explicit invalidation.

Do not make a static Web rebuild the cache invalidation mechanism.

## 28. Vercel Cron

Use Vercel Cron only for the short bounded pumps accepted in #315, such as:

- Outbox fan-out;
- Updates projection;
- Audit projection;
- Notification intent;
- bounded notification delivery;
- webhook processing.

Routes are fixed internal endpoints in the same Nest application, conceptually:

```text
/internal/cron/outbox
/internal/cron/updates
/internal/cron/notifications
```

They are authenticated with Vercel `CRON_SECRET` Bearer semantics and are not public business APIs.

`CRON_SECRET` is a scheduler credential, not an administrator credential and cannot invoke unrelated admin commands.

## 29. Cron work budget

A Cron invocation must have both:

```text
max item count
max elapsed processing budget
```

and stop before the platform maximum duration.

A reasonable first implementation budget is on the order of tens of seconds, not hundreds of seconds.

Even though Vercel allows substantially longer Function execution on current plans, the V2 baseline does not turn a Cron HTTP request into a long-running worker host.

PGMQ/Outbox remain the durable pending-work state, so the next invocation can continue safely.

Overlapping/duplicate Cron calls are safe because queue claims, DB locks, receipts and idempotency provide concurrency correctness.

## 30. Long/heavy jobs

Continue using GitHub Actions for:

- acquisition/crawling;
- enrichment/research;
- large media processing;
- bulk release exports/builds where not appropriate for a short worker;
- large reconciliation/backfills;
- heavyweight privacy/export/delete phases;
- migration/recovery drills.

Do not run these from user-facing API requests merely because Vercel Functions can technically run for several minutes.

## 31. GitHub Actions and database credentials

Use separate least-privilege credentials by workflow purpose.

Examples:

```text
migration role/URL
pipeline worker role/URL
read-only validation role where useful
```

Do not place the production Nest API database password into every GitHub workflow.

#316's Python pipeline role remains distinct from Nest API and migration roles.

## 32. Secrets

### Vercel API secrets/config

Expected categories:

```text
DATABASE_URL                         request transaction-pooler URL
SUPABASE_URL / issuer configuration auth verification target
R2 signing credentials              only if Nest issues R2 upload URLs
CRON_SECRET                         scheduler authentication
provider secrets                    notification/etc.
observability credentials           #319
```

Do not require a Supabase legacy JWT secret for JWT verification.

Do not put `DATABASE_MIGRATION_URL` in Vercel.

Do not introduce a Supabase `service_role` API key into Nest unless a future feature specifically requires a Supabase HTTP API that cannot be implemented through the selected DB/Auth boundaries.

### Web public config

Only intentionally public browser configuration may use `NEXT_PUBLIC_*`.

No DB, R2 signing, notification provider or admin secrets enter the Web bundle.

### Environment isolation

Production and staging use different:

- Supabase projects/databases;
- database passwords;
- Auth signing keys/configuration;
- R2 private/staging credentials/surfaces;
- CRON secrets;
- provider secrets.

## 33. Deployment protection

Ad-hoc Vercel Preview deployments should use Vercel deployment protection when appropriate.

A stable staging API can be network-reachable for automated acceptance, but contains only staging data and still enforces normal application authentication/authorization.

Do not make a preview URL itself an authorization boundary.

## 34. Preview migration policy

API PR previews do **not** automatically apply migrations to production or shared staging.

For a schema-changing PR:

```text
CI clean/local Supabase
  -> apply complete migration history
  -> run migration/integration/contract tests
```

After merge or explicit release-candidate action:

```text
protected staging migration
  -> staging API deployment/acceptance
  -> protected production migration when approved
```

This avoids concurrent PRs fighting over one shared remote database schema.

## 35. Staging acceptance

Before production API cutover, stable staging must prove at least:

- Node 24 runtime;
- conventional Nest single-function deployment;
- Fluid Compute enabled;
- Fastify behavior;
- `/health`;
- `/ready` through transaction pooler;
- JWT/JWKS auth;
- capability authorization;
- Kysely transaction behavior;
- PostGIS query;
- PGMQ send/read/archive;
- Outbox dispatcher;
- Cron Bearer authentication;
- one bounded Cron pump;
- publication build/seal/activate/rollback/takedown smoke;
- R2 direct upload/finalize flow;
- public-media custom-domain delivery/takedown purge;
- OpenAPI contract smoke;
- Web generated client against staging API.

These are deployment acceptance checks, not new architecture decisions.

## 36. Production smoke

A production candidate deployment before DNS/traffic cutover should prove:

```text
/health
/ready
DB select + bounded transaction
Supabase JWT verification
representative public read
representative authenticated read
no privileged command unless explicitly test-scoped
```

Use synthetic/test identities/data specifically designated for production smoke where writes are needed.

Do not test publication/roles/takedowns against real live content casually during deployment verification.

## 37. Function limits are guards, not work budgets

Current Vercel supports function durations far longer than PandaAtlas should ordinarily need and a platform payload ceiling larger than the selected Fastify body limit.

Do not treat the platform maximum as the application target.

The application keeps materially smaller budgets:

```text
JSON request body             <= 1 MiB
DB statement                  bounded around seconds, not minutes
ordinary HTTP use case        bounded and expected to complete quickly
Cron pump                     tens of seconds + bounded item count
heavy batch                   GitHub Actions
large binary                  direct R2 path
```

## 38. Error behavior under dependency failure

If Supabase is temporarily unavailable:

- `/health` remains 200 if Nest itself is running;
- `/ready` returns 503;
- DB-backed API calls return stable dependency/service errors from #319;
- no fallback to mock/static/old Worker/D1 data;
- pending durable queues/outbox remain recoverable in PostgreSQL once service resumes.

If R2 is unavailable:

- ordinary non-media knowledge reads may continue;
- upload/finalize/media-specific operations fail explicitly;
- do not mark a failed upload as published.

## 39. Database backup baseline

Production Supabase Pro currently includes daily backups with seven-day history.

Record this policy explicitly before cutover and perform a restore rehearsal against a non-production target.

If #321 determines that losing up to one day of DB changes is unacceptable, enable PITR before cutover. PITR is a paid add-on and requires sufficient compute; the decision should be tied to RPO rather than enabled implicitly.

Database backup does not back up R2 object bytes. R2 media/pipeline-artifact durability and recovery must therefore be accounted for separately.

## 40. No production fallback runtime

V2 deployment does not keep Cloudflare Worker/D1 or FastAPI as an automatic runtime fallback.

During the bounded migration rollback window #321 may retain the old deployment as a rollback target, but once V2 is accepted and the rollback window closes:

```text
Vercel Nest + Supabase
```

is the authoritative API runtime.

Do not add run-time fallback logic such as:

```text
if Supabase down -> call Worker/D1
if Nest fails -> read checked-in release
```

That would recreate dual authority.

## 41. Architecture telemetry needed to tune deployment

#319 should make these observable:

```text
Vercel invocation/wall/active duration
cold-start/bootstrap duration where available
HTTP latency/status
pg pool total/idle/waiting
DB acquisition/query/transaction latency
Supabase connection saturation
Outbox lag
PGMQ queue depth/age/retry/DLQ
Cron run outcome/drain counts
R2 upload/finalize failures
publication state
```

The initial `DB_POOL_MAX=1` is re-evaluated from these metrics and load tests, not intuition.

## 42. Current repo migration consequences

The V1 FastAPI serverless closure/build system is not translated into V2.

Delete/rewrite after cutover:

```text
services/api/index.py
FastAPI ASGI Vercel entrypoint
Python serverless closure classifier
Python Vercel excludeFiles logic created only to keep crawler/batch dependencies out
FastAPI runtime-boundary deployment checks
```

The independent Python split from #316 makes that elaborate Python tree-shaking/exclusion strategy unnecessary.

The V2 Nest service should be a naturally small Node workspace rather than a large mixed-runtime package that requires custom closure computation.

## 43. Proposed deployment manifest

#320/#321 should create a non-secret V2 deployment manifest that records at least:

```text
web Vercel project ID + root
production API Vercel project ID + root
staging API Vercel project ID + root
Node major
Fluid Compute enabled
API function region
production Supabase project ref + region + plan/compute class
staging Supabase project ref + region
runtime connection mode (transaction)
pool defaults
backup/PITR policy
public API domain
Web domains
R2 public media domain/bucket identity (non-secret)
Cron route/cadence identifiers
cutover/rollback owner
```

Do not record passwords/tokens/connection-string secrets in Git.

## 44. External facts verified for this decision

Current official documentation checked on 2026-08-26 establishes:

- Vercel supports NestJS as a backend framework on Fluid Compute;
- Fluid Compute runs concurrent invocations in one instance;
- Vercel Functions have finite request/response payload and execution limits;
- Vercel Cron can provide minute-level schedules on paid plans;
- Supabase recommends transaction-mode pooling for temporary/serverless clients;
- Supavisor transaction mode does not support prepared statements;
- Supabase troubleshooting guidance recommends starting serverless client connection limits very low, often one;
- Supabase Pro daily backups retain seven days and PITR is a paid add-on;
- R2 `r2.dev` is intended for non-production use while production public buckets should use custom domains;
- R2 presigned URLs support direct single-object browser uploads and must be treated as bearer credentials;
- when custom-domain caching is enabled, an R2 delete may require explicit Cloudflare cache purge to stop cached delivery immediately.

## 45. What was not externally validated

Because the current environment has no Supabase access token or production `DATABASE_URL`, this ticket does **not** claim live verification of:

- the current production Supabase project reference;
- current production/staging Supabase regions;
- current plan/compute size;
- actual configured Supavisor pool size/client limit;
- current Auth signing key state;
- production database latency from a Vercel region;
- PITR status;
- a live PGMQ round trip through Vercel.

Likewise, no new Vercel API project or staging project was created in this planning session.

Those are explicit provisioning/staging acceptance tasks before #321 authorizes cutover.

## 46. Rejected alternatives

### One Web+API Vercel project/services deployment

Rejected for the V2 baseline because separate projects match the existing project boundary and allow independent API region, secrets, Cron, rollback and release cadence with less coupling.

### Long-lived container/API host

Rejected. Current Nest/Vercel support and the chosen serverless-safe architecture do not show a need for a self-managed/persistent host.

### Multi-region API by default

Rejected. One Supabase primary means multiple API compute regions add DB distance/pools without making the authoritative database highly available across regions.

### Large `pg` pool per function instance

Rejected. Autoscaling + Fluid concurrency + server-side pooling make large application-side pools risky without evidence.

### `NullPool` equivalent / brand-new TCP connection for every request

Not selected for Node baseline. A tiny reusable warm-instance `pg.Pool` retains connection reuse while keeping total client pressure low. Pool correctness never depends on warm reuse.

### Database migration at app startup

Rejected due cold starts, concurrent instances and unsafe schema mutation from request runtime.

### Uploading media through Nest

Rejected due payload/function bandwidth/lifecycle constraints. Use R2 presigned direct upload.

### Keeping D1/Worker as failover

Rejected because it reintroduces a second public-data authority and publication parity problem.

### Aggressive current-content CDN caching at initial cutover

Rejected as initial baseline because emergency takedown correctness matters more than reducing modest PostgreSQL read traffic. Optimize after production evidence.

## 47. Decisions deferred to later Wayfinder tickets

- Exact metrics/log/tracing/error taxonomy, SLOs, alerts and load-test gates: #319.
- Exact `services/api` workspace files, package scripts, Vercel config and CI package graph: #320.
- Exact staging/prod provisioning sequence, DNS switch, migration gate, rollback window, RPO/PITR decision and old runtime deletion date: #321.
- Final consolidated baseline and implementation tickets: #322.

## Acceptance for #318

Later planning can now assume all of the following without reopening this ticket:

- Web and Nest API use separate Vercel projects; staging API is a third stable project using a separate staging Supabase project.
- Vercel Pro and Supabase Pro are the minimum production baseline implied by current Cron/production DB requirements.
- Node is pinned to 24.x.
- Nest keeps conventional `src/main.ts`; the whole modular monolith runs as one Fluid Compute Function.
- API compute runs in one region selected next to the Supabase primary; multi-region is not baseline.
- production request DB traffic uses transaction pooling; application-side `pg.Pool` starts at max=1 and increases only by evidence.
- runtime and migration DB credentials/connection modes are separate; migrations never run in Vercel bootstrap/build/request/Cron.
- global Fastify JSON/body boundary is 1 MiB.
- large file/media uploads go directly browser-to-R2 via short-lived scoped presigned URLs.
- public media uses an R2 custom domain, not r2.dev; emergency takedown includes cache purge when cached delivery is possible.
- `/health` has no remote dependency and `/ready` performs only a bounded normal-pool DB probe.
- cold-start initialization has no migration, queue loop, publication build or mandatory remote write.
- Vercel Cron runs only short bounded idempotent pumps; long/heavy work remains GitHub Actions.
- production/staging secrets and data are isolated; migration and pipeline workers have separate roles.
- current public API caching begins conservatively; no static/Worker/D1 fallback can bypass Publication controls.
- Supabase production metadata and live Vercel↔Supabase smoke evidence are still required before cutover because the current tool environment cannot inspect that project.
