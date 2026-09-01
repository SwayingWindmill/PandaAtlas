# Issue #356 — V1 PostgreSQL retirement evidence

- Tracking issue: #356
- Parent cutover: #333
- Data-classification authority: `docs/migration/v1-to-v2-data-classification.md`
- Migration: `infra/supabase/migrations/0051_retire_obsolete_v1_postgres.sql`
- Post-migration verifier: `services/api/scripts/migration/verify-v1-retirement.mjs`
- Status: production V1 retirement and async post-cutover verification complete

## Decision boundary

#356 removes only PostgreSQL state that #332 already classified as migrated, rebuilt, or discardable after the V2 cutover. It does not create a V1 rollback path and does not reinterpret an old table merely because its name looks legacy.

Retained as current V2 authority or explicitly reused physical state:

- Supabase Auth and `identity.*` authorization/account state;
- `integration.outbox_events` and V2 consumer receipts;
- `community_intake.*` and `review_moderation.*`;
- V2 `evidence`, `panda`, `place`, `life_history`, `lineage`, `media`, `curation`, `publication`, `public_read`, `updates`, and `pipeline` schemas;
- V2 tables inside the shared `engagement`, `game`, `notification`, `privacy`, and `audit` schemas;
- `public.habitats`, `public.sightings`, and `public.distribution_*`, which #332 explicitly left without a V2 owner;
- `admin_media.uploads`, because there is not yet an explicit migrate/discard ownership decision for that private-upload provenance.

Retired after the V2 migration/cutover contract:

- migrated V1 Panda/evidence/place/life-history/lineage/media copies in `public`;
- V1 publication/archive/workbench tables, views, functions, bootstrap roles, and transient import state;
- V1 Follow/Passport/notification-preference history that is not a V2 owner;
- `activity`, `feed`, and `community_curation` schemas;
- legacy Guess Panda question/attempt state after its V2 migration;
- V1 Notification orchestration/worker tables while preserving the 0047 V2 Notification tables;
- V1 Privacy request/retention/tombstone workflow while preserving the 0047 V2 subject-request tables;
- V1 audit projection/export/maintenance tables and projector triggers while preserving `audit.evidence_events`.

## Cross-boundary dependencies handled explicitly

The migration uses `RESTRICT` for destructive object removal rather than broad `CASCADE`. Rehearsal/catalog review identified and handled these real dependencies explicitly:

1. `public.sightings.panda_id` is retained, so its FK is moved from `public.pandas(id)` to canonical `panda.pandas(panda_id)` before the V1 Panda table is removed.
2. Retained habitat/distribution tables lose only their V1 `public.has_any_role` admin-write policies; public read behavior and PostGIS data remain.
3. `community_intake.submissions` had V1 Privacy anonymization request columns/FK/trigger added in 0029. V2 Contribution does not use that workflow coupling, so those V1-only columns and trigger are removed before `privacy.requests` retirement.
4. `community_curation` references V1 `public.change_sets`, `public.publication_batches`, legacy Notification, and legacy Privacy. It is retired before those referenced owners. Only non-`projected` bridge work blocks retirement; completed bridge history is discardable per #332.
5. `public.public_evidence_sources` is referenced by legacy RLS policies on V1 residency/event source tables; those policies are removed before the view.
6. public workbench views are dropped in dependency order (`archive_workbench_metrics` before `archive_workbench_queue`).
7. three V1 public command functions return table composite row types and therefore must be retired before their tables: `publish_publication_batch`, `complete_emergency_takedown_followup`, and `set_archive_publication_cutover`.
8. retained Identity/Community Intake/Review tables had V1 unified-audit projector triggers. Those triggers are removed before the old projector functions and audit projection tables.

## Data preflights kept intentionally small

The destructive migration keeps only cutover invariants that still protect authoritative/user obligations:

- active V1 Follow rows must already be represented by V2 Favorites;
- unfinished `community_curation` bridge work must not remain;
- open V1 Privacy requests (`requested`, `verified`, or `processing`) must not remain.

Historical rows, stale V1 publication pointers, and other already-classified discardable implementation state are not treated as artificial blockers. A fresh logical backup is the recovery boundary for historical evidence before production DDL.

## Local reset and seed boundary

The pre-V2 seed files under `infra/supabase/seed/` write directly to V1 `public.pandas`, evidence, lineage, and media tables. They cannot remain part of the canonical fresh-reset path after 0051 without reintroducing a V1 compatibility model.

`infra/supabase/config.toml` therefore disables automatic SQL seed loading. Fresh local Supabase reset is schema-first; focused tests and migration rehearsals create the V2 data they require explicitly. The historical seed SQL remains in the repository as non-executed reference material until a separate V2 demo-data owner is defined.

## Verification contract

After a successful fresh reset or production migration, run:

```powershell
npm run db:verify-v1-retirement -w @zhipanda/api -- --database-url <postgres-url>
```

The verifier checks only destructive-DDL risk boundaries:

- representative retired V1 relations/schemas/functions are absent;
- representative V2/retained relations remain;
- `public.sightings` references canonical V2 Panda identity;
- retained public habitat/distribution tables no longer carry V1 admin-write policies;
- retained V2 tables no longer invoke old audit projector functions;
- Community Intake no longer references the V1 Privacy request model;
- `identity.accounts` still references `auth.users`;
- migration `0051` is recorded exactly once in Supabase migration history.

## Production execution contract

Production retirement is not allowed until all of the following are true:

1. latest `main`/migration set has a successful fresh local 0001→0051 reset;
2. V2 database types are regenerated from the post-0051 schema and API typecheck/integration checks pass;
3. a fresh logical production backup is created and its non-empty artifacts plus SHA-256 manifest are recorded outside the repository;
4. 0051 is applied through the canonical Supabase migration path;
5. `db:verify-v1-retirement` passes against production;
6. canonical PublicRead/Publication, Curation, async consumer/queue, and health smoke checks pass after DDL;
7. production migration history contains 0051 exactly once.

## Production execution evidence

On 2026-09-01, production was verified at migration `0050` with zero unfinished Community Curation bridges, zero open legacy Privacy requests, and zero active V1 Follows missing their V2 Favorite. A fresh pre-0051 logical backup was then created outside the repository under `PandaAtlas-backups/issue-356-20260901-155117-pre-0051`; all five dump artifacts were non-empty and recorded in a SHA-256 manifest. The canonical Supabase migration dry-run listed only `0051_retire_obsolete_v1_postgres.sql`, after which 0051 was applied successfully.

Post-DDL verification recorded migration `0051` exactly once. The production retirement verifier passed with `35` retired relations, `24` required retained/V2 relations, `3` retired schemas, `12` retired legacy function names, and zero failures. Canonical `/health`, `/ready`, `/api/v2/release`, `/api/v2/stats`, and `/api/v2/pandas` remained healthy; the active public release stayed `2026.07.31.1-v2-recovery` with `39` published pandas. Publication, Curation owner-routing, V2 PGMQ queues, and retained authority counts remained intact.

The post-DDL async smoke exposed one pre-existing `publication.release.activated` Outbox event from the #333 cutover with zero publish attempts and no error. The existing #333 scheduler is `.github/workflows/v2-async-downstream.yml`, which invokes the bounded NestJS worker every five minutes. Production was missing a usable scheduler credential, and the internal controller was also unintentionally inheriting the public `/api/v2` prefix/version. PR #361 corrected the route to the version-neutral `/internal/jobs/async-downstream`; a shared secret was then rotated into Vercel Production and GitHub `V2_ASYNC_CRON_SECRET`, and workflow dispatch run `33492581951` completed successfully against main commit `5a85a0b8f3f5c1940ee68bb4e33511fdaf2c8f56`.

Migration `0052_async_downstream_scheduler.sql` was temporarily introduced while validating a Supabase Cron fallback after Vercel Hobby rejected minute-level Cron. Once the pre-existing #333 GitHub scheduler was confirmed and repaired, keeping both schedulers would have been redundant. Forward-only migration `0053_retire_duplicate_async_scheduler.sql` therefore unschedules the temporary Supabase job, drops its invocation function, and removes its two Vault entries while leaving the extensions available. A fresh 0001→0053 reset passed and verified `0053=1`, scheduler job `0`, scheduler function `0`, and scheduler Vault entries `0`.

After the successful GitHub worker cycle, production reported `due_unpublished_outbox=0`, `errored_unpublished_outbox=0`, and zero messages in all seven checked V2/panda-data PGMQ queues. The final production step is applying 0053 and confirming those same invariants with migration history at 0053.
