# Deployment runtime status

- Status date: 2026-08-28
- Governing target: [ZhiPanda V2 Architecture Baseline](../architecture/zhipanda-v2-architecture-baseline.md)
- Earlier managed-cloud decision: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)
- Inventory: [Managed-cloud migration Phase 0](managed-cloud-phase-0-inventory.md)

This page is the human-readable status key for runtime and deployment documentation. It distinguishes what serves production today from the accepted V2 target and from tooling retained only for migration, rollback, local development, or historical evidence.

## Status labels

| Label | Meaning |
|---|---|
| **Current production** | Actively serves ZhiPanda production traffic or production release operations today. It remains supported until the V2 cutover reaches its explicit commit/retirement boundary. |
| **Target** | Accepted NestJS V2 end state. A target component is not assumed to serve production until its implementation/cutover ticket exits. |
| **Transitional** | Retained only to support current production, migration, bounded rollback, or retirement. Do not add unrelated feature work or new authority. |
| **Local only** | Supported for development, verification, or recovery exercises. It must not become a persistent production dependency. |

## Runtime matrix

| Responsibility | Current status | Accepted V2 target | Rule |
|---|---|---|---|
| Public Web | **Current production:** OpenNext application on Cloudflare Worker | **Target:** native Next.js on Vercel | The existing Vercel Web project is useful migration evidence, but production custom-domain cutover belongs to the V2 implementation/cutover map. |
| Public read API | **Current production / Transitional:** Cloudflare Worker backed by D1/R2 | **Target:** NestJS 11 + Fastify 5 on Vercel backed by Supabase release-scoped PostgreSQL read models | Do not add new D1 authority or `/api/v1` compatibility to V2. Worker/D1 exists only until the bounded legacy API rollback window closes. |
| Domain rules and writes | **Current/repository authority:** FastAPI and PostgreSQL/PostGIS | **Target:** NestJS business-capability modular monolith on Vercel + Supabase PostgreSQL/PostGIS | V2 migrates business meaning, not FastAPI package/service architecture. There is no dual-write target. |
| Authoritative database and authentication | Supabase PostgreSQL/PostGIS/Auth foundation is established | **Target:** Supabase PostgreSQL/PostGIS/Auth remains the single managed authority; PostgreSQL Identity capabilities authorize Nest requests | Do not create another authoritative database or browser/server shadow authority. |
| Public media and large immutable objects | **Current production and Target:** Cloudflare R2, currently partly exposed through legacy API routes | **Target:** R2 custom-domain delivery with Nest-authorized direct uploads/finalization | Keep reviewed R2 objects; retire Worker media proxying after V2 media-domain transition. |
| DNS | **Current production and Target:** Cloudflare | **Target:** retain Cloudflare DNS | Vercel Web/API records remain managed through the cutover plan; Cloudflare proxy behavior is not assumed where unverified. |
| Short durable background work | V1 projectors/workers/scripts | **Target:** transactional Outbox + consumer-specific PGMQ queues drained by bounded Vercel Cron/invocations | No API-startup polling or long-running request worker. |
| Long/heavy batch/data work | **Current production:** guarded local/operator scripts plus some GitHub Actions | **Target:** GitHub Actions + independent `tools/panda-data` Python runtime | Python is a data/research runtime, not a second backend. |
| Local Docker, local Supabase/PostgreSQL, local admin tooling | **Local only** | **Local only** | Development/recovery only; never production authority. |

## Transitional freeze rules

Until the V2 cutover closes the relevant rollback window:

1. Keep the current Cloudflare Web Worker, public API Worker, D1 projection, FastAPI authority, and OpenNext configuration operational only for current production and bounded rollback.
2. Do not add new D1-backed product authority, new Worker product features, or new OpenNext-only behavior.
3. Do not invest further in deploying FastAPI to Vercel; `vercel-api-phase-2.md` is superseded by the NestJS V2 target.
4. Do not add `/api/v1`, FastAPI error, snake_case, admin-token, Worker, or D1 compatibility to NestJS V2.
5. Do not introduce a persistent Docker host, VM, Nginx host, or self-managed PostgreSQL server as a production dependency.
6. Keep current-production documentation accurate; do not describe NestJS V2 as live before cutover.
7. Remove transitional runtime/tooling immediately after its bounded rollback role closes rather than preserving an arbitrary long cooling period.

## Current migration position

- The original managed-cloud Phase 0 inventory remains useful historical/current-resource evidence.
- The Vercel Next.js Web project and accepted preview evidence from the original Phase 1 remain useful inputs.
- The old FastAPI Vercel Phase 2 preparation is **superseded**; do not finish FastAPI serverless pooling/auth/deployment as an intermediate target.
- NestJS V2 architecture planning is complete under Wayfinder #309/#310-#322. V2-01 through V2-09 (#323-#331) are complete; V2-10 (#332) is the active migration and managed-staging rehearsal before production cutover.
- Production traffic for `zhipanda.com`, `www.zhipanda.com`, and `api.zhipanda.com` remains on the current legacy paths until the V2 cutover ticket changes them.
- Supabase stays the authoritative managed data platform and R2 stays the retained public-media/object platform through the migration.
