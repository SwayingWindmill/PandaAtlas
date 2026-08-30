# V1 → V2 persistent-data classification

- Tracking issue: #332
- Date: 2026-08-28
- Authority: `docs/architecture/zhipanda-v2-architecture-baseline.md` and the migration/cutover decision from #321
- Rule: D1 is comparison-only. Every authoritative migration source below is PostgreSQL unless explicitly marked as a retained physical table.

## Classification rules

`migrate` means transform V1-owned state into a different V2-owned table. `retain` means the physical PostgreSQL table is already the V2 authority and must not be copied or cleared. `rebuild` means derive a fresh V2 projection after authoritative migration. `discard` means the V1 state is implementation/projection/workflow residue and must not become V2 authority.

The migration must fail rather than invent a stable identity, source relationship, media checksum/size, administrator grant, or ambiguous workflow continuation.

## Matrix

| V1 state | Outcome | V2 owner / treatment |
|---|---|---|
| `public.pandas` stable IDs | migrate | `panda.pandas`; preserve UUID exactly. Scalar biography columns are compatibility projections, not the preferred fact source. |
| `public.panda_slugs` | migrate | `panda.slugs`; preserve canonical/legacy values and validity dates. |
| `public.panda_names` + `public.panda_name_sources` | migrate | `panda.names` + `panda.name_sources`; preserve row UUIDs and provenance. |
| `public.panda_external_identifiers` + sources | migrate | `panda.external_identifiers` + source links; preserve row UUIDs. |
| `public.fact_assertions` + sources | migrate | `panda.fact_assertions` + sources; map V1 publication state to V2 assertion lifecycle only where semantically valid. |
| `public.public_fact_conclusions` + assertion links | migrate | `panda.fact_conclusions` + links; preserve UUID/version/current state. |
| `public.evidence_sources` | migrate | `evidence.sources`; restricted/internal fields remain private. A non-SHA legacy `content_hash` is not relabelled as SHA-256. |
| `public.evidence_attachments` | migrate | `evidence.attachments`; checksum/object version/size already satisfy the V2 evidence contract. |
| `public.institutions` | migrate | `place.institutions`; preserve UUID. V1 has no canonical institution slug, so the migration uses a deterministic ID-derived technical slug unless an explicit migration mapping supplies one. |
| `public.facilities` | migrate | `place.places` with `place_type=facility`; preserve UUID and institution link. V1 has no facility slug, so use deterministic ID-derived technical slug unless explicitly mapped. |
| coarse residency/event locations | migrate | materialize deterministic `place.places` rows with `place_type=coarse_location`; never pretend the coarse string identifies a facility. |
| `public.panda_residencies` + sources | migrate | `life_history.residencies` + sources; facility IDs become place IDs and coarse locations use the deterministic coarse-place mapping. |
| `public.domain_events` + participants/sources | migrate | `life_history.events` + participants/sources; facility/coarse endpoints become V2 place IDs. |
| `public.parentage_assertions` + sources | migrate | `lineage.parentage_assertions` + sources; preserve assertion IDs/status/review time. |
| `public.media_assets` + `public.panda_media` | migrate with prerequisite | `media.assets` + `media.panda_assets`. V2 requires trustworthy content SHA-256, byte size and media type. The migration must stop on linked V1 media that lacks these object facts; it must not fabricate them. Rights may safely remain `unknown`/`pending` rather than being upgraded. |
| `identity.accounts` | retain | Same physical V2 authority. `account_id` remains the Supabase Auth UUID; auth users are never recreated. |
| `identity.roles`, capabilities, assignments/revocations/account-state history | retain | Same physical Identity authority. V2 migrations add/adjust capability vocabulary; migration never infers staff grants from email. |
| `public.user_roles` | discard after explicit reconciliation | Legacy bootstrap role projection. Any account not already represented by valid `identity.role_assignments` is a migration blocker requiring operator resolution, not email/role inference. |
| `engagement.follows` active rows | migrate | Merge into `engagement.favorites`, resolving panda reference by stable UUID or canonical V1 slug. Inactive follows are history, not current saved-panda state. |
| `engagement.pending_follow_intents`, `engagement.follow_events` | discard | V1 Follow Intent/state-machine residue; V2 Favorite has no equivalent continuation protocol. |
| `engagement.collections`, `engagement.collection_pandas` | retain | V2 repository uses these physical tables directly. |
| `engagement.location_checkins`, `engagement.seen_pandas` | retain | V2 repository uses these physical tables directly. |
| legacy passport / last-viewed state | discard/rebuild | Passport is composed from V2 product state; feed/view cursors are not authority. |
| `game.guess_questions` | migrate with prerequisite | `game.questions`; only when the legacy media reference resolves to a V2 `media.assets.asset_id`. No URL/string media guess is converted to a UUID. |
| `engagement.game_attempts` | migrate with prerequisite | `game.attempts`; requires a migrated V2 question identity. Attempts cannot be truthfully attached to an invented question. |
| `community_intake.*` | retain | Existing physical tables are explicitly reused by the V2 Contribution module. |
| `review_moderation.*` | retain | Existing physical tables are explicitly reused by V2 Review/Moderation. |
| `community_curation.*` | discard after open-work check | Bridge is explicitly not a V2 Curation owner. Any unfinished bridge work is a migration blocker and must be resolved into Contribution/Review/Curation before cutover. |
| `curation.*` | retain | New V2-owned Curation state; not a V1 migration source. |
| `notification.preferences` / older `engagement.notification_preferences` | migrate selectively | `notification.channel_preferences`. Only V2 categories (`knowledge_update`, `correction`) and channels (`station`, `email`) may be copied directly; other legacy categories are not silently reinterpreted. |
| legacy notification intents/inbox/delivery jobs/digests/worker receipts | discard | V1 orchestration/projector state. V2 messages are produced from V2 durable events; pending V1 work must drain or be explicitly cancelled before freeze. |
| `privacy.requests` and legacy privacy workflow tables | discard after open-work check | V2 uses `privacy.subject_requests`. Open V1 privacy obligations block cutover and must be completed before migration; completed legacy evidence remains historical until retirement evidence is sealed. |
| `audit.event_facts` and legacy module audit tables | retain as historical evidence through cutover, do not project into V2 | V2 `audit.evidence_events` starts from V2 durable events. Historical V1 audit evidence is not rewritten into fictitious V2 event IDs. Export/retention evidence must be archived before legacy schema deletion in #333. |
| `publication.*` V2 tables | rebuild | Build one fresh V2 release from migrated V2 authority, seal it, then activate only during the later cutover procedure. |
| `public_read.*`, `updates.*`, derived stats/search | rebuild | Release-scoped V2 projections generated from V2 authority. |
| `activity.*`, `feed.*` | discard/rebuild | Legacy projections/cursors, not V2 authority. |
| `public.publication_*`, archive workbench/cutover glue, public release pointer | discard after evidence capture | V1 publication/workbench implementation. Required historical evidence is archived; V2 Publication does not import its runtime state. |
| `public.habitats`, `public.sightings`, `public.distribution_*` | retain outside V2 migration until separately product-owned | Current V2 has no authoritative owner for the legacy habitat/distribution model. These tables must not be dropped by #332 or misrepresented as `place.*`; they remain legacy read-only data for an explicit later ownership decision. |
| `public.admin_import_jobs`, transient recovery/gate bookkeeping, caches | discard | Operational residue, not business authority. |
| D1 / Worker / OpenNext state | discard | Never a migration input. D1 may only be used for comparison during rehearsal. |

## Preflight blockers

A rehearsal is not accepted if any of these are non-zero/unresolved:

1. active Follow rows whose panda reference resolves to neither `public.pandas.id` nor canonical V1 slug;
2. legacy bootstrap `public.user_roles` not backed by an equivalent active Identity assignment;
3. unfinished `community_curation` bridge work that still represents required editorial work;
4. open legacy Privacy requests;
5. linked V1 media missing a trustworthy SHA-256, positive byte size, or media type/object identity;
6. legacy Guess Panda questions whose media reference cannot resolve to a migrated V2 asset;
7. a live V2 `publication.current_release` pointer or other evidence that V2 has already begun authoritative production writes.

## Rehearsal invariant set

Verification is intentionally compact rather than record-by-record bureaucracy:

- V1 and V2 panda stable-ID counts match and every V2 panda has exactly one canonical slug.
- All migrated source links resolve; current fact conclusions remain unique per `(panda, field)`.
- Parentage, residency and event participants reference migrated pandas; V2 primary residency exclusion constraints remain satisfied.
- Every migrated media association points at a verified V2 object row; no pending/unknown rights row can become public solely because of migration.
- Supabase Auth UUIDs behind `identity.accounts` are unchanged; no new staff role assignment is created by the migration.
- Active V1 follows are a subset of resulting V2 favorites, while retained collections/check-ins/seen rows are untouched.
- Fresh Publication/PublicRead state is built only after authoritative migration and never from D1.
