# NestJS V2 Implementation Map

- Status: **Execution map**
- Date: 2026-08-26
- Architecture authority: `docs/architecture/zhipanda-v2-architecture-baseline.md`
- Planning source: Wayfinder #309 / #322

## 1. Delivery rule

This implementation map converts the accepted V2 architecture into a small number of delivery slices.

Each slice should deliver a coherent working capability. Do not split the work into one issue per class/module/table/check unless implementation evidence shows a slice is too large to review safely.

Implementation must not reopen settled architecture simply because the V1 FastAPI repository has a different shape.

The default rule remains:

> **business migration, not architecture migration**

and:

> **test and defend only against concrete risks; do not grow a second governance product around the migration**

## 2. Dependency graph

```text
V2-01 Workspace/runtime foundation
        |
        v
V2-02 Platform + DB + Identity security
        |
        +----------------------+--------------------+
        |                      |                    |
        v                      v                    v
V2-03 Core knowledge      V2-08 Python runtime   platform remains usable
        |
        +----------+
        |          |
        v          v
V2-04 Fan state   V2-05 Editorial governance
        |          |
        |          +----------+
        |                     |
        +----------+----------+
                   |
                   v
        V2-06 Publication + public reads
                   |
                   v
        V2-07 Async/compliance downstream
                   |
                   +----------------+
                   |                |
                   v                v
        V2-09 Web V2 client    V2-08 Python complete
                   \                /
                    \              /
                     v            v
                V2-10 Migration + staging rehearsal
                           |
                           v
                V2-11 Production cutover + retirement
```

Some implementation work may proceed in parallel when its declared dependencies are satisfied. The graph is about authority and acceptance dependencies, not forcing one developer to work serially.

## 3. V2-01 — Establish the NestJS workspace and runtime foundation

GitHub: #323

Dependencies: none.

### Scope

- establish explicit npm workspaces for API client, Web, and Nest API;
- rebuild `services/api` as conventional NestJS 11 + Fastify 5 + Node 24 target structure;
- add root TS/ESLint defaults, API Vitest/SWC config, dependency-cruiser, and the private `packages/api-client` shell;
- typed configuration bootstrap;
- global request validation and RFC 9457 error boundary;
- native ALS request context;
- conventional `/health`, `/ready` skeleton;
- conventional Vercel Nest build/entrypoint;
- narrow architecture checks for settled layer/module boundaries.

### Acceptance boundary

- Nest API builds, typechecks, lints, and runs focused tests;
- one standard Nest composition root;
- no `/api/v1`, FastAPI serverless closure wrapper, Worker/D1 fallback, generic shared package, Turborepo/Nx, hidden postinstall/prebuild gate, or speculative framework abstraction;
- current V1 production remains unaffected.

## 4. V2-02 — Build API platform, database, and Identity security foundation

GitHub: #324

Blocked by: V2-01.

### Scope

- Kysely + node-postgres platform provider;
- serverless `pg.Pool` baseline and real `/ready` DB path;
- explicit transaction scopes;
- generated DB types;
- additive V2 schemas, roles, Outbox/PGMQ foundation;
- Supabase asymmetric JWT/JWKS verification;
- deny-by-default authorization guards;
- Identity capability/security policy, explicit provisioning, recent-auth/AAL/live-session behavior;
- Pino/ALS logging, Vercel OTel, Sentry adapter, stable error taxonomy;
- basic Outbox dispatch/consumer primitives needed by later modules.

### Acceptance boundary

Use real disposable PostgreSQL/PostGIS/PGMQ integration for the platform semantics that mocks cannot prove.

Do not implement:

```text
ADMIN_API_TOKEN
X-Actor-Id
email admin bootstrap
JWT capability authority
ambient transaction in ALS
generic BaseRepository
generic retry middleware
per-request identity upsert
```

## 5. V2-03 — Implement core panda knowledge modules

GitHub: #325

Blocked by: V2-02.

### Modules

```text
Evidence
Panda
Lineage
Places
LifeHistory
Media
```

### Scope

Implement authoritative domain/application/persistence/required HTTP surfaces for current product behavior.

Preserve:

- stable panda identity;
- source/evidence provenance;
- parentage uncertainty/status;
- Institution/Place distinction;
- residency and life-event truth;
- Calendar derivability from birth/event facts;
- media rights/licence/eligibility and R2 metadata.

Only add pipeline/export views when an actual `panda-data` consumer requires them.

### Acceptance boundary

- core facts can be created/queried through V2 boundaries against real PostgreSQL/PostGIS;
- approved module dependency graph is respected;
- no generic `knowledge` mega-module, V1 service translation, or cross-module table/repository access;
- tests focus on meaningful domain invariants and real DB/spatial behavior.

## 6. V2-04 — Implement fan Identity, Engagement, and Game behavior

GitHub: #326

Blocked by: V2-02, V2-03.

### Modules

```text
Identity application surfaces
Engagement
Game
```

### Scope

- account/current-actor surfaces needed by Web;
- Favorite;
- Collection;
- LocationCheckin;
- SeenPanda;
- Random Panda;
- Guess Panda;
- persisted game attempts where product persistence is useful.

### Acceptance boundary

- fan state persists through Supabase-authenticated V2 APIs;
- Favorite is the only saved-panda relation;
- Check-in and SeenPanda remain distinct;
- anonymous game flows remain possible where no account is required;
- no duplicate Follow authority, browser shadow truth, or controller role-name authorization.

## 7. V2-05 — Implement Contribution, Review, Moderation, and Curation

GitHub: #327

Blocked by: V2-02, V2-03, V2-04.

### Modules

```text
Contribution
Review
Moderation
Curation
```

### Scope

- immutable submission revisions and attachment policy;
- ReviewCase lifecycle, assignment/triage/evidence verification/decisions;
- moderation warnings/restrictions/sanctions/restoration/appeals;
- curation changes/validation/approval/provenance;
- review incorporation through Curation/fact-owner ports;
- sensitive command capability/recent-auth/AAL policy.

### Acceptance boundary

A contribution can proceed through V2 Review into a Curation recommendation/approved fact change without Review writing fact-owner tables.

Do not recreate:

```text
community_curation bridge
combined review_moderation module
generic admin CRUD authority
V1 endpoint compatibility wrappers
```

## 8. V2-06 — Implement Publication and release-scoped public reads

GitHub: #328

Blocked by: V2-03, V2-05.

### Modules/capabilities

```text
Publication
public_read projections
public knowledge /api/v2 surfaces
OpenAPI generation
api-client generated transport types
```

### Scope

- immutable sealed release lifecycle;
- release membership;
- separate current pointer;
- activation/rollback transition history;
- public release suspension;
- emergency takedown/restore overlay;
- typed release-scoped read models;
- one pinned `releaseId` per composite query;
- public Panda/Lineage/Places/LifeHistory/Media/Evidence/statistics routes required by the product;
- canonical OpenAPI 3.1 generation and `api-client` output.

### Acceptance boundary

- build/seal/activate/rollback/takedown works in PostgreSQL;
- public responses are deterministic for a release and exclude private state;
- activation is a bounded pointer transaction and emits durable integration events;
- no D1 SQL artifact, runtime ChangeSet replay, universal `public_json`, Worker projection, or V1 transport compatibility.

## 9. V2-07 — Implement async downstream, Updates, Notification, Privacy, and Audit

GitHub: #329

Blocked by: V2-04, V2-05, V2-06.

### Modules/capabilities

```text
Updates
Notification
Privacy
Audit
Outbox dispatcher/consumer flows
bounded PGMQ job runners
```

### Scope

- consumer-specific queue fan-out;
- idempotent consumer receipts;
- publication -> Updates;
- Updates/publication -> Notification intent;
- notification inbox/preferences/delivery attempts and bounded retry/DLQ;
- downstream Audit evidence;
- Privacy orchestration through narrow export/delete ports;
- short bounded worker invocation endpoints/runners suitable for Vercel Cron;
- long/heavy work remains GitHub Actions, not request startup workers.

### Acceptance boundary

- one published knowledge change can produce the expected Updates/Notification/Audit results with at-least-once-safe processing;
- provider failure cannot corrupt the owner business transaction;
- Privacy never becomes a cross-module table-access service;
- no single broadcast queue, startup polling, generic retry decorator, Redis/BullMQ/Kafka/RabbitMQ, or per-read audit-row explosion.

## 10. V2-08 — Extract the independent Python `panda-data` runtime

GitHub: #330

Blocked by: V2-01. Coordinate contract/view needs with V2-02/V2-03 as those become available.

### Scope

Move only surviving Python responsibilities into `tools/panda-data`:

```text
acquisition
crawler
research
enrichment
identity-resolution assistance
curation assistance
media processing
offline artifact/export building
```

Establish:

- independent `pyproject.toml` + `uv.lock`;
- Draft 2020-12 JSON Schema contracts;
- Python + Ajv strict contract validation;
- least-privilege pipeline DB role;
- pipeline job/artifact metadata;
- R2 immutable artifact manifests;
- module-owned export-view consumption where required.

### Acceptance boundary

- production-relevant Python jobs run without importing `services/api/app`;
- Python cannot directly mutate authoritative module schemas;
- no Python HTTP backend/sidecar;
- no pickle/joblib/ad-hoc DB/file protocol as a runtime contract;
- do not move every Python script merely because it exists.

## 11. V2-09 — Migrate the Web to the generated V2 client

GitHub: #331

Blocked by: V2-03, V2-04, V2-06, V2-07.

### Scope

- generate/use `@zhipanda/api-client` from canonical OpenAPI;
- replace direct `/api/v1` fetches and FastAPI proxy helpers with V2 client calls;
- migrate public Panda/lineage/place/map/calendar/search surfaces;
- migrate fan account/Engagement/Game/Updates/Notification surfaces;
- migrate contribution/admin/review/moderation/curation surfaces that remain in the product;
- keep frontend ViewModels/UX in `apps/web` rather than importing backend domain types;
- prepare R2 public media domain use.

### Acceptance boundary

- production-candidate Web has no runtime dependence on `/api/v1` or FastAPI proxy helpers;
- critical fan journeys work against managed V2 staging;
- existing valuable product URLs remain stable where the product concept is unchanged;
- do not preserve dead V1 admin/prototype routes solely for migration compatibility.

## 12. V2-10 — Build/rehearse production data migration and managed staging

GitHub: #332

Blocked by: V2-03 through V2-09 as applicable to the state being migrated and exercised.

### Scope

- explicit V1 table/data classification: migrate, rebuild projection, or discard;
- deterministic V1 PostgreSQL -> V2 migration utility;
- Supabase Auth UUID-preserving Identity mapping;
- full staging migration rehearsal and duration evidence;
- build/seal/activate a representative V2 public release;
- managed Nest staging deployment using real Supabase transaction pooling;
- Web staging/preview against V2;
- R2 upload/finalize/public media path;
- Outbox/PGMQ worker smoke;
- compact production cutover runbook and backup/rollback values.

### Acceptance boundary

- full migration fits the intended freeze window; only if measured otherwise may a one-time pre-backfill/final-delta mechanism be introduced;
- important data/business invariants are verified without record-by-record test bureaucracy;
- managed staging proves auth, DB, queue, Publication, media, observability, and critical browser behavior;
- no production traffic switch yet;
- no D1 -> V2 migration path.

## 13. V2-11 — Production cutover and legacy retirement

GitHub: #333

Blocked by: V2-10.

### Scope

1. create/tag the final legacy source reference;
2. apply final additive V2 production migrations;
3. enter bounded V1 write/publication/job freeze;
4. run final deterministic V1 -> V2 backfill;
5. build/seal final V2 release;
6. configure V2 Web to stable Vercel API project hostname;
7. move Web custom domains to Vercel and validate;
8. close legacy Web rollback;
9. move `api.zhipanda.com` to Nest and validate while writes remain frozen;
10. declare V2 commit point;
11. close legacy API rollback before reopening V2 writes/publication/workers;
12. switch Web back to canonical API hostname;
13. immediately execute focused cleanup changes for OpenNext, Worker/D1, FastAPI runtime/proxies/contracts/tests/gates;
14. follow with forward SQL cleanup for obsolete V1 schemas/tables when dependencies are gone.

### Acceptance boundary

- V2 is the only production business/write/public-read authority;
- post-commit rollback is V2-to-V2 only;
- no active production dependency on FastAPI, D1, Worker API, or OpenNext remains;
- Cloudflare continues only for DNS/R2 duties;
- current operational docs are updated to V2 and obsolete V1 deployment docs are marked superseded/removed;
- no arbitrary long legacy cooling period.

## 14. Implementation order inside large slices

The slices above intentionally contain multiple modules. Within a slice, implement only the product behavior required by the current product contract and migration.

Prefer walking one vertical use case end-to-end before filling every possible endpoint.

Examples:

### Core knowledge

```text
Panda identity/profile
 -> Evidence
 -> Places/current residency
 -> Lineage
 -> LifeHistory
 -> Media
```

### Editorial

```text
Contribution submission
 -> ReviewCase
 -> Curation recommendation
 -> fact-owner change
 -> later Publication
```

### Fan

```text
current actor/account
 -> Favorite
 -> Collection
 -> Check-in / SeenPanda
 -> Game attempts where useful
```

Do not implement speculative CRUD completeness first.

## 15. What does not get its own implementation ticket

The following are part of the owning slices and should **not** become separate architecture/governance workstreams unless implementation evidence proves otherwise:

```text
coverage percentage work
extra architecture gates
extra lint rules
logger abstraction refactors
future-proof provider wrappers
repository base classes
retry framework
feature-flag framework
migration dashboard
custom CI impact analyzer
Prometheus/Grafana setup
Turborepo/Nx migration
V1 compatibility API
```

If a real production need emerges later, create a focused issue with the measured failure/requirement it solves.

## 16. Acceptance philosophy

A slice is done when its product/system boundary is trustworthy enough for its dependents.

Do not require unrelated full-system evidence early.

Examples:

- V2-03 does not need production DNS evidence.
- V2-04 does not need every Publication scenario.
- V2-08 does not need the entire Web browser suite.
- V2-09 does not need Worker/D1 compatibility tests.
- V2-10 is where managed staging/cutover evidence belongs.
- V2-11 is where the short production cutover smoke belongs.

## 17. Architectural reopening rule

Implementation tickets may choose concrete names, SQL shapes, method signatures, and file layouts within the baseline.

Reopen a Wayfinder architecture decision only if implementation produces evidence that the baseline cannot meet one of:

```text
correctness
security
product semantics
managed-platform constraints
operability/recovery
```

“V1 did it differently” is not evidence.
