# Deployment runtime status

- Status date: 2026-09-27
- Architecture authority: [ZhiPanda V2 Architecture Baseline](../architecture/zhipanda-v2-architecture-baseline.md)
- Cutover evidence: [Issue #333 — V2 Production Cutover Evidence](../release/issue-333-v2-production-cutover.md)
- Repository structure: [ZhiPanda Monorepo Structure](../monorepo-structure.md)

This page is the canonical human-readable **current-state** document for ZhiPanda runtime and deployment status. Architecture and migration documents may preserve historical states, but they must not be used to infer present production routing when they conflict with this page.

## Source-of-truth order

Use the documents in this order when a deployment statement appears inconsistent:

1. **This file** for the latest reviewed runtime and availability snapshot.
2. **`zhipanda-v2-architecture-baseline.md`** for the governing production architecture and runtime boundaries.
3. **`issue-333-v2-production-cutover.md`** for the immutable chronological record of the V2 cutover and legacy retirement.
4. Older managed-cloud phase, V1, Worker/D1, OpenNext, or FastAPI deployment documents only as historical evidence for the state at the date they were written.

Do not rewrite historical execution records to make them look current. Mark them historical or superseded instead.

## Current production architecture

The V2 cutover crossed its commit point on 2026-09-01. The production architecture is therefore V2-only:

| Responsibility | Current architecture | Authority / rule |
|---|---|---|
| Public Web | Next.js on Vercel | `zhipanda.com` and `www.zhipanda.com` are Vercel-routed Web domains. OpenNext/Cloudflare Worker Web is retired. |
| Public and application API | NestJS 11 + Fastify 5 on Vercel | `api.zhipanda.com` is the canonical API host. FastAPI and the Cloudflare Worker/D1 API are retired. |
| Business data | Supabase PostgreSQL/PostGIS | Sole authoritative business database. No D1 or local database is a production authority. |
| Authentication | Supabase Auth + NestJS authorization | Supabase Auth owns authentication identity; application capabilities and policy are enforced by V2. |
| Public media / large immutable objects | Cloudflare R2 | Retained object/media platform. |
| DNS | Cloudflare DNS | Retained DNS authority; application traffic targets Vercel. |
| Short durable async work | V2 Outbox/PGMQ plus bounded scheduler invocation | No API-startup polling or persistent request worker. |
| Long/heavy data work | GitHub Actions + `tools/panda-data` | Python is an offline data/research runtime, not an HTTP backend. |
| Local Supabase/Docker/admin tooling | Local only | Development, verification, and recovery exercises only. |

Post-cutover rollback is **V2-to-V2 only**. Do not restore public traffic to the retired FastAPI, Worker/D1, or OpenNext runtimes.

## Current availability observation

Architecture cutover and runtime availability are separate facts. A fresh probe on **2026-09-27** found that the Vercel deployments are currently disabled:

- `https://zhipanda.vercel.app/zh` -> HTTP `402 Payment Required`, `X-Vercel-Error: DEPLOYMENT_DISABLED`;
- `https://zhipanda-api.vercel.app/health` -> HTTP `402 Payment Required`, `X-Vercel-Error: DEPLOYMENT_DISABLED`;
- the canonical `api.zhipanda.com/health` probe also returns HTTP `402` through the current Vercel path.

The account-level cause is now confirmed from Vercel's 2026-09-25 notification: the free team `swaying-windmill` consumed **300% of the Hobby included Fluid Active CPU allowance (4 CPU-hours)** and Vercel paused the account. Earlier notifications recorded Active CPU reaching 75% on 2026-09-06 and 100% on 2026-09-08 / 2026-09-22; Fluid Provisioned Memory also reached 100% of its 360 GB-hour Hobby allowance on 2026-09-14. This is a usage-cap pause, not a build failure, billing-method failure, domain failure, or rollback to V1.

One structural contributor was the production GitHub scheduler invoking `GET /internal/jobs/async-downstream` every five minutes. That endpoint performs multiple bounded dispatcher/consumer batches and therefore wakes the NestJS Vercel runtime even when public traffic is low. On 2026-09-27 the schedule was reduced from every five minutes to once per hour (`17 * * * *`), cutting fixed scheduler invocations from about 8,640 to about 720 per 30 days while retaining a durable reliability pump for non-realtime downstream work.

A second compute-reduction pass was completed on 2026-09-27 without changing the V2 authority boundaries:

- public Publication/PublicRead responses keep browser caching conservative (`Cache-Control: public, max-age=0, must-revalidate`) while allowing Vercel CDN reuse for 60 seconds with a 30-second stale-while-revalidate window; public Updates use a shorter 30-second/15-second window;
- cacheable Publication/PublicRead responses carry the shared `zhipanda-public-read` Vercel cache tag;
- every public-state-changing Publication command (`activate`, `rollback`, release `suspend`/`restore`, resource `takedown`/`restore`) synchronously purges that API cache tag with foreground revalidation semantics and then calls the Web project's authenticated revalidation endpoint;
- the Web revalidation endpoint marks the complete localized public tree (`/[locale]`) plus `/sitemap.xml` stale, so Next.js ISR cannot continue serving a pre-takedown snapshot merely because its normal TTL has not expired;
- staging/production API startup now requires `PUBLIC_WEB_BASE_URL` and `PUBLIC_REVALIDATION_AUTH` together, and Vercel production Web builds require the same `PUBLIC_REVALIDATION_AUTH` value; the credential belongs only in the Web/API deployment environments, never in repository files;
- the Next.js public panda, place, institution, and legacy atlas detail routes use on-demand static generation instead of request-by-request SSR; panda and place pages retain a 60-second background revalidation interval as a resilience/performance fallback;
- public panda profile loading no longer performs separate full-collection reference lookups and duplicate atlas loads, and shared public identity context is memoized per server render.

These changes reduce both Active CPU and Provisioned Memory pressure while preserving NestJS/Supabase as the online business-data authority and preserving emergency takedown correctness. They were validated locally with V2 lint/typecheck/build, Web typecheck/lint/build, unit tests, architecture checks, and clean-database publication/async integration tests. Production cache-hit/purge verification remains pending while the Vercel team is paused.

The Hobby plan does not require payment while usage remains within the included limits. Immediate restoration after a usage-cap pause may require upgrading to Pro; remaining on Hobby requires the rolling usage window to return below the included limits and then an account unpause/review through Vercel support if the team remains paused. Do not reintroduce retired legacy runtimes as a workaround.

## Legacy disposition

The following are retired production implementations and may remain only as historical documentation, migration evidence, or Git history:

- FastAPI online request runtime;
- `/api/v1` compatibility surfaces;
- Cloudflare Worker/D1 public-read authority;
- OpenNext Web runtime;
- Worker/D1 projection and release replay;
- FastAPI Vercel serverless-closure preparation;
- legacy admin-token / actor-header compatibility.

New product work must target V2. Do not add compatibility layers for retired runtime shapes.

## Active engineering focus

With the architecture migration complete, current engineering work should prioritize:

- restoring/maintaining V2 production availability;
- keeping fixed background invocations inside the intended Vercel Hobby/Pro compute envelope;
- publishing curated panda knowledge through V2 Publication/PublicRead;
- the fan-facing Next.js experience and generated V2 client;
- `tools/panda-data` acquisition, curation, identity-resolution assistance, and media/data processing;
- repository hygiene and current-state documentation.

Historical migration plans remain useful for auditability but are not active implementation queues unless explicitly reopened.
