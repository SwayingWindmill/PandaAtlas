# ZhiPanda Monorepo Structure

```text
PandaAtlas/
  apps/
    web/                    # Next.js app router on vinext + Vite, Cloudflare Worker
    mobile/                 # Expo app, iOS, Android and web
  services/
    api/                    # NestJS (Express) API, Cloudflare Worker
  packages/
    api-client/             # generated, typed API client
    world-map/              # Natural Earth outline and projection shared by the website and the app
  tools/
    panda-data/             # offline Python acquisition/curation/media tooling (uv)
  infra/
    supabase/               # PostgreSQL migrations, seeds and local Supabase config
  scripts/                  # development operations, release checks, curation and research tooling
  contracts/                # data and process contracts that code reads
  data/                     # curated inputs, reviewed batches and public release data
  docs/
```

## npm workspaces

The npm workspaces are exactly:

- `packages/api-client`
- `packages/world-map`
- `apps/web`
- `apps/mobile`
- `services/api`

## Runtime boundaries

- `apps/web` runs as Cloudflare Worker `zhipanda-v2-web` and calls the API through the `V2_API` service binding; browsers use `https://api.zhipanda.com`.
- `services/api` runs NestJS on Express as Cloudflare Worker `zhipanda-v2-api` and is the only online business API.
- Supabase PostgreSQL is the sole business-data authority, reached through Cloudflare Hyperdrive; Supabase Auth is the identity authority.
- Cloudflare owns DNS and R2 media storage.
- `tools/panda-data` is offline tooling and is never imported into the online runtime.

## Deployment

`apps/web/cloudflare.config.ts` and `services/api/cloudflare.config.ts` are the tracked production topology, and `cf` is the deployment CLI. Production deploys only through `.github/workflows/production-deploy.yml`; see [deployment runtime status](deployment/runtime-status.md).

## Development

Run Node/Nest/Vite commands from the Windows side of the repository. Next remains a development-only route-type generation tool for the Web workspace. The command catalog is [Development Operations](development-operations.md); offline Python commands use `tools/panda-data` and `uv`.
