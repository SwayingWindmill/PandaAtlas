# Architecture decisions

ZhiPanda records cross-cutting architecture choices as Architecture Decision Records (ADRs) and one governing baseline.

## Governing architecture

[ZhiPanda V2 Architecture Baseline](zhipanda-v2-architecture-baseline.md) is the governing architecture: a NestJS 11 API on Express (Node 24) organized as a business-capability modular monolith, Supabase PostgreSQL/PostGIS/Auth as the single authoritative data platform, and Cloudflare Workers, R2 and Hyperdrive for the online runtime. Use [deployment runtime status](../deployment/runtime-status.md) for the live provider and runtime topology.

The product priority is **panda fan experience first**. Archive, provenance, review, audit and publication capabilities support the product and must not displace the fan-facing loops.

## Decision records

| Decision | Status | What still applies |
|---|---|---|
| [ADR 0001](adr-0001-single-source-api-boundary.md) | Principle stands; implementation superseded | One API owns domain rules and writes: the NestJS V2 API. |
| [ADR 0002](adr-0002-managed-cloud-deployment-target.md) | Principle stands; provider superseded | Managed services only; production is Cloudflare Workers with Supabase. |
| [ADR 0003](adr-0003-single-accountable-archive-approver.md) | Principle stands; implementation superseded | One accountable approver decides publication, with no four-eyes step. |
| [Batch workflow interfaces](batch-workflow-interfaces.md) | Current | The bounded batch control plane. |

Wayfinder #309 resolved the V2 architecture through decisions #310-#322; the baseline is their synthesis. Implementation refines code-level details inside it. Reopen architecture only when implementation produces material correctness, security, product, managed-platform or operability evidence that the baseline cannot satisfy.
