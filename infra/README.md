# Infrastructure boundary

`infra/` contains declarative infrastructure inputs used for local verification, current transitional runtimes, migration, and recovery.

- [`cloudflare`](cloudflare/) supports the current transitional Worker, D1, and related rollback paths.
- [`supabase`](supabase/) contains forward-only migrations, seed inputs, and local managed-platform configuration.

Infrastructure files do not by themselves prove a production cutover. Current, target, transitional, and local-only responsibilities are authoritative in the [deployment status page](../docs/deployment/runtime-status.md).
