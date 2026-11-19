# PandaAtlas / ZhiPanda

PandaAtlas powers ZhiPanda, a panda-fan product for exploring individual pandas, families, places, maps, moments, personal collections, and reviewed public knowledge.

## Current system

- Web: `apps/web`, Next-compatible App Router source running on vinext + Vite as Cloudflare Worker `zhipanda-v2-web`.
- Mobile app: `apps/mobile`, Expo / React Native app for iOS, Android, and web review builds.
- API: `services/api`, NestJS 12 on the Express adapter running as Cloudflare Worker `zhipanda-v2-api`.
- Collector: `services/collector`, standalone Python acquisition service running on its own host (see [ADR 0004](docs/architecture/adr-0004-continuous-collector.md)).
- Business data and identity: Supabase PostgreSQL/PostGIS and Supabase Auth.
- Production database transport: Cloudflare Hyperdrive.
- Public media: Cloudflare R2.
- Recurring async work: the API Worker's Cron Trigger.
- Production release: the approval-gated Production Deploy workflow; see [Production release and rollback](docs/runbooks/production-release.md).
- Offline acquisition and curation: `tools/panda-data` plus bounded curation scripts; these are not online request runtimes.

For actual provider names, bindings and domains, use [Deployment runtime status](docs/deployment/runtime-status.md).

## Development

Run Node/npm work from the native Windows checkout. The canonical command catalog is [Development Operations](docs/development-operations.md):

```powershell
npm run ops -- list
npm run verify:dev:list
npm run verify:dev
```

For Web browser acceptance, use `npm run smoke:web`. For deployable Cloudflare artifacts, use `npm run build:cloudflare`.

## Current work

Live `main` plus GitHub issues and pull requests are the project-status source of truth. Use [Issue tracker guidance](docs/agents/issue-tracker.md) when deciding what is current or what to do next.

## Repository map

- [Architecture decisions](docs/architecture/README.md)
- [Monorepo structure](docs/monorepo-structure.md)
- [Deployment runtime status](docs/deployment/runtime-status.md)
- [Development operations](docs/development-operations.md)
- [Issue tracker](docs/agents/issue-tracker.md)
- [Domain glossary map](docs/agents/domain.md)
- [Web runtime](apps/web/README.md)
- [Web browser-test contract](apps/web/tests/README.md)
- [Mobile app](apps/mobile/README.md)
- [Mobile product brief](PRODUCT.md)
- [Mobile design specification](DESIGN.md)
- [Collector service](services/collector/README.md)
