# Deployment runtime status

- Status date: 2026-08-01
- Governing decision: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)
- Inventory: [Managed-cloud migration Phase 0](managed-cloud-phase-0-inventory.md)
- Current migration step: [Phase 1 parallel Vercel Web deployment](vercel-web-phase-1.md)

This page is the human-readable status key for runtime and deployment documentation. It distinguishes what serves production today from the approved managed-cloud target and from tooling that exists only for migration, rollback, local development, or recovery testing.

## Status labels

| Label | Meaning |
|---|---|
| **Current production** | Actively serves Panda Atlas production traffic or production release operations today. It remains supported until a verified cutover and rollback window complete. |
| **Target** | Approved end state under ADR 0002. A target component is not assumed to serve production until its migration phase exits. |
| **Transitional** | Retained only to support current production, migration, compatibility, or rollback. Do not add unrelated feature work or new authoritative state. |
| **Local only** | Supported for development, verification, or recovery exercises. It must not become a persistent production dependency. |

## Runtime matrix

| Responsibility | Current status | Approved target | Rule |
|---|---|---|---|
| Public Web | **Current production:** OpenNext application on Cloudflare Worker | **Target:** native Next.js on Vercel | The Vercel project is deployed in parallel, but custom-domain cutover belongs to Phase 4. |
| Public read API | **Current production / Transitional:** Cloudflare Worker backed by D1 and R2 | **Target:** bounded managed API functions on Vercel backed by Supabase | Preserve the public contract and rollback path until Phase 5 completes. |
| Domain rules and writes | **Repository authority:** FastAPI and PostgreSQL/PostGIS; managed production host remains Phase 2 work | **Target:** bounded FastAPI-compatible functions on Vercel with Supabase PostgreSQL/PostGIS | Do not create another authoritative database or persistent self-managed API host. |
| Authoritative database and authentication | Supabase schema, Auth, and migration model are established; production connection and policy evidence remain Phase 2 work | **Target:** Supabase PostgreSQL/PostGIS/Auth | Supabase is the only approved authoritative managed data platform. |
| Public media and large immutable objects | **Current production and Target:** Cloudflare R2 | **Target:** retain R2 | Migration work must preserve stable public media behavior. |
| DNS | **Current production and Target:** Cloudflare | **Target:** retain Cloudflare DNS | Vercel records remain DNS-only unless a reviewed test requires otherwise. |
| Bounded batch and release workflows | **Current production:** guarded operator-workstation scripts, with some GitHub Actions checks | **Target:** GitHub Actions with environments, approvals, artifacts, concurrency, and idempotency controls | Migration belongs to Phase 3; request handlers must not execute long-running work. |
| Local Docker, local Supabase, local PostgreSQL, and local admin proxy | **Local only** | **Local only** | Use for development and recovery verification; never document these as the production target. |

## Transitional freeze rules

Until the relevant cutover phase completes:

1. Keep the Cloudflare Web Worker, public API Worker, D1 migrations, and OpenNext configuration operational for current production and rollback.
2. Do not add new D1-backed product authority, write paths, or features unrelated to migration safety.
3. Do not introduce new OpenNext-only application behavior.
4. Do not add a persistent Docker host, VM, Nginx host, or self-managed PostgreSQL server as a production dependency.
5. Keep current production documentation accurate; do not describe Vercel or the managed API as cut over before their exit evidence passes.
6. Remove transitional resources only in their ADR 0002 retirement phase and after the documented rollback window.

## Current migration position

- Phase 0 responsibility inventory is complete.
- Phase 1 has a Vercel project and parallel deployment; acceptance remains in progress.
- Production traffic for `zhipanda.com`, `www.zhipanda.com`, and `api.zhipanda.com` remains on Cloudflare.
- Phase 2 managed FastAPI and Supabase production-connection work has not started.
- No production DNS, D1, R2, release activation, or rollback behavior is changed by Phase 1.
