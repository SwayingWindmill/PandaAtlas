# ZhiPanda V2 Architecture Baseline

- Status: **Target implementation baseline**
- Date: 2026-08-26
- Planning source: Wayfinder map #309 and decisions #310-#321
- Product priority: panda fan experience first
- Current production status: see `docs/deployment/runtime-status.md` until V2 cutover completes

## 1. Purpose

This document is the canonical architecture baseline for the NestJS V2 rebuild of ZhiPanda/PandaAtlas.

It governs V2 implementation. It does **not** claim that production has already cut over from the current FastAPI/Cloudflare V1 runtime.

The core migration rule is:

> **Migrate business truth and product invariants; do not migrate the FastAPI architecture.**

V2 is a replacement architecture, not a TypeScript translation of the Python package tree.

## 2. Architecture principles

1. Build a business-capability modular monolith, not microservices.
2. Supabase PostgreSQL/PostGIS is the single authoritative database.
3. NestJS owns the online HTTP/business runtime; Python remains a separate data/research runtime.
4. Preserve business meaning, provenance, security, auditability, recovery properties, and database invariants; do not preserve FastAPI routers/services/Pydantic/SQLAlchemy/Worker/D1 shapes.
5. Prefer explicit, boring platform primitives over speculative abstraction.
6. Do not introduce Redis, BullMQ, Kafka, RabbitMQ, Temporal, or another datastore without measured need.
7. No compatibility layer for `/api/v1`, FastAPI error shapes, V1 snake_case payloads, Worker/D1 fallback, legacy admin tokens, or actor headers.
8. Keep engineering governance proportional: every defensive check, test, gate, retry, or fallback must correspond to a concrete trust, invariant, concurrency, external-failure, architecture, or release risk.
9. Test each risk at the cheapest sufficient layer; do not duplicate the same assertion mechanically through every test layer.
10. Keep deployment managed-only: no persistent self-managed production server.

## 3. Target production topology

```text
Cloudflare DNS
  |
  +-- zhipanda.com / www.zhipanda.com
  |     -> Vercel Next.js
  |
  +-- api.zhipanda.com
  |     -> Vercel NestJS / Fastify
  |           |
  |           +-> Supabase PostgreSQL/PostGIS
  |           +-> Supabase Auth/JWKS
  |           +-> PGMQ / Outbox-backed jobs
  |
  +-- media.zhipanda.com
        -> Cloudflare R2

GitHub Actions
  +-> protected SQL migrations
  +-> Python panda-data jobs
  +-> long/heavy batch jobs
  +-> staging/cutover workflows

Vercel Cron
  +-> short bounded Outbox/PGMQ pumps
```

Cloudflare remains for DNS and R2. D1, the public API Worker, and OpenNext are transitional V1 infrastructure and are not part of the V2 target.

## 4. Target repository layout

```text
PandaAtlas/
├─ apps/
│  └─ web/                     # Next.js
├─ services/
│  └─ api/                     # NestJS modular monolith
├─ packages/
│  └─ api-client/              # generated private HTTP client
├─ tools/
│  └─ panda-data/              # Python + uv
├─ contracts/
│  ├─ http/
│  ├─ integration/
│  ├─ pipeline/
│  └─ fixtures/
├─ infra/
│  └─ supabase/
├─ docs/
├─ .github/workflows/
├─ tsconfig.base.json
├─ eslint.config.mjs
├─ dependency-cruiser.config.mjs
├─ package.json
└─ package-lock.json
```

JavaScript workspaces are explicit:

```text
packages/api-client
apps/web
services/api
```

Use npm workspaces only. Do not add Turborepo, Nx, Lerna, Changesets, pnpm migration, project-reference graphs, or shared-config packages without a measured problem they solve.

The only initial shared npm package is `api-client`.

Do not create generic `shared`, `common`, `utils`, `types`, `domain`, `config`, `ui`, `eslint-config`, or `tsconfig` packages as architectural escape hatches.

## 5. NestJS runtime baseline

- Node.js 24 LTS.
- NestJS 11.
- Fastify 5 via `@nestjs/platform-fastify`.
- Strict TypeScript.
- `module` / `moduleResolution`: NodeNext for the API.
- One conventional composition root: `src/main.ts` + `AppModule`.
- No Nest microservice transport in the authoritative API.
- No Express runtime/types in the API baseline.
- Singleton DI by default.
- No business `forwardRef()` cycles.
- No request-scoped providers unless a concrete need is proven.
- Native `AsyncLocalStorage` is the one request-context mechanism.
- Constructors and init hooks do not perform remote side effects, migrations, polling, or durable work.
- No `setInterval` worker loops inside the Vercel API runtime.

Conceptual API tree:

```text
services/api/src/
├─ main.ts
├─ app.module.ts
├─ platform/
│  ├─ config/
│  ├─ database/
│  ├─ http/
│  ├─ request-context/
│  ├─ auth/
│  ├─ observability/
│  ├─ outbox/
│  └─ storage/
└─ modules/
   └─ <business capability>/
```

A mature module may contain `domain`, `application`, `infrastructure`, and `http`, but empty decorative layers are not required.

## 6. Business module map

V2 has 18 business modules.

### Knowledge / panda world

1. **Evidence** — source identity, provenance, verification/access metadata, public-safe source summary.
2. **Panda** — stable panda identity, slug, names, aliases, external IDs, core biographical facts, evidence-aware conclusions.
3. **Lineage** — parentage assertions, status/uncertainty, derived family relationships.
4. **Places** — institutions, places, habitats, protected areas, distribution geography.
5. **LifeHistory** — residency periods, life events, participants, temporal precision/status; calendar derives from this truth.
6. **Media** — reviewed assets, rights/licence/attribution, derivatives, R2 metadata, public eligibility.

### Editorial governance

7. **Contribution** — submissions, immutable revisions, attachment metadata/policy.
8. **Review** — review cases, assignments, triage, evidence verification, requests for information, decisions, incorporation recommendations.
9. **Moderation** — warnings, restrictions, sanctions, restoration, appeals.
10. **Curation** — editorial changes, validation, approval, provenance.
11. **Publication** — immutable release lifecycle, membership, sealing, activation, rollback, withdrawal/takedown control.

### Fan experience

12. **Identity** — application account state, roles, capabilities, revocations, security policy; Supabase Auth remains external authentication authority.
13. **Engagement** — Favorite, Collection, LocationCheckin, SeenPanda.
14. **Game** — Random Panda, Guess Panda, question/rule data, attempts.
15. **Updates** — public-safe updates/announcements, personalized eligibility/read state/cursors; replaces V1 Activity + Feed split.
16. **Notification** — preferences/consent, notification intent, inbox, delivery attempts/receipts, delivery policy.

### Compliance / evidence

17. **Privacy** — privacy-request state, execution, exports, retention/holds/deletion tombstones through narrow module ports.
18. **Audit** — append-only downstream evidence projection; never a business state source.

Forbidden V2 business modules include generic `api`, `schemas`, `services`, `integration`, `projection`, `admin_content`, `admin_media`, `archive_*`, `community_curation`, combined `review_moderation`, and generic `shared/common/utils` domains.

## 7. Module dependency rules

Synchronous cross-module calls are allowed only when the caller cannot produce a correct command result without an immediate authoritative answer.

Approved examples:

```text
Lineage -> Panda
LifeHistory -> Panda, Places
Engagement -> Panda / Places
Review -> Contribution
Moderation -> Identity
Curation -> owning fact modules
Publication -> Curation
Updates -> Engagement for current eligibility
Privacy -> narrow export/delete/privacy ports
```

Durable asynchronous reactions are used when the caller remains correct without downstream completion:

```text
published knowledge -> Updates
Updates / publication -> Notification
all relevant contexts -> Audit
Review incorporation -> Curation when immediate consistency is unnecessary
Review abuse -> Moderation
lagging projections / analytics
```

Rules:

- no cycles;
- no cross-module repository imports;
- no cross-module private-table reads/writes;
- DB foreign keys may enforce integrity but are not application APIs;
- module public surfaces export narrow application/query ports, not repositories/entities/DTO internals;
- domain is framework-free;
- application is framework-neutral and does not import Nest, Fastify, Kysely, pg, Pino, Sentry, or OTel;
- infrastructure owns provider/database adapters;
- controllers invoke application commands/queries.

## 8. PostgreSQL and persistence

Use **Kysely + node-postgres** as the SQL-first data layer.

Do not use Prisma or TypeORM as the primary persistence abstraction and do not recreate SQLAlchemy-style generic repositories.

`infra/supabase/migrations/*.sql` is the sole schema-migration authority.

### Schema ownership

Authoritative V2 server state moves toward private capability schemas, conceptually:

```text
evidence.*
panda.*
lineage.*
place.*
life_history.*
media.*
contribution.*
review.*
moderation.*
curation.*
publication.*
identity.*
engagement.*
game.*
updates.*
notification.*
privacy.*
audit.*
integration.*
pipeline.*
public_read.*
```

`public` is reserved for deliberately public database-facing projections/views where justified; browser code does not receive generic direct write authority to business tables.

### Transactions

- application commands own transaction boundaries;
- transaction scope is propagated explicitly, not hidden in ALS;
- repositories do not open surprise nested transactions;
- cross-module atomic work uses narrow transaction-participant ports only for true invariants;
- otherwise write owner state + durable Outbox event;
- external side effects never occur inside a DB transaction;
- `READ COMMITTED` is the default unless measured correctness requires stronger isolation;
- prefer constraints, row locks, versions, and idempotency before stronger isolation.

### Connections

Request/serverless traffic uses Supavisor transaction mode.

Baseline:

```text
one singleton Kysely per warm runtime
one bounded pg.Pool
pool max = 1 initially
no named prepared statements
```

Migration/session-sensitive operations use a separate direct/session-capable connection path.

## 9. HTTP and client contract

The only hand-authored HTTP truth is the Nest HTTP boundary: controllers + concrete DTO classes + protocol metadata.

Generate one OpenAPI 3.1 artifact:

```text
contracts/http/openapi.v2.json
```

Generate the private TypeScript client using:

```text
openapi-typescript
openapi-fetch
```

The Web imports the generated client package; it never imports Nest DTO/domain source directly.

### V2 wire conventions

- business routes: `/api/v2/...`;
- infrastructure routes: `/health`, `/ready`;
- JSON/query field names: camelCase;
- path segments: lower-case/kebab-case;
- stable lowerCamel operation IDs;
- no universal `{data, meta}` success envelope;
- errors: RFC 9457 `application/problem+json`;
- stable extensions: `code`, `requestId`, optional bounded `errors`;
- request validation failures use HTTP 400, not FastAPI 422;
- ETag/If-Match for representation concurrency where needed;
- retry-safe commands use `Idempotency-Key` header when justified.

No `/api/v1` aliases, snake_case transformer, FastAPI `detail` compatibility, manual V2 OpenAPI YAML fragments, or hand-maintained frontend transport interfaces.

## 10. Identity, authentication, and authorization

### Authentication authority

Supabase Auth remains the authentication authority.

Production V2 requires asymmetric Supabase JWT signing keys; prefer ES256, accept RS256. Do not implement HS256/legacy-secret compatibility in Nest.

Use `jose` with remote JWKS and local token verification.

Verify at least:

```text
issuer
audience = authenticated
exp / iat / nbf
algorithm allowlist
UUID sub
role = authenticated
is_anonymous = false
session_id
aal
```

`sub` is the stable application account identity.

### Authorization authority

PostgreSQL Identity is the authorization authority.

Global deny-by-default guards:

1. authentication guard verifies Supabase JWT and enriches request context;
2. application-access guard loads one authoritative Identity snapshot and enforces capability/security policy.

Public routes are explicit.

Controllers authorize with capabilities, not role names.

A role is an administrative capability bundle; `administrator` has no wildcard/root bypass.

Security policy can require:

```text
sensitive
requiresRecentAuth
minimumAal
requiresLiveSession
```

Recent authentication is derived from current-session JWT AMR evidence, not account-global `last_authenticated_at` and not JWT `iat`.

AAL2/live-session checks are reserved for high-impact commands.

Remove V1 actor/admin bypasses:

```text
ADMIN_API_TOKEN
X-Actor-Id
workflow actor header
email-based admin bootstrap
custom JWT capability claims as authority
```

Account provisioning is an explicit authenticated idempotent Identity command, not a write performed on every protected request.

## 11. Domain events, Outbox, PGMQ, and jobs

### Domain events

Domain events are module-local synchronous objects. They are not a durable cross-module bus.

Do not use Nest EventEmitter as authoritative durable integration infrastructure.

### Integration events

All durable cross-module facts are written to a transactional Outbox in the same PostgreSQL transaction as owner state.

Canonical event envelope includes stable identifiers/versioning, source module, occurred time, correlation/causation, bounded actor reference, and schema-versioned payload. Never include raw JWTs or unnecessary PII.

### Fan-out

The Outbox dispatcher atomically fans events into consumer-specific private PGMQ queues.

Do not use one shared `integration_events` queue as a broadcast bus.

Examples:

```text
integration_updates
integration_notification
integration_audit
```

Outbox is the durable/replayable cross-module fact history. PGMQ is execution transport, not an event store.

### Delivery semantics

State the guarantee as:

> at-least-once execution + idempotent consumer

Consumers use durable receipt/idempotency records or domain uniqueness as appropriate.

Retries are bounded and only used for replay-safe transient failures. Poison/permanent messages move to a dead-letter path rather than blocking a queue.

### Worker execution

- no polling during API startup;
- short bounded pumps may run through Vercel Cron/invocation;
- long/heavy work runs through GitHub Actions;
- external side effects happen after durable intent is committed;
- `waitUntil()` is only for harmless best-effort work, not durable publication/notification/audit/privacy execution.

## 12. Python `panda-data` boundary

Python remains valuable for:

```text
acquisition
crawling
enrichment
identity-resolution assistance
curation assistance
media processing
release/export artifact building
research
```

It becomes an independent project under `tools/panda-data`, managed by `uv`.

It is not a second backend and exposes no production HTTP server.

Nest remains authoritative for business-state decisions.

### Cross-runtime boundary

Allowed mechanisms:

1. JSON Schema Draft 2020-12 contracts;
2. immutable artifacts in R2;
3. module-owned read/export views;
4. pipeline jobs/events through PostgreSQL/Outbox/PGMQ;
5. rare Nest HTTP calls only when the interaction is genuinely an application API.

Canonical cross-runtime schemas are language-neutral JSON Schema, validated by Python `jsonschema` and Ajv 2020 strict mode.

Pydantic models and TypeScript interfaces are consumers, not the contract authority.

Python uses a least-privilege DB role and may write pipeline/job/artifact state, not authoritative Panda/Lineage/Publication/etc. tables.

Large outputs are immutable artifacts referenced by job IDs/artifact IDs; do not put large payloads directly into PGMQ.

Do not use pickle/joblib/ad-hoc SQLite/DuckDB/base64-compressed files as production cross-runtime contracts.

## 13. Publication and public reads

Publication is split into immutable content and mutable control state.

### Release model

```text
build
 -> validate
 -> sealed immutable release
 -> activation pointer
```

A sealed release never changes.

Activation/rollback changes a separate current-release pointer and records transition history.

Rollback switches the pointer to a previous sealed release; it does not copy content into a new rollback batch.

### Public read model

Public API requests read release-scoped typed PostgreSQL projections, conceptually:

```text
public_read.pandas
public_read.panda_aliases
public_read.lineage_edges
public_read.parentage_assertions
public_read.institutions
public_read.places
public_read.events
public_read.media
public_read.sources
public_read.distribution_features
public_read.habitat_features
public_read.release_stats
```

Each row is release-scoped where needed.

A composite public query resolves the active release once and pins that `releaseId` for all subqueries so a single response cannot mix releases.

Do not reconstruct current public state on every request by replaying ChangeSet/Revision history.

Do not make a universal `public_json` table the primary model.

### Emergency takedown

Normal correction creates a new release.

A narrow emergency takedown overlay exists for urgent privacy, wildlife-location, copyright, or severe factual issues. Takedowns survive release rollback until explicitly restored.

A whole public release may be temporarily suspended without deleting it.

### Scope

Release snapshots freeze public knowledge content, not live user/account state.

Updates and Notifications react asynchronously to publication events rather than being embedded into the release snapshot.

## 14. Media

Cloudflare R2 remains the public-media/object store.

Browser upload flow:

```text
Browser -> Nest authorization
Browser <- short-lived presigned PUT
Browser -> R2 directly
Nest <- finalize/verify metadata
```

Do not stream normal large uploads through Nest.

Public media should use an R2 custom domain such as `media.zhipanda.com`, not `r2.dev`.

Deletion/takedown must account for CDN cache purge when a public cached object must disappear immediately.

A narrow permanent redirect may preserve already-published legacy `/media/releases/...` asset URLs if external URL stability requires it. This is an asset-URL concern, not `/api/v1` API compatibility.

## 15. Observability and errors

### Logging

Use one DI-managed Pino-based Nest `LoggerService` and JSON stdout to Vercel Runtime Logs.

Request logs use normalized route templates, one completion event, strict redaction, and identifiers from native ALS request context.

Do not create a second logging-specific request context.

### Tracing

Use `@vercel/otel` as the OpenTelemetry bootstrap and Fastify-maintained instrumentation where useful.

Use explicit low-cardinality application/worker spans.

Do not enable raw SQL text/bind-value tracing by default.

### Error aggregation

Use `@sentry/nestjs` for unexpected error aggregation/source maps with its own OTel setup disabled so Vercel OTel remains the trace owner.

### Metrics

Initial baseline does not deploy Prometheus/Grafana/custom metrics collectors.

Use Vercel platform signals, Supabase DB/resource signals, and low-cardinality structured completion measurements for queue lag, pool wait, publication build, delivery, etc.

### Error taxonomy

Domain/application errors map centrally to stable `<namespace>.<condition>` codes and RFC 9457 categories.

Unknown failures become safe `system.internal` responses; internal diagnostics stay in observability, not client responses.

## 16. Testing strategy

API test stack:

```text
Vitest
unplugin-swc / @swc/core
V8 coverage
@nestjs/testing only where DI/module wiring is the thing under test
Fastify app.inject() for HTTP contract tests
real PostgreSQL/PostGIS/PGMQ for persistence integration
```

Web continues to use Playwright for critical browser journeys/accessibility.

Test rule:

> Put a behavior primarily at the cheapest layer that proves the risk. Add a higher-level test only when the integration itself is the risk.

Do not require one test file per class, duplicate validation through unit+HTTP+E2E+browser, test generated interfaces field-by-field, create giant in-memory repository replicas, or run all suites for unrelated changes.

A coarse initial 80% line/branch floor applies to meaningful domain/application code. Do not create per-file/per-module/100% coverage bureaucracy.

## 17. Architecture enforcement

Use three mechanisms because they cover distinct risks:

```text
ESLint
+ dependency-cruiser
+ one small V2 semantic/storage checker
```

Fail CI on real violations such as:

```text
cycles
cross-module repository imports
cross-module private-table access
application/domain importing framework/provider code
Web importing API server source
business forwardRef/ModuleRef/global-module escapes
V2 runtime importing Worker/D1/FastAPI compatibility code
OpenAPI/client or schema/type drift
```

Do **not** recreate V1 repository top-level file/directory whitelists, “gate for the gate” checks, or dozens of architecture micro-scripts.

## 18. Build and CI

Use normal workspace scripts and small root aggregation commands.

Build means build; install means install; test means test.

No hidden migration/codegen/architecture work in `postinstall`, `prebuild`, `predeploy`, or nested command-router wrappers.

Generated artifacts are explicit and checked for drift:

```text
contracts/http/openapi.v2.json
packages/api-client/src/generated/schema.d.ts
services/api/src/platform/database/generated/database.ts
```

PR CI is risk-scoped with simple path filtering.

Examples:

- domain/application change -> lint, typecheck, architecture, relevant Vitest;
- HTTP change -> plus Fastify contract/OpenAPI-client drift;
- DB change -> plus migration replay and relevant real-DB integration;
- schema change -> Python + Ajv strict validation;
- Web change -> Web lint/typecheck/build + relevant critical journey;
- Python change -> Ruff/type/tests for the affected scope.

Full managed staging, broader DB/browser, load, and recovery evidence belongs at main/staging/release/cutover boundaries where it is useful.

## 19. Managed deployment

### Vercel projects

Use separate projects/deployment units:

```text
Web production/preview -> apps/web
Nest production        -> services/api
Nest stable staging    -> services/api
```

The Nest app deploys conventionally as one Vercel Fluid Compute function; do not build a FastAPI-style handler/closure wrapper.

Colocate API and Supabase region where practical.

### Health

`GET /health` proves the Nest process is alive and does not call remote dependencies.

`GET /ready` performs a bounded DB readiness probe through the real request connection path and returns 503 when the DB dependency is unavailable.

Publication suspension is not infrastructure un-readiness.

### Migrations

Application startup never runs migrations.

Protected GitHub Actions/controlled operator workflows use migration credentials separate from request-runtime DB credentials.

## 20. Migration and cutover

V2 uses a bounded replacement migration, not long-running dual operation.

### Before cutover

- build V2 off canonical production traffic;
- add V2 schemas additively while V1 remains authoritative;
- move surviving Python to `tools/panda-data`;
- rehearse deterministic V1->V2 migration;
- prepare V2 Web/API deployments, R2 domain, backup evidence, and one sealed candidate release;
- keep V1 tables/runtime working until its rollback window closes.

### Final freeze

Pause V1 business writes/publication/jobs and do not accept V2 production writes yet.

Run a final deterministic full backfill when rehearsal proves it fits the cutover window. Only introduce a one-time delta pass if measurement proves a full rebuild cannot fit.

D1 is never a V2 migration source.

### Routing sequence

1. V2 Web temporarily calls the stable Vercel API project hostname.
2. Move `zhipanda.com` / `www.zhipanda.com` to Vercel Web while canonical `api.zhipanda.com` remains legacy.
3. Validate and close the legacy Web rollback window.
4. Move canonical `api.zhipanda.com` to Nest while V2 Web still calls the stable project hostname.
5. Validate Nest production.
6. Declare the explicit **V2 commit point**.
7. Close Worker/D1/FastAPI runtime rollback **before** V2 authoritative writes reopen.
8. Reopen V2 writes/publication/workers.
9. Reconfigure Web to canonical `https://api.zhipanda.com`.
10. Begin legacy cleanup immediately.

There is no period where V1 and V2 both own writes.

Do not add dual-write, triggers, CDC, reverse sync, V1 Nest controllers, or percentage canary routing between incompatible V1/V2 contracts.

### Post-commit rollback

After V2 begins accepting production writes, rollback is V2-to-V2 via a previous Vercel deployment or forward fix.

Database restore/PITR is disaster recovery for actual data corruption, not normal app deployment rollback.

Normal V2 DB evolution uses bounded expand/contract discipline so a previous known-good V2 deployment can remain a short-term rollback candidate.

## 21. Legacy retirement

After the respective rollback window closes, delete rather than indefinitely preserve:

### Web legacy

```text
OpenNext
apps/web/open-next.config.ts
wrangler Web configs
Cloudflare Web runtime glue/deploy scripts
Cloudflare Web Worker resources
```

### API projection legacy

```text
services/worker-api/**
D1 schema/migrations/databases
Worker API deployment/release tooling
D1 release activation/rollback machinery
Worker parity/compatibility tests
```

### FastAPI legacy

```text
services/api/app/**
index.py
FastAPI pyproject/uv.lock under services/api
SQLAlchemy/Pydantic HTTP runtime
manual V1 OpenAPI fragments
FastAPI Vercel closure tooling
FastAPI-specific Web proxies
FastAPI API tests
```

Surviving Python capabilities must already live in `tools/panda-data`.

Use Git history/tagging for forensic access to the final V1 source; do not create a permanent `legacy/fastapi` museum inside the V2 repository.

Old V1 DB tables are removed through later forward SQL cleanup when no V2/runtime/tool dependency remains.

## 22. Intentional V1 breaking changes

V2 does not preserve:

```text
/api/v1
snake_case wire payloads
FastAPI 422 behavior
FastAPI detail error body
ADMIN_API_TOKEN
X-Actor-Id
email bootstrap admin behavior
V1 custom JWT authority assumptions
Worker/D1 public-read implementation
manual V1 OpenAPI/checklist contracts
D1 publication activation APIs/scripts
```

The V2 Web migrates to the generated V2 client as part of the product migration.

Once `/api/v2` is production, future breaking HTTP changes require an explicit later API-version decision; the lack of V1 compatibility is not permission for careless V2 breakage.

## 23. Proportional engineering rule

The following are explicitly **not** quality goals:

- maximum abstraction;
- maximum number of checks;
- maximum test count;
- maximum fallback paths;
- maximum retry coverage;
- one wrapper around every library;
- one base class for every repeated shape;
- “future proofing” unsupported scenarios.

A defensive check must name the failure mode it prevents.

Prefer the guarantees already provided by:

```text
TypeScript types
validated HTTP/config boundaries
PostgreSQL constraints
module ownership
explicit transactions
idempotency where retries are real
managed platform primitives
```

Avoid catch-log-rethrow templates, duplicate exists-before-insert checks when a uniqueness constraint is authoritative, blanket repository retries, mock fallbacks in production, runtime fallback to V1, or generic Result/base/wrapper layers without boundary value.

## 24. Superseded and retained architecture documents

### Superseded for V2 implementation

This baseline supersedes the V2 applicability of:

- `docs/architecture/zhipanda-v1-architecture-baseline.md` runtime/backend architecture;
- ADR 0001's FastAPI/Worker/D1 authority and `/api/v1` compatibility model;
- ADR 0002's FastAPI-specific managed API target and phased FastAPI deployment work;
- `docs/architecture/api-request-runtime-boundary.md` FastAPI serverless-closure design;
- V1 dependency/storage-check documents where they encode the Python module/storage graph;
- D1/OpenNext-specific publication/deployment architecture;
- V1 combined module boundaries such as `review_moderation`, `community_curation`, Activity/Feed split, and archive-workbench architecture where replaced by the V2 module map.

These files may remain as historical records until repository cleanup, but they are not V2 implementation authority.

### Product/business truths retained

The following V1 truths remain unless a later product decision changes them:

- panda fan experience first;
- one stable panda identity across product surfaces;
- lineage/family as first-class structured data;
- Institution and Place are distinct;
- Calendar derives from event/birth truth rather than becoming a second event store;
- Favorite is the single saved-panda relationship;
- Collection, LocationCheckin, SeenPanda, Notification consent, and GameAttempt remain distinct concepts;
- Check-in does not imply a panda was seen and vice versa;
- provenance/review/moderation/privacy/audit/publication support the product rather than becoming the public product hierarchy.

### Operational documents

`docs/deployment/runtime-status.md` continues to describe **current production** until actual cutover. It must not be rewritten to claim V2 is live merely because implementation starts.

After the V2 commit point, operational docs/ADRs must be updated to describe only the real V2 production topology and mark V1 deployment phases superseded.

## 25. Implementation authority

Implementation work must follow the delivery graph in:

`docs/implementation/nestjs-v2-implementation-map.md`

A delivery ticket may refine code-level details inside its accepted architecture boundary. It may not reopen settled architecture merely because a V1 file suggests a different structure.

Reopen an architecture decision only when implementation discovers material evidence that an accepted baseline cannot satisfy correctness, security, operability, or product requirements.

## 26. Source decision records

The detailed research/decision assets remain useful supporting evidence:

- `docs/research/nestjs-v2-domain-module-map-2026-08-26.md`
- `docs/research/nestjs-v2-runtime-foundation-2026-08-26.md`
- `docs/research/nestjs-v2-postgresql-transaction-architecture-2026-08-26.md`
- `docs/research/nestjs-v2-http-openapi-client-strategy-2026-08-26.md`
- `docs/research/nestjs-v2-identity-authorization-security-2026-08-26.md`
- `docs/research/nestjs-v2-events-outbox-background-execution-2026-08-26.md`
- `docs/research/nestjs-v2-python-pipeline-boundary-2026-08-26.md`
- `docs/research/nestjs-v2-publication-public-read-architecture-2026-08-26.md`
- `docs/research/nestjs-v2-managed-deployment-architecture-2026-08-26.md`
- `docs/research/nestjs-v2-observability-testing-enforcement-2026-08-26.md`
- `docs/research/nestjs-v2-monorepo-layout-build-tooling-2026-08-26.md`
- `docs/research/nestjs-v2-migration-cutover-retirement-2026-08-26.md`

When this baseline and a research note appear to differ, this synthesis is the governing V2 statement unless the difference is an implementation detail explicitly deferred here.
