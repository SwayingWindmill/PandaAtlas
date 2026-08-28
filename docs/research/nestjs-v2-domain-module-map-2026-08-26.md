# NestJS V2 domain module map research

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #310 `Define the NestJS V2 domain module map and dependency rules`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

What should the canonical NestJS V2 business-module map be, which responsibilities belong to each module, which synchronous dependencies are allowed, which interactions should be event-driven, and what enforcement rules should prevent cross-module implementation leakage while keeping PandaAtlas a modular monolith?

## Decision

PandaAtlas V2 should be a **business-capability modular monolith**, not a translation of the existing FastAPI package tree and not a collection of technical-layer modules.

The canonical backend is organized around 18 business modules in four groups:

### Knowledge and panda-world facts

1. **Evidence**
   - Owns reviewed source identity and source metadata, access/verification state, provenance vocabulary, and public-safe source summaries.
   - Does not own Panda, lineage, residency, event, media, or publication facts.
   - Other fact-owning modules may reference stable Evidence source IDs but must not edit Evidence storage directly.

2. **Panda**
   - Owns stable Panda identity, canonical slug, names and aliases, external identifiers, core biographical attributes and their evidence-aware conclusions.
   - Stable `panda_id` is shared by every other module; no feature-specific Panda copies are allowed.
   - Birth/death facts remain Panda facts when they are biographical attributes; other modules may derive views from them but may not duplicate their truth.

3. **Lineage**
   - Owns parentage assertions, relationship status and uncertainty, and lineage relationship derivation.
   - References Panda IDs but does not own Panda identity or profile attributes.
   - Family-story presentation is not a second lineage store.

4. **Places**
   - Owns the spatial entities used by the product: **Institution** and **Place** remain distinct domain concepts.
   - Also owns habitat/protected-area/distribution geography where those records represent spatial entities or map facts.
   - Does not own Panda residency history; residency is a temporal Panda-life fact.

5. **LifeHistory**
   - Owns Panda residency periods, Panda life events, event participants, event precision/status, and the event truth used by Moments/Calendar.
   - References Panda and Place IDs.
   - A transfer/arrival/return and its residency consequences belong to one LifeHistory consistency boundary rather than being split between Event and Place repositories.
   - Calendar anniversaries are derived views; they are not stored as a second event truth.

6. **Media**
   - Owns reviewed public media assets, rights/licence state, attribution, derivatives, R2-facing object metadata, availability/withdrawal state, and media presentation eligibility.
   - Private contributor attachments do not belong here; they remain Contribution data.
   - Consumer modules may reference Media asset IDs. Media must not depend on Panda/Place/etc. repositories simply to validate targets.

### Editorial trust and governance

7. **Contribution**
   - Replaces `community_intake` as the canonical product term.
   - Owns Submission, immutable SubmissionRevision, contributor-provided source records, contributor-visible submission status, private attachment metadata and attachment-access policy.
   - Does not decide whether submitted claims are accepted knowledge.

8. **Review**
   - Owns ReviewCase, reviewer assignment, triage, verification results, requests for information, append-only review decisions, SLA state and incorporation recommendations.
   - Reads immutable Contribution review surfaces through an explicit interface.
   - Does not directly create canonical facts, Curation changes or Publications.

9. **Moderation**
   - Split from the current combined `review_moderation` package.
   - Owns warnings, scoped restrictions, suspensions requested by moderation policy, restoration, sanctions, AppealCase and moderation-specific decision history.
   - Abuse-related Review outcomes may produce Moderation integration events; Review must not call Moderation repositories.
   - When a sanction requires immediate account-access change, Moderation may call a narrow Identity account-control interface synchronously.

10. **Curation**
    - Owns the editorial change workflow that turns reviewed/internal candidate knowledge into reviewable, validated, approved changes.
    - Owns ChangeSet/revision workflow state, validation state, approval separation and provenance links to origins such as Contribution/Review or Python research artifacts.
    - Semantic fact validation is delegated through narrow interfaces to the owning fact modules; Curation does not become the owner of Panda/Lineage/Places/LifeHistory/Media semantics.
    - The current `community_curation` package is not a permanent V2 module. It is migration-era bridge glue whose responsibility becomes an explicit Review-to-Curation contract.

11. **Publication**
    - Owns immutable Release/publication lifecycle, release membership, activation, rollback/withdrawal semantics, release provenance/version identity and publication commands.
    - Accepts only approved Curation results.
    - Does not own the meaning of Panda/Lineage/etc. facts.
    - The exact public read model/projection implementation is intentionally deferred to #317.

### Signed-in fan experience and return loops

12. **Identity**
    - Owns PandaAtlas account state, roles, capabilities, assignments/revocations, recent-auth policy and authorization vocabulary.
    - Supabase Auth remains the external authentication provider; token/JWKS mechanics are an infrastructure adapter feeding Identity, not a separate business module.
    - JWT claims never become application authorization truth.

13. **Engagement**
    - Owns Favorite, Collection, LocationCheckin and SeenPanda.
    - Favorite remains the single saved-Panda relationship; internal historic Follow naming must not create a second user-facing relation.
    - LocationCheckin and SeenPanda remain distinct facts and neither is inferred from the other.
    - Existing `fan_games` moves out to Game; notification consent/preferences move to Notification.

14. **Game**
    - Owns Random Panda/Guess Panda game rules, question-bank state where persisted, and optional signed-in attempt history.
    - Anonymous play remains supported.
    - Game consumes a narrow published-Panda query interface; it does not own Panda copies.

15. **Updates**
    - Replaces the current split between the rebuildable `activity` projection and the personalized `feed` implementation as one cohesive return-loop capability.
    - Owns public-safe update/activity items, editorial announcements, correction/retraction presentation, personalized eligibility/read state, cursors and explicit last-viewed state.
    - It does not own source Panda facts, Favorites or Notification delivery.
    - It consumes durable Publication/LifeHistory/editorial integration events and consults Engagement through a narrow read interface where current Favorite state is required.

16. **Notification**
    - Owns notification preferences/consent, notification intents, Inbox state, delivery attempts, transport receipts, retries, dead-letter state and channel delivery policy.
    - It consumes durable business events; upstream modules do not call delivery transports.
    - Contact/session mechanics remain outside business event payloads.

### Compliance and evidence plane

17. **Privacy**
    - Owns privacy request state, per-context execution state, export artifacts, retention policy records, holds and deletion tombstones.
    - Privacy is an explicit cross-module workflow orchestrator. It coordinates narrow privacy/export/delete interfaces from Identity, Engagement, Contribution, Notification and retained provenance owners rather than reimplementing their rules or querying their repositories.
    - No other business module depends on Privacy.

18. **Audit**
    - Owns the unified append-only audit evidence projection, sensitive-read evidence, audit export and integrity summaries.
    - It is downstream evidence only and must never be used to reconstruct business state.
    - No business module imports Audit or waits for Audit projection to complete. Source modules own their local append-only audit facts/events; Audit consumes them.

## Modules that must not exist in V2

The following current package/route groupings are not valid domain modules and must not be reproduced as Nest modules:

- `api` / `api.v1` — HTTP is an adapter inside each owning module.
- `schemas` — transport DTOs live at module HTTP boundaries; domain types live with the domain.
- generic `services` — behavior belongs to the owning business module.
- `admin_content` — Admin is a surface, not a fact owner; admin controllers live in Panda/Places/LifeHistory/etc.
- `admin_media` as a separate domain — private admin upload mechanics belong to Media infrastructure/application code.
- `projection` as a generic shared business module — each projection/read model has an explicit owner; public-read design is resolved in #317.
- `archive_operations`, `archive_publication`, `archive_workbench` — these collapse into Curation and Publication capabilities plus HTTP/admin adapters.
- `community_curation` — replaced by an explicit Review-to-Curation anti-corruption interface/event.
- combined `review_moderation` — split into Review and Moderation because they own different subjects, states, permissions and consequences.
- `integration` as a business module — Outbox/event transport is platform infrastructure; event contracts belong to their producing domain.
- generic `common`, `shared`, or `utils` domain escape hatches.

Python-only acquisition, enrichment, identity-resolution, crawling and research packages are not NestJS domain modules. Their V2 seam is resolved by #316.

## Canonical dependency model

There are two edge types and they must be treated differently.

### Synchronous module dependency

Allowed only when the caller cannot produce a correct command result without an immediate authoritative answer in the same request/business transaction.

Examples:

- Lineage -> Panda: validate referenced stable Panda identities.
- LifeHistory -> Panda and Places: validate participants and place references.
- Engagement -> Panda/Places: validate a Panda being favorited/seen or a Place being checked in.
- Review -> Contribution: read the active immutable submission revision and bounded attachment/source state.
- Moderation -> Identity: apply immediate account-access consequences required by a sanction.
- Curation -> fact-owning modules: semantic validation through explicit validators/readers.
- Publication -> Curation: require approved publishable changes.
- Updates -> Engagement: evaluate current Favorite-based private-feed eligibility when a query requires live relationship state.
- Privacy -> owned-context privacy ports: coordinate export/deletion without bypassing module rules.

A synchronous dependency is **not** permission to import another module's repository, entity implementation, Kysely table helpers, controller, DTO or internal service.

### Durable asynchronous dependency

Use an Integration Event whenever immediate consistency is not required for the producing command to be correct.

Required event-driven flows include:

- approved/published knowledge -> Updates;
- Updates/publication events -> Notification;
- Identity/Engagement/Contribution/Review/Moderation/Curation/Publication/etc. facts -> Audit projection;
- Review incorporation recommendation -> Curation intake where synchronous creation is not required by the Review decision itself;
- Review abuse outcome -> Moderation follow-up;
- business commands -> analytics/metrics/projections that can lag safely.

In-process Nest events may be used only for local module implementation details. Any event that another module must eventually receive uses the transactional Outbox/durable event path decided in #315.

## Dependency direction

The compile-time synchronous graph must be acyclic. The preferred direction is:

```text
Evidence          Identity          Media
   |                 |
   v                 v
Panda            Moderation
 |  \
 |   +--> Lineage
 |   +--> LifeHistory <--- Places
 |   +--> Engagement <--- Places
 |              |
 |              +--> Updates
 |
 +----> Curation <---- Review <---- Contribution
          |
          v
     Publication

Game ----> Published Panda query seam (owner decided by #317)

Privacy ----> Identity / Engagement / Contribution / Notification / provenance privacy ports

Audit <~~~~ durable audit/integration events from all source contexts
Notification <~~~~ durable publication/update/account preference events
Updates <~~~~ durable publication/life-history/editorial events
```

The diagram shows conceptual direction, not a promise that every arrow becomes a direct TypeScript import. Durable arrows (`<~~~~`) are contract/event dependencies and therefore do not create compile-time module imports.

## NestJS module interface rules

1. **One business module, one public interface.** Each module exports a deliberately small application/query interface from its module root. Internal folders are private.
2. **Controllers belong to the owning module.** There is no central `api/v1` package that imports every domain implementation.
3. **Domain code is framework-free.** Domain objects/errors/policies must not import NestJS, Fastify, OpenAPI, Kysely, `pg`, Supabase clients or HTTP exception classes.
4. **Application code owns use cases.** Controllers call application commands/queries. Repositories are infrastructure adapters behind application/domain interfaces.
5. **No cross-module repository access.** A module may not import or instantiate another module's repository or database adapter.
6. **No cross-module table writes.** Each module writes only storage it owns. A cross-module invariant is executed through the target module's interface, including when a shared PostgreSQL transaction is required.
7. **Cross-module reads use interfaces, not SQL joins against private tables.** Dedicated read projections may denormalize across modules when that projection has an explicit owner. Public read architecture is resolved by #317.
8. **Database foreign keys are not application interfaces.** Cross-schema/reference FKs may enforce referential integrity, but they do not authorize another module to mutate the referenced owner's tables.
9. **No business `SharedModule`.** Reusable pure technical primitives may live in platform packages later decided by #320; business concepts stay with an owner.
10. **No re-export cascades.** A module must not re-export another business module merely to make dependency wiring convenient.
11. **Acyclic imports are enforced in CI.** The final TypeScript dependency checker must reject undeclared module edges, deep imports and cycles.
12. **Storage ownership is enforced separately.** CI should also reject SQL/table access outside a module's declared storage ownership where practical, preserving the intent of the current Python storage-boundary contracts without their implementation shape.

## Suggested internal shape

The exact folder/tooling convention is finalized by #311/#320, but the domain decision assumes this shape conceptually:

```text
modules/panda/
  domain/          # framework-free model, errors, policies
  application/     # commands, queries, module-facing interfaces
  infrastructure/  # Kysely/pg/R2/etc. adapters
  http/            # controllers, request/response DTOs, presenters
  panda.module.ts  # Nest composition root for the module
```

This is not a requirement to create a file per command or adopt ceremony-heavy CQRS. Simple modules may use a small number of application classes/functions. Complex state-machine modules such as Curation, Publication, Moderation and Privacy may use explicit command handlers where that improves clarity.

## Cross-cutting platform capabilities are not business modules

The following should exist as platform/infrastructure capabilities, not domain owners:

- configuration;
- database connection/transaction runtime;
- Supabase JWT/JWKS verification adapter;
- request/correlation context;
- HTTP bootstrap, Fastify and global filters/pipes;
- structured logging/tracing/metrics;
- transactional Outbox transport primitives;
- R2 client;
- encryption/signing primitives;
- time/ID generation abstractions where tests require them.

Business modules consume these capabilities through infrastructure/application seams without turning `platform` into a dumping ground for domain behavior.

## Mapping from the current FastAPI packages

| Current area | V2 owner |
|---|---|
| `domain/trusted_identity`, Panda schemas/services | Panda |
| `domain/archive_relationships` | Lineage |
| `domain/archive_residency`, event logic | LifeHistory |
| map/habitat/facility/institution services | Places |
| `admin_media`, public media metadata | Media |
| evidence/source records | Evidence |
| `community_intake` | Contribution |
| review case half of `review_moderation` | Review |
| sanctions/appeals half of `review_moderation` | Moderation |
| `community_curation`, `archive_workbench`, change-set workflow | Curation |
| `archive_publication`, publication/release services | Publication |
| `identity` | Identity |
| `engagement.fan_library`, `engagement.fan_memory`, favorites/collections/check-ins/seen | Engagement |
| `games`, `engagement.fan_games` | Game |
| `activity` + `feed` | Updates |
| `notification` | Notification |
| `privacy_operations` | Privacy |
| `audit` | Audit |
| `api`, `schemas`, `core`, `db`, `integration`, generic `services` | deleted as domain groupings; responsibilities move to owning modules/platform |
| acquisition/enrichment/identity_resolution/knowledge/research scripts | Python data pipeline, outside Nest domain runtime |

## Decisions intentionally deferred

This ticket does **not** decide:

- whether Kysely is the final database access library or exactly how a transaction is propagated across module interfaces (#312);
- concrete Nest bootstrap/provider/global-pipe conventions (#311);
- DTO/OpenAPI/code-generation mechanics (#313);
- detailed authorization Guard/decorator structure (#314);
- exact Domain Event vs Integration Event envelope and PGMQ worker implementation (#315);
- the physical contract between Python data tooling and NestJS (#316);
- public read tables/materialized projections/release artifact storage (#317);
- Vercel function topology and serverless pooling (#318);
- exact dependency/storage-boundary tooling (#319/#320);
- migration and compatibility/cutover sequencing (#321).

## Consequences

### Benefits

- The V2 architecture is based on product truth and ownership rather than FastAPI files.
- Panda, lineage, places, life history and media remain independent enough to evolve without one giant Catalog service.
- Governance retains real trust boundaries while eliminating migration-era glue modules.
- User-facing persistence does not leak into core knowledge modules.
- Rebuildable/downstream concerns such as Updates, Notification and Audit are naturally event-driven.
- Privacy is explicitly recognized as a coordinator, preventing it from becoming a second owner of every account-related table.
- Admin and HTTP cease to be alternate business authorities.
- The graph can be mechanically enforced and remains compatible with a single NestJS process and one PostgreSQL database.

### Costs

- Some workflows require explicit cross-module interfaces instead of convenient repository imports.
- Curation and Privacy are intentional orchestrators with several dependencies and therefore need particularly narrow interfaces and strong tests.
- Existing code cannot be migrated package-for-package; behavior must be reassigned to its V2 owner.
- Combining Activity and Feed into Updates is a deliberate V2 redesign and will require contract/data migration rather than namespace preservation.

## Acceptance for #310

The module map is considered resolved when later planning can use these statements without reopening ownership questions:

- the 18 canonical business modules above are the default V2 map;
- technical FastAPI package groupings are not migration constraints;
- Review and Moderation are separate;
- Activity and Feed become Updates;
- community-curation/archive glue becomes Curation + Publication interfaces rather than permanent compatibility modules;
- synchronous cross-domain calls require a narrow declared interface and immediate-consistency justification;
- downstream/projection/delivery work uses durable events;
- cross-module repository/table access is forbidden;
- compile-time dependency cycles are forbidden;
- PandaAtlas remains one NestJS modular monolith over one authoritative PostgreSQL/PostGIS database.
