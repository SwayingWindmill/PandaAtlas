# PandaAtlas / ZhiPanda

PandaAtlas powers ZhiPanda, a panda-fan product for exploring individual pandas, families, places, maps, moments, personal collections, and reviewed public knowledge.

## Current system

- Web: `apps/web`, Next-compatible App Router source running on vinext + Vite as Cloudflare Worker `zhipanda-v2-web`.
- API: `services/api`, NestJS 11 + Fastify 5 running as Cloudflare Worker `zhipanda-v2-api`.
- Business data and identity: Supabase PostgreSQL/PostGIS and Supabase Auth.
- Production database transport: Cloudflare Hyperdrive.
- Public media: Cloudflare R2.
- Bounded recurring async execution: GitHub Actions calling the authenticated NestJS internal job endpoint.
- Offline acquisition and curation: `tools/panda-data` plus bounded curation scripts; these are not online request runtimes.

For actual provider names, bindings, domains, and retirement state, use [Deployment runtime status](docs/deployment/runtime-status.md). Historical V1, Vercel, FastAPI, D1, and OpenNext documents are evidence only, not current runtime authority.

## Development

Run Node/npm work from the native Windows checkout. The canonical command catalog is [Development Operations](docs/development-operations.md):

```powershell
npm run ops -- list
npm run verify:dev:list
npm run verify:dev
```

For Web browser acceptance, use `npm run smoke:web`. For deployable Cloudflare artifacts, use `npm run build:cloudflare`.

## Current work

Live `main` plus GitHub issues and pull requests are the project-status source of truth. Use [Issue tracker guidance](docs/agents/issue-tracker.md) when deciding what is current or what to do next; dated research, release evidence, and migration plans are supporting records rather than backlog state.

## Repository map

- [Architecture decisions](docs/architecture/README.md)
- [Monorepo structure](docs/monorepo-structure.md)
- [Deployment runtime status](docs/deployment/runtime-status.md)
- [Development operations](docs/development-operations.md)
- [Issue tracker](docs/agents/issue-tracker.md)
- [Domain glossary map](docs/agents/domain.md)
- [Web runtime](apps/web/README.md)
- [Web browser-test contract](apps/web/tests/README.md)
