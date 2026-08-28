# NestJS V2 Python data-pipeline boundary and shared contracts

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #316 `Define the Python data-pipeline boundary and shared contracts`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

How should acquisition, crawling, enrichment, identity resolution, curation tooling, media processing, release construction, and research remain in Python while becoming structurally independent from the NestJS application, and which database, JSON Schema, artifact, event, and job/command contracts should form the only supported seams between the two runtimes?

## Decision summary

PandaAtlas V2 keeps Python as a **separate batch/data runtime**, not as a second backend application.

The target shape is:

```text
                    ┌─────────────────────────────┐
                    │        NestJS V2 API        │
                    │ authoritative business state│
                    └──────────────┬──────────────┘
                                   │
                    authoritative │ writes never bypass Nest modules
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
                v                                     v
       module-owned export views              Integration Outbox
                │                                     │
                │ versioned read contract             │ versioned fact
                v                                     v
       Python data runtime                    consumer/job PGMQ
       acquisition/enrichment                     queues
       identity resolution                           │
       curation assistance                           v
       media/release builders                 Python bounded worker
       research                                      │
                │                                    │
                ├──────── immutable artifacts ───────┤
                │          + manifests               │
                v                                    v
       private R2 artifact store              pipeline job/result state
                │                                    │
                └──────── result event/outbox ───────┘
                                   │
                                   v
                    Nest owning module validates,
                    reviews and applies business state
```

Core rule:

> **Python may discover, compute, transform and build. NestJS business modules remain the only authority that accepts those results as PandaAtlas business truth.**

Python therefore does not become a hidden second write API for Panda, Evidence, Lineage, Places, LifeHistory, Media, Curation, Publication, Identity, Engagement, Review, Moderation, Privacy, Updates, Notification, or Audit tables.

## 1. Runtime ownership

### Python keeps

Python remains the preferred implementation language for work whose center of gravity is external data, document/media processing, scientific/data tooling, or long-running batch execution:

- acquisition source adapters;
- crawling and fetch policy;
- discovery and breadth-first source expansion;
- evidence/raw-source capture;
- parsing and normalization;
- fact enrichment;
- bilingual/LLM-assisted enrichment where retained;
- identity extraction and identity-resolution algorithms;
- candidate deduplication and reconciliation;
- curation preparation, batch planning and patch generation;
- research workflows and exploratory analysis;
- image/media derivative generation and technical inspection;
- large immutable release-artifact construction when #317 requires it;
- bulk data-quality and reconciliation reports;
- one-time V1 data migration/import tooling.

### NestJS keeps

NestJS V2 remains authoritative for:

- Panda identity and published factual state;
- Evidence source registration/provenance decisions;
- Lineage assertions and status;
- Places/LifeHistory state;
- reviewed Media metadata, rights and publication eligibility;
- Contribution/Review/Moderation workflow state;
- Curation approval/application/provenance;
- Publication lifecycle, activation, withdrawal and rollback;
- Identity/account/capability policy;
- Engagement/Game/Updates/Notification/Privacy/Audit business state;
- HTTP/API authorization and user-facing commands.

### Meaning of “curation remains in Python”

Python keeps **curation tooling**, not authoritative editorial governance.

Python may produce:

```text
candidate bundles
reconciliation reports
curation patches
batch review plans
identity-resolution suggestions
source-quality reports
release build candidates
```

But final review/approval/application is owned by the V2 Review/Curation/fact-owner modules selected in #310.

A Python script must not modify authoritative fact tables merely because an operator has reviewed a local CSV or patch file.

## 2. One Python product, not many hidden services

The V2 baseline uses one installable Python application/package, conceptually:

```text
tools/panda-data/
  pyproject.toml
  src/
    panda_data/
      cli/
      acquisition/
      enrichment/
      identity_resolution/
      curation/
      media/
      release/
      research/
      contracts/
      infrastructure/
        postgres/
        pgmq/
        r2/
```

The exact monorepo path is finalized by #320, but the architectural boundary is fixed here.

There is no Python HTTP server in the V2 baseline.

Do not create:

```text
Python FastAPI sidecar
Python internal REST service
Python microservice per crawler
Python worker API
```

Python runs as bounded CLI/batch workers locally and in GitHub Actions, consuming durable jobs/artifacts and exiting.

## 3. Independent Python dependency graph

The Python data runtime has its own `pyproject.toml` and lockfile/environment and is independent of the Nest/npm dependency graph.

Use `uv` as the Python project/lock runner because the repository already uses uv and current uv projects provide `pyproject.toml`, isolated project environments, lockfiles and package entrypoints.

A multi-package uv workspace is **not required** for the V2 baseline. Start with one Python project; split it only if genuinely conflicting dependency/runtime needs appear.

The Python project must not depend on or install the old `panda-atlas-api` FastAPI package.

### Baseline dependency direction

Expected Python foundations include, where required:

- `pydantic` / `pydantic-settings` for Python-local typed models/configuration;
- `jsonschema` for canonical cross-runtime JSON Schema validation;
- `psycopg` for the narrow PostgreSQL/pipeline boundary;
- `httpx`, Scrapy/Scrapling or established fetch libraries for acquisition;
- Pillow/media libraries for media processing;
- an S3-compatible client for R2 where artifact storage is required.

Do not carry FastAPI, Uvicorn, SQLAlchemy or PyJWT into the Python data package merely because they existed in `services/api`.

If one data workflow later proves SQLAlchemy materially useful, that is a local tool choice rather than a shared architecture requirement. The baseline database seam is sufficiently narrow for direct psycopg SQL/adapters.

## 4. Current repository evidence

The current `services/api` package mixes two runtimes that should be independent in V2.

Examples:

- `services/api/app/acquisition` contains adapters, crawling policy, bundles, discovery, reconciliation and curation helpers alongside the HTTP application;
- `services/api/app/enrichment` and `app/identity_resolution` are data-pipeline capabilities packaged as API implementation;
- many `services/api/scripts/*.py` import `app.acquisition`, `app.enrichment`, `app.identity_resolution`, `app.knowledge`, `app.db`, or HTTP/application modules directly;
- API-specific scripts and data-pipeline scripts live in the same script directory;
- one `pyproject.toml` consequently combines FastAPI, JWT/auth, SQLAlchemy and crawler dependencies.

This is packaging coupling, not a domain requirement.

The current repository already contains strong migration inputs:

- language-neutral Draft 2020-12 schemas under `contracts/`;
- positive contract fixtures;
- acquisition bundles that explicitly prohibit trusted/publication write targets;
- curation-patch workflows that produce proposals without automatically applying them;
- content hashes and stable bundle IDs;
- substantial local research/import datasets;
- R2 as the retained large-object/media platform.

V2 strengthens these boundaries rather than discarding them.

## 5. Supported cross-runtime seams

There are only five supported categories of Nest/Python interaction:

1. **versioned JSON Schema contracts**;
2. **immutable artifact contracts**;
3. **module-owned database export/read contracts**;
4. **durable pipeline jobs and integration events through PostgreSQL/PGMQ/Outbox**;
5. **explicit Nest HTTP commands only when a human/client interaction genuinely belongs to the public/private application API**.

Everything else is prohibited coupling.

In particular, these are not supported seams:

```text
Python importing Nest TypeScript models
Nest importing generated Python code
Python importing old services/api/app modules
Python writing arbitrary Nest module tables
Nest reading Python implementation files as data contracts
shared pickle/joblib objects
shared SQLite/DuckDB files as business truth
shelling out from a user HTTP request to Python scripts
one runtime depending on the other runtime's virtual environment/node_modules
```

## 6. Cross-runtime contract authority

### Canonical authority is JSON Schema Draft 2020-12

For data that crosses the Python/Nest boundary, the canonical hand-authored contract is **JSON Schema Draft 2020-12** under `contracts/`.

This is deliberately different from #313:

- Nest-only HTTP contracts are authored in Nest DTO/controllers and OpenAPI is generated;
- Python/Nest shared contracts must be language-neutral, so JSON Schema itself is the authored authority.

Do not make either of these the cross-runtime authority:

```text
Pydantic model_json_schema() output
TypeScript interface/type declaration
Nest DTO class
Python dataclass
```

Those are language-specific representations.

### Why this changes the current pattern

Several current tests assert exact equality between a checked JSON file and `PydanticModel.model_json_schema()`.

That makes Python the real contract authority even though the file looks language-neutral.

V2 reverses the direction:

```text
canonical JSON Schema
     │
     ├── Python boundary validation
     ├── TypeScript boundary validation
     ├── generated TypeScript declarations
     └── positive/negative fixture tests
```

Pydantic models may still exist for Python ergonomics, but they are internal models. Their serialized input/output is validated against the canonical schema at the boundary.

## 7. JSON Schema rules

Every V2 shared schema must:

- declare `$schema: https://json-schema.org/draft/2020-12/schema`;
- have a stable `$id`, preferably a repository-controlled URN rather than a fake network URL;
- declare an explicit contract/version identity;
- use strict object shapes (`additionalProperties: false` or the appropriate 2020-12 equivalent);
- use explicit types for every keyword whose semantics depend on type;
- use camelCase wire property names;
- distinguish missing from `null` intentionally;
- use RFC 3339 timestamps and calendar-date strings consistently;
- use UUID strings for stable UUID identifiers;
- use lowercase SHA-256 hex for content digests;
- forbid NaN/Infinity because the interchange is JSON;
- avoid arbitrary implementation-language class names in `$id`, schema titles or enums.

### No runtime network schema loading

All schemas and `$ref` dependencies are shipped in the repository/package and registered locally.

Neither Python nor Nest loads arbitrary remote schemas from the network during worker execution or validation.

This removes availability risk and avoids validating against attacker-controlled schemas.

## 8. Cross-language strict-validation gate

A schema is not accepted merely because one implementation can parse it.

V2 contract CI must compile/check every shared schema with at least:

- Python `jsonschema` Draft202012Validator, with explicit format checking where formats matter;
- TypeScript/Node Ajv's 2020-12 validator in strict mode plus required format support.

### Prototype evidence from this ticket

On 2026-08-26:

- Python `jsonschema 4.26.0` accepted both current `contracts/integration-event.v1.json` and `contracts/acquisition-bundle.v1.json` as valid Draft 2020-12 schemas;
- Ajv `8.20.0` + `ajv-formats 3.0.1` compiled `integration-event.v1.json` in strict mode;
- Ajv strict mode **rejected the current acquisition bundle schema** because a conditional subschema applies `maxItems` to `assertion_ids` without declaring `type: array` in the same subschema.

The current pattern is legal JSON Schema but not strict cross-language authoring.

This finding is evidence for the V2 gate: schemas must satisfy both validators before becoming supported shared contracts.

Do not silently disable Ajv strictTypes globally just to accept Python-generated schemas.

## 9. TypeScript bindings

Nest/TypeScript gets generated declaration types from the canonical shared schemas.

Baseline generator: `json-schema-to-typescript` or an equivalently small generator selected by #320.

Generated declarations are derived and never hand-edited.

Runtime validation still uses Ajv; TypeScript types alone cannot enforce JSON Schema constraints such as patterns, number bounds, array uniqueness or full `oneOf` semantics.

Conceptually:

```text
contracts/**/*.schema.json
        │
        ├── Ajv runtime validator
        └── generated TS types
```

This package is distinct from the OpenAPI-generated HTTP client package from #313 even if #320 chooses to expose them under one workspace package hierarchy.

## 10. Python bindings

Python uses two layers:

1. canonical JSON Schema validation using `jsonschema`;
2. Pydantic/dataclass/domain models for local ergonomic processing where useful.

For inbound shared data:

```text
bytes/JSON
  -> canonical JSON Schema validation
  -> Python local model parsing
  -> algorithm
```

For outbound shared data:

```text
Python local model/result
  -> JSON serialization
  -> canonical JSON Schema validation
  -> artifact/event/job persistence
```

Do not require generated Pydantic code in the V2 baseline. It adds another generator/tooling surface without proving enough benefit over the already-existing Python models plus authoritative schema validation.

If future contract volume makes generated Python models worthwhile, the generated code must remain derived from the same canonical JSON Schema.

## 11. Contract layout

Exact package paths are #320, but the conceptual taxonomy is fixed:

```text
contracts/
  shared/
    integration-event-envelope.v1.schema.json
    pipeline-job.v1.schema.json
    artifact-manifest.v1.schema.json
  events/
    pipeline.acquisition-completed.v1.schema.json
    pipeline.enrichment-completed.v1.schema.json
    pipeline.identity-resolution-completed.v1.schema.json
    pipeline.media-processing-completed.v1.schema.json
    pipeline.release-build-completed.v1.schema.json
  jobs/
    acquisition-run.v1.schema.json
    enrichment-run.v1.schema.json
    identity-resolution-run.v1.schema.json
    media-processing-run.v1.schema.json
    release-build-run.v1.schema.json
  artifacts/
    acquisition-bundle.v2.schema.json
    evidence-capture.v1.schema.json
    identity-resolution.v2.schema.json
    enrichment-batch.v2.schema.json
    curation-patch.v2.schema.json
    media-build-result.v1.schema.json
    release-build-input.v1.schema.json
    release-build-result.v1.schema.json
  fixtures/
    ...
```

The names/versions above are target categories, not a requirement to create every file before a workflow needs it.

Do not create a giant `common.schema.json` dumping ground.

## 12. Contract versioning

Each cross-runtime contract has an explicit integer major version in both filename/ID and payload/envelope where applicable.

Rules:

- never rewrite the semantics of an already accepted version;
- structural or semantic breaking change creates a new version;
- strict schemas mean adding an unexpected field can also require a new version unless consumers are deliberately designed for that extension;
- producers emit the current version;
- consumers reject unsupported versions with a stable terminal error rather than guessing;
- positive and negative fixtures are versioned with the schema.

### Deployment overlap

A V2 deployment may temporarily support current and immediately previous contract versions **only to drain already-created jobs/events/artifacts safely**.

That is bounded deployment compatibility, not a permanent legacy compatibility layer.

After the old queue/job population is drained and verified, the old parser/handler is removed.

## 13. Wire naming

V2 cross-runtime JSON uses **camelCase**, consistent with the V2 HTTP wire contract from #313.

Python internal code remains free to use idiomatic `snake_case` and maps at the boundary through aliases/adapters.

Do not preserve V1 snake_case JSON merely because current Python models emit it.

Database columns can remain snake_case independently.

## 14. Pipeline job contract

Do not introduce a general-purpose cross-runtime command bus.

The only generic Python execution request is a **bounded pipeline job**.

Conceptually:

```json
{
  "jobId": "uuid",
  "jobType": "media.processing",
  "jobVersion": 1,
  "requestedAt": "2026-08-26T12:00:00Z",
  "correlationId": "uuid",
  "causationId": "uuid-or-null",
  "inputArtifacts": ["uuid"],
  "parameters": {}
}
```

Rules:

- `jobType` comes from a closed allowlist/registry;
- `parameters` are validated by the specific job-type schema;
- payloads contain no shell command, module path, SQL or arbitrary executable expression;
- secrets are referenced through deployment configuration, never embedded in job payloads;
- jobs have deterministic/idempotent identity when created from a retry-safe upstream workflow;
- a worker dispatches `jobType` to a registered handler, not `eval`, dynamic imports supplied by clients, or shell execution.

### This is a technical job, not a business command

Business commands such as:

```text
ApproveCuration
PublishRelease
WithdrawRelease
GrantRole
ApplySanction
```

remain inside Nest application modules and are never represented as arbitrary Python job payloads.

## 15. Nest-triggered Python work

When a Nest business workflow needs Python computation, the owning module first records its own authoritative workflow state.

Example:

```text
Media command
  -> records ProcessingRequested state
  -> appends media.processing-requested integration event
  -> COMMIT

Outbox Dispatcher
  -> Python media work queue

Python worker
  -> process bytes
  -> write immutable derivative artifacts
  -> record pipeline result
  -> append pipeline.media-processing-completed event

Media consumer
  -> verify result/hashes/policy
  -> update authoritative Media state
```

The same pattern applies to identity-resolution assistance and release building.

Python never updates the Media/Publication module tables directly.

## 16. Scheduled acquisition work

Acquisition may originate from a scheduled GitHub Actions workflow rather than a user/Nest command.

The scheduler is still not the durable business truth.

A scheduled Python entrypoint must establish a durable, idempotent pipeline run/job before or as it begins meaningful work.

Conceptually:

```text
GitHub Actions wake-up
   -> ensure/create pipeline acquisition run by schedule key
   -> execute bounded work / checkpoint
   -> write artifacts
   -> mark pipeline result
   -> append pipeline.acquisition-completed event
```

If the workflow is delayed or retried, the existing run/job identity prevents accidental duplicate authoritative intake.

Nest Curation/Evidence consumers decide what to do with the candidate artifact.

## 17. Pipeline database boundary

Introduce one private technical schema conceptually named `pipeline`.

It is not a business domain module and does not own Panda facts.

It owns only cross-runtime operational state such as:

```text
pipeline.jobs
pipeline.job_attempts
pipeline.artifacts
```

### `pipeline.jobs`

Stores durable technical execution identity/state:

```text
job_id
job_type
job_version
state
correlation_id
causation_id
input artifact references
requested_at
started_at
completed_at
failure_code
```

### `pipeline.job_attempts`

Append-only execution evidence when needed for retry/recovery:

```text
job_id
attempt_number
runner identity
started_at
finished_at
outcome
failure_code
```

### `pipeline.artifacts`

Indexes immutable artifact metadata:

```text
artifact_id
artifact_type
artifact_version
schema_id
sha256
byte_size
media_type
storage_provider
storage_bucket
storage_key
producer_job_id
created_at
metadata
```

The bytes themselves live in object storage when they are not tiny control messages.

Do not put large crawl bodies/media/release packages into PostgreSQL JSONB merely to avoid object storage.

## 18. Dedicated Python database role

Python/GitHub workers use a dedicated restricted PostgreSQL login/role, conceptually `zhipanda_pipeline_worker`.

It is not the Nest API database role and not Supabase `service_role` user identity.

Baseline permissions:

- read/write the narrowly defined `pipeline` technical tables needed by workers;
- call PGMQ operations only for queues assigned to Python workloads;
- SELECT only explicitly granted module-owned export views;
- call a narrow function/adapter to append allowed `pipeline.*` integration events to the Outbox;
- no direct DML grants on authoritative business tables;
- no blanket privileges on `public`, `auth`, `identity`, or all schemas.

### Outbox publishing from Python

Python-produced durable facts such as `pipeline.acquisition-completed` follow #315 and reach the transactional Outbox.

Prefer a narrow database function/adapter such as an `append_pipeline_event` boundary over granting the worker unrestricted DML across the entire integration schema.

The function enforces source namespace/envelope constraints at the database boundary; Python validates the full event schema before invoking it.

Exact grants/function implementation are #318/#320 implementation work.

## 19. Authoritative database write rule

The Python role has **zero direct write permission** to V2 business module storage by default.

That includes schemas owned by:

```text
panda
evidence
lineage
places
life_history
media
contribution
review
moderation
curation
publication
identity
engagement
game
updates
notification
privacy
audit
```

If a future workflow claims it needs direct Python writes to one of these tables, the architectural burden is to prove why a Nest-owned application command/result-consumer cannot own the invariant.

The default answer is no.

## 20. Python read access to authoritative state

Python often needs current curated state for reconciliation or identity resolution.

It still must not query arbitrary private tables.

Each owning module may expose a **versioned, module-owned database export view** for data-pipeline use.

Examples conceptually:

```text
panda.pipeline_identity_export_v1
lineage.pipeline_parentage_export_v1
evidence.pipeline_source_export_v1
places.pipeline_place_export_v1
media.pipeline_asset_export_v1
```

Rules:

- the view is owned/migrated with the source module;
- its columns are an explicit data contract;
- Python gets SELECT on the view, not underlying tables;
- changes that break a pipeline consumer create a new view version;
- views expose only the minimum data needed;
- sensitive account/privacy data is not exported merely for convenience.

This is the database equivalent of #310's narrow module interface rule.

## 21. Reproducible input snapshots

A live export view is useful for discovery and small reads, but a long-running/replayable job should record the exact authoritative input it used.

For deterministic/reviewable jobs, create or reference an immutable input snapshot/artifact containing:

- source export version;
- relevant row/entity IDs;
- source data version/release ID where applicable;
- content hash;
- created timestamp.

Then the job records that artifact ID.

This prevents a two-hour identity-resolution or release-build run from silently seeing different truth halfway through execution.

## 22. Artifact store

Cloudflare R2 remains the V2 durable store for large immutable objects, so Python pipeline artifacts should reuse that platform rather than add another storage service.

Use a private pipeline bucket or private scoped prefix finalized by #318.

The public media bucket/prefix is not a general scratch space.

### Artifact immutability

Once an artifact is finalized:

- its object bytes are immutable;
- its SHA-256 is recorded;
- object key is content-addressed or otherwise non-overwriting;
- new content creates a new artifact identity/key;
- downstream consumers verify size/hash before trusting it.

Do not “update” a previous acquisition bundle, curation patch or release build in place.

## 23. Artifact manifest

Every durable artifact has a language-neutral manifest governed by JSON Schema.

Conceptually:

```json
{
  "manifestVersion": 1,
  "artifactId": "uuid",
  "artifactType": "acquisition.bundle",
  "artifactVersion": 2,
  "schemaId": "urn:zhipanda:contracts:artifacts:acquisition-bundle:v2",
  "sha256": "...",
  "byteSize": 12345,
  "mediaType": "application/json",
  "createdAt": "...",
  "producerJobId": "uuid",
  "storage": {
    "provider": "r2",
    "bucket": "...",
    "key": "..."
  }
}
```

Queue/event messages normally carry the artifact ID/reference, not a duplicate copy of a large payload.

## 24. Artifact formats

### JSON

Use ordinary UTF-8 JSON for bounded structured bundles/manifests.

### JSON Lines

Use JSONL for large record-oriented exports/results where streaming and row-level validation are useful.

Each line is validated against the record schema and the batch is covered by a manifest/hash/count contract.

Compression may use standard gzip when useful.

Do not keep producing `.gz.b64` files as an operational storage format. Base64-wrapped gzip is useful for repository transport in exceptional historical cases, but R2 can store the compressed bytes directly.

### Binary media

Store raw/derived media bytes directly with a manifest containing MIME type, digest, dimensions/other technical metadata as applicable.

### Parquet

Parquet is allowed for analytics/research-derived datasets where columnar processing is the point.

It is **not** the baseline authoritative command/event interchange format because JSON Schema does not directly validate a Parquet payload's full semantics and Nest should not need a Python/Arrow stack merely to ingest ordinary business results.

If a later high-volume workflow justifies Parquet as an official boundary, it must add an explicit column/schema/version contract.

### Forbidden interchange formats

Do not use as cross-runtime authoritative artifacts:

```text
pickle
joblib
marshal
Python object dumps
Node v8 serialization
ad hoc SQLite databases
ad hoc DuckDB databases
unversioned CSV with inferred columns
```

## 25. Acquisition boundary

Acquisition owns source access and candidate generation, not trusted truth.

Python acquisition may:

- fetch allowed sources;
- capture immutable evidence bytes/metadata;
- parse structured candidates;
- normalize values;
- compute stable candidate/deduplication IDs;
- produce acquisition/evidence candidate artifacts;
- emit completion/failure metrics/events.

It may not:

- write Panda/Lineage/LifeHistory facts directly;
- mark evidence trusted/public;
- activate a release;
- publish media;
- bypass Review/Curation.

The current acquisition bundle's explicit no-trusted-write/no-publication-write boundary is retained as a V2 invariant, even if its schema is redesigned.

## 26. Evidence source registry split

The current repository source registry mixes operational acquisition concerns with source identity concepts.

V2 separates them:

### Evidence module owns

- stable source/evidence identity;
- source publisher/title/locator/provenance metadata accepted into PandaAtlas;
- verification/access/public-safe evidence status.

### Python acquisition config owns

- adapter implementation key;
- fetch/crawl mode;
- domain allowlist;
- throttling/politeness settings;
- parser/version;
- browser/authorized-session operational policy;
- non-secret references to required credentials/session configuration.

Python receives stable Evidence source IDs through an explicit export/input contract rather than inventing a second business source identity.

## 27. Identity resolution boundary

Identity resolution is a strong Python use case because it benefits from batch comparisons, normalization and algorithmic tooling.

Flow:

```text
candidate artifact
+ immutable Panda identity export snapshot
          |
          v
Python identity resolver
          |
          v
IdentityResolutionResult artifact
          |
          v
Curation/Panda owning module
  accepts / rejects / flags review
```

The result contains evidence and candidate matches, confidence/reason codes and stable source identifiers; it does not mutate Panda identity rows.

Merge/split/canonical identity decisions remain authoritative Nest business commands because they have broad product/integrity consequences.

## 28. Enrichment boundary

Python enrichment produces proposals/derived content with provenance.

Examples:

- normalized factual candidate;
- translated/bilingual summary proposal;
- inferred relationship candidate;
- extraction confidence/reasoning metadata;
- source locator/evidence reference.

An enrichment result is never automatically equivalent to a confirmed public fact merely because a model assigns a high confidence score.

Curation/fact-owner rules decide acceptance and publication status.

## 29. Curation tooling boundary

Current file-based curation assets under `data/curation/pandas/*.csv` are migration/history inputs, not the V2 ongoing source of truth.

V2 Python tools may still generate downloadable/reviewable curation artifacts, but accepted editorial state is stored in authoritative PostgreSQL Curation/fact modules.

After cutover, do not maintain a permanent dual-write flow such as:

```text
operator edits CSV
  + Nest edits DB
  + periodic reconciliation decides which one wins
```

There is one authority.

## 30. Media-processing boundary

Python remains responsible for technical media processing where appropriate:

- image decode/inspection;
- EXIF/metadata stripping;
- dimension checks;
- derivative resizing/cropping/encoding;
- checksums;
- quality/technical validation;
- optional computer-vision enrichment where approved.

Flow:

```text
Media owns original/private asset state
    -> media processing requested
    -> Python reads scoped source object
    -> writes derivatives to private staging R2 prefix
    -> emits MediaBuildResult manifest
    -> Media verifies and records authoritative derivative/rights state
```

Python cannot make an object public simply by writing bytes to R2.

Media/Publication owns eligibility and public URL lifecycle.

Python R2 credentials should therefore be scoped to required input/staging prefixes rather than the whole public-media administration surface.

## 31. Release-construction boundary

Python may build large immutable release artifacts because that is batch/data assembly work.

It does **not** own Publication lifecycle.

Required flow:

```text
Publication/Curation
  -> creates approved immutable ReleaseBuildInput
  -> records build requested state

Python
  -> validates ReleaseBuildInput schema/hash
  -> builds candidate release artifact(s)
  -> computes manifest/hash/counts
  -> writes private immutable result artifact
  -> emits pipeline.release-build-completed

Publication
  -> revalidates result
  -> performs domain release checks
  -> records release membership/build association
  -> authorized command activates/withdraws/rolls back
```

Python never writes the active release pointer.

The exact shape of ReleaseBuildInput/Public Release remains #317.

## 32. Research boundary

Research is intentionally freer than production ingestion but still cannot become business truth implicitly.

Research Python may:

- read approved exports/artifacts;
- use notebooks or scientific libraries;
- create experimental datasets/models/reports;
- perform offline joins and analysis.

Research outputs live in a research artifact namespace/local workspace until intentionally promoted through a typed pipeline/curation intake contract.

Do not grant the research environment broad production write access for convenience.

## 33. Repository data hygiene

The current `data/local-panda-research/` tree contains large numbers of generated/import JSON, JSONL and base64-compressed artifacts.

These files are useful migration evidence but should not define the V2 runtime storage pattern.

V2 policy:

- small hand-authored fixtures/config may remain in Git;
- canonical contract schemas/fixtures remain in Git;
- durable generated run artifacts live in R2 + pipeline artifact registry;
- ephemeral local outputs remain ignored local files;
- GitHub Actions artifacts are for CI/job diagnostics and handoff, not the authoritative archive.

GitHub currently retains workflow artifacts for 90 days by default, configurable only to bounded retention (up to 400 days for private repositories), so it cannot be the long-term provenance/archive store.

## 34. Integration events produced by Python

Python is allowed to produce only explicitly registered integration events, typically in the `pipeline.*` namespace.

Examples:

```text
pipeline.acquisition-completed
pipeline.acquisition-failed
pipeline.identity-resolution-completed
pipeline.enrichment-completed
pipeline.media-processing-completed
pipeline.release-build-completed
```

These events describe completed/failed technical facts.

Python does not emit fake domain events such as:

```text
panda.updated
publication.release-activated
moderation.sanction-applied
```

unless the corresponding authoritative Nest module actually committed that business fact.

## 35. Integration events consumed by Python

Python may consume selected durable events/jobs routed through consumer-specific PGMQ queues from #315.

Examples:

```text
media.processing-requested
publication.release-build-requested
curation.identity-resolution-requested
```

Where practical, the event indicates that the owning module has committed a workflow/request state; the Python queue message references the authoritative event/job/input artifact.

Do not let an arbitrary event type dynamically invoke arbitrary Python functions.

## 36. Result acceptance

A successful Python job means:

```text
technical computation finished
+ output artifact passed cross-runtime schema validation
+ hashes/object writes completed
```

It does **not** automatically mean:

```text
business change accepted
fact confirmed
media public
release active
curation approved
```

The owning Nest module must validate the current business state when consuming the result. This protects against stale jobs and delayed results.

Example: if a media asset was withdrawn while processing was running, a later successful derivative job cannot automatically re-enable it.

## 37. Stale-result protection

Job requests/results carry enough source version/precondition information to detect stale work.

Depending on workflow, this may include:

```text
aggregate ID/version
input artifact hash
source release/version
expected workflow version
request event ID
```

The consuming Nest module rejects or marks stale results rather than applying them to a newer state blindly.

## 38. Failure and retry semantics

Python workers follow #315:

- bounded attempts;
- durable job state;
- stable failure codes;
- retry only transient failures;
- PGMQ visibility timeout/retry where queued;
- DLQ for poison/permanent failures;
- idempotent artifact/result registration.

### Retry-safe artifact writes

Before uploading an artifact, derive/fix its intended content identity.

Retry may:

- confirm an identical existing object/hash;
- reuse the same artifact registration when idempotency matches;
- create a new attempt record.

Retry must not silently overwrite different bytes at the same immutable key.

## 39. Checkpointing long jobs

Long acquisition/research/build workflows should checkpoint durable progress when repeating all work is expensive.

Checkpoints belong to pipeline job state or immutable intermediate artifacts, not process memory or GitHub runner local disk.

A restarted GitHub Actions runner must be able to resume/restart safely from durable state.

Do not model every tiny function as a workflow step table; checkpoint only where recovery value justifies it.

## 40. Secrets and credentials

Never put these in shared contracts/artifacts/events:

- database passwords;
- R2 secret keys;
- Supabase service/secret keys;
- bearer/refresh tokens;
- authenticated crawl session cookies;
- API provider secrets.

Job payloads may contain stable **secret reference names** only where needed.

GitHub/Vercel/developer environments resolve those references through environment-managed secrets.

## 41. Human actor and machine worker distinction

Python GitHub workers are machine execution identities, not human PandaAtlas actors.

They do not send `X-Actor-Id`, fake JWT `sub`, or a shared admin token to impersonate an editor.

When a Python result ultimately causes an authoritative change:

- the original human actor/review decision is already represented in the owning Nest workflow where required; or
- the action is an explicitly permitted automated system transition with a named system source and audit semantics.

The machine identity can be recorded as execution provenance separately from the human/business actor.

## 42. HTTP use from Python

Do not use Nest HTTP as the default bulk data-plane transport between runtimes.

For batch jobs, PostgreSQL job/event state + PGMQ + R2 artifacts are more durable and efficient.

Python may call a Nest HTTP endpoint only when the operation genuinely is an application API command/query and the machine-auth design is explicitly authorized.

No generic endpoint such as:

```text
POST /internal/python/run-command
POST /admin/import-any-json
```

is added as an escape hatch.

## 43. No direct shared source package

Do not create a package containing “shared domain models” imported by both Nest and Python.

Cross-language sharing happens at the contract boundary:

```text
JSON Schema
SQL view contract
artifact manifest
integration event
pipeline job
```

Each runtime owns its own internal models.

This prevents the Python package structure or Nest module internals from becoming a cross-language architecture constraint.

## 44. Source code migration classification

### Move into the Python data runtime

Conceptually migrate/rewrite these current areas:

```text
services/api/app/acquisition/**
services/api/app/enrichment/**
services/api/app/identity_resolution/**
relevant data/knowledge contract helpers that exist only for pipeline processing
media processing/build scripts
release artifact construction code that #317 keeps in Python
research/data-quality tooling
```

### Rewrite as Nest/TypeScript or V2 worker code

Do not move these merely because their current entrypoint is a `.py` script:

```text
OpenAPI/API contract generation/checks
Identity/account/authorization operations
Engagement projectors/recovery
Updates/Activity/Feed projectors
Notification projectors/delivery business logic
Privacy operations
Moderation operations
Publication activation/rollback/withdrawal commands
Audit application/business operations
```

Their current Python script form is an implementation accident of the FastAPI V1 runtime.

### Retire

Worker/D1/OpenNext/recovery scripts whose sole purpose is the obsolete transitional architecture are deletion candidates under #321.

## 45. Current `services/api/scripts` problem

The current single script directory contains all three categories:

1. genuine Python data tooling;
2. FastAPI operational/domain CLIs;
3. transitional deployment/recovery scripts.

V2 does not migrate the directory as a unit.

Every script is classified by capability ownership and either becomes a `panda-data` CLI command, a Nest worker/CLI command, or is deleted.

This is another application of the migration rule:

> **Business capability and runtime responsibility migrate; file location does not.**

## 46. Python CLI design

Expose a small stable command namespace instead of dozens of independent script files.

Conceptually:

```text
panda-data acquisition run ...
panda-data acquisition discover ...
panda-data enrichment run ...
panda-data identity resolve ...
panda-data curation build-patch ...
panda-data media process ...
panda-data release build ...
panda-data jobs drain ...
panda-data contracts validate ...
```

Exact CLI framework and command names are #320 implementation details.

The CLI exits after bounded work; it is not a daemon.

## 47. Dependency groups

Avoid installing the heaviest research/crawler/media stack for every lightweight pipeline command.

Use the Python project's supported dependency-group/optional-dependency mechanism for concerns such as:

```text
crawler
media
research
dev
```

Keep one project unless dependency conflicts actually justify package separation.

## 48. Source adapter policy

Preserve the strong current acquisition property that source access is explicit and reviewed.

Python owns operational source capability policy such as:

```text
public HTTP
authorized session
browser-rendered
approved proxy where explicitly permitted
```

but production secrets/sessions are external configuration.

A source adapter is not allowed to escalate its own capability or bypass reviewed access policy because a crawler library supports it.

## 49. Artifact provenance

Every promoted candidate/result can be traced back through:

```text
Nest accepted fact/change
  -> Curation/Review decision
  -> pipeline result artifact
  -> pipeline job/run
  -> input artifact(s)
  -> evidence/source capture
  -> source locator/fetch metadata
```

Correlation/event/artifact IDs provide joins; do not rely on GitHub run URLs as the only provenance key.

GitHub run IDs may be recorded as execution metadata but are not durable business identifiers.

## 50. Public media and pipeline artifact separation

R2 is reused, but storage semantics remain separate:

```text
private pipeline artifact
private media processing staging
reviewed public media
```

A pipeline object cannot be treated as public simply because it lives in Cloudflare R2.

Promotion to reviewed public media requires Media module state and the publication rules from #317.

## 51. Database migration ownership

Consistent with #312, all PostgreSQL schema changes—including `pipeline` tables, export views, grants and integration helper functions—remain in `infra/supabase/migrations/*.sql`.

Python never runs Alembic/SQLAlchemy migrations and Nest never runs Kysely migrations as a second schema authority.

Python may run preflight checks that the required schema/view/queue versions exist before processing.

## 52. Contract migrations versus database migrations

A JSON Schema contract version and a PostgreSQL migration version are independent.

Do not derive one from the other.

A job/event/artifact explicitly identifies its contract version; the worker checks that version and then queries the database capabilities it needs.

## 53. Contract fixtures

Each supported shared contract should have:

- at least one minimal valid fixture;
- realistic valid fixtures for important variants;
- negative fixtures for security/semantic boundaries;
- version mismatch fixture;
- unknown-field fixture when strictness matters;
- invalid hash/date/UUID/reference examples where relevant.

Fixtures are small and committed to Git.

Large real research datasets are not contract fixtures.

## 54. CI contract gates

Exact CI orchestration is #319/#320, but the V2 boundary requires these gates:

1. validate every schema against Draft 2020-12 meta-schema;
2. compile every schema with Ajv 2020 in strict mode;
3. run format validation deliberately, not implicitly;
4. validate all positive and negative fixtures in both runtimes;
5. regenerate TypeScript declarations and fail on drift;
6. run Python outbound serialization examples through canonical schemas;
7. enforce forbidden import boundaries so Python data code cannot import the old API/Nest internals;
8. enforce that the pipeline DB role has no authoritative business-table writes in integration tests where practical.

Do not reproduce the V1 model where the sole contract test is `checked_in_schema == Pydantic.model_json_schema()`.

## 55. Architecture import enforcement

After extraction, CI should fail if `panda_data` imports packages representing Nest/old API business implementation.

Examples of forbidden migration leftovers:

```text
from app.db.session import ...
from app.identity.repository import ...
from app.services.publication_service import ...
from app.notification.delivery import ...
```

The Python package may depend only on its own implementation plus explicit contract/database/object-storage libraries.

## 56. Network/runtime isolation

Python batch jobs do not have to be deployed with the Nest Vercel function.

This provides several benefits:

- crawler/native/media dependencies do not inflate the Nest function;
- crawler network behavior does not share user API request concurrency;
- long jobs are not constrained by user API lifecycle;
- Python version/library changes do not redeploy the authoritative API by necessity;
- API security surface does not include crawler/browser packages.

## 57. Local development

Local development may provide filesystem artifact adapters and local PostgreSQL/PGMQ, but the same manifests/job/event schemas are used.

Do not create a special “local Python writes business tables directly” mode.

The data boundary must remain representative of production even locally.

## 58. No automatic production promotion from research

A useful research script may eventually graduate into production acquisition/enrichment.

Graduation requires:

- named job/artifact contract;
- deterministic/recorded configuration;
- cross-runtime schema validation;
- durable provenance;
- bounded failure/retry behavior;
- reviewed source-access policy;
- owning Nest consumer/acceptance path.

Copying a notebook/script into a GitHub Actions workflow is not sufficient.

## 59. Why not rewrite Python into TypeScript

Rejected.

The project already has substantial acquisition, parsing, enrichment, identity-resolution and media/data logic in Python, and the ecosystem remains strong for those workloads.

The problem is not the language; the problem is runtime ownership and hidden coupling.

A clean contract boundary gives PandaAtlas the benefits of NestJS for the online product without discarding appropriate Python data tooling.

## 60. Why not keep Python inside `services/api`

Rejected.

Keeping acquisition/enrichment modules under the API package would continue to imply that:

- Python data code can reach API repositories/imports;
- API dependencies are needed to run crawler tools;
- scripts can treat domain implementation as a library;
- eventual FastAPI deletion becomes difficult.

The point of V2 is structural independence.

## 61. Why not share PostgreSQL tables directly

Rejected as the default contract.

Direct unrestricted table access is the easiest short-term integration and the most dangerous long-term one.

It couples Python to:

- physical column names;
- module persistence layouts;
- migration sequencing;
- private joins;
- implicit invariants not represented in algorithms.

Versioned export views and pipeline-owned technical tables provide the SQL efficiency without turning table storage into public interfaces.

## 62. Why not make Pydantic the shared source of truth

Rejected.

Pydantic is excellent Python tooling and currently emits Draft 2020-12 JSON Schema, but making `model_json_schema()` authoritative would force TypeScript/Nest contracts to follow Python implementation choices.

The Ajv strict-mode failure found in this ticket also demonstrates that a schema generated/accepted by the Python path may still be undesirable as a strict cross-language contract.

## 63. Why not make TypeScript/Nest classes the shared source of truth

Rejected for the symmetric reason.

Python should not need Nest decorators/compiler behavior or an OpenAPI document to understand an offline acquisition/media artifact.

OpenAPI remains the HTTP authority; JSON Schema remains the data-pipeline authority.

## 64. Why not put all payloads in PGMQ

Rejected.

PGMQ messages should be small work references.

Large source bodies, media, identity batches and release packages belong in immutable object artifacts.

This keeps queue reads fast, avoids duplicating payload copies and makes replay/hash verification explicit.

## 65. Why not use GitHub Actions artifacts as the pipeline store

Rejected.

GitHub Actions artifacts are excellent workflow outputs, but their retention is bounded and workflow runs/artifacts can be deleted.

They may mirror useful diagnostics, but R2 + the pipeline artifact registry is the durable PandaAtlas artifact system.

## 66. Why not introduce Airflow/Prefect/Dagster/Temporal now

Rejected for the V2 baseline.

The current needs can be represented with:

- bounded GitHub Actions execution;
- PostgreSQL durable job state;
- PGMQ queues;
- immutable artifacts;
- explicit retry/checkpoint code.

Adding a workflow orchestrator would introduce another control plane before a workload proves that multi-step orchestration/visibility cannot be maintained simply.

Revisit only with evidence such as many interdependent long-running pipelines, complex backfills, or operational failure modes that the current model cannot manage.

## 67. Security boundaries

The pipeline runtime is lower-trust than the authoritative application write path because it fetches external content and runs parsers/media tools.

Therefore:

- least-privilege DB role;
- no direct business-table writes;
- private object prefixes;
- content-type/size/hash validation;
- treat downloaded content as untrusted;
- never execute content or arbitrary payload code;
- no production user session tokens in jobs;
- no automatic authority from crawler/parser confidence;
- validate result again in Nest before applying.

This boundary reduces the blast radius of a compromised source parser or third-party crawler dependency.

## 68. Media/file safety

Acquired documents/media should remain quarantined/private until technical checks complete.

Python processing may strip unsafe metadata and generate normalized derivatives, but content safety/licensing/publication decisions are separate Media/Review policies.

The output artifact includes technical evidence rather than a blanket `safe=true` flag that bypasses the owning module.

## 69. Observability context

Pipeline jobs propagate:

```text
jobId
correlationId
causationId
source event ID
artifact IDs
GitHub run ID when applicable
```

They do not propagate a raw HTTP request object or AsyncLocalStorage context across runtime boundaries.

Python logging emits structured bounded identifiers; exact OpenTelemetry/logging conventions are #319.

## 70. Exit codes and failure codes

CLI process exit status is operational only.

Durable job state records a stable machine-readable failure code independently, for example:

```text
source_fetch_timeout
source_policy_denied
contract_invalid
unsupported_contract_version
artifact_hash_mismatch
identity_input_stale
media_decode_failed
release_input_invalid
```

Do not make downstream logic parse Python stack trace strings.

## 71. Data deletion/privacy

Python artifacts that contain personal/private submission information must follow Privacy/retention policy rather than being retained forever as “research data”.

The artifact registry must make retention/classification/ownership identifiable enough for Privacy to locate and delete/restrict artifacts through explicit ports/jobs where required.

Exact retention policy remains the owning module/#319 work.

Public panda research/evidence and user-submitted private data must not share an undifferentiated artifact namespace.

## 72. Suggested end-state dependency diagram

```text
                   contracts/*.schema.json
                    /                  \
                   /                    \
          generated/validated       validated
             TypeScript               Python
                 |                       |
                 v                       v
             NestJS V2               panda-data
                 |                       |
        authoritative schemas      pipeline schema only
                 |                       |
                 +------- Postgres ------+
                         |
                 Outbox / PGMQ
                         |
                         +-------- R2 immutable artifacts
```

There is no source-code import arrow between NestJS and Python.

## 73. Migration sequence implied by this decision

Implementation planning should be able to use this sequence later:

1. establish canonical shared-contract directory/gates;
2. create independent Python project/package and CLI skeleton;
3. move acquisition/enrichment/identity-resolution pure logic first, removing FastAPI imports;
4. add pipeline artifact/job adapters and restricted DB role;
5. create module-owned export views needed by Python;
6. migrate acquisition source adapters and candidate artifact production;
7. migrate curation preparation and identity resolution;
8. migrate media/release builders selected by #317;
9. convert domain/operational Python scripts to Nest workers/CLI or delete them;
10. remove old Python API package once #321 cutover allows it.

This is not the final delivery slice plan; #321/#322 determine cutover sequencing.

## 74. Existing V1 data assets

Do not lose historical research/curation evidence during extraction.

Existing files can be classified as:

- source/config to retain in Git;
- small contract fixtures to retain/move under contracts;
- historical migration input to archive/import;
- generated operational artifacts to move to R2;
- obsolete Worker/D1/public-release transitional artifacts to retire after #321.

The migration should preserve provenance/hashes, not preserve the current directory layout forever.

## 75. External references checked

- Pydantic JSON Schema: https://docs.pydantic.dev/latest/concepts/json_schema/
- Python `jsonschema` validation / Draft 2020-12: https://python-jsonschema.readthedocs.io/en/latest/validate/
- Python `jsonschema` documentation: https://python-jsonschema.readthedocs.io/
- Ajv JSON Schema / 2020-12: https://ajv.js.org/json-schema.html
- `json-schema-to-typescript`: https://github.com/bcherny/json-schema-to-typescript
- uv projects: https://docs.astral.sh/uv/guides/projects/
- uv workspaces: https://docs.astral.sh/uv/concepts/projects/workspaces/
- GitHub Actions artifact retention: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
- Supabase Queues/PGMQ semantics inherited from #315: https://supabase.com/docs/guides/queues

## Decisions deferred to other Wayfinder tickets

- Exact public release input/result contract and whether Python constructs all or only selected release projections: #317.
- Exact R2 private bucket/prefix names, pipeline DB credentials/grants, GitHub environment secrets and real managed smoke tests: #318.
- Exact logging/tracing/metrics, contract CI implementation, security scanning and artifact/DLQ alerting: #319.
- Exact repository path, uv/npm workspace integration, CLI framework, generated TS package location and scripts: #320.
- Exact extraction/cutover order for old FastAPI scripts and when V1 curation files stop being writable: #321.

## Acceptance for #316

The Python/data boundary is resolved when later planning can assume all of the following without reopening this decision:

- Python remains a separate batch/data runtime for acquisition, enrichment, identity resolution, curation assistance, media/release building and research; it is not a second HTTP backend.
- Python becomes an independent project/package and does not import the FastAPI/Nest business implementation.
- Nest business modules remain the only authority that accepts Python results as PandaAtlas business truth.
- Python has no direct authoritative business-table writes in the V2 baseline.
- Python reads business state only through explicit versioned module-owned export views or immutable input snapshot artifacts.
- One private `pipeline` technical schema owns only jobs/attempts/artifact metadata, not Panda business facts.
- Python uses a dedicated least-privilege database role, with only pipeline/assigned-queue/export-view/event-append permissions.
- Shared Python/Nest contracts are canonical hand-authored JSON Schema Draft 2020-12, not Pydantic or TypeScript classes.
- Shared schemas use camelCase, strict object semantics and explicit versioning.
- CI validates every shared schema with Python Draft202012Validator and Ajv 2020 strict mode; Ajv strictness is not disabled to accommodate Python-generated schema quirks.
- TypeScript contract types are generated from canonical JSON Schema; runtime validation still uses Ajv.
- Python uses canonical JSON Schema validation at ingress/egress while Pydantic remains an internal ergonomics layer.
- Cross-runtime large data moves as immutable R2 artifacts with typed manifests/hashes; queues/events normally contain references rather than duplicated large payloads.
- JSON/JSONL are baseline structured artifact formats; Parquet is research/analytics-oriented unless explicitly promoted with its own contract; pickle/joblib/ad hoc database files are forbidden interchange formats.
- GitHub Actions artifacts are not the durable provenance store.
- The only generic cross-runtime execution request is a bounded typed pipeline job; there is no arbitrary business-command or shell-execution bus.
- Python-produced integration events are explicitly registered technical facts such as `pipeline.*`, appended through the transactional Outbox semantics from #315.
- Nest revalidates current business state when accepting Python results, so stale/delayed jobs cannot blindly mutate newer state.
- current CSV/local-research artifacts are migration/history inputs, not permanent parallel business authorities.
- current `services/api/scripts` are classified by ownership: genuine data tooling moves to `panda-data`, business/worker operations are rewritten in Nest, obsolete transitional scripts are deleted.
