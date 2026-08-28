# NestJS V2 migration, cutover, rollback, and legacy retirement

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #321 `Choose the migration, cutover, rollback, and legacy-retirement strategy`
- Status: decision asset for Wayfinder; not yet the consolidated V2 baseline

## Question

Given the resolved V2 architecture, what migration sequence should move PandaAtlas from FastAPI plus Worker/D1/OpenNext to NestJS plus Supabase, what production continuity and rollback guarantees are required at each step, when may old runtime paths and compatibility artifacts be deleted, and where should PandaAtlas intentionally accept breaking changes rather than preserve legacy behavior?

## Decision summary

PandaAtlas uses a **bounded replacement migration**, not a compatibility migration.

The target is reached by preparing V2 completely off the canonical production domains, performing one bounded authoritative-data freeze and final deterministic backfill, then moving Web and API traffic in two independent routing steps that do not require Nest to implement `/api/v1`.

The strategy is:

```text
Legacy production remains unchanged
  Cloudflare OpenNext Web
  Cloudflare Worker /api/v1 + D1
  FastAPI/PostgreSQL authority

            |
            | build/test/migrate off canonical traffic
            v

V2 candidate
  Vercel Next Web
  Vercel Nest API
  Supabase V2 schemas/read models
  R2 public media domain

            |
            | bounded write/publication freeze
            | final deterministic full backfill
            | seal one V2 public release
            v

Step A: Web cutover
  zhipanda.com -> Vercel Web
  V2 Web calls API project's stable *.vercel.app hostname
  api.zhipanda.com remains legacy Worker

            |
            | verify Web and close legacy-Web rollback
            v

Step B: API cutover
  api.zhipanda.com -> Vercel Nest API
  V2 Web still calls stable Vercel API hostname
  old Worker/D1 remains temporary API rollback only

            |
            | verify API and close legacy-API rollback
            v

Commit point
  V2 becomes the only runtime authority
  reopen writes/publication/batch execution on V2
  legacy runtime rollback is no longer valid

            |
            | ordinary V2 deployment rollback only
            v

Canonicalize Web API config
  V2 Web -> https://api.zhipanda.com

            |
            v

Immediate cleanup series
  delete Worker/D1/OpenNext/FastAPI compatibility/runtime tooling
  keep R2, Cloudflare DNS, Supabase, Vercel, GitHub Actions
```

Core decisions:

1. **No dual write.** V1 and V2 never accept authoritative writes concurrently.
2. **No database triggers, CDC, logical replication, queue mirroring, or generic sync service** merely to bridge migration.
3. **No Nest `/api/v1` compatibility controllers, snake-case adapters, FastAPI error emulation, Worker fallback, or D1 fallback.**
4. Build V2 in the same long-term repository paths; do not keep a permanent `services/api-v2` beside FastAPI.
5. Production continuity comes from retained deployed legacy artifacts and Git history/tagging, not from keeping two backend source trees alive in the V2 branch.
6. Apply V2 database schema changes additively while V1 remains authoritative; do not destructively alter V1 tables before the legacy rollback windows are closed.
7. Use repeatable deterministic data migration into V2-owned schemas. For the current PandaAtlas scale, prefer a **final full rebuild/backfill during the freeze** over designing an incremental CDC system. Use incremental migration only if rehearsal proves the full rebuild cannot fit the cutover window.
8. D1 is a derived public projection and is **never migrated into V2**. V2 public-read state is rebuilt from authoritative PostgreSQL/module data.
9. Supabase Auth remains the same external identity provider. Auth users are not re-created; only PandaAtlas product Identity/account/authorization state is transformed into V2.
10. Web and API legacy rollback windows are deliberately separate by temporarily letting V2 Web call the Vercel API project's stable hostname. This avoids an atomic multi-DNS switch and avoids API compatibility code.
11. The legacy rollback window ends **before V2 authoritative writes reopen**. After V2 writes resume, rollback means a previous V2 deployment or forward database fix/restore—not routing back to FastAPI/Worker/D1.
12. Do not keep legacy systems for an arbitrary multi-week cooling period. Once the bounded rollback criteria are satisfied, cleanup starts in the next dedicated cleanup changes.
13. Preserve only genuine public/business contracts. The one deliberate legacy URL exception is already-published media: old `/media/releases/...` URLs may receive a simple permanent redirect to the new R2 custom domain. This is a durable asset-URL concern, not `/api/v1` compatibility.
14. Migration quality gates reuse #319 evidence. #321 does not add a second migration-specific testing bureaucracy.

---

# 1. What currently matters for the migration

The repository records the current production pair as:

```text
zhipanda.com / www.zhipanda.com
  -> Cloudflare OpenNext Worker
  -> Web built against /api/v1

api.zhipanda.com
  -> Cloudflare Worker
  -> D1 public projection
  -> R2 media

Authoritative business/write model
  -> FastAPI
  -> PostgreSQL/PostGIS
```

Current Web source contains many hard dependencies on `/api/v1`, including Identity, Engagement, Contribution, Review/Admin, Notification, Feed, Games, Map and public read calls.

V2 intentionally moves to:

```text
/api/v2
camelCase
RFC 9457 errors
new generated client
new Identity/auth model
new Publication/public-read model
```

Therefore:

> Old Web and new Nest API are not a supported production pair, and new Web and old Worker/FastAPI are not a supported production pair.

This is why migration must solve deployment sequencing instead of adding a compatibility layer.

---

# 2. Supersede the FastAPI parts of ADR 0002

ADR 0002 remains useful for the managed-cloud destination:

```text
Vercel
Supabase
Cloudflare DNS/R2
GitHub Actions
no self-managed server
```

But its FastAPI-specific target is superseded by the V2 decisions.

Do not finish the old Phase 2 by deploying FastAPI to Vercel merely because that was once planned.

In particular, V2 should not spend implementation effort finishing:

```text
FastAPI Vercel serverless closure
FastAPI production pooling
FastAPI managed production auth
FastAPI preview contract acceptance
```

as an intermediate production platform.

That work would create a platform migration immediately followed by a backend rewrite.

The only surviving intent is:

```text
bounded managed API on Vercel
Supabase authority
managed auth
separate batch work
```

implemented directly by Nest V2.

---

# 3. Do not create a permanent side-by-side backend tree

The long-term path remains:

```text
services/api
```

and eventually contains NestJS only.

Do not make this permanent:

```text
services/api          FastAPI
services/api-v2       NestJS
```

or:

```text
services/fastapi-api
services/nest-api
```

because that encourages permanent duplicate ownership and doubles repository tooling.

### Migration development mechanics

Use ordinary Git isolation instead:

```text
V2 migration branch / reviewed implementation branches
  services/api -> Nest target
  tools/panda-data -> surviving Python
```

while the current Cloudflare production deployments continue to serve production independently of that branch.

The exact old implementation remains available through Git history and an explicit pre-cutover tag/commit.

No `legacy/fastapi` source archive is required inside the final tree.

---

# 4. Tag the last legacy source state

Before the destructive source cleanup/production cutover sequence, create one explicit Git reference such as conceptually:

```text
legacy-v1-final
```

pointing to the reviewed final legacy production source commit.

Purpose:

- identify exactly which source built the retained legacy deployment;
- allow forensic comparison;
- allow reconstruction during the bounded legacy rollback window if absolutely necessary;
- avoid retaining dead source directories in the V2 repository.

The tag is evidence, not a supported alternate branch that receives new feature fixes.

Once cutover work begins, V1 receives only a critical production safety fix if needed to protect the active legacy system before its rollback window closes.

No ordinary feature work continues on V1.

---

# 5. Schema migration is additive before cutover

While V1 is still authoritative, production SQL migrations may add:

```text
new V2 module schemas
new integration/outbox tables
new public_read schemas
new V2 indexes/constraints
new app roles/permissions
new pipeline tables where required
```

These changes must not break existing V1 reads/writes.

Do not pre-cutover:

```text
DROP V1 tables
rename V1 columns used by FastAPI
change V1 column meaning
replace V1 constraints in ways FastAPI cannot satisfy
remove V1 DB roles
remove D1 projection inputs needed for rollback
```

This is not backward-compatible V2 application design. It is simply preserving the currently running database consumer until traffic leaves it.

After legacy rollback closes, cleanup migrations can remove obsolete schemas/tables.

---

# 6. No dual-write bridge

Explicitly reject:

```text
FastAPI writes V1 + V2
Nest writes V2 + V1
Postgres trigger copies V1 -> V2
Postgres trigger copies V2 -> V1
CDC/logical replication between V1 and V2 models
queue-based state mirroring
write-through compatibility repository
```

Reasons:

- V1 and V2 have deliberately different domain/module semantics;
- a bridge would itself require conflict, retry, ordering and recovery behavior;
- it would become the hardest part of the migration to delete;
- PandaAtlas does not have evidence that the data volume or write rate justifies it.

The migration instead has one clear authority at every point:

```text
before commit point -> V1 authority
at cutover freeze    -> no business writes
before reopen        -> V2 accepted
then                  -> V2 authority
```

---

# 7. Repeatable V1 -> V2 backfill

Implement a bounded explicit migration utility for authoritative V1 state.

It may be a small TypeScript/Nest-side migration program because the destination business semantics are V2-owned.

Conceptually:

```text
services/api/scripts/migration/
  migrate-v1-to-v2.ts
  verify-v1-to-v2.ts
```

Exact filenames are implementation detail.

The tool:

- reads legacy PostgreSQL tables explicitly;
- transforms legacy records into V2 module-owned state;
- writes only V2 target schemas;
- records a compact migration report;
- fails on ambiguous identity/data that cannot be safely mapped;
- is repeatable before V2 accepts production writes.

Do not expose migration logic as an HTTP endpoint.

Do not create a generic ETL framework.

---

# 8. Prefer full deterministic rebuild over delta synchronization

The migration should rehearse a full V1 -> V2 rebuild on staging/a production copy.

If that fits comfortably in the bounded cutover window, the final production procedure is:

```text
freeze writes
clear only migration-owned pre-live V2 target state
run full deterministic migration from final V1 snapshot
verify
seal V2 release
cut traffic
```

This is preferred to writing delta/cursor/CDC machinery.

Only if rehearsal shows the full migration is too slow may implementation add:

```text
pre-backfill
+ small deterministic delta pass during freeze
```

Even then, the delta mechanism is a one-time migration tool, not a permanent dual-write service.

---

# 9. Classify legacy data instead of copying every table

Every V1 persistent dataset is classified into one of three outcomes:

### A. Migrate into V2 authority

Examples conceptually:

```text
Panda identity/facts
Lineage
Places/residency/life history
Evidence/provenance
Media metadata
Identity account/authorization state
Engagement state that is a real product concept
Contribution/Review/Curation state required to continue work
Moderation state
Privacy state
Notification preferences/durable state where still meaningful
Audit evidence required by policy
```

### B. Rebuild as a V2 projection

Examples:

```text
public_read.*
Updates projections
derived statistics
search/read projections
```

These are generated from authoritative V2 facts.

### C. Do not migrate

Examples:

```text
D1 projection internals
Worker deployment metadata
FastAPI request/session implementation artifacts
legacy compatibility tables
obsolete release-workbench glue
temporary migration/gate bookkeeping
rebuildable caches
```

Do not preserve a table merely because it exists.

The exact table-to-module matrix becomes implementation work under #322.

---

# 10. D1 is never an input to V2 authority

D1 is derived from PostgreSQL and immutable release artifacts.

Therefore migration is never:

```text
D1 -> Supabase V2
```

It is:

```text
V1 authoritative PostgreSQL
          ↓
       V2 modules
          ↓
    V2 public_read
```

D1 may be used only as a temporary comparison/reference during pre-cutover validation.

No V2 code imports D1 schema or release behavior.

---

# 11. Supabase Auth users remain in place

Do not migrate or recreate auth users.

Supabase Auth remains the external identity provider under #314.

Migration only transforms PandaAtlas-owned identity/business state, for example:

```text
legacy product account
legacy role/permission assignments
moderation/account restrictions
notification preferences
```

into the V2 Identity/Moderation/Notification schemas.

The stable mapping key is the Supabase user UUID/subject where the legacy data has one.

Do not derive new administrator grants from email addresses during migration.

Ambiguous or legacy bootstrap-only accounts must be resolved explicitly rather than silently gaining V2 capabilities.

---

# 12. Python migration is responsibility-based

Before production cutover, all Python functionality that still matters must be in one of two states:

### Survives under `tools/panda-data`

Examples:

```text
acquisition
crawler
research
enrichment
identity-resolution assistance
media processing
offline artifact/export building
```

### Reimplemented/owned by Nest or deleted

Examples:

```text
HTTP API
Identity authorization
Publication control
Updates projector
Notification worker control
Privacy operations
Audit projection/control
D1 release deployment
FastAPI OpenAPI generation
```

No production GitHub Action after cutover may depend on:

```text
services/api/app
FastAPI Python package imports
```

This is a hard retirement prerequisite because otherwise deleting FastAPI source would break data operations.

---

# 13. V2 staging is the proof environment

Use the stable staging topology from #318:

```text
Vercel Web preview/staging
Vercel Nest staging API
separate staging Supabase
staging R2 policy/bucket as applicable
```

Before touching production traffic, staging proves the #319 acceptance set:

```text
Web critical journeys
Nest /health + /ready
auth/JWKS/capability behavior
Postgres/PostGIS
PGMQ/Outbox
Publication build/seal/activate/rollback/takedown
R2 upload/finalize/public media path
OpenAPI client
focused load/connection evidence
observability smoke
```

#321 adds no second copy of those tests.

Migration rehearsal additionally proves:

```text
V1-shaped source snapshot -> V2 full backfill
migration duration
migration report
important business counts/invariants
V2 public release construction
```

---

# 14. Production candidate is built before the cutover window

Create the exact candidate deployments before changing canonical traffic.

Record a compact cutover record containing at least:

```text
Git commit SHA
Web Vercel deployment ID/URL
API Vercel deployment ID/URL
Supabase migration head
V2 migration report hash/summary
V2 sealed release ID/version
current legacy public release version
R2 media domain
operator/cutover time
```

This may be a Markdown/runbook record or workflow artifact.

Do not create another large machine-readable governance contract solely for the cutover.

The purpose is to know exactly what is being switched, not to create another gate ecosystem.

---

# 15. Use an additive production DB preparation phase

Before the traffic cutover window:

1. confirm managed backup status;
2. apply reviewed additive V2 migrations through the protected migration workflow;
3. create/verify V2 app roles and permissions;
4. run a production V2 pre-backfill if useful for timing/proof;
5. build/verify V2 public-read state without activating it for canonical traffic;
6. ensure legacy FastAPI/Worker behavior still operates because V1 schema was not destructively changed.

Do not rely on database restore as a normal application rollback mechanism.

Supabase backup/PITR is disaster recovery, not the routine answer to a bad application deployment.

---

# 16. Backup policy at cutover

At minimum, confirm that a restorable managed backup exists before the final migration/cutover.

If production requires low-RPO recovery for the cutover, enable/verify PITR before the migration rather than after an incident.

Do not require PITR as a permanent architecture rule if PandaAtlas' measured RPO/cost does not justify it.

A logical `pg_dump` immediately before cutover may be retained as additional migration evidence only if it is operationally cheap and secure; it is not mandatory if managed backup/PITR evidence already satisfies recovery requirements.

No backup should contain R2 objects; R2 is a separate retained store and database restore does not restore object data.

---

# 17. Public media is prepared before Web cutover

The R2-backed V2 public media domain must exist before the V2 Web is promoted.

Conceptually:

```text
media.zhipanda.com
  -> R2 public custom domain
```

V2 public-read records use this domain directly.

Do not route normal V2 image bytes through Nest.

### Existing published media URLs

Current production has already published paths such as:

```text
https://api.zhipanda.com/media/releases/<release>/...
```

Those are externally visible durable asset URLs, not just internal FastAPI endpoint shapes.

A narrow migration exception is permitted:

```text
GET/HEAD /media/releases/<known-safe-key>
  -> 308 https://media.zhipanda.com/releases/<same-key>
```

or an equivalent simple infrastructure redirect.

Rules:

- redirect only, no R2 proxying through Nest;
- no `/api/v1` behavior is preserved;
- no dynamic fallback to Worker;
- new V2 content emits only the new media domain;
- the redirect may be retained long-term because public asset URLs often outlive application API versions.

If implementation proves those old URLs were never intended to be stable externally, #322 may omit the redirect; do not build broader URL compatibility around it.

---

# 18. Begin one bounded cutover freeze

Immediately before final production migration:

Pause authoritative legacy business changes:

```text
curation/import writes
publication/release activation
admin business writes
legacy batch jobs that mutate authoritative data
```

Also ensure no new V2 production business writes are accepted yet.

This is one bounded operator-controlled freeze, not a permanent maintenance mode framework.

Do not implement a complex global feature-flag system solely for this migration.

If one simple application-level maintenance response is needed to protect an exposed write endpoint during the window, it should be temporary and deleted after cutover.

Because current public production is predominantly release-driven read behavior and some write-oriented product surfaces have historically been disabled, the migration should exploit that fact rather than design a high-throughput zero-freeze replication platform the product does not need.

---

# 19. Final production data migration

During the freeze:

1. capture final legacy source identifiers/counts;
2. reset only pre-live V2 target state that the migration owns and that has not accepted real production writes;
3. run the deterministic V1 -> V2 migration;
4. verify required module invariants/counts/identity mappings;
5. build V2 `public_read` from V2 authority;
6. seal a V2 Release;
7. verify the active candidate contains the intended current public knowledge;
8. do not modify V1/D1 after this point except rollback-safe emergency maintenance.

Avoid a huge record-by-record V1/V2 payload comparison.

Verification should focus on meaningful invariants:

```text
stable Panda identities/slugs
parentage/lineage integrity
place/residency referential integrity
public release counts/checksum/representative fixtures
media references
identity/account mapping
critical moderation/privacy state
no private fields in public read models
```

---

# 20. Web cutover happens first, but Web uses the V2 API project hostname

Do **not** change canonical `api.zhipanda.com` yet.

The V2 Web production candidate is configured temporarily to call the stable Vercel API project hostname, conceptually:

```text
https://zhipanda-api.vercel.app
```

or the exact project-level stable hostname selected in #318.

This is a deployment seam, not a public API version or compatibility layer.

Then move:

```text
zhipanda.com
www.zhipanda.com
```

from the Cloudflare OpenNext deployment to the Vercel Web project.

Now:

```text
new production Web -> Nest V2 via Vercel project hostname
old canonical api.zhipanda.com -> legacy Worker/D1
```

The old Cloudflare Web deployment remains a valid Web rollback because it still points to the unchanged legacy `api.zhipanda.com`.

This removes the need for an atomic Web+API DNS switch.

---

# 21. Close the legacy Web rollback window quickly

Validate the already-defined production Web acceptance signals against the custom domains:

```text
home/profile/lineage/map/public search
locale/canonical behavior
media
critical browser journey
runtime errors
API calls reaching V2
```

Do not rerun every historical browser test and recovery drill.

Once the V2 Web is accepted:

- declare Cloudflare OpenNext no longer a valid production Web rollback target;
- future Web rollback uses Vercel's immutable-deployment rollback mechanism;
- do not keep the old Web rollback window open for weeks merely because the Worker still exists.

The Cloudflare Web deployment resource/source cleanup can occur in the next cleanup change.

---

# 22. API cutover is then independent

After Web rollback is closed, move:

```text
api.zhipanda.com
```

from the Cloudflare Worker to the Vercel Nest API project.

The new V2 Web still calls the Vercel API project hostname during this API cutover, so switching `api.zhipanda.com` cannot break the primary Web application.

The canonical API hostname now exposes only V2 routes:

```text
/api/v2/...
/health
/ready
/media/... redirect only if retained
```

There is no `/api/v1` compatibility implementation.

Old external `/api/v1` clients receive the normal V2 not-found behavior and must migrate.

This is an intentional breaking change.

---

# 23. API legacy rollback is allowed only while writes remain frozen

Immediately after canonical API switch, Worker/D1 can still be used as the last legacy API rollback target **only while the authoritative write freeze remains active**.

If a critical V2 API problem is found before the commit point:

```text
api.zhipanda.com -> legacy Worker
```

can be restored without state reconciliation because:

- V1 authoritative data has not resumed changing;
- V2 has not accepted new authoritative production writes;
- D1 still contains the final legacy release;
- V2 Web is not dependent on canonical `api.zhipanda.com` yet.

This is the only reason to retain Worker/D1 during this narrow period.

---

# 24. The commit point is explicit

After canonical API verification succeeds, declare the **V2 commit point**.

At that moment:

1. Web production is accepted on Vercel;
2. Nest production is accepted on Vercel;
3. canonical API hostname points to Nest;
4. final V2 data migration is accepted;
5. V2 public release is accepted;
6. no critical observability signal is active;
7. legacy Worker/D1 rollback is explicitly closed.

Then:

```text
reopen V2 writes
reopen publication
re-enable V2 batch jobs/workers
```

From this point onward:

> Do not route production traffic back to FastAPI/Worker/D1.

This is the most important rollback boundary in the migration.

---

# 25. Why legacy rollback must end before V2 writes reopen

If V2 accepts a new Favorite, Contribution, Review, Moderation decision, account state or Publication and then production is routed back to V1, V1 does not understand the new V2 ownership/schema semantics.

Trying to keep old rollback valid would require:

```text
dual write
reverse migration
compatibility tables
or data replay from V2 into V1
```

All are explicitly rejected.

Therefore the migration makes one clean choice:

```text
legacy rollback safety
    ends
before
V2 authoritative write availability
    begins
```

For the current PandaAtlas operating model, a short bounded write freeze is much simpler and safer than a permanent synchronization architecture.

---

# 26. After commit, application rollback is V2-to-V2

Once V2 owns production writes, a bad application deployment is handled through Vercel deployment rollback/promotion:

```text
current Nest deployment
    -> previous known-good Nest deployment

current Next deployment
    -> previous known-good Next deployment
```

provided both deployments understand the current forward-compatible production DB migration head.

This is why production schema migrations should use expand/contract discipline for ordinary V2 releases:

```text
add/expand schema
ship compatible app
migrate data if needed
later remove old V2 shape
```

This is **V2 operational compatibility**, not FastAPI compatibility.

Do not attempt to reverse SQL migrations automatically during a normal Vercel rollback.

---

# 27. Database rollback after commit is disaster recovery, not deployment rollback

After V2 accepts writes:

- bad code -> Vercel rollback/forward fix;
- bad read query/index -> forward fix;
- bad additive schema -> forward migration/fix;
- corrupted/destructively incorrect data -> Supabase backup/PITR recovery process if required.

A database restore can cause downtime/data loss and therefore is not a routine release mechanism.

Do not restore production DB merely to match an older application deployment unless an incident assessment explicitly requires it.

---

# 28. Canonicalize the Web API base after API acceptance

Once canonical API cutover is accepted and legacy API rollback is closed, update Web production configuration from the temporary Vercel API project hostname to:

```text
https://api.zhipanda.com
```

Deploy/promote that configuration change through the normal Vercel Web path.

This is not a risky architecture migration anymore because both hostnames point to the same Nest service/contract.

After that deployment is accepted, the Vercel project hostname remains a platform address, not a product dependency that must be exposed in product docs.

---

# 29. No arbitrary long legacy cooling period

Do not keep the old Cloudflare Web, Worker/D1 and FastAPI tooling supported for 14/30/90 days “just in case.”

Once each legacy rollback window is closed:

- stop deployment workflows to that runtime;
- stop generating D1 releases;
- stop fixing compatibility tests;
- open cleanup changes immediately.

A resource may remain physically undeleted for a short operational cleanup interval, but it is no longer a supported fallback.

This distinction prevents “temporary” architecture from surviving indefinitely.

---

# 30. Legacy retirement order

Use a small ordered cleanup series rather than one giant deletion if reviewability benefits.

### Cleanup A — Web legacy

After Web rollback closes:

Delete/retire as applicable:

```text
OpenNext build dependency
apps/web/open-next.config.ts
apps/web/wrangler*.jsonc
apps/web/cloudflare/* runtime glue
Cloudflare Web deploy/preview scripts
Cloudflare Web acceptance/withdrawal scripts whose only purpose is legacy runtime
panda-atlas-web Worker resources
```

Keep:

```text
Cloudflare DNS
R2
```

### Cleanup B — API projection legacy

After API rollback closes:

Stop immediately:

```text
new D1 projection generation
Worker API deployment
D1 activation/rollback flows
```

Then delete:

```text
services/worker-api/**
infra/cloudflare/d1/**
D1 release apply/rollback scripts
Worker contract/parity tests
Worker-specific GitHub workflows
D1 production/staging databases once no evidence requirement remains
panda-atlas-api Worker resources
```

Do not preserve a D1 export as a future data source; immutable public release evidence plus authoritative PostgreSQL is sufficient.

### Cleanup C — FastAPI legacy

Delete from the V2 tree:

```text
FastAPI app package
index.py ASGI entrypoint
FastAPI pyproject/uv.lock from services/api
FastAPI Vercel closure tooling
SQLAlchemy runtime/repositories
Pydantic HTTP schema tree
manual V1 OpenAPI YAML/fragments
FastAPI-specific architecture/storage checkers
FastAPI proxy helpers in Web
FastAPI API tests
```

Surviving Python data code must already live in `tools/panda-data`.

### Cleanup D — repository governance/tooling

Prune:

```text
V1 repository-structure whitelist
D1/OpenNext/FastAPI gate scripts
obsolete deployment contracts
V1 release-workbench deployment artifacts
root npm aliases that no longer execute a real target responsibility
```

Do not retain obsolete checks merely because they once caught useful V1 problems; #319/#320 provide V2 equivalents only where the underlying risk still exists.

---

# 31. What is deliberately broken at V2 cutover

The following compatibility is **not preserved**:

```text
/api/v1 routes
V1 snake_case JSON/query fields
FastAPI 422 validation behavior
FastAPI {detail: ...} errors
V1 admin-token/actor-header behavior
V1 role/permission claim assumptions
Worker/D1 public schema implementation
manual OpenAPI fragment contracts
FastAPI proxy helper semantics
V1 release/D1 activation endpoints/scripts
```

Do not create redirects or translation adapters for these application contracts.

The V2 Web migrates to the generated V2 client in the same product release.

Any external consumer must explicitly adopt `/api/v2`.

---

# 32. What is intentionally preserved

Migration preserves product/system invariants rather than implementation compatibility:

```text
stable Panda identity and content meaning
lineage/life-history semantics
source/evidence provenance
review/moderation/privacy obligations
user-owned Engagement data that remains a V2 product concept
Supabase Auth user identity
R2 reviewed media objects
public release safety/immutability/withdrawal semantics
critical Audit evidence
public canonical Web URLs where product routing remains valid
published media URLs via narrow redirect if required
```

This is the practical meaning of:

> business migration, not architecture migration.

---

# 33. Public Web route compatibility is product-owned, not backend compatibility

Existing useful product URLs such as Panda/profile/place routes should generally remain stable when they are still the same product concept.

Do not change user-facing URLs merely to prove the backend is V2.

But do not preserve dead admin/prototype/internal routes if the V2 product no longer owns them.

Web route disposition belongs to product behavior, not FastAPI migration.

---

# 34. Do not use percentage canary across V1 and V2

Reject a 1%/10%/50% traffic split between old and new backends.

Reasons:

- contracts differ (`/api/v1` vs `/api/v2`);
- write ownership differs;
- two independently evolving public-release models would be active;
- sticky routing/user-state compatibility would add unnecessary complexity;
- current PandaAtlas scale does not justify it.

Use full staging/preview evidence and a bounded routing switch instead.

Vercel rolling-release or feature-flag infrastructure may be useful later for ordinary V2 releases if product risk warrants it, but it is not needed to migrate from V1.

---

# 35. Do not use production shadow requests as a new platform

A small pre-cutover comparison of representative public reads is useful.

Do not introduce a permanent shadow-traffic service that mirrors every production request to V2.

It creates:

```text
extra traffic
privacy/security questions
write suppression complexity
response comparison normalization
another component to delete
```

Use staging datasets, migration fixtures, representative production-read probes and release-level verification instead.

---

# 36. Do not build migration feature flags into every module

The migration needs a small number of operational states:

```text
legacy authority
write freeze
V2 authority
```

It does not need per-module flags such as:

```text
PANDA_V2_ENABLED
LINEAGE_V2_ENABLED
REVIEW_V2_ENABLED
PUBLICATION_V2_ENABLED
...
```

Those flags would recreate partial ownership and combinatorial test states.

A feature flag may still exist later for a real user-facing feature rollout; that is unrelated to the backend migration.

---

# 37. Cutover checks are intentionally short

Do not invent a second “migration hard-gates” framework.

Before Web switch, confirm:

```text
exact V2 Web/API deployment pair
final migration accepted
V2 release sealed
media domain working
V2 API health/readiness
critical Web smoke
no active critical staging defect
legacy rollback target recorded
```

Before API commit point, confirm:

```text
canonical API DNS reaches Nest
/health + /ready
representative public reads
Auth/JWKS path
current release identity
no critical 5xx/readiness/DB signal
legacy Worker still recoverable until commit
```

That is enough.

Do not require every crawler, recovery drill, full browser matrix and every historic release test at the cutover minute.

Those risks have already been tested at the appropriate earlier layer/staging stage.

---

# 38. DNS handling

Cloudflare remains authoritative DNS.

Before cutover record only the values needed to revert the affected hostnames:

```text
zhipanda.com
www.zhipanda.com
api.zhipanda.com
```

including their current legacy destinations and intended Vercel targets.

Do not export/version the entire DNS zone merely for the application migration.

Where records are DNS-only, use a short ordinary TTL before the cutover if current configuration allows it; Cloudflare documents that DNS-only records can use short TTLs while cached resolvers may still delay visible convergence.

Do not promise zero-second DNS rollback.

Use the Vercel project/generated URLs to verify candidate behavior independent of DNS before changing canonical records.

---

# 39. Vercel rollback after V2 cutover

Vercel deployments are immutable and support promotion/rollback to a previous deployment without rebuilding.

Therefore after legacy rollback closes, preserve at least one known-good previous V2 deployment for both Web and API as part of normal deployment retention.

The migration runbook should identify the immediately previous known-good V2 deployment during the first post-cutover releases.

No special rollback service is required.

---

# 40. Post-cutover DB evolution uses normal expand/contract

The ban on V1 compatibility does not mean V2 can deploy destructive database changes carelessly.

For normal V2 deploy rollback safety:

1. add new schema first;
2. deploy code that can operate with the expanded shape;
3. backfill if needed;
4. switch V2 behavior;
5. remove old V2 columns/tables only in a later cleanup after the previous deployment is no longer a rollback candidate.

This is standard operational database discipline, not legacy architecture retention.

Keep the overlap bounded; do not maintain old V2 schemas indefinitely.

---

# 41. Publication transition

Before cutover:

- stop D1 release activation;
- migrate authoritative publication/curation data into V2;
- construct one V2 sealed release representing the intended production content;
- keep final legacy D1 release frozen as rollback content.

After V2 commit point:

- V2 `publication.current` becomes the only active release pointer;
- new publication writes only V2 PostgreSQL/public_read;
- stop producing D1 SQL/artifacts immediately;
- D1 release rollback commands are no longer valid operations.

Do not attempt to mirror each V2 release back into D1 during a post-cutover “comfort period.”

---

# 42. Background jobs transition

Before commit point:

- new V2 Outbox/PGMQ consumers may be exercised in staging;
- production V1 scheduled/batch writes are paused for final migration;
- V2 production durable workers remain disabled or have no writable traffic.

At commit point:

- enable the V2 short queue pumps/Cron path;
- enable relevant GitHub Actions V2/panda-data workflows;
- do not restart legacy projectors/notification workers/import writers.

No period exists where both legacy and V2 worker sets process the same authoritative work.

---

# 43. Secrets and credentials retirement

After each legacy runtime closes, revoke/delete credentials that exist only for it rather than leaving them indefinitely:

Examples:

```text
Worker/D1 deployment credentials no longer needed
FastAPI ADMIN_API_TOKEN
legacy workflow actor tokens
FastAPI managed-runtime secrets
OpenNext Worker deployment credentials if no longer used
```

Retain Cloudflare credentials required for DNS/R2, but reduce permissions to those surviving duties.

Do not rotate unrelated surviving secrets merely because the migration occurred unless security policy requires it.

---

# 44. Documentation and ADR cleanup

After cutover:

- mark ADR 0001/0002 V1 runtime-specific sections superseded by the final V2 architecture baseline;
- update `docs/deployment/runtime-status.md` to only the real production path;
- replace the historical FastAPI Vercel Phase 2 document with a superseded marker or delete if no archival value;
- update Web/API READMEs;
- update environment examples;
- remove runbooks for D1/OpenNext/FastAPI production operations.

Do not keep two “current architecture” documents that disagree.

Historical research assets may remain under `docs/research` because they document decisions; operational docs must describe only the active system.

---

# 45. Data cleanup after legacy rollback closes

Old V1 tables/schemas are not kept forever for psychological rollback comfort.

After:

```text
V2 commit point
+ required migration evidence retained
+ V2 writes/publication proven
+ no remaining Python/tool dependency on V1 tables
```

create explicit cleanup migrations to drop obsolete V1 schemas/tables in bounded groups.

Before each drop, verify only the relevant dependency search/migration mapping, not an entire new governance program.

If some legacy table is retained for legal/audit history, classify it explicitly under the V2 owning module or archive policy rather than leaving it as an unowned `legacy_*` schema forever.

---

# 46. Legacy source deletion does not wait for DB table deletion

Source/tooling cleanup can happen as soon as runtime rollback closes.

Database cleanup may lag slightly because schema/data removal deserves its own reviewed SQL migrations.

Do not interpret this as support for the old runtime.

For example:

```text
Worker source deleted
D1 deployment stopped
old V1 tables still present for one cleanup migration
```

is acceptable.

The reverse—keeping Worker source and tests alive just because one legacy table has not yet been dropped—is not.

---

# 47. Rollback decision table

| Phase | Production authority | Valid rollback |
| --- | --- | --- |
| Before cutover freeze | V1 | normal V1 operations |
| Final migration / before Web switch | frozen | abort cutover; keep legacy traffic |
| V2 Web live, canonical API still Worker | frozen | switch Web domains back to Cloudflare Web |
| Web rollback closed, before API switch | frozen | Vercel Web rollback within V2; legacy API unchanged |
| canonical API on Nest, before commit point | frozen | switch API DNS back to Worker |
| after V2 commit / writes reopened | V2 | Vercel V2 deployment rollback or forward fix; **no legacy runtime rollback** |
| catastrophic data incident after commit | V2 | incident-specific Supabase restore/PITR if necessary |

This table is the migration's rollback contract.

---

# 48. Breaking-change policy

During implementation before V2 production:

- V2 internal/HTTP design may change freely according to the architecture plan;
- no V1 compatibility burden is added;
- staging data can be rebuilt.

At the V2 production commit point:

- `/api/v2` becomes the production API contract;
- future breaking HTTP changes require a deliberate V3/API-version decision;
- future DB evolution follows bounded V2 deployment compatibility as described above.

“Do not preserve FastAPI” applies to V1 migration, not to careless breaking changes after V2 becomes production.

---

# 49. What not to migrate just because tests exist

The current repository contains many tests/checks for:

```text
D1 parity
Worker release activation
OpenNext deployment
FastAPI serverless closure
V1 request runtime boundaries
repository structure whitelist
manual V1 OpenAPI fragments
legacy release-gate artifacts
```

Their existence is not evidence that V2 needs replacements.

Delete tests whose protected behavior is deleted.

Keep only tests for a business invariant or V2 boundary that still exists.

Do not create a V2 test solely to preserve the count/shape of the V1 suite.

---

# 50. What not to defend against

Do not build migration logic for unsupported scenarios such as:

```text
running V1 and V2 indefinitely in active-active mode
switching individual users between V1/V2 for months
allowing V1 to write after V2 writes begin
reconstructing V2 state from D1
rolling V2 writes backward into V1 tables
keeping old Web compatible with new API
keeping new Web compatible with old API
```

Those are not migration requirements.

The architecture becomes simpler by explicitly declaring them unsupported.

---

# 51. Production continuity expectations

The migration aims for no meaningful public-read outage, but does not promise impossible atomic DNS convergence.

Continuity comes from:

- candidate deployments tested before DNS changes;
- independent Web/API cutover using the Vercel API project hostname seam;
- legacy traffic retained until each narrow rollback decision closes;
- immutable public content during the final freeze;
- stable R2 media storage;
- short DNS TTL where possible;
- explicit rollback target values.

If a few minutes of mixed DNS cache are possible, the staged hostname approach prevents the new Web from depending on canonical API DNS during that period.

No compatibility backend is required to solve DNS caching.

---

# 52. Minimal operator runbook

The final cutover runbook should remain short enough to execute and understand.

Conceptually:

### Prepare

1. identify exact V2 commit and Vercel Web/API deployments;
2. confirm backup/recovery availability;
3. apply additive V2 DB migrations;
4. rehearse migration and confirm expected runtime;
5. confirm R2 media domain;
6. record the three legacy DNS rollback values.

### Freeze and migrate

7. pause V1 writes/publication/jobs;
8. run final deterministic V1 -> V2 backfill;
9. verify key invariants;
10. build/seal V2 public release.

### Web

11. V2 Web uses Vercel API project hostname;
12. switch Web domains to Vercel;
13. run critical Web acceptance;
14. close Cloudflare Web rollback.

### API

15. switch canonical API hostname to Nest;
16. run short API/readiness/auth/release smoke;
17. if bad, revert API DNS while writes are still frozen;
18. if good, declare V2 commit point.

### Commit

19. reopen V2 writes/publication/workers;
20. change Web API base to canonical `api.zhipanda.com`;
21. start legacy cleanup changes.

No 50-step ceremonial checklist is required.

---

# 53. External platform facts checked

Current official/platform documentation checked on 2026-08-26 supports the migration assumptions:

- Vercel deployments are immutable and support promoting/rolling back to a previous deployment without rebuilding;
- Vercel custom/project-generated URLs allow a deployment to be tested independently from the final custom domain;
- Cloudflare DNS TTL controls cache lifetime; DNS-only records can use short TTLs, while actual resolver convergence may still take longer than the configured value;
- Supabase paid plans provide managed backups, with PITR available when a lower RPO is required; restoring a database causes downtime and is therefore disaster recovery rather than routine app rollback;
- Supabase recommends migration-driven production schema changes and separate local/staging/production environments.

References:

- https://vercel.com/academy/vercel-foundations/deployments
- https://vercel.com/docs/projects/domains/add-a-domain
- https://developers.cloudflare.com/dns/manage-dns-records/reference/ttl/
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/deployment/maturity-model

---

# 54. Decisions deferred to #322 implementation map

The final synthesis will turn this strategy into delivery slices, including:

- exact table/domain migration matrix;
- exact order of Nest module implementation;
- exact V2 migration scripts and schema migrations;
- exact Web feature/client conversion slices;
- exact GitHub workflow cleanup/creation order;
- exact legacy file deletion tickets;
- exact staging/cutover implementation tickets.

#321 does not implement those changes.

---

# Acceptance for #321

Later planning can assume all of the following without reopening this ticket:

- PandaAtlas performs a bounded V1 replacement, not a long-running compatibility migration;
- there is never a period where V1 and V2 both own authoritative writes;
- no dual-write, CDC, trigger-based mirroring, reverse sync, or generic migration bus is introduced;
- V2 production schemas are added alongside V1 before cutover, and V1 DB shapes are not destructively changed until legacy rollback closes;
- V1 authoritative state is transformed into V2 via an explicit repeatable data migration; at current scale a final full deterministic rebuild during the freeze is preferred over delta machinery unless rehearsal proves otherwise;
- D1 is not migrated into V2; it remains only the frozen legacy public projection until API rollback closes;
- Supabase Auth identities remain in place; V2 migrates only PandaAtlas-owned account/authorization/business state;
- surviving Python is moved to `tools/panda-data` before FastAPI source is retired;
- Nest V2 does not implement `/api/v1`, V1 snake_case, FastAPI 422/detail errors, admin-token compatibility or Worker/D1 fallback;
- V2 Web temporarily calls the stable Vercel API project hostname so Web and API custom-domain cutovers have separate rollback windows without compatibility code;
- Web custom domains move to Vercel first, while canonical `api.zhipanda.com` remains legacy until Web rollback is accepted and closed;
- canonical API then moves to Nest while V2 Web remains independent of that DNS switch;
- legacy API rollback is allowed only while writes/publication remain frozen;
- the explicit V2 commit point closes legacy runtime rollback before V2 authoritative writes reopen;
- after the commit point, application rollback is V2-to-V2 through Vercel deployment rollback/forward fixes; database restore/PITR is only for true data incidents;
- Web is then reconfigured to canonical `https://api.zhipanda.com`;
- there is no arbitrary long legacy cooling period: cleanup begins immediately after the relevant rollback window closes;
- Worker/D1/OpenNext/FastAPI runtime/tooling/tests are deleted rather than archived into a permanent legacy tree; Git tag/history identifies the final V1 source;
- old V1 tables are removed through later forward SQL cleanup after no V2/runtime/tool dependency remains;
- public media objects remain on R2; old published `/media/releases/...` URLs may use one narrow permanent redirect if external URL stability warrants it;
- migration reuses #319's staging/test evidence and adds only migration/backfill proof plus a short cutover smoke, not a second overbuilt gate system;
- final #322 converts this strategy into implementation slices and deletion tickets.