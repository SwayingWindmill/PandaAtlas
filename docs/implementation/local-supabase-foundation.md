# ZhiPanda local Supabase foundation

Issue #177 replaces the repository's standalone PostGIS container with one pinned Supabase CLI stack. The minimum stack supplies PostgreSQL 17, PostGIS, PGMQ, Auth, and private Storage. Studio, local email capture, Realtime, analytics, and Edge Runtime are disabled for this foundation slice. FastAPI remains the sole authoritative application command path.

## Pinned toolchain

- Supabase CLI: `2.110.0`, committed in the root `package.json` and lockfile.
- PostgreSQL major: `17`, committed in `infra/supabase/config.toml`.
- PGMQ compatibility range enforced by preflight: `>=1.5.1,<2.0`.
- Migrations: `infra/supabase/migrations/*.sql`, applied in filename order.
- Seeds: `infra/supabase/seed/*.sql`, applied in filename order after migrations.

Do not use an unpinned global CLI or a floating database image for release evidence.

## Local commands

Install the exact JavaScript dependency graph once:

```powershell
npm ci
```

The following commands work from PowerShell, Windows `cmd.exe`, Linux, and macOS because they invoke the exact committed CLI version through `npx`:

```powershell
npm run infra:start
npm run infra:reset
npm run infra:status
npm run infra:preflight
npm run infra:stop
```

The default local endpoints are:

| Service | Address |
| --- | --- |
| Supabase API, Auth, Storage | `http://127.0.0.1:54321` |
| PostgreSQL | `127.0.0.1:54322` |

`docker-compose.yml` now starts only FastAPI. Start the Supabase stack first and provide `ADMIN_API_TOKEN` explicitly before starting the API container. The Compose database default points to the host Supabase database through `host.docker.internal:54322`.

## Reset and preflight contract

`npm run infra:reset` recreates the local database, applies all checked-in migrations, and loads every ordered seed file. It is destructive to local Supabase data.

`npm run infra:preflight` writes `.release-gate/zhipanda-foundation.json` and fails closed unless it proves:

- Auth and Storage health endpoints respond successfully;
- PostgreSQL 17, PostGIS, pgcrypto, and a supported PGMQ version are installed;
- all checked-in migrations are recorded in Supabase migration history;
- existing Panda, Archive publication, and Public Projection relations remain readable;
- `integration.outbox_events` and the logged `integration_events` PGMQ queue exist;
- PGMQ create, send, read, Visibility Timeout, archive, metrics, drop, and transactional rollback semantics work;
- the generic `panda-atlas-private` bucket remains private;
- `integration`, `pgmq`, and `pgmq_public` are not Data API schemas;
- `anon` and `authenticated` do not have schema access to integration or PGMQ internals;
- the checked configuration does not contain high-confidence token material or a default admin token.

The report redacts database credentials. Generated reports and Supabase temporary state are ignored by Git.

## Integration event boundary

`contracts/integration-event.v1.json` and `app.integration.IntegrationEventEnvelope` define the shared transport-neutral envelope. Domain contexts own their payload schemas and event names. The envelope provides stable event, aggregate, schema, idempotency, correlation, causation, and occurrence metadata.

`integration.outbox_events` is the authoritative event history and replay source. PGMQ is a delivery transport: durable queue payloads should reference the Outbox event ID and routing metadata instead of copying sensitive domain content.

The `integration` schema is deliberately absent from PostgREST's exposed schema list. Browser code must not insert Outbox events or access PGMQ directly.

## Upgrade procedure

1. Stop the current local stack without deleting checked-in files.
2. Change the exact CLI version and regenerate the lockfile.
3. Review generated configuration differences explicitly; do not accept new services or public schemas silently.
4. Run a completely fresh `infra:start`, `infra:reset`, and `infra:preflight` on Windows and Linux.
5. Verify the hosted staging PostgreSQL major and available PGMQ version before applying the same migration set.
6. Keep the previous application version able to read additive schema changes until the relevant map-closing verification succeeds.

A CLI or database upgrade is rejected when a fresh reset cannot install PGMQ, changes required queue semantics, exposes a private schema or bucket, or makes existing Archive/Projection data unreadable.

## Rollback and fallback

Application rollback stops new producers and workers through their feature flags but does not drop PGMQ, `integration.outbox_events`, existing queue messages, migrations, or private Storage objects. Preserve data for a forward fix.

Celery plus Redis is not installed by this ticket. It remains a transport-only fallback and may be activated only when the hard conditions documented by issue #165 occur: an environment cannot supply the required PGMQ API, the pinned stack cannot reset reproducibly, extension versions cannot be controlled safely, measured database contention exceeds the release threshold, or recovery/monitoring gates cannot pass. Domain event contracts, Outbox facts, idempotency keys, and handlers must remain unchanged if the transport is replaced.
