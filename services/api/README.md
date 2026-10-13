# ZhiPanda API

`services/api` is the production NestJS V2 API runtime.

## Runtime

- Node.js 24
- NestJS 11 on the Express adapter (`@nestjs/platform-express`)
- Cloudflare Worker `zhipanda-v2-api`
- Supabase PostgreSQL as the sole business-data authority
- Supabase Auth UUID identity
- Cloudflare Hyperdrive for production request-scoped PostgreSQL connections

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

Cloudflare owns the online API runtime. `cloudflare.config.ts` declares the Worker, `api.zhipanda.com`, Hyperdrive, service bindings, and compatibility flags. `worker/index.mjs` bridges the Nest Express application into the Cloudflare Node HTTP runtime with `httpServerHandler`. Express is required: Fastify's boot uses `new Function` and timers outside a request, which Workers forbid. `npm run check:worker-boot` boots the built Worker in local workerd and requires the application's own `/health` response.

Build the deployable artifact with `npm run build:cloudflare -w @zhipanda/api`. Production deploys only through the approved `Production Deploy` workflow (`.github/workflows/production-deploy.yml`), which runs `cf deploy --prebuilt`.

Production runtime configuration includes:

- `APP_ENV=production`
- `DATABASE_CONNECTION_MODE=hyperdrive`
- `CORS_ALLOW_ORIGINS`
- Supabase Auth configuration
- observability/provider credentials where enabled

The Worker does not carry a production `DATABASE_URL`; each request receives its PostgreSQL connection string from the Hyperdrive binding. Migration-only direct grants remain outside the request runtime.

## API and jobs

The public/admin API is implemented under `src/modules`. The bounded asynchronous downstream cycle has no HTTP endpoint: the Worker's `scheduled` handler runs one `AsyncDownstreamRunnerService.runCycle()` per Cloudflare Cron Trigger (every five minutes, declared in `cloudflare.config.ts`) inside the request-scoped Hyperdrive pool.

OpenAPI is generated from the Nest application:

```powershell
npm run openapi:generate -w @zhipanda/api
```

The generated V2 contract is `openapi/panda-atlas-v2.json`.

## Legacy retirement

FastAPI, `/api/v1`, the Python ASGI entrypoint, the FastAPI/Vercel closure, the Vercel Nest runtime, and the old `services/worker-api`/D1 projection runtime are retired. They are not compatibility targets and must not be reintroduced. The current Cloudflare Nest Worker and OpenNext Web Worker are V2 production runtime, not legacy compatibility paths.
