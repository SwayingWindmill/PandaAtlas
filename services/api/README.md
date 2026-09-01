# ZhiPanda API

`services/api` is the production NestJS V2 API runtime.

## Runtime

- Node.js 24
- NestJS 11 + Fastify 5
- Vercel Functions
- Supabase PostgreSQL as the sole business-data authority
- Supabase Auth UUID identity
- Supavisor transaction pool for serverless runtime connections
- strict database TLS with the Supabase Root 2021 CA

The V2 architecture authority is [`docs/architecture/zhipanda-v2-architecture-baseline.md`](../../docs/architecture/zhipanda-v2-architecture-baseline.md).

## Local development

Run Node/Nest commands from the Windows side of the repository:

```powershell
npm run dev:api
npm run typecheck:v2
npm run test:v2
npm run lint:v2
npm run check:architecture:v2
npm run build:v2
```

`GET /health` verifies that the HTTP runtime is alive. `GET /ready` performs the bounded PostgreSQL readiness check.

## Production deployment

Vercel owns the online API runtime. `services/api/vercel.json` pins the function region to Tokyo (`hnd1`) next to the production Supabase project.

Production runtime configuration includes:

- `APP_ENV=production`
- `DATABASE_URL` using the Supavisor transaction pool
- `DATABASE_SSL_CA_CERT` containing the Supabase Root 2021 CA
- `CORS_ALLOW_ORIGINS`
- Supabase Auth configuration
- observability/provider credentials where enabled

The runtime database login is a dedicated least-privilege login that inherits `zhipanda_app`; migration-only direct grants are not part of the steady-state runtime role.

## API and jobs

The public/admin API is implemented under `src/modules`. The bounded asynchronous downstream cycle is exposed only through `GET /internal/jobs/async-downstream`, authenticated with `CRON_SECRET`, and is intended to be invoked by the production scheduler.

OpenAPI is generated from the Nest application:

```powershell
npm run openapi:generate -w @zhipanda/api
```

The generated V2 contract is `openapi/panda-atlas-v2.json`.

## Legacy retirement

FastAPI, `/api/v1`, the Python ASGI entrypoint, the FastAPI Vercel closure, Cloudflare Worker/D1 projection runtime, and OpenNext Web runtime were retired at the V2 production cutover. They are not compatibility targets and must not be reintroduced. Historical evidence remains in Git history and the legacy cutover tag.
