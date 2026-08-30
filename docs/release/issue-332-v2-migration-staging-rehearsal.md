# Issue #332 — V1 → V2 migration and managed-staging rehearsal

Date: 2026-08-28

## Migration rehearsal

The deterministic migration is implemented in:

- `services/api/scripts/migration/migrate-v1-to-v2.mjs`
- `services/api/scripts/migration/verify-v1-to-v2.mjs`
- `docs/migration/v1-to-v2-data-classification.md`

The migration has a read-only planning mode and an explicit apply mode. It refuses to proceed when the V2 current-release pointer is already live, when identity/role mapping is unresolved, when active Follow rows cannot resolve to canonical pandas, when legacy editorial/privacy work is still open, or when legacy media/game references cannot be mapped without inventing data.

A localhost-only helper, `prepare-local-rehearsal.mjs`, exists solely to make the repository's demo seed production-like enough to exercise object-level media requirements. It refuses non-local database hosts and is not part of production migration input.

### Measured local full rebuild

A fresh local Supabase database was recreated from all migrations `0001` through `0048` and repository seeds. The rehearsal fixture then supplied only missing demo object metadata and one demo Game target/media relationship.

Measured full migration runs:

| Run | Source pandas | Media links | Result | Migration duration |
|---|---:|---:|---|---:|
| first full rebuild | 19 | 7 | pass | 86 ms |
| repeat full rebuild | 19 | 7 | pass | 76 ms |

The repeat run clears only V2 migration-owned target state and recreates it from V1 authority, demonstrating that the full migration is repeatable before V2 writes open. At this scale there is no evidence supporting a delta/CDC mechanism.

The compact verifier ran 14 business/integrity checks after both runs and passed with zero failures. It checks stable Panda UUID preservation, canonical slug cardinality, Evidence/Fact/Lineage/Residency/Event counts, media associations, Follow→Favorite coverage, Supabase Auth UUID referential identity, media rights non-promotion, and Game migration counts.

## Managed staging repository readiness

The V2 runtime already provides the required staging shape:

- Node `24.x` pinned in `services/api/package.json`.
- Conventional Nest composition root in `services/api/src/main.ts`; no Vercel handler wrapper.
- Fastify/Nest runtime with `/health` liveness and `/ready` bounded DB readiness.
- request DB pool defaults to `DB_POOL_MAX=1`.
- staging/production require `DATABASE_URL`, `SUPABASE_URL`, and explicit CORS origins.
- request runtime does not run database migrations.
- V2 Outbox/consumer receipts/PGMQ, Publication/PublicRead, R2-oriented media metadata, auth, logging/OTel/Sentry hooks are implemented by the preceding V2 tickets.
- `services/api/vercel.json` no longer contains the obsolete FastAPI Python-function bundle or disabled Git-deployment configuration. Current Vercel supports zero-configuration NestJS deployment; the project should be rooted at `services/api`.

## External managed-staging blocker

A real managed staging deployment cannot be truthfully certified from the current repository credentials:

- GitHub repository Actions secrets list is empty.
- No repository-managed staging Supabase project metadata/transaction-pool URL is available.
- No usable local Vercel CLI authorization could be established during this rehearsal.

Therefore no production traffic was switched and no managed-staging success is claimed.

The remaining external provisioning task must provide a distinct staging Supabase project and a stable Vercel Nest staging project, then configure at minimum:

- `APP_ENV=staging`
- `DATABASE_URL` using the staging Supabase transaction-pool endpoint
- `SUPABASE_URL`
- `CORS_ALLOW_ORIGINS` for the staging Web origin
- Supabase JWT/JWKS settings as required by the project
- R2 staging bucket/public-media settings used by the Web/API deployment
- `CRON_SECRET` and provider credentials only for the bounded jobs actually exercised
- observability destinations where production-like staging evidence is required

## Managed-staging acceptance checklist

Once those external values exist, the remaining rehearsal is intentionally small:

1. Apply migrations outside Vercel using migration credentials.
2. Run V1→V2 migration plan, full apply, then the compact verifier; record duration.
3. Build and deploy the Nest staging project rooted at `services/api`; verify Fluid Compute in project settings.
4. Confirm `/health` is 200 without remote dependency work and `/ready` is 200 through the real Supabase transaction-pool path.
5. Build one V2 release, seal it, exercise release-scoped PublicRead and rollback pointer behavior without touching production DNS.
6. Exercise one Outbox event through the relevant consumer receipt/PGMQ path and verify idempotent processing.
7. Exercise Supabase Auth against staging and one capability-protected command.
8. Verify one R2 public-media object through the staging Web journey.
9. Run the critical Web staging browser journeys using the generated V2 client.
10. Capture the staging API/Web deployment URLs, Supabase backup/PITR status, Cloudflare DNS current values and intended rollback values for the production cutover runbook.

## Cutover conclusion

The measured full rebuild is comfortably inside any realistic bounded write-freeze window for the current repository data scale, so #332 does **not** justify a delta migration. D1 remains comparison-only and is never a V2 source.

Production cutover must remain blocked until the external managed-staging checklist above is executed against real staging resources.
