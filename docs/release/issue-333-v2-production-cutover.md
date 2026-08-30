# Issue #333 — V2 Production Cutover Evidence

Status: **in progress**  
Issue: `#333 V2-11: Cut over production and retire the legacy runtimes`  
Started: 2026-08-30 (Asia/Singapore)  
Branch: `feat/issue-333-production-cutover`

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

## 3. Production Supabase source baseline

Production project:

- project ref: `gsnpkwlezpdkdupizjdb`
- region: `ap-northeast-1`
- migration history: `0001` through `0025`

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

Public DNS remained Cloudflare-proxied at capture time:

- `zhipanda.com`: TTL 300s
- `www.zhipanda.com`: TTL 600s
- `api.zhipanda.com`: TTL 600s

No DNS cutover has occurred in #333 yet.

## 6. Production API environment gap

The existing `zhipanda-api` production Vercel project still exposes the old V1-era
Supabase/Postgres integration variable set. The accepted NestJS runtime contract additionally
requires these production inputs before a candidate deployment can be validated:

- `APP_ENV=production`
- `DATABASE_URL` using a production login that is a member of `zhipanda_app`
- `DATABASE_SSL_CA_CERT` with the Supabase Root 2021 CA
- `CORS_ALLOW_ORIGINS` with the explicit production Web origins

The least-privilege login must not be replaced by a permanent `postgres`-privileged runtime
connection merely to make the cutover easier.

## 7. Current execution blocker

The connected Supabase OAuth/MCP session can inspect the production project, but the local
Supabase CLI is not authenticated with a Personal Access Token. In this non-TTY executor,
`supabase login` explicitly requires `SUPABASE_ACCESS_TOKEN` or `--token`.

Production already owns canonical migration history `0001`–`0025`. The preferred production
path is therefore an authenticated CLI `supabase db push` so repository versions `0026`–`0049`
remain the remote migration versions as well. #333 must not manufacture a second,
server-generated migration-version sequence as a shortcut.

Until CLI database deployment and the production runtime login/environment are ready:

- V1 writes are **not** frozen.
- no production V2 candidate is deployed.
- Web DNS is unchanged.
- API DNS is unchanged.
- the legacy Workers remain the live rollback authority.

## 8. Next executable sequence

Once the production Supabase CLI/runtime credential prerequisite is available, continue the
runbook without adding a compatibility phase:

1. record the final legacy source/deployment anchor and database restore/backup state;
2. apply repository migrations `0026`–`0049` to production with exact migration history;
3. provision the production login as a member of `zhipanda_app` and set the Nest runtime env;
4. run the deterministic full V1-to-V2 migration and compact verifier;
5. deploy and validate the V2 API candidate at the stable Vercel hostname;
6. deploy and validate the V2 Web candidate against that stable API hostname;
7. begin the bounded freeze, recapture exact DNS rollback values, and execute Web then API cutover;
8. establish the V2-only commit point, reopen V2 writes/async work, and retire the legacy
   OpenNext/Worker/D1/FastAPI runtime paths immediately as required by #333.
