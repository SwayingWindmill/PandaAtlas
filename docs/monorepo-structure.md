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

- `apps/web` runs on Vercel and calls the canonical API at `https://api.zhipanda.com`.
- `services/api` runs NestJS/Fastify on Vercel and is the only online business API runtime.
- Supabase PostgreSQL is the sole business-data authority.
- Supabase Auth is the identity authority.
- Cloudflare is retained for authoritative DNS and R2 media storage only.
- `tools/panda-data` is offline data tooling and is not imported into the online request runtime.

## Deployment

Production functions are placed in Tokyo (`hnd1`) near the Supabase production project. The API uses a least-privilege PostgreSQL login through Supavisor transaction pooling with strict Supabase CA verification.

Cloudflare Worker/D1, OpenNext, FastAPI, `/api/v1`, and FastAPI serverless-closure tooling are retired implementation history, not supported compatibility surfaces.

## Development

Run Node/Nest/Next commands from the Windows side of the repository. The canonical command catalog is documented in [`docs/development-operations.md`](development-operations.md).

Offline acquisition and curation Python commands use `tools/panda-data` and `uv` independently of the online API workspace.
