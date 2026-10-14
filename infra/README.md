# Infrastructure boundary

[`supabase`](supabase/) contains the forward-only PostgreSQL migrations, seed inputs and local Supabase configuration. Only the approval-gated Production Deploy workflow applies migrations to production.

Cloudflare Worker configuration lives with each Worker: `apps/web/cloudflare.config.ts` and `services/api/cloudflare.config.ts`. The live topology is in the [deployment status page](../docs/deployment/runtime-status.md).
