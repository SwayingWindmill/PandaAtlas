# Issue #332 — V1 → V2 migration and managed-staging rehearsal

Date: 2026-08-30

## Migration rehearsal

The deterministic migration is implemented in:

- `services/api/scripts/migration/migrate-v1-to-v2.mjs`
- `services/api/scripts/migration/verify-v1-to-v2.mjs`
- `docs/migration/v1-to-v2-data-classification.md`

The migration has a read-only planning mode and an explicit apply mode. It refuses to proceed when the V2 current-release pointer is already live, when identity/role mapping is unresolved, when active Follow rows cannot resolve to canonical pandas, when legacy editorial/privacy work is still open, or when legacy media/game references cannot be mapped without inventing data.

A localhost-only helper, `prepare-local-rehearsal.mjs`, exists solely to make the repository's demo seed production-like enough to exercise object-level media requirements. It refuses non-local database hosts and is not part of production migration input.

### Measured local full rebuild

A fresh local Supabase database was recreated from all migrations `0001` through `0049` and repository seeds after merging the current `main`, including the acquisition-to-Curation owner-routing migration added by #351. The rehearsal fixture then supplied only missing demo object metadata and one demo Game target/media relationship.

Measured full migration runs on the `0049` baseline:

| Run | Source pandas | Media links | Result | Migration duration | Verifier |
|---|---:|---:|---|---:|---:|
| first full rebuild | 19 | 7 | pass | 91 ms | 14/14 pass in 52 ms |
| repeat full rebuild | 19 | 7 | pass | 107 ms | 14/14 pass in 41 ms |

The repeat run clears only V2 migration-owned target state and recreates it from V1 authority, demonstrating that the full migration remains repeatable before V2 writes open after the `0049` schema change. At this scale there is still no evidence supporting a delta/CDC mechanism.

The compact verifier ran 14 business/integrity checks after both runs and passed with zero failures. It checks stable Panda UUID preservation, canonical slug cardinality, Evidence/Fact/Lineage/Residency/Event counts, media associations, Follow→Favorite coverage, Supabase Auth UUID referential identity, media rights non-promotion, and Game migration counts.

## Managed staging repository readiness

The V2 runtime now provides the managed staging shape used in this rehearsal:

- Node `24.x` is pinned in `services/api/package.json`.
- `services/api/src/main.ts` is the Vercel serverless entry: it initializes Nest/Fastify, waits for `fastify.ready()`, then exports the request handler instead of calling `listen()`.
- `services/api/src/cli.ts` is the long-running local/container entry and retains normal `app.listen(...)` semantics.
- Shared application configuration remains centralized in `services/api/src/bootstrap.ts`.
- Vercel uses its zero-configuration NestJS builder; the API package exposes `build:local` for local/CI Nest builds rather than overriding Vercel with a package-level `build` command.
- Fastify/Nest exposes `/health` liveness and `/ready` bounded database readiness.
- Request DB pool defaults to `DB_POOL_MAX=1`.
- Staging PostgreSQL uses the Supabase transaction pool on port `6543` with the least-privilege `zhipanda_app` login role.
- PostgreSQL TLS verification remains enabled. `DATABASE_SSL_CA_CERT` carries the Supabase Root 2021 CA and `pg` uses `rejectUnauthorized: true`; the runtime does not disable certificate validation.
- Staging/production require `DATABASE_URL`, `SUPABASE_URL`, and explicit CORS origins.
- Request runtime does not run database migrations.
- Root `services/api/instrumentation.ts` follows Vercel's instrumentation hook while application observability registration stays in the existing source module.
- V2 Outbox/consumer receipts/PGMQ, Publication/PublicRead, R2-oriented media metadata, auth, logging/OTel/Sentry hooks are implemented by the preceding V2 tickets.

## Managed staging resources and evidence

The isolated managed Supabase staging project is `zhipanda-staging` (`lmhxnumzlveehqolypqg`, `ap-northeast-1`). Migrations `0001` through `0049` are present. The runtime role `zhipanda_app` has login enabled and was independently verified through the Supavisor transaction pool with strict CA validation and `select 1`.

The dedicated Vercel API staging project is `zhipanda-api-staging`. The accepted Preview deployment is:

- `https://zhipanda-api-staging-a6f8rryew-swaying-windmill.vercel.app`

Managed acceptance completed on 2026-08-30:

- `/health` returned `200 {"status":"ok"}`.
- `/ready` returned `200 {"status":"ok"}` through the real `zhipanda_app` / Supavisor / managed PostgreSQL path.
- Supabase Auth/JWKS accepted a real staging user. `POST /api/v2/me/account` returned 201, `GET /api/v2/me` returned 200, and capability-protected profile replacement returned 200.
- A managed release was built, sealed and activated; a second release was built, sealed and activated; rollback restored the first release pointer. Release-scoped panda reads returned 200 at each stage and the rolled-back response did not expose second-release content.
- The deployed Vercel API independently returned the rolled-back release and panda detail from the same current-release pointer.
- Publication emitted three managed outbox events. Dispatch produced six PGMQ messages across `integration_updates` and `integration_audit`.
- The updates consumer processed three messages, the audit consumer processed three messages, and a deliberate duplicate updates delivery produced `duplicates=1` while retaining exactly one consumer receipt for that event.
- A browser smoke using the real Web generated V2 client against the managed API rendered the managed panda profile with HTTP 200 and displayed the active managed release version. A local read-only bypass proxy was used solely to cross Vercel Preview Protection; no staging-only protection logic was added to product code.

The old managed Supabase source project was also inspected read-only. Its migration history stops at `0025` and its relevant V1 tables are empty, so production cutover planning must preserve that real source-shape finding rather than assuming the newer local V1 rehearsal shape.

## Remaining external acceptance

Two items remain before managed staging can be declared fully complete:

1. **Cloudflare R2 remote object journey.** The retained staging bucket is `panda-atlas-media-staging`, but the local Wrangler OAuth session expired during acceptance. No R2 success is claimed until Wrangler authentication is restored and one reviewed staging object is verified remotely.
2. **Managed Web Preview evidence.** The critical browser journey already passed with the real generated V2 client and managed API, but a Vercel-hosted Web Preview still needs to be captured as deployment evidence without weakening API Preview Protection.

The cutover runbook also still needs the final staging Web deployment URL plus Supabase backup/PITR status and current/intended Cloudflare DNS values.

## Managed-staging acceptance checklist

1. [x] Apply migrations outside Vercel using migration credentials.
2. [x] Run V1→V2 migration plan, full apply, then the compact verifier; record duration.
3. [x] Build and deploy the Nest staging project rooted at `services/api` using the Vercel NestJS zero-config backend path.
4. [x] Confirm `/health` is 200 and `/ready` is 200 through the real Supabase transaction-pool path.
5. [x] Build/seal/activate managed V2 releases, exercise release-scoped PublicRead, and verify rollback pointer behavior without touching production DNS.
6. [x] Exercise Outbox through PGMQ/consumer receipts and verify duplicate delivery is idempotent.
7. [x] Exercise Supabase Auth/JWKS against staging and capability-protected commands.
8. [ ] Verify one R2 public-media object through the staging Web/R2 journey after Wrangler auth is restored.
9. [x] Run a critical browser journey using the generated V2 client against the managed API; capture the Vercel-hosted Web Preview separately as remaining deployment evidence.
10. [ ] Capture the final staging Web deployment URL, Supabase backup/PITR status, and Cloudflare DNS current/intended rollback values for the production cutover runbook.

## Cutover conclusion

The measured full rebuild is comfortably inside any realistic bounded write-freeze window for the current repository data scale, so #332 does **not** justify a delta migration. D1 remains comparison-only and is never a V2 source.

Production cutover remains blocked until the R2 remote check and final managed Web/backup/DNS evidence are captured. No production traffic or DNS was changed by this rehearsal.
