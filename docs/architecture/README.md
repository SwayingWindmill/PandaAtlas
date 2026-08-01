# Architecture decisions

Panda Atlas records accepted cross-cutting architecture choices as Architecture Decision Records (ADRs).

## Current and target deployment

The current production deployment remains Cloudflare-based until the managed-cloud migration phases are accepted. The approved target is Vercel for the Next.js Web application and bounded API functions, Supabase PostgreSQL/PostGIS/Auth as the authoritative managed data platform, Cloudflare DNS/R2 for domains and public media, and GitHub Actions for bounded batch workflows.

Use the [deployment runtime status](../deployment/runtime-status.md) page for the shared Current production, Target, Transitional, and Local-only labels applied across repository documentation.

| ADR | Status | Decision |
|---|---|---|
| [ADR 0001](adr-0001-single-source-api-boundary.md) | Accepted | FastAPI and PostgreSQL/PostGIS own domain rules and writes; D1/R2 may provide a versioned public read projection. |
| [ADR 0002](adr-0002-managed-cloud-deployment-target.md) | Accepted | Migrate gradually to a managed-only Vercel, Supabase, Cloudflare DNS/R2, and GitHub Actions deployment without self-managed production servers. |

The target ADR does not claim that migration is already complete. Runtime documentation and release tooling must continue to describe the current production path until each cutover is verified.

## Migration implementation status

- Phase 0 inventory: [complete](../deployment/managed-cloud-phase-0-inventory.md)
- Machine-readable responsibility register: [`contracts/managed-cloud-deployment-inventory.v1.json`](../../contracts/managed-cloud-deployment-inventory.v1.json)
- Inventory validation: `node scripts/release/check-managed-cloud-inventory.mjs`
- Phase 1 Vercel deployment: [deployed with acceptance in progress](../deployment/vercel-web-phase-1.md)
- Next action: complete the deployment-matched browser and accessibility checks in GitHub Actions; no production DNS or Cloudflare runtime changes are authorized yet.
