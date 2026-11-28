# Architecture decisions

ZhiPanda records cross-cutting architecture choices as Architecture Decision Records (ADRs) and one governing baseline.

## Governing architecture

[ZhiPanda V2 Architecture Baseline](zhipanda-v2-architecture-baseline.md) is the governing architecture: a NestJS 12 API on Express (Node 24) organized as a business-capability modular monolith, Supabase PostgreSQL/PostGIS/Auth as the single authoritative data platform, and Cloudflare Workers, R2 and Hyperdrive for the online runtime. Use [deployment runtime status](../deployment/runtime-status.md) for the live provider and runtime topology.

The product priority is **panda fan experience first**. Archive, provenance, review, audit and publication capabilities support the product and must not displace the fan-facing loops.

## Decision records

| Decision | Status | What still applies |
|---|---|---|
| [ADR 0001](adr-0001-single-source-api-boundary.md) | Accepted | One API owns domain rules and writes: the NestJS V2 API. |
| [ADR 0002](adr-0002-managed-cloud-deployment-target.md) | Accepted, amended by ADR 0004 | Managed services only; production is Cloudflare Workers with Supabase. The collector is the one exception. |
| [ADR 0003](adr-0003-single-accountable-archive-approver.md) | Accepted, amended by ADR 0005 | One accountable approver decides publication, with no four-eyes step. |
| [ADR 0004](adr-0004-continuous-collector.md) | Accepted, amended by ADR 0005 | A continuously running multi-platform collector on its own host replaces the reviewed-source acquisition runtime. |
| [ADR 0005](adr-0005-panda-news-and-fact-updates.md) | Proposed | AIHOT, run headless, processes collected content; panda news and fact updates are pulled into `services/api` and shown in the web and app. |
| [Batch workflow interfaces](batch-workflow-interfaces.md) | Current | The bounded batch control plane. |
| [Mobile app and platform services](mobile-app-platform-services.md) | Current | Which Supabase and Cloudflare services the Expo app uses, and why the others do not fit. |

Wayfinder #309 resolved the V2 architecture through decisions #310-#322; the baseline is their synthesis. Implementation refines code-level details inside it. Reopen architecture only when implementation produces material correctness, security, product, managed-platform or operability evidence that the baseline cannot satisfy.
