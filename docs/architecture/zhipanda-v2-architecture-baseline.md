# ZhiPanda V2 Architecture Baseline

- Status: **Governing architecture; V2 is live**
- Date: 2026-08-26; updated to the live system 2026-10-14
- Planning source: Wayfinder map #309 and decisions #310-#321
- Product priority: panda fan experience first

## 1. Purpose

This document is the canonical application/domain architecture baseline for the NestJS V2 rebuild of ZhiPanda/PandaAtlas.

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

## 3. Production topology

```text
Cloudflare DNS (custom domains only)
  |
  +-- zhipanda.com / www.zhipanda.com
  |     -> Web Worker (vinext + Vite, Workers Cache)
  |           +-> R2 media bucket (/media/*)
  |           +-> V2_API service binding -> API Worker
  |
  +-- api.zhipanda.com
        -> API Worker (NestJS on Express)
              +-> Hyperdrive -> Supabase PostgreSQL/PostGIS
              +-> Supabase Auth JWKS
              +-> Cron Trigger: Outbox/PGMQ downstream cycle

GitHub Actions
  +-> Production Deploy: approval-gated migrations, then API, then Web
  +-> Production Probe: scheduled health and async-heartbeat checks
  +-> batch operations and Python panda-data jobs
```

Bindings, schedules, domains and versions live in `docs/deployment/runtime-status.md`.

## 4. Repository layout

The layout and the three npm workspaces are listed in `docs/monorepo-structure.md`. Use npm workspaces only. Do not add Turborepo, Nx, Lerna, Changesets, pnpm migration, project-reference graphs, or shared-config packages without a measured problem they solve.

The only initial shared npm package is `api-client`.

Do not create generic `shared`, `common`, `utils`, `types`, `domain`, `config`, `ui`, `eslint-config`, or `tsconfig` packages as architectural escape hatches.

## 5. NestJS runtime baseline

- Node.js 24 LTS.
- NestJS 11.
- Express via `@nestjs/platform-express`, served on Cloudflare Workers through `httpServerHandler`. Fastify was replaced (#524) because Workers forbid `new Function` and provide no timers outside a request, both of which Fastify's boot needs.
- Strict TypeScript.
- `module` / `moduleResolution`: NodeNext for the API.
- One composition root: `src/bootstrap.ts` + `AppModule`, mounted by the Worker entry `worker/index.mjs`.
- No Nest microservice transport in the authoritative API.
- Singleton DI by default.
- No business `forwardRef()` cycles.
- No request-scoped providers unless a concrete need is proven.
- Native `AsyncLocalStorage` is the one request-context mechanism.
- Constructors and init hooks do not perform remote side effects, migrations, polling, or durable work.
- No `setInterval` worker loops inside the Worker runtime; recurring work runs from the Cron Trigger.

Conceptual API tree:

```text
services/api/src/
├─ bootstrap.ts
├─ app.module.ts
├─ jobs/                       # scheduled downstream cycle run by the Cron Trigger
├─ platform/
│  ├─ auth/
│  ├─ config/
│  ├─ database/
│  ├─ health/
│  ├─ http/
│  ├─ integration/             # Outbox, PGMQ dispatch, async heartbeat
│  ├─ integrity/
│  ├─ observability/
│  └─ request-context/
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
- application is framework-neutral and does not import Nest, Express, Kysely or pg;
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

Request and Cron traffic reach Supabase through Cloudflare Hyperdrive, with query caching disabled so permission and release reads are never stale (`docs/deployment/runtime-status.md`).

Baseline:

```text
one singleton Kysely per warm runtime
one bounded pg.Pool (max from DB_POOL_MAX)
no named prepared statements
```

Migrations use a separate migration credential in the Production Deploy workflow, never the request path.

## 9. HTTP and client contract

The only hand-authored HTTP truth is the Nest HTTP boundary: controllers + concrete DTO classes + protocol metadata.

Generate one OpenAPI 3.1 artifact:

```text
services/api/openapi/panda-atlas-v2.json
```

Generate the private TypeScript client using:

```text
openapi-typescript
openapi-fetch
```

The Web imports the generated client package; it never imports Nest DTO/domain source directly.

### V2 wire conventions

- business routes: `/api/v2/...`;
- infrastructure routes: `/health`, `/ready`, `/health/async`;
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

Retries are bounded and only used for replay-safe transient failures. Poison/permanent messages must move to a dead-letter path rather than block a queue. Today only the notification provider queue has one (`notification_provider_dlq`); a failing message on any other queue fails the cycle until it is fixed, which `GET /health/async` reports.

### Worker execution

- no polling during API startup;
- the Cron Trigger runs one bounded downstream cycle per tick (Outbox dispatch, then each consumer queue);
- long/heavy work runs through GitHub Actions;
- external side effects happen after durable intent is committed;
- `waitUntil()` is only for harmless best-effort work, not durable publication/notification/audit/privacy execution.

## 12. Python `panda-data` boundary

Python owns:

```text
reviewed source acquisition and identity reconciliation
the crawler comparison lab
curation CSV validation
media processing
offline artifact manifests and pipeline job bookkeeping
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

Cloudflare R2 is the media store. The bucket is private: the Web Worker serves only allowlisted panda photos and homepage videos at `/media/*` on the site's own domain, and Workers Cache keeps them at the edge.

Contribution attachments register metadata through the Contribution module; the API offers no upload endpoint. A browser upload path, when built, must upload to R2 directly through a short-lived presigned URL that Nest authorizes and then verifies on finalize, so large uploads never stream through Nest.

Deletion or takedown of a public object must also purge it from the edge cache when it has to disappear immediately.

## 15. Observability and errors

### Logging

Use the one DI-managed structured logger (`platform/observability`). It writes each entry as a single plain object through `console`, so Workers Logs indexes its fields. Unexpected 5xx failures and every Cron cycle result are logged.

Request logs use normalized route templates, one completion event, strict redaction, and identifiers from native ALS request context.

Do not create a second logging-specific request context.

### Tracing, error aggregation and metrics

There is no tracing or error-aggregation service and no metrics collector. Signals come from Workers Logs, Cloudflare and Supabase platform metrics, and the Production Probe workflow (described in `docs/deployment/runtime-status.md`). Add tracing or aggregation only for a measured need, and never trace raw SQL text or bind values by default.

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
light-my-request in-process injection (`test/inject-http.ts`) for HTTP contract tests
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
services/api/openapi/panda-atlas-v2.json
packages/api-client/src/schema.generated.ts
services/api/src/platform/database/database.<schema>.generated.ts
```

PR CI is risk-scoped with simple path filtering.

Examples:

- domain/application change -> lint, typecheck, architecture, relevant Vitest;
- HTTP change -> plus HTTP contract/OpenAPI-client drift;
- DB change -> plus migration replay and relevant real-DB integration;
- schema change -> Python + Ajv strict validation;
- Web change -> Web lint/typecheck/build + relevant critical journey;
- Python change -> Ruff/type/tests for the affected scope.

There is no staging environment. Every push to `main` runs the full development verification and the Cloudflare deployability build, and production releases go through the approval-gated Production Deploy workflow.

## 19. Managed deployment

### Cloudflare Workers

Two Workers are deployed units: the Web Worker (`apps/web`) and the API Worker (`services/api`). The API Worker mounts the Nest application through `httpServerHandler` and runs the Cron Trigger; the Web Worker reaches it through the `V2_API` service binding. Both are reachable only on their custom domains. Hyperdrive connects the API Worker to Supabase.

### Health

`GET /health` proves the Nest process is alive and does not call remote dependencies.

`GET /ready` performs a bounded DB readiness probe through the real request connection path and returns 503 when the DB dependency is unavailable.

`GET /health/async` reads the async downstream heartbeat and returns 503 once no Cron Trigger cycle has completed every stage for more than 20 minutes. It is separate from `/ready` because a stalled background cycle does not stop the API serving requests; it exists for the external production probe.

Publication suspension is not infrastructure un-readiness.

### Migrations

Application startup never runs migrations. Only the approval-gated Production Deploy workflow migrates production, using a migration credential separate from the request-runtime role; migrations are expand-first so the previous deployment keeps working. See `docs/runbooks/production-release.md`.

## 20. Rollback

Rollback is V2-to-V2: redeploy a previous Worker version, or fix forward (`docs/runbooks/production-release.md`). Expand-first migrations keep the previous deployment a valid rollback target. Database restore/PITR is disaster recovery for actual data corruption, not deployment rollback.

## 21. HTTP contract break from V1

The V2 HTTP contract deliberately does not carry:

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

A breaking change to `/api/v2` requires an explicit API-version decision.

## 22. Proportional engineering rule

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

## 23. Product truths

These hold unless a later product decision changes them:

- panda fan experience first;
- one stable panda identity across product surfaces;
- lineage/family as first-class structured data;
- Institution and Place are distinct;
- Calendar derives from event/birth truth rather than becoming a second event store;
- Favorite is the single saved-panda relationship;
- Collection, LocationCheckin, SeenPanda, Notification consent, and GameAttempt remain distinct concepts;
- Check-in does not imply a panda was seen and vice versa;
- provenance/review/moderation/privacy/audit/publication support the product rather than becoming the public product hierarchy.

## 24. Changing the architecture

A delivery ticket may refine code-level details inside its accepted architecture boundary. It may not reopen settled architecture merely because a V1 file suggests a different structure.

Reopen an architecture decision only when implementation discovers material evidence that an accepted baseline cannot satisfy correctness, security, operability, or product requirements.
