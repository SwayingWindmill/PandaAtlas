# ZhiPanda Monorepo Structure

The active repository layout after the V2 production cutover is:

```text
PandaAtlas/
  apps/
    web/                    # Next.js V2 Web runtime
  services/
    api/                    # NestJS/Fastify V2 API runtime
  packages/
    api-client/             # generated/typed API client workspace
  tools/
    panda-data/             # offline Python acquisition/curation/data runtime
  infra/
    supabase/               # canonical PostgreSQL migrations and local Supabase config
  scripts/                  # bounded repository, release, curation, and research tooling
  contracts/                # active data/process contracts
  docs/
```

## npm workspaces

The npm workspaces are exactly:

- `apps/web`
- `services/api`
- `packages/api-client`

`services/worker-api` is not a workspace and no longer exists after the V2 cutover.

## Runtime boundaries

- `apps/web` runs as Cloudflare Worker `zhipanda-v2-web` through vinext + Vite + the Cloudflare Vite plugin and calls the canonical API at `https://api.zhipanda.com`; deployed server calls use the `V2_API` service binding.
- `services/api` runs NestJS/Fastify as Cloudflare Worker `zhipanda-v2-api` and is the only online business API runtime.
- Supabase PostgreSQL is the sole business-data authority.
- Supabase Auth is the identity authority.
- Cloudflare Hyperdrive supplies production request-scoped PostgreSQL connectivity; Cloudflare also owns DNS and R2 media storage.
- `tools/panda-data` is offline data tooling and is not imported into the online request runtime.

## Deployment

`apps/web/cloudflare.config.ts` and `services/api/cloudflare.config.ts` are the tracked production deployment topology. `cf` is the operator/deployment CLI; the Web runtime no longer carries an OpenNext or Wrangler deployment path.

Vercel Web/API deployment, the old Worker/D1 projection runtime, FastAPI, `/api/v1`, and FastAPI serverless-closure tooling are retired implementation history, not supported compatibility surfaces.

## Development

Run Node/Nest/Vite commands from the Windows side of the repository. Next remains a development-only route-type generation tool for the Web workspace. The canonical command catalog is documented in [`docs/development-operations.md`](development-operations.md).

Offline acquisition and curation Python commands use `tools/panda-data` and `uv` independently of the online API workspace.
