# Architecture decisions

ZhiPanda records accepted cross-cutting architecture choices as Architecture Decision Records (ADRs) and governing architecture baselines.

## V2 target implementation architecture

The governing target for all new backend migration work is [ZhiPanda V2 Architecture Baseline](zhipanda-v2-architecture-baseline.md).

Its implementation sequence is [NestJS V2 Implementation Map](../implementation/nestjs-v2-implementation-map.md).

The V2 target is NestJS 11 + Fastify 5 on Node 24, a business-capability modular monolith, Supabase PostgreSQL/PostGIS/Auth as the single authoritative managed data platform, Cloudflare DNS/R2, Vercel Web/API runtimes, and GitHub Actions for bounded long/heavy work.

The V2 baseline intentionally does not preserve FastAPI package architecture, `/api/v1` transport compatibility, Worker/D1 public-read architecture, or OpenNext deployment machinery.

## Current production remains V1 until cutover

The [ZhiPanda V1 Architecture Baseline](zhipanda-v1-architecture-baseline.md) and existing deployment documents remain useful for describing the system that is still serving production during migration. They are **not** the implementation authority for NestJS V2.

The governing product priority remains **panda fan experience first**. Archive, provenance, review, moderation, audit, and publication capabilities support the product and must not displace the fan-facing loops carried forward from the [V1 product architecture baseline](zhipanda-v1-architecture-baseline.md).

Use [deployment runtime status](../deployment/runtime-status.md) for the actual Current production / Target / Transitional / Local-only state. Do not describe V2 as production before the cutover ticket reaches its explicit commit point.

## ADR disposition

| Decision | V2 status | Meaning |
|---|---|---|
| [ADR 0001](adr-0001-single-source-api-boundary.md) | Superseded for V2 runtime design | Its single-authority principle remains; FastAPI/Worker/D1 and `/api/v1` compatibility do not. |
| [ADR 0002](adr-0002-managed-cloud-deployment-target.md) | Partially superseded | Managed-only Vercel + Supabase + Cloudflare DNS/R2 + GitHub Actions remains; its FastAPI-specific managed API phase is replaced by NestJS V2. |
| [V1 Architecture Baseline](zhipanda-v1-architecture-baseline.md) | Current-production historical/product input | Product truths remain where still valid; FastAPI/runtime/module implementation is not a V2 constraint. |
| [V2 Architecture Baseline](zhipanda-v2-architecture-baseline.md) | Governing target | Canonical architecture for V2 implementation. |

## V2 planning record

Wayfinder #309 resolved the V2 architecture through decisions #310-#322. Detailed research notes remain under `docs/research/` as supporting evidence; the V2 baseline is the governing synthesis.

The implementation issues linked from the V2 Implementation Map should refine only code-level details inside the accepted architecture. Reopen architecture only when implementation produces material correctness, security, product, managed-platform, or operability evidence that the baseline cannot satisfy.
