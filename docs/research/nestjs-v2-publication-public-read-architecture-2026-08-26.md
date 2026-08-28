# NestJS V2 public reads, Publication, and immutable release projections

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #317 `Redesign public reads, publication, and release projections for V2`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

What should the V2 public-read and publication architecture be inside the single Supabase authority: which read models or projections are worth keeping, how immutable public releases and withdrawal/rollback semantics should work, how public queries should consume them, and which existing FastAPI release adapters, Worker API, D1 projections, and compatibility machinery should be deleted rather than carried forward?

## Decision summary

PandaAtlas V2 keeps the **immutable public release** concept, but removes the V1 delivery architecture built around FastAPI + file manifests + D1 + Worker parity.

The V2 shape is:

```text
Authoritative module state
Panda / Evidence / Lineage / Places / LifeHistory / Media / Curation
                         |
                         | approved immutable source revisions
                         v
                Publication Release Build
                         |
                         | release-scoped public-safe projection
                         v
              private `public_read` schema
              + immutable release membership
              + typed query-oriented tables
                         |
                 seal / validate release
                         |
                         v
               Publication activation
                 atomic pointer switch
                         |
                         v
                  NestJS public API
                         |
                         v
                     Next.js
```

The central rule is:

> **Public release history remains immutable, but serving no longer reconstructs a release from change-set history and no longer copies the release into D1. A release is built once into immutable, release-scoped PostgreSQL read models and activation is only an atomic pointer/control-plane change.**

A second rule is equally important:

> **“Published” is not a mutable status on release content. A sealed release is immutable content that may be activated, rolled back to, suspended, or reactivated through separate publication transitions.**

## 1. What is preserved from V1

The following V1 properties are correct and must survive the migration:

- one reviewed authoritative PostgreSQL source;
- public-safe projection rather than exposing editorial/private tables directly;
- immutable release identity/history;
- fail-closed public-field filtering;
- provenance from source revision to public output;
- a compatibility/version boundary for the public projection schema;
- atomic change of the current public release;
- rollback without rewriting historical release content;
- emergency withdrawal/takedown capability;
- historical release evidence retained for audit/recovery;
- public media only when rights/eligibility allow it;
- release-level counts/hashes/validation before activation;
- a public query never accidentally sees an unapproved newer fact just because the authoritative row changed.

These are business and safety properties, not reasons to retain V1 storage/runtime shapes.

## 2. What is wrong with the current V1 shape

The repository currently has several overlapping public-delivery mechanisms.

### Runtime reconstruction from editorial history

FastAPI public reads can reconstruct the active public record through:

```text
public_release_pointer
  -> publication_batches
  -> publication_batch_change_sets
  -> change_set_revisions
  -> entity_revisions
```

For Panda list/detail reads this becomes per-request SQL that derives the latest public revision again.

This preserves history but makes the public query path depend on editorial workflow storage and repeated reconstruction logic.

### A second release representation in files

`projection/public_release.py` builds:

```text
pandas.csv
pandas.json
api.json
d1.sql
manifest.json
```

The builder also contains public-field security rules, API runtime shaping, D1 SQL generation and release manifest logic in one implementation.

### A third runtime in D1

The Cloudflare Worker serves public reads from D1 tables/views such as:

```text
public_releases
public_release_records
current_public_release
current_public_records
```

The project then needs parity checks between FastAPI/PostgreSQL and Worker/D1.

### A fourth public-data copy in the Web build

The current Next.js code imports generated `TRUSTED_*` structures and labels them `versioned-local-public-release`.

This means a frontend build can retain release data that is no longer current after a database/Worker withdrawal, which the existing staging withdrawal documentation already calls out.

V2 removes all four-way synchronization.

## 3. Publication module responsibility

The V2 `Publication` module owns only publication lifecycle and release identity/control.

It owns:

- Release identity;
- Release build request and build status;
- immutable release membership/input manifest;
- projection schema version;
- release validation/sealing;
- active release pointer;
- activation history;
- rollback transitions;
- deliberate suspension/whole-release withdrawal;
- emergency public takedown controls;
- public release metadata queries;
- integration events for activation/withdrawal/rollback.

It does **not** own the semantics of Panda, Lineage, Places, LifeHistory, Evidence or Media.

Those modules remain responsible for deciding what a valid public-safe representation of their concepts is.

## 4. Release lifecycle is split from activation lifecycle

V1 uses `publication_batches.status = draft|published`, which conflates immutable release content and whether that content is current.

V2 separates them.

### Release build lifecycle

Conceptually:

```text
building
  -> sealed

building
  -> failed
```

A `sealed` release is immutable forever.

It may be activated multiple times over its lifetime.

There is no `active` column on the release row.

### Publication control lifecycle

A separate singleton/current-publication record identifies the active release and current delivery state.

Conceptually:

```text
publication.current
  activeReleaseId
  state = live | suspended
  switchedAt
  generation
```

Every pointer/state mutation has a separate append-only transition record.

Conceptually:

```text
publication.transitions
  transitionId
  operation = activate | rollback | suspend | resume
  fromReleaseId
  toReleaseId
  actorId
  reason
  correlationId
  occurredAt
```

This lets one old sealed release become current again without creating a duplicate “rollback release”.

## 5. Rollback

Rollback is simply **activation of an older compatible sealed release**.

V2 does not create a new release whose content copies the rollback target.

Correct shape:

```text
active release A
      |
      | rollback command
      v
atomic current pointer -> release B
+ append transition(operation=rollback, A -> B)
+ Outbox event
```

Release A and Release B both remain immutable.

### Why this is better than the V1 rollback batch

The current V1 `rollback` publication batch copies the target's change-set membership into a new batch.

That creates another release identity even though the public content is intentionally the historical target.

In V2 the rollback fact belongs in **activation history**, not in duplicated content history.

### Rollback compatibility gate

A release can only be activated when its `projectionSchemaVersion` is supported by the running API deployment.

The implementation must maintain at least the current active release and the designated rollback candidate on a projection schema the running deployment can read.

Before an old projection reader/version is removed:

1. build and seal a replacement release on the current projection schema if needed;
2. verify the active and rollback candidates use supported versions;
3. deploy the code removing the old reader;
4. then retire bounded compatibility code.

This is deployment overlap, not permanent backward compatibility.

## 6. Normal withdrawal versus emergency takedown

V2 distinguishes two different operations that V1 partially mixes.

### Normal editorial withdrawal

Examples:

- a Panda fact is corrected;
- a public event should disappear;
- a media item is replaced as part of normal editorial work;
- a source summary is no longer publication-eligible.

Normal withdrawal is represented by **a new immutable release** whose membership/projection reflects the new approved truth.

Historical releases remain unchanged.

### Emergency public takedown

Some cases cannot wait for a normal release build:

- wildlife safety/location exposure;
- legal or rights takedown;
- accidental personal/private data exposure;
- critical factual harm requiring immediate removal;
- emergency media withdrawal.

For these cases Publication owns a narrow **public delivery control**, separate from release content.

Conceptually:

```text
publication.takedown_actions
  actionId
  targetType
  targetId
  action = withdraw | restore
  actorId
  reason
  correlationId
  occurredAt
```

The current effective takedown state is derived/materialized from the append-only actions.

Public-read adapters always apply active takedowns before returning a resource.

A takedown does not mutate a historical release row or projection row.

### Takedowns survive rollback by default

A resource-level emergency takedown targets the stable public resource identity, not one release copy.

Therefore rolling back to an older release does not accidentally make a legally/safety-withdrawn media item or entity public again.

Restoration is an explicit new action.

### Whole-release emergency suspension

For a catastrophic release problem, Publication can set the current publication state to `suspended` while retaining the pointer to the last active release for operator context.

Public knowledge APIs fail closed while suspended.

A deliberate suspension is distinguishable from ordinary infrastructure failure through the stable error taxonomy to be finalized in #319.

## 7. Release identity

Each V2 release has one internal immutable UUID and one optional human-readable version.

Conceptually:

```text
releaseId
releaseVersion          # e.g. 2026.08.26.1, operator-friendly
projectionSchemaVersion
sourceManifestHash
projectionBuilderVersion
createdBy
createdAt
sealedAt
manifestHash
```

### Simplify the V1 version vocabulary

The V1 public artifact exposes several operational versions simultaneously:

```text
dataset_release_version
public_schema_version
database_migration_version
projection_code_version
publication_batch_id
```

V2 keeps the useful provenance internally but does not make every implementation version part of every public response.

Recommended meanings:

- `releaseId`: immutable content release identity;
- `releaseVersion`: optional human-readable release label;
- `projectionSchemaVersion`: semantic version of release/read-model representation;
- `projectionBuilderVersion`: Git commit/build identity or explicit projector version for reproducibility;
- `databaseSchemaRevision`: internal provenance captured in the manifest, not an API compatibility contract.

HTTP API versioning remains `/api/v2` from #313 and is independent of the release projection schema version.

## 8. Immutable release membership

A release does not merely mean “whatever rows were approved when someone queried later”.

Before projection is sealed, Publication records the exact immutable source revisions included in the release.

Conceptually:

```text
publication.release_members
  releaseId
  resourceType
  resourceId
  sourceRevisionId
  sourceVersion
  sourceHash
```

The exact revision identifier is supplied by the owning module/Curation boundary.

Examples may include:

- Panda public revision;
- approved parentage assertion revision;
- Place revision;
- LifeHistory event revision;
- Evidence public-source revision;
- reviewed Media revision.

The release can therefore be reproduced without asking “what is the current row now?”.

## 9. Public projection build boundary

Publication coordinates the build, but modules own their public semantics.

Each relevant module exposes a narrow public projection contributor/port.

Conceptually:

```ts
interface PublicReleaseContributor {
  captureMembers(...): Promise<ReleaseMemberRef[]>;
  projectMembers(...): Promise<PublicProjectionSlice>;
}
```

The concrete interface need not be ceremony-heavy, but these rules are mandatory:

- the contributor reads only its module-owned storage;
- Publication never reaches into another module's private tables;
- the contributor produces public-safe semantic data, not raw persistence rows;
- all release input references are immutable/versioned;
- public safety/rights rules stay with the owning module;
- Publication validates cross-slice integrity before seal.

This preserves #310's no-cross-module-repository/table rule.

## 10. Build execution

Release construction is not required to occur inside the user HTTP request.

### Request phase

An authorized Publication command:

```text
RequestReleaseBuild
```

creates a durable release/build record and job.

The request returns after durable intent is committed.

### Worker phase

A bounded Publication worker from #315:

1. captures/loads exact approved release members;
2. invokes module public projection contributors;
3. writes release-scoped public read rows;
4. computes counts/hashes;
5. verifies referential and safety invariants;
6. writes the release manifest;
7. marks the release `sealed` atomically if all gates pass.

If the dataset remains small enough that the whole build is safely bounded, the worker may complete in a short managed invocation. The architecture does not require a permanent worker process.

Python from #316 is **not required for the primary serving projection**.

Python may build optional large export packages, media derivatives or offline release artifacts when those workflows genuinely benefit from Python, but the public API does not depend on a Python-generated `api.json` or `d1.sql` to serve the current release.

## 11. `public_read` is a physical delivery schema, not a business module

V2 introduces a private derived schema conceptually named:

```text
public_read
```

It is not exposed directly to browser clients and is not a `ProjectionModule` business capability.

It stores immutable, release-scoped read models.

Every table has a logical business owner even though the physical delivery rows live in the same derived schema.

For example:

```text
public_read.pandas                 # owned semantically by Panda
public_read.panda_aliases          # Panda
public_read.lineage_edges          # Lineage
public_read.parentage_assertions   # Lineage
public_read.institutions           # Places
public_read.places                 # Places
public_read.residencies            # LifeHistory / Places boundary
public_read.events                 # LifeHistory
public_read.media                  # Media
public_read.sources                # Evidence
public_read.distribution           # Places/spatial public projection
public_read.habitats               # Places/spatial public projection
public_read.release_stats          # derived release aggregate
```

All rows include `release_id`.

## 12. Why ordinary release-scoped tables, not PostgreSQL materialized views

Do not use mutable `REFRESH MATERIALIZED VIEW` state as the primary immutable release store.

Materialized views are useful for replaceable caches, but the Public Release needs historical immutable snapshots and pointer rollback.

Release-scoped tables make this explicit:

```text
release A rows remain
release B rows remain
current pointer chooses one
```

Ordinary SQL views may still provide convenience views over the active release, but they are not the source of release history.

## 13. Do not use one generic `public_json` table as the main query model

The V1/D1 approach stores broad records as JSON and reconstructs endpoint behavior around those blobs.

V2 public queries need real indexed operations:

- Panda search/filter/sort;
- alias/slug resolution;
- lineage graph traversal;
- date/event filtering;
- PostGIS bounding-box/spatial queries;
- media eligibility;
- place/institution joins;
- release statistics.

Therefore the primary public read path uses typed/query-oriented columns and relational tables.

A JSONB payload may be retained inside an individual read table where it genuinely reduces low-value column explosion, but it is not the architecture's generic record abstraction.

## 14. Public Panda read model

The Panda public projection should contain the fields needed for catalog/profile/search without consulting editorial tables.

Conceptually:

```text
public_read.pandas
  release_id
  panda_id
  canonical_slug
  primary_name_zh
  primary_name_en
  sex
  life_status
  birth_date
  death_date
  current_place_id
  featured
  search_document
  profile_payload
  content_hash
```

Supporting tables/indexes may include:

```text
public_read.panda_aliases
public_read.panda_external_ids
```

Search remains PostgreSQL-native. No Elasticsearch/Algolia is introduced in the V2 baseline.

## 15. Lineage read model

Lineage should remain relational, not a precomputed giant family JSON blob.

Conceptually:

```text
public_read.lineage_edges
  release_id
  parent_panda_id
  child_panda_id
  parent_role
  assertion_status
  assertion_id
```

The API can perform bounded graph traversal using indexed rows and application logic/recursive SQL as appropriate.

Derived concepts such as sibling/grandparent remain query results, not separately authoritative release facts unless profiling proves a cache is useful.

## 16. Places and map read models

Spatial public reads should use PostGIS directly in the single Supabase database.

Do not keep a giant `api.json` GeoJSON structure as the serving source.

Conceptually:

```text
public_read.places
public_read.institutions
public_read.facilities            # only if V2 product still needs the distinction
public_read.distribution_features
public_read.habitat_features
```

Release-scoped geometry columns keep PostGIS indexes available for bounding-box/zoom queries.

The HTTP layer still returns GeoJSON where required; storage does not have to be GeoJSON text.

## 17. LifeHistory / calendar read model

Calendar and life-history product surfaces must continue to derive from the same event truth.

Keep one release-scoped event projection:

```text
public_read.events
  release_id
  event_id
  event_type
  date / date precision
  place references
  public summary fields
```

and participant relations where needed.

Do not create a second `calendar_events` public source of truth.

Calendar is a query/view over release events.

## 18. Media read model

A release stores public Media metadata/eligibility references, not a second copy of media processing state.

Conceptually:

```text
public_read.media
  release_id
  media_id
  panda_id / subject reference
  rights_public_state
  credit
  source_url
  alt/localized text
  derivative public references
  dimensions
  content hashes
  delivery eligibility
```

The Media module remains authoritative for rights and availability.

Public release projection only includes a public-safe snapshot of that reviewed state.

Emergency Media takedowns are applied by the Publication/Media delivery control before URL exposure.

## 19. Evidence/source read model

Public Evidence information is intentionally a **summary**, not raw acquired evidence.

Keep a release-scoped source summary model sufficient for provenance display:

```text
source ID
publisher/title
public source URL where allowed
source type
verification/access status safe for public display
last verified/public freshness metadata
```

Do not put raw evidence bodies, crawler diagnostics or private access/session details into the public read schema.

## 20. Release stats

Aggregate release stats are worth precomputing because they should be internally consistent with the release and are cheap to store.

Conceptually:

```text
public_read.release_stats
  release_id
  panda_count
  place_count
  published_media_count
  ... product-relevant aggregates
```

Stats are built from the same sealed release projection, never from current authoritative tables after activation.

## 21. What does not belong in a Public Release

Do **not** snapshot every application module just because a release exists.

These remain live transactional state:

- Identity/account state;
- roles/capabilities;
- Engagement favorites/collections/check-ins/seen-pandas;
- Game attempts/history;
- Notification preferences/delivery state;
- Contribution private workflow;
- Review assignments/work state;
- Moderation sanctions;
- Privacy requests;
- Audit evidence;
- operator/admin workflow state.

`Updates` is also a live downstream return-loop model. Publication activation may emit an event that creates an Updates item, but Updates itself is not frozen inside the content release.

Game content that needs Panda facts pins/reads the active public release while attempts remain live.

## 22. Public query rule: pin one release per application query

A public composite request must not independently resolve `current_release` for every repository call.

Otherwise an activation between two SQL statements could produce a mixed response containing rows from two releases.

Correct shape:

```text
HTTP request
   -> PublicKnowledgeQuery
      -> Publication.getActiveRelease()
      -> returns ActiveReleaseRef(releaseId, version, schemaVersion)
      -> pass releaseId explicitly to Panda/Lineage/Places read adapters
      -> assemble response
```

The release ID is explicit application query context, not hidden domain state.

For a simple endpoint that is one SQL statement, the query may join the current pointer directly, but composite queries still follow the same semantic rule.

## 23. Current-release views are convenience only

PostgreSQL views such as:

```text
public_read.current_pandas
public_read.current_places
```

may be introduced for diagnostics or simple single-query reads.

They are not the only application interface because composite queries need a pinned release ID.

Repositories should be capable of querying by explicit `releaseId`.

## 24. Public API and release metadata

V2 keeps a small public metadata endpoint conceptually:

```text
GET /api/v2/releases/current
```

It may expose:

```text
releaseId
releaseVersion
releasedAt
projectionSchemaVersion
selected public coverage metadata
```

Do not expose internal database migration IDs as required public client state.

### Response headers

Public knowledge responses may include one stable diagnostic/cache header such as:

```text
X-ZhiPanda-Release: <releaseVersion-or-id>
```

and standard HTTP `ETag`/cache headers.

Do not preserve the V1 requirement that every response carry several PandaAtlas-specific database/projection version headers.

Exact cache directives/CDN behavior are #318.

## 25. HTTP DTOs are not release storage rows

The `public_read` schema is an internal persistence/read-model contract.

Nest application queries map those rows to V2 HTTP response DTOs from #313.

Do not make the OpenAPI DTO classes the database table definition and do not make every projection schema change an HTTP API breaking change.

The boundaries are:

```text
module public semantics
   -> release projection schema
   -> application read model
   -> HTTP DTO/OpenAPI
```

## 26. Next.js consumes Nest public reads, not checked-in release data

The V2 Web application stops importing a generated local public release as the application truth.

Remove the architecture where pages import:

```text
TRUSTED_PANDA_DETAILS
TRUSTED_LINEAGE_NODES
TRUSTED_PLACES
... 
```

as the live product dataset.

Next server components/server data loaders consume the generated V2 API client from #313.

This gives one current-publication authority:

```text
Supabase Publication pointer
        -> Nest public API
        -> Next.js
```

No Web rebuild is required merely to make an emergency public withdrawal visible.

Static generation/caching may still be used as an optimization, but correctness cannot depend on a release copy embedded permanently at build time.

## 27. Cache identity

The release identity is the natural cache namespace.

A sealed release never changes, so release-specific cached results are immutable except for emergency public-delivery controls.

For current endpoints:

- activation changes the active release cache key/generation;
- suspension/takedown invalidates affected current-publication cache entries;
- standard `ETag` is derived from release/resource/query content identity;
- immutable R2 derivatives use content/release-specific keys where rights policy permits.

Exact Vercel/Next/CDN invalidation strategy is #318.

## 28. Release sealing gates

A release cannot become `sealed` unless all required gates pass.

At minimum:

### Membership

- every member references an existing immutable approved source revision;
- no duplicated logical public resource;
- required dependency resources are present;
- excluded/withdrawn source revisions do not appear.

### Public safety

- no private/contact data;
- precise wildlife location rules enforced;
- translations meet publication policy;
- source summaries are public-safe;
- media rights/availability policy passes;
- no unsigned/private R2 URL leakage;
- no unknown sensitive field silently passes through.

### Referential integrity

- Panda references resolve inside release or are explicitly modeled as safe external/dependency stubs;
- lineage parent/child references are valid;
- event participants and place references are valid;
- media subjects are valid;
- aliases/slugs are unique under public resolution rules.

### Projection integrity

- expected row counts recorded;
- content hashes computed;
- deterministic rebuild from the same membership yields equivalent semantic output;
- supported projection schema version;
- all required read tables/slices completed.

## 29. Release manifest

Keep a compact immutable release manifest in PostgreSQL and optionally mirror it to private R2 for audit/export.

Conceptually:

```text
releaseId
releaseVersion
projectionSchemaVersion
projectionBuilderVersion
databaseSchemaRevision
sourceManifestHash
memberCount / counts by resource type
projection table counts
projection hashes / manifest hash
createdAt
sealedAt
```

The runtime no longer loads a checked-in Python `release_manifest` file to decide whether the database release is valid.

The database release row/manifest is the authority.

## 30. Optional release export artifacts

The Public Release may still have value as a downloadable/auditable data export.

If a product or audit use case needs it, an optional derived job may produce:

```text
manifest.json
pandas.json / JSONL
CSV export
GeoJSON export
other archival package
```

and store it as an immutable R2 artifact under #316.

Those exports are **derived from the sealed release**.

They are not the serving source for Nest and they do not gate activation unless a concrete product requirement explicitly says an export must exist before publication.

There is no `d1.sql` artifact in V2.

## 31. Activation transaction

Activation is intentionally small and fast because the expensive projection build already happened.

Conceptually one transaction:

```text
BEGIN

lock publication.current
verify target release = sealed
verify supported projection schema
verify no release-level block
append publication transition
update current activeReleaseId/state
append Integration Outbox event

COMMIT
```

No projection rows are created during pointer switching.

No R2 copy, D1 migration or frontend build is part of the activation transaction.

## 32. Activation events

Publication emits durable facts through #315, for example:

```text
publication.release-activated
publication.release-rolled-back
publication.delivery-suspended
publication.delivery-resumed
publication.resource-taken-down
publication.resource-restored
```

Consumers may include:

- Updates;
- Notification where appropriate;
- Audit;
- cache/deployment maintenance adapters where loss is not correctness-critical or where durable jobs are created.

The Outbox event is committed with the pointer/control transaction.

## 33. Release build failure

A failed build never changes public state.

The existing active release continues serving.

Build failures are recorded with stable error codes such as:

```text
release_member_invalid
release_projection_failed
release_reference_missing
release_public_safety_violation
release_media_ineligible
release_hash_mismatch
release_schema_unsupported
```

The failed draft/build can be inspected and a new build requested after fixing the source issue.

Do not partially activate successful slices.

## 34. No “latest approved rows” public fallback

If there is no live active release, public knowledge APIs fail closed.

They must not fall back to:

```text
latest Panda table rows
latest approved Curation rows
old static Web dataset
mock data
checked-in golden fixture
```

This prevents publication controls from being bypassed.

## 35. Emergency resource takedown behavior

For a resource covered by an active emergency takedown:

- normal public detail/list/search reads omit it or return public `404` as appropriate;
- derived relationships must not leak the resource through a different endpoint;
- media delivery does not return a public URL/object through the supported application path;
- counts/stats may either subtract the resource dynamically or be labeled as release snapshot counts depending on endpoint semantics.

For user-facing “current published content” stats, prefer applying takedown-aware effective counts.

Historical internal/admin release inspection can still show the immutable sealed snapshot and the applied takedown overlay separately.

## 36. Takedown scope must be narrow

Emergency controls are not a replacement for normal release editing.

Only designated high-impact capabilities can issue them, with:

- recent-auth/security requirements from #314;
- explicit reason;
- actor/system identity;
- correlation ID;
- Audit/Outbox evidence;
- operator-visible current state.

Routine editorial removals must flow through Curation and a new release.

## 37. Public media history and rights revocation

Release immutability does **not** mean PandaAtlas must keep serving bytes whose rights have been revoked.

Historical release metadata can remain immutable while the Media/Publication delivery control blocks the public object.

A current release must not expose a usable public URL for an actively withdrawn media identity.

The exact R2/custom-domain/cache purge mechanism is #318, but the semantic rule is fixed here.

## 38. Projection schema evolution

`projectionSchemaVersion` is an internal/public-delivery semantic contract.

Rules:

- a sealed release's projection version never changes;
- additive physical DB migrations may keep old rows readable;
- a breaking projection shape creates a new schema version/read adapter as needed;
- the API deployment explicitly declares supported projection versions;
- old support is removed after active + rollback candidates move to supported versions;
- do not mutate historical release rows to pretend they were built by a newer projector.

If a new schema requires wholly different storage, use new release-scoped tables/versioned payloads rather than rewriting old release history.

## 39. Storage retention

Sealed release metadata, membership and projection history are retained long enough to support:

- rollback;
- audit/provenance;
- incident analysis;
- release comparison;
- reproducibility.

Given PandaAtlas scale, the V2 baseline prefers retaining sealed release rows rather than introducing early compaction.

Large optional export artifacts may have an explicit retention/archive policy, but deleting an export artifact cannot erase the authoritative PostgreSQL release history.

## 40. Public-read security boundary

The `public_read` schema is private database infrastructure.

Browser `anon`/`authenticated` Supabase clients do not receive direct SELECT grants merely because the data is public product content.

The supported public boundary is Nest `/api/v2`.

Benefits:

- one authorization/HTTP contract path;
- no PostgREST schema exposure to maintain;
- takedown/suspension rules cannot be bypassed through direct Supabase queries;
- consistent rate limiting/cache/observability;
- future storage changes do not become browser contracts.

## 41. Public reads are not CQRS infrastructure theater

The architecture uses read models because public release semantics require an immutable delivery snapshot, not because every command needs a separate CQRS service.

Do not add:

```text
command bus framework
event-sourcing framework
read-model microservice
projection service deployment
Kafka stream processors
```

The read tables live in the same PostgreSQL and are built by bounded workers.

## 42. Current release consistency across product surfaces

All knowledge-based public surfaces use the same release identity:

- Panda catalog/detail;
- lineage/family;
- places/institutions;
- life events/calendar;
- public map layers;
- source/evidence summaries;
- public media metadata;
- public knowledge stats;
- Game questions that derive from published Panda facts.

Live user state may change independently, but when it references public knowledge the presentation resolves that resource against the pinned/current public release.

## 43. Updates interaction

Publication activation is a fact consumed by `Updates`.

Updates can create public-safe return-loop items such as:

- newly published Panda/profile update;
- new public LifeHistory event;
- approved announcement;
- release change relevant to followed Panda.

Updates is not a second release store.

It references stable Panda/event/release identities and handles current visibility when serving an item.

## 44. Search interaction

Search reads only release-scoped public records.

A result not in the active release/takedown-safe effective view cannot appear because an authoritative private row exists.

Use PostgreSQL indexes/search vectors/trigram support as appropriate.

No separate search engine is justified for V2 baseline.

## 45. Sitemap/SEO interaction

The Next sitemap and metadata generation consume the same Nest public release API/query path.

A Web deployment may cache the resolved set for efficiency, but release/takedown changes need an invalidation/revalidation path from #318.

Do not treat a checked-in generated slug list as the long-term publication authority.

## 46. Existing V1 components to delete rather than adapt

The following are migration inputs, not V2 architecture.

### Cloudflare Worker public API

Delete after cutover:

```text
services/worker-api/**
```

including D1 release repositories, HTTP routing and release parity behavior.

Cloudflare remains for DNS/R2, not a second public API runtime.

### D1 release infrastructure

Delete:

- D1 `public_releases` / `public_release_records` serving model;
- `current_public_release` / `current_public_records` D1 views;
- D1 release migrations;
- D1 preflight/apply/rollback scripts;
- Wrangler D1 release activation paths;
- D1 release withdrawal tables/logic;
- D1 parity and rollback evidence that only exists because two databases serve the API.

### `d1.sql`

Delete generation of:

```text
d1.sql
```

from Public Release artifacts.

There is no V2 consumer for it.

### FastAPI release adapters

Rewrite/delete rather than translate:

```text
services/api/app/projection/public_release.py
services/api/app/projection/postgres_source.py
services/api/app/projection/approved_release_bootstrap.py
services/api/app/services/managed_release_service.py
services/api/app/services/release_read_service.py
services/api/app/services/release_service.py
V1 publication_repository implementation
```

Correct semantic checks move into Nest Publication/module contributors; Python/file/D1 compatibility glue does not.

### File manifest authority

`services/api/app/release_manifests` and checked-in release files cease being runtime authority.

Historical manifests may be archived as migration evidence.

### Build-time Web release authority

Replace the current live-product dependency on:

```text
apps/web/features/public-content/public-release.ts
lib/generated/TRUSTED_*
frontend withdrawal files as authoritative current state
```

with generated V2 API client reads plus ordinary frontend view-model logic.

Some generated fixtures can remain for tests/storybook/local demos, but not as production current-publication truth.

## 47. V1 database publication tables are not preserved by name

These V1 `public` schema structures are architecture/history inputs:

```text
entity_revisions
change_sets
change_set_revisions
change_set_reviews
publication_batches
publication_batch_change_sets
public_release_pointer
public_api_release_withdrawals
```

V2 Curation/Publication private schemas are redesigned around their module semantics.

Do not keep these table names/shapes merely to reduce migration work.

The data/provenance they contain must be migrated or archived as required by #321.

## 48. Proposed V2 storage shape

Conceptually only; exact DDL is implementation work:

```text
publication.releases
  release_id PK
  release_version UNIQUE
  build_state
  projection_schema_version
  projection_builder_version
  database_schema_revision
  source_manifest_hash
  manifest_hash
  created_by
  created_at
  sealed_at
  failure_code

publication.release_members
  release_id
  resource_type
  resource_id
  source_revision_id
  source_version
  source_hash
  PK(release_id, resource_type, resource_id)

publication.current
  singleton
  active_release_id
  state
  switched_at
  generation

publication.transitions
  transition_id
  operation
  from_release_id
  to_release_id
  actor_id
  reason
  correlation_id
  occurred_at

publication.takedown_actions
  action_id
  target_type
  target_id
  action
  actor_id
  reason
  correlation_id
  occurred_at

public_read.*
  release_id + typed public query rows
```

Content rows and release membership become immutable after seal.

## 49. Build immutability enforcement

Database constraints/triggers/privileges should enforce:

- no mutation of release members after `sealed_at`;
- no mutation/delete of release projection rows for a sealed release;
- no change of projection version/hash metadata after seal;
- activation only targets sealed releases;
- pointer transitions use an application/DB transaction that also emits durable event evidence;
- transition/takedown history is append-only;
- current pointer/control is the only intentionally mutable publication control record.

Do not rely solely on TypeScript convention for release immutability.

## 50. Concurrency

Release building and activation are concurrency-safe.

### Builds

Multiple builds can exist, each with a distinct release ID.

They do not affect the live pointer.

### Activation

Activation locks the singleton current publication record.

The command may include an expected current release/version (`If-Match`/application precondition from #313) so an operator cannot silently overwrite a concurrent activation.

### Takedown

Takedown/restore commands are idempotent by command idempotency key and append stable action history.

## 51. Four-eyes / authorization

Publication operations remain high-impact admin commands.

Curation review/separation-of-duties semantics belong to Curation/Review, but Publication activation/rollback/suspension also require explicit capabilities from #314.

At minimum, activation cannot bypass the fact that the release source membership is approved/sealed.

Whether two distinct humans must participate in every release activation is a product/governance policy, not an excuse to keep the V1 `change_sets` tables.

The policy should be expressed in V2 Review/Curation/Publication state directly.

## 52. Reproducibility

A sealed release is reproducible from:

```text
release membership
+ immutable source revision IDs/hashes
+ projectionSchemaVersion
+ projectionBuilderVersion
+ database schema revision
```

A rebuild tool can compare semantic rows/hashes without needing the original D1 SQL file.

Determinism applies to semantic projected data. Operational timestamps/transition IDs are outside the content hash unless deliberately included.

## 53. Release comparison

Because releases are stored by release ID in the same PostgreSQL, operators can compare:

- member additions/removals;
- source revision changes;
- public row hashes;
- resource count changes;
- media differences;
- lineage/event differences.

No external D1 export/import is needed for diffing.

## 54. Disaster recovery semantics

Publication metadata/read projections are in the single authoritative Supabase PostgreSQL backup/PITR domain.

R2 export artifacts are useful additional evidence but are not the sole recovery source.

If projections are lost but authoritative source revisions/membership survive, they are rebuildable.

If the current pointer is lost, activation history identifies the intended state.

Exact provider backup/PITR validation is #318/#321.

## 55. Testing requirements implied by this decision

Detailed organization is #319, but later implementation must prove:

### Release build

- exact approved members captured;
- source mutation after capture cannot change sealed result;
- public safety failures prevent seal;
- cross-resource references validated;
- release counts/hashes deterministic;
- failed build never changes active release.

### Immutability

- sealed membership cannot update/delete;
- sealed projection rows cannot mutate;
- historical release remains readable after later activations.

### Activation

- pointer switch + transition + Outbox commit atomically;
- concurrent activation precondition failure is safe;
- unsupported projection schema cannot activate;
- composite public query pins one release.

### Rollback

- rollback switches to exact historical release ID;
- does not duplicate/copy release content;
- old current release remains intact;
- emergency takedowns are not bypassed.

### Takedown

- whole-release suspension fails public knowledge reads closed;
- resource takedown removes it across list/detail/search/lineage/map as applicable;
- restore is explicit and audited;
- historical sealed content is not rewritten.

### Web/public API

- Next production paths do not use checked-in generated release truth;
- public API never falls back to private/current authoritative rows;
- release metadata/ETag remain consistent across one response.

## 56. Migration implications

#321 can assume this target sequence conceptually:

1. build new V2 Publication schema and release-scoped `public_read` tables in Supabase;
2. create projection contributors from V2 modules;
3. build/seal a V2 release from migrated approved content;
4. validate V2 Nest public reads against the current public product dataset;
5. switch Next to V2 generated API client/public reads;
6. activate V2 release authority;
7. retire Worker/D1 public API;
8. retire FastAPI file/release adapters;
9. archive/import required historical release/provenance evidence;
10. delete D1/release compatibility machinery after rollback window closes.

No long-term dual-publication system is retained.

## 57. Decisions deferred to later tickets

- Vercel/Nest deployment region, cache headers, Next revalidation, CDN invalidation and R2 public-media routing: #318.
- Observability, alerting on failed/suspended release, error taxonomy, architecture/test gates: #319.
- Exact TypeScript package paths, worker CLI commands and module/file layout: #320.
- Exact migration ordering, historical release migration depth, cutover rollback window and D1/FastAPI deletion moment: #321.
- Final consolidated architecture and implementation slices: #322.

## Acceptance for #317

The public-read/publication architecture is resolved when later planning can assume all of the following without reopening this ticket:

- Supabase PostgreSQL is the only public-content authority; no D1 copy is part of V2 serving.
- immutable Public Releases are retained as a business/recovery concept.
- release content/build lifecycle is separate from current activation lifecycle.
- a sealed release can be activated multiple times and is never mutated.
- rollback is an atomic pointer switch to an older compatible sealed release plus an append-only transition; it does not create a copied rollback release.
- normal editorial withdrawal creates a new immutable release.
- emergency whole-release suspension and resource/media takedown are narrow Publication delivery controls that do not rewrite release history and are explicitly restored/audited.
- emergency resource takedowns survive rollback by stable resource identity unless explicitly restored.
- release membership records exact immutable source revision IDs/versions/hashes.
- Publication coordinates projection but module owners define public-safe semantics through narrow contributor interfaces; Publication does not query other modules' private tables directly.
- primary public serving projections are typed, release-scoped tables in a private `public_read` delivery schema.
- ordinary materialized-view refresh and one generic `public_json` record table are not the primary serving architecture.
- Panda/search, Lineage, Places/spatial, LifeHistory events, Media, public Evidence summaries and release stats retain useful read projections; user/private/live workflow modules do not get snapshotted into a Public Release.
- public composite queries pin one release ID explicitly for response consistency.
- public API maps projection rows to V2 DTOs and does not expose database projection rows as the HTTP contract.
- Next.js consumes Nest V2 public reads through the generated client; checked-in `TRUSTED_*`/local release data is not production publication truth.
- release manifests/counts/hashes live with the PostgreSQL release authority; optional JSON/CSV/export artifacts are derived outputs, not serving prerequisites.
- Python is not required to build the primary serving projection; it may build optional large export/media/release artifacts under #316.
- activation is a small transaction over a prebuilt sealed release and emits durable Outbox events.
- no public fallback to current authoritative/private rows exists when publication is unavailable.
- `services/worker-api`, D1 release tables/views/scripts, `d1.sql`, FastAPI managed/file release adapters, and build-time Web release authority are deletion targets rather than compatibility requirements.
