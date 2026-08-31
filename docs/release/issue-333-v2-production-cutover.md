# Issue #333 — V2 Production Cutover Evidence

Status: **in progress**  
Issue: `#333 V2-11: Cut over production and retire the legacy runtimes`  
Started: 2026-08-30 (Asia/Singapore)  
Branch: `feat/issue-333-production-cutover`
Draft PR: `#355 V2-11: cut over production and retire legacy runtimes`

This file is the execution evidence for the bounded V2 production cutover defined by
`docs/runbooks/zhipanda-v2-production-cutover.md`. It records observed production state;
it must not claim a cutover step completed before that step has actually been executed and
validated.

## 1. Accepted prerequisite

`#332 V2-10: Rehearse V1-to-V2 migration and cutover in staging` is complete. Its managed
staging evidence established the production deployment shape that #333 must reproduce:

- NestJS/Fastify on Vercel for the API.
- Next.js on Vercel for the Web app.
- Supabase PostgreSQL as the only business authority.
- Supabase Auth UUIDs preserved as account identity.
- Transaction pooling with the least-privilege `zhipanda_app` role.
- Strict database TLS using the Supabase Root 2021 CA.
- Cloudflare retained for DNS and R2 only after commit.

## 2. Stable Vercel destinations

Verified with the authenticated Vercel CLI on 2026-08-30:

| Surface | Vercel project | Stable hostname |
| --- | --- | --- |
| Web | `zhipanda` | `https://zhipanda.vercel.app` |
| API | `zhipanda-api` | `https://zhipanda-api.vercel.app` |

The API production project had configuration drift before #333 execution:

- Framework Preset: FastAPI
- Install Command: `pip install -r requirements.txt`

That project-level configuration has been corrected to the accepted V2 shape:

- Framework Preset: NestJS
- Build Command: auto-detect
- Install Command: auto-detect
- Output Directory: auto-detect

This settings correction did **not** deploy a new production build and did **not** change DNS.

Production environment preparation continued without changing live traffic:

- API `APP_ENV=production` is configured as a readable Vercel Production Config value.
- API `CORS_ALLOW_ORIGINS` is explicitly limited to `https://zhipanda.com`,
  `https://www.zhipanda.com`, and the temporary candidate Web origin
  `https://zhipanda.vercel.app`.
- API `DATABASE_SSL_CA_CERT` now contains the verified Supabase Root 2021 CA. The downloaded
  certificate is self-signed `CN=Supabase Root 2021 CA`, expires 2031-04-26, and has SHA-256
  fingerprint `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
- Web Production `NEXT_PUBLIC_API_BASE_URL` is now the temporary cutover value
  `https://zhipanda-api.vercel.app`, matching the Step A / Step B runbook requirement. It is
  public configuration rather than a secret.

The three canonical hostnames are also attached to the intended Vercel projects before any DNS
change:

| Hostname | Vercel project | Vercel DNS target |
| --- | --- | --- |
| `zhipanda.com` | `zhipanda` | `f22e3e5fb5ddc981.vercel-dns-017.com` |
| `www.zhipanda.com` | `zhipanda` | `f22e3e5fb5ddc981.vercel-dns-017.com` |
| `api.zhipanda.com` | `zhipanda-api` | `4e22a95b9aeab32d.vercel-dns-017.com` |

Vercel reports each hostname as verified for its project and its current DNS configuration as
invalid only because traffic still intentionally points at Cloudflare. The cutover form is a
CNAME to the target above with Cloudflare proxying disabled; Cloudflare remains authoritative
DNS.

### Joint Vercel/Supabase runtime placement

The production Supabase project is in `ap-northeast-1` (Tokyo). The old FastAPI production
Vercel deployment was observed running in `iad1`, which would add a trans-Pacific hop to every
database round trip. The V2 deployment shape now versions `regions: ["hnd1"]` for both the
NestJS API and Next.js Web dynamic runtime. Static Web assets remain CDN-delivered globally;
only dynamic compute is pinned near the database.

The Nest database layer also follows Vercel Fluid Compute guidance for `pg.Pool`: on Vercel it
registers the pool with `attachDatabasePool()` from `@vercel/functions`, while local/container
execution retains normal Nest lifecycle shutdown. The existing request-pool limits, strict TLS
and Supavisor transaction-pool design remain unchanged.

### Production dependency baseline

The production candidate dependency set was refreshed only within existing supported release
lines:

- Next.js `15.5.24` (the patched 15.5 maintenance release).
- React Router / React Router DOM `7.18.3`.
- Sharp `0.35.4` as an explicit Web dependency, which satisfies Next 15.5.24's supported Sharp
  range.
- DOMPurify resolved to `3.4.14` through the existing React Admin range.
- AJV root/runtime dedupe resolved to `8.20.0` where dependency ranges permit it.

`npm audit --omit=dev` still reports the PostCSS advisory inherited from Next.js because
Next `15.5.24` continues to pin PostCSS `8.4.31`. The Next.js 15.x upstream is actively working
on the PostCSS bump; #333 intentionally does not use a root override that would pretend to
change Next's published dependency closure without an upstream-supported release.

Local candidate verification after a clean lockfile-driven install:

- Web typecheck: pass.
- Web Next.js production build: pass.
- API typecheck: pass.
- API Nest build: pass.
- API fast tests: 12/12 pass.
- V2 architecture check: pass, 182 modules / 370 dependencies, zero violations.

## 3. Production Supabase source baseline

Production project:

- project ref: `gsnpkwlezpdkdupizjdb`
- region: `ap-northeast-1`
- migration history: `0001` through `0025`
- organization plan observed during #333 preparation: Free

Supabase's production guidance does not provide automatic downloadable backups for Free projects
and recommends regular off-site logical exports with `supabase db dump`; Free projects may also
be paused for low activity. Therefore #333 requires a fresh logical `db dump` before the first
production DDL write at minimum. For a durable long-lived production service, moving the
production organization to a paid plan with managed backups/no inactivity pausing is the
preferred production posture rather than treating the Free tier as the final availability
baseline.

Read-only production inspection on 2026-08-30 confirmed the migration source remains
business-empty:

| State | Rows |
| --- | ---: |
| `public.pandas` | 0 |
| `public.panda_slugs` | 0 |
| `public.fact_assertions` | 0 |
| `public.evidence_sources` | 0 |
| `public.media_assets` | 0 |
| `identity.accounts` | 0 |
| `engagement.follows` | 0 |
| `community_intake.submissions` | 0 |
| `review_moderation.review_cases` | 0 |
| `auth.users` | 0 |

The legacy release-pointer singleton rows exist but carry no active authority:

- `public.public_release_pointer.active_batch_id = null`
- `public.archive_release_pointer.latest_release_id = null`

This means the production migration is primarily a versioned schema/runtime cutover rather
than a bulk business-data move. The deterministic V1-to-V2 migration and verifier remain the
required cutover checks; the empty source does not waive them.

## 4. Migration safety review

Repository migrations `0026` through `0049` were re-audited before production execution.
They do not drop business tables, truncate business data, or delete V1 business rows.
They add V2 schemas, tables, constraints, projections, durable queues, permissions, and
application/runtime role boundaries.

Migration `0042_nestjs_v2_platform_foundation.sql` intentionally creates only the group role:

```sql
create role zhipanda_app nologin nosuperuser nocreatedb nocreaterole noinherit;
```

A production login credential must therefore be provisioned out of band and granted
membership in `zhipanda_app`. No password belongs in repository SQL.

## 5. Cloudflare rollback baseline

Authenticated Wrangler inspection on 2026-08-30 captured the currently deployed legacy
Workers:

| Surface | Worker | Active version |
| --- | --- | --- |
| API | `panda-atlas-api` | `53d63faa-e2bf-407d-935a-c9cfa8675454` |
| Web | `panda-atlas-web` | `4e6a494b-633a-4f35-8ac9-9489dfb37511` |

The active API deployment was created 2026-08-26T16:38:13Z.

Cloudflare DNS-record authority is now available through a dedicated token limited to the
`zhipanda.com` zone. The token was verified without exposing its secret, and exact host-routing
records were read from zone `zhipanda.com`:

- `zhipanda.com`: `AAAA 100::`, proxied, TTL automatic;
- `www.zhipanda.com`: `AAAA 100::`, proxied, TTL automatic;
- `api.zhipanda.com`: `AAAA 100::`, proxied, TTL automatic.

The root MX and SPF records are unrelated to the Web/API cutover and must remain untouched. These
exact AAAA records are the current legacy custom-domain routing baseline; Cloudflare Anycast IP
answers are no longer being used as a proxy for rollback record contents. No DNS write has been
executed in #333. The exact records will still be recaptured immediately before Step A so the
rollback snapshot is contemporaneous with cutover.

## 6. Production API environment gap

The existing `zhipanda-api` production Vercel project still exposes the old V1-era
Supabase/Postgres integration variable set. The accepted NestJS runtime contract now has these
production inputs prepared:

- `APP_ENV=production`: configured.
- `DATABASE_SSL_CA_CERT`: configured with the verified Supabase Root 2021 CA.
- `CORS_ALLOW_ORIGINS`: configured with the explicit production/candidate Web origins.
- `DATABASE_URL`: **not configured yet**; it must use a production login that is a member of
  `zhipanda_app` through the Supavisor transaction pool.

The least-privilege login must not be replaced by a permanent `postgres`-privileged runtime
connection merely to make the cutover easier.

## 7. Production backup and canonical schema deployment

Supabase CLI authentication is available from the Windows native credential store. A read-only
project listing confirmed production `gsnpkwlezpdkdupizjdb` and staging `lmhxnumzlveehqolypqg`,
both in Tokyo. The repository-pinned CLI `2.110.0` and current CLI `2.116.0` still fail to read
that persisted credential in the non-interactive Windows executor, matching upstream Windows
credential regressions. A transient, untracked `supabase@2.102.0` invocation reads the same native
credential successfully; no PAT is copied into the repository, command line, or evidence file.

Because CLI `2.102.0` predates the repository's `[local_smtp]` config key, #333 uses an ignored
`infra/supabase/.temp/cli-2.102-workdir` with a minimal compatible config and a junction back to
the canonical `infra/supabase/migrations` directory. This creates no second migration source.

Before the first V2 DDL, a five-file logical recovery baseline was written outside the repository
to `C:\Users\HaoZhang\PandaAtlas-backups\issue-333-20260831-pre-v2`:

- `roles.sql`: 431 bytes, SHA-256 `0decd601faa70260a3a31e8ce63208cc4a4c1f99921bc6f3ed4faf1cd980da3a`;
- `schema.sql`: 770,390 bytes, SHA-256 `21cdb817ccfc0cee93ef6f80cfc414d679a668cc298212639cd6837c66b4397b`;
- `data.sql`: 64,720 bytes, SHA-256 `8e898f9136cd6a11f2ac93c4f25654493eb990aa5409c608e265e5fab5e7bbd3`;
- `supabase-migrations-schema.sql`: 887 bytes, SHA-256 `18b99fbbb3ec9fbb964bb255a56171329acd99b6977ece2addd89fdf5aa5105b`;
- `supabase-migrations-data.sql`: 282,299 bytes, SHA-256 `a138a9330d01a8760bb7153206266ffc0fa4c744a8898b9a7ccb8a079429cec7`.

Docker Desktop engine `29.6.2` was active for the backup. A production `db push --dry-run`
reported **only** canonical migrations `0026`–`0049`. The real `db push` then applied those 24
repository migrations successfully. A post-push migration-list read confirms local and remote
history now match exactly from `0001` through `0049`; no repair or server-generated migration
version was introduced.

Supabase MCP `apply_migration` remains intentionally unused because it cannot preserve the
repository migration versions required by this cutover.

Post-migration role evidence confirms `zhipanda_app` and `zhipanda_pipeline` exist as `NOLOGIN`,
`NOINHERIT`, `NOBYPASSRLS` group roles. Production now has a separate
`zhipanda_app_runtime` login with `INHERIT`, no superuser/createdb/createrole/bypass-RLS privileges,
and membership in `zhipanda_app`. Its generated password is stored only in Windows Credential
Manager and was handed directly to Vercel; Vercel Production now exposes `DATABASE_URL` as a Secret
using the Tokyo Supavisor transaction pool on port `6543`.

## 8. Deterministic migration and verification

Fresh production source counts were all zero for the V1 authorities consumed by
`migrate-v1-to-v2.mjs`: pandas, evidence, facts, institutions/facilities, residencies, life events,
lineage, linked media, and active follows.

The first strict preflight correctly found two blockers from one row in `game.guess_questions`:
`unresolvedLegacyGameTarget=1` and `ambiguousLegacyGameMedia=1`. Inspection proved that row was
exactly the baseline question hard-coded by canonical migration `0040` (`question_id`
`55ad14ea-cc08-4aa2-bba2-4e77823f74db`), with zero attempts and no matching legacy attempt rows.
Because production has no V1 panda/media authority to migrate it from, and the row is preserved in
the pre-V2 logical backup, #333 removed only that orphan legacy seed instead of adding a migration
compatibility branch. The complete strict preflight was then rerun and all ten blockers returned
zero.

The migration and verifier now accept `DATABASE_SSL_CA_CERT` and configure node-postgres with the
same strict CA validation used by the Nest runtime (`rejectUnauthorized=true`). The production
migration plan succeeded over the least-privilege runtime connection with all source counts zero and
no blockers.

The runtime group intentionally has no access to legacy V1 authorities or destructive cleanup
rights. #333 therefore granted a short-lived, direct migration bridge only to
`zhipanda_app_runtime`: exact V1 source `SELECT` permissions plus the target `DELETE` permissions
required by the deterministic clear phase. Two apply attempts failed on omitted legacy dependencies
(`public.public_evidence_sources`, reached through V1 RLS, then `notification.preferences`); both
failures occurred inside the migration transaction and rolled back completely. After catalog/source
review added only those two missing `SELECT` grants, the next apply committed successfully in
**6,557 ms** with all source and target counts zero and no blockers. This is comfortably inside the
bounded freeze window, so no delta/CDC migration path is required.

The compact verifier then passed **14/14** in **2,033 ms**. Its Supabase Auth invariant no longer
requires direct runtime access to the protected `auth` schema: it verifies the exact validated
foreign key from `identity.accounts.account_id` to `auth.users.id`, which preserves the same UUID
invariant while respecting the production Auth boundary. Both migration scripts pass `node --check`.

Immediately after verification, every direct migration-bridge grant was revoked. Post-revoke checks
confirm no runtime `SELECT` remains on legacy `public.pandas`, the legacy evidence helper view,
`notification.preferences`, or `auth.users`, and no migration-only `DELETE` remains on
`notification.provider_jobs`. The steady-state runtime is back to the privileges inherited from
`zhipanda_app` only.

The Vercel production API project is locally linked as `swaying-windmill/zhipanda-api`.
`APP_ENV`, `DATABASE_SSL_CA_CERT`, explicit `CORS_ALLOW_ORIGINS`, and the new `DATABASE_URL` Secret
are configured. Legacy `POSTGRES_*` and Supabase service-role variables remain in place while the
live public API is still the old FastAPI/Worker path; they are retirement work after the V2 commit
point, not inputs to the Nest runtime.

## 9. Managed Vercel candidates

The accepted NestJS API production candidate is deployment
`dpl_Az5CMoifskdJM3kHMBmD2ZKrk3qs` (`zhipanda-72lhymnn7-swaying-windmill.vercel.app`). The first
successful deployment was rejected because Vercel placed its Lambda in `iad1` even though the
repository config carried `regions: ["hnd1"]`. Redeploying the same committed build closure with an
explicit `--regions hnd1` produced the accepted candidate. Deployment JSON now records the Nest
`index` Lambda as Node.js 24 with `deployedTo: ["hnd1"]`; `zhipanda-api.vercel.app` and the project
custom-domain association both point at this deployment.

The local executor's household DNS currently mis-resolves `zhipanda-api.vercel.app`, so local curl
results are not used as health evidence. Instead, #333 built an isolated Vercel Web probe whose only
source change was a prebuild script that requested the stable API alias. Vercel's own build logs show
both remote checks passing before the Web build started:

- `/health`: HTTP 200, `status=ok`;
- `/ready`: HTTP 200, `status=ok`.

The `/ready` result is the managed-runtime proof: the Nest Lambda can start in Vercel, resolve the
stable alias, connect through the production Tokyo Supavisor transaction pool, validate the Supabase
Root CA, and execute its readiness query using the steady-state `zhipanda_app_runtime` permissions
after all migration-only grants were revoked.

The accepted Web production candidate is deployment
`dpl_3znHquSdb2dVVsXw8FF16gTFxmSy` (`zhipanda-1uslkzp1m-swaying-windmill.vercel.app`). It is Ready,
targets Production, is associated with `zhipanda.com`, `www.zhipanda.com`, and `zhipanda.vercel.app`,
and its Node.js functions are actually deployed to `hnd1` (middleware retains Vercel's expected
global distribution). Vercel metadata ties it to commit
`f2049270a94c32d88fc08aa75bceb1cb0b6efcc8` on `feat/issue-333-production-cutover`.

The Web deployment metadata says `gitDirty=1` because it came from an isolated deployment bundle, so
#333 audited the bundle instead of trusting that flag. All 288 files from the clean commit archive
match the deployed bundle byte-for-byte. The only additional non-Vercel file is
`data/frontend-withdrawals/2026.07.20.2-ri-ri.json`; it is itself tracked at the same commit and its
Git blob hash matches `HEAD` exactly (`bad05d4a0f6c5838d97f04c1e71ab2cfbb0e7348`). No business-code
or configuration drift was introduced by the bundle.

A current-commit Vercel probe deployment also completed the normal Web guards and Next.js 15.5.24
production build after the API probes, including all 56 static-generation steps. The ordinary GitHub
PR Preview for the same commit remains Ready as an independent build path.

V1 writes are still **not** frozen, no public DNS cutover has started, and the legacy Workers remain
the live rollback authority. A temporary `api-v2-probe.zhipanda.com` experiment was not created in
Cloudflare because the local network could not reach the Cloudflare API; no root, `www`, or `api`
record was modified. The managed Vercel-to-Vercel probe above makes that temporary hostname
unnecessary.

## 10. Next executable sequence

Continue the runbook without adding a compatibility phase:

1. restore a reliable Cloudflare control-plane path and recapture the exact root/`www`/`api` rollback
   records plus current legacy Worker deployment anchors;
2. begin the bounded freeze only after that DNS write/rollback path is demonstrably available;
3. rerun the deterministic migration and 14-check verifier as the final freeze-window copy;
4. execute Web then API DNS cutover;
5. establish the V2-only commit point, switch the Web API base from the stable Vercel alias to
   `https://api.zhipanda.com`, reopen V2 writes/async work, and retire the legacy
   OpenNext/Worker-D1/FastAPI runtime paths immediately as required by #333.
