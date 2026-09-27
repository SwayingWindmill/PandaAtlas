# Architecture decisions

ZhiPanda records accepted cross-cutting architecture choices as Architecture Decision Records (ADRs) and governing architecture baselines.

## Governing production architecture

The governing production architecture is [ZhiPanda V2 Architecture Baseline](zhipanda-v2-architecture-baseline.md).

Its historical implementation sequence is preserved in [NestJS V2 Implementation Map](../implementation/nestjs-v2-implementation-map.md), and the completed production cutover is recorded in [Issue #333 — V2 Production Cutover Evidence](../release/issue-333-v2-production-cutover.md).

V2 is NestJS 11 + Fastify 5 on Node 24, a business-capability modular monolith, Supabase PostgreSQL/PostGIS/Auth as the single authoritative managed data platform, Cloudflare DNS/R2, Vercel Web/API runtimes, and GitHub Actions plus the independent Python `tools/panda-data` runtime for bounded offline work.

The V2 baseline intentionally does not preserve FastAPI package architecture, `/api/v1` transport compatibility, Worker/D1 public-read architecture, or OpenNext deployment machinery.

## V1 is historical

The production cutover crossed its V2-only commit point on 2026-09-01. The [ZhiPanda V1 Architecture Baseline](zhipanda-v1-architecture-baseline.md) and older deployment documents remain useful as dated historical/product input, but they are not current runtime authority and must not be used to justify restoring FastAPI, Worker/D1, OpenNext, or `/api/v1` compatibility.

The governing product priority remains **panda fan experience first**. Archive, provenance, review, moderation, audit, and publication capabilities support the product and must not displace the fan-facing loops carried forward from the valid product semantics of the V1 era.

Use [deployment runtime status](../deployment/runtime-status.md) for the latest reviewed production/availability snapshot. It is intentionally separate from historical migration and cutover records.

## ADR disposition

| Decision | Current status | Meaning |
|---|---|---|
| [ADR 0001](adr-0001-single-source-api-boundary.md) | Superseded for runtime implementation; authority principle retained | Single business authority remains a core invariant; FastAPI/Worker/D1 and `/api/v1` compatibility do not. |
| [ADR 0002](adr-0002-managed-cloud-deployment-target.md) | Partially superseded by implemented V2 | Managed-only Vercel + Supabase + Cloudflare DNS/R2 + GitHub Actions remains; its FastAPI-specific API phase is historical. |
| [V1 Architecture Baseline](zhipanda-v1-architecture-baseline.md) | Historical | Product truths may remain relevant; its FastAPI/runtime/module implementation is retired. |
| [V2 Architecture Baseline](zhipanda-v2-architecture-baseline.md) | Governing production baseline | Canonical architecture for current implementation and future backend work. |

## V2 planning and execution record

Wayfinder #309 resolved the V2 architecture through decisions #310-#322. V2 implementation issues #323-#333 then established the runtime, migrated the product, rehearsed staging, completed the production cutover, and retired the legacy application runtimes.

Detailed research notes under `docs/research/` and the implementation map remain supporting evidence. They should not be edited to erase the historical state they documented. When a current-state statement is needed, point to the V2 baseline and deployment runtime-status page instead.

Reopen an architecture decision only when implementation produces material correctness, security, product, managed-platform, or operability evidence that the current baseline cannot satisfy. “V1 did it differently” is not such evidence.
