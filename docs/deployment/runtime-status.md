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

This is an **availability incident on the V2 hosting path**, not evidence that production rolled back to V1. Repository and cutover evidence still establish Vercel/NestJS/Supabase as the production architecture. Restore availability by resolving the Vercel project/deployment/account state while keeping the V2 topology; do not reintroduce retired legacy runtimes as a workaround.

No production mutation was performed while recording this status.

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
- publishing curated panda knowledge through V2 Publication/PublicRead;
- the fan-facing Next.js experience and generated V2 client;
- `tools/panda-data` acquisition, curation, identity-resolution assistance, and media/data processing;
- repository hygiene and current-state documentation.

Historical migration plans remain useful for auditability but are not active implementation queues unless explicitly reopened.
