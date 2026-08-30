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

The dedicated Vercel API staging project is `zhipanda-api-staging`. The accepted API Preview deployment is:

- `https://zhipanda-api-staging-a6f8rryew-swaying-windmill.vercel.app`

The accepted Vercel-hosted Web Preview deployment for the managed journey is:

- `https://zhipanda-u2fstk16z-swaying-windmill.vercel.app`

Managed acceptance completed on 2026-08-30:

- `/health` returned `200 {"status":"ok"}`.
- `/ready` returned `200 {"status":"ok"}` through the real `zhipanda_app` / Supavisor / managed PostgreSQL path.
- Supabase Auth/JWKS accepted a real staging user. `POST /api/v2/me/account` returned 201, `GET /api/v2/me` returned 200, and capability-protected profile replacement returned 200.
- A managed release was built, sealed and activated; a second release was built, sealed and activated; rollback restored the first release pointer. Release-scoped panda reads returned 200 at each stage and the rolled-back response did not expose second-release content.
- The deployed Vercel API independently returned the rolled-back release and panda detail from the same current-release pointer.
- Publication emitted three managed outbox events. Dispatch produced six PGMQ messages across `integration_updates` and `integration_audit`.
- The updates consumer processed three messages, the audit consumer processed three messages, and a deliberate duplicate updates delivery produced `duplicates=1` while retaining exactly one consumer receipt for that event.
- A browser smoke using the real Web generated V2 client against the managed API rendered the managed panda profile with HTTP 200 and displayed the active managed release version. The final Vercel-hosted Web Preview repeated that journey without a local proxy: its server-only V2 client sent the configured Vercel automation-bypass header to the protected API, while the browser bundle received no bypass secret.
- Cloudflare Wrangler OAuth was restored and the retained `panda-atlas-media-staging` bucket was verified remotely. The reviewed object `releases/2026.07.20.2/media-shin-shin-6b36624de9829665-w480.webp` downloaded as exactly 60,930 bytes with SHA-256 `d937360864bdae72e2fa093c5fa4ee244b9777e4b5b1b2543ca0b2931fe7561a`, matching the reviewed manifest.
- Public access was enabled only for the staging bucket through its non-production `r2.dev` surface. The reviewed object returned HTTP 200 there. A managed media asset referencing that exact R2 object was attached through `MEDIA_PORT`, published in a new managed release, and independently returned by the deployed Vercel API with the same object key and SHA-256.
- The Web browser journey was then repeated with `NEXT_PUBLIC_MEDIA_BASE_URL` pointed at the staging `r2.dev` surface. The generated V2 client rendered the managed panda profile, the hero `<img>` requested the reviewed R2 object directly, the browser observed HTTP 200 from R2, and decoded dimensions were 480×360. Production R2 and production DNS were not changed.
- Supabase Management API backup status for `zhipanda-staging` reported `walg_enabled=true`, `pitr_enabled=false`, and no listed backups. This is recorded staging state only; enabling a paid PITR add-on is a production-cutover decision for #333, not a rehearsal side effect.
- The pre-cutover Cloudflare rollback baseline was captured without changing DNS. `zhipanda.com` and `www.zhipanda.com` remain bound to Worker `panda-atlas-web`; `api.zhipanda.com` remains bound to Worker `panda-atlas-api`. Public resolution remained on Cloudflare anycast with observed TTLs of 300–600 seconds, while `media.zhipanda.com` had no public resolution. The latest captured Worker versions were Web `4e6a494b-633a-4f35-8ac9-9489dfb37511` (2026-08-04T19:49:42Z) and legacy API `53d63faa-e2bf-407d-935a-c9cfa8675454` (2026-08-26T16:38:12Z).

The old managed Supabase source project was also inspected read-only. Its migration history stops at `0025` and its relevant V1 tables are empty, so production cutover planning must preserve that real source-shape finding rather than assuming the newer local V1 rehearsal shape.

## Remaining external acceptance

Managed staging acceptance is complete. Production cutover concerns such as production backup policy, PITR enablement and canonical DNS changes remain scoped to #333 and were not changed by this rehearsal.

## Managed-staging acceptance checklist

1. [x] Apply migrations outside Vercel using migration credentials.
2. [x] Run V1→V2 migration plan, full apply, then the compact verifier; record duration.
3. [x] Build and deploy the Nest staging project rooted at `services/api` using the Vercel NestJS zero-config backend path.
4. [x] Confirm `/health` is 200 and `/ready` is 200 through the real Supabase transaction-pool path.
5. [x] Build/seal/activate managed V2 releases, exercise release-scoped PublicRead, and verify rollback pointer behavior without touching production DNS.
6. [x] Exercise Outbox through PGMQ/consumer receipts and verify duplicate delivery is idempotent.
7. [x] Exercise Supabase Auth/JWKS against staging and capability-protected commands.
8. [x] Verify one reviewed R2 public-media object through the staging Web/R2 journey, including remote byte/hash integrity and browser image decode.
9. [x] Run a critical browser journey from the Vercel-hosted Web Preview using the generated V2 client against the protected managed API and direct staging R2 media surface.
10. [x] Capture the final staging Web deployment URL, Supabase backup/PITR status and the current Cloudflare DNS/Worker rollback baseline.

## Cutover conclusion

The measured full rebuild is comfortably inside any realistic bounded write-freeze window for the current repository data scale, so #332 does **not** justify a delta migration. D1 remains comparison-only and is never a V2 source.

Managed staging rehearsal and acceptance are complete for #332. Production cutover remains a separate #333 action; no production traffic, production R2 or canonical DNS was changed by this rehearsal.
