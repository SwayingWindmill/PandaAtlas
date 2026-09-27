# Panda Atlas / ZhiPanda

Panda Atlas is the monorepo behind **ZhiPanda (吱熊猫)**, a fan-first giant-panda knowledge product centered on named individual pandas, their families, life histories, places, media, and published evidence.

## Production architecture

The V2 production cutover is complete. The active architecture is:

- **Web:** Next.js on Vercel (`apps/web`)
- **API:** NestJS 11 + Fastify 5 on Vercel (`services/api`)
- **Business data:** Supabase PostgreSQL/PostGIS
- **Authentication:** Supabase Auth with NestJS application authorization
- **Public media / immutable objects:** Cloudflare R2
- **DNS:** Cloudflare DNS
- **Typed client:** `packages/api-client`
- **Offline acquisition / research / curation:** Python + `uv` in `tools/panda-data`
- **Long/heavy batch work:** GitHub Actions and bounded repository workflows

FastAPI, `/api/v1`, Cloudflare Worker/D1 public-read authority, and OpenNext are retired production implementations. They are not compatibility targets.

For the latest reviewed runtime and availability state, use [`docs/deployment/runtime-status.md`](docs/deployment/runtime-status.md). Do not infer current production health from historical migration documents.

## Repository layout

```text
PandaAtlas/
├─ apps/
│  └─ web/                 # Next.js public/admin Web product
├─ services/
│  └─ api/                 # NestJS/Fastify V2 modular monolith
├─ packages/
│  └─ api-client/          # generated/typed V2 API client
├─ tools/
│  └─ panda-data/          # Python acquisition/research/curation runtime
├─ infra/
│  └─ supabase/            # canonical PostgreSQL migrations and local Supabase config
├─ contracts/              # active cross-runtime/process contracts
├─ data/                   # governed datasets and release evidence
├─ scripts/                # development, release, curation, batch, and research tooling
└─ docs/
```

See [`docs/monorepo-structure.md`](docs/monorepo-structure.md) for the maintained structure and runtime boundaries.

## Local development

This repository is hosted on Windows. Run Node.js/npm/NestJS/Next.js commands with the **Windows toolchain against the native workspace**, not Node/npm through WSL against `/mnt/e`.

Install dependencies from the repository root:

```powershell
npm ci
```

Inspect the canonical development command catalog:

```powershell
npm run ops -- list
npm run ops -- describe verify.dev
```

Start the local infrastructure when a task needs Supabase/PostgreSQL:

```powershell
npm run infra:start
npm run infra:status
```

Run Web and API development processes in separate terminals:

```powershell
npm run dev:web
npm run dev:api
```

## Verification

V2 API and client:

```powershell
npm run typecheck:v2
npm run test:v2
npm run lint:v2
npm run check:architecture:v2
npm run build:v2
```

Web:

```powershell
npm run typecheck:web
npm run lint:web
npm run build:web
npm run smoke:web
```

Repository-scoped verification:

```powershell
npm run verify:dev:list
npm run verify:dev
npm run check:repository-hygiene
npm run check:research-script-policy
```

The canonical development operations are documented in [`docs/development-operations.md`](docs/development-operations.md).

## Panda data runtime

`tools/panda-data` is an independent offline Python runtime. It supports source acquisition, crawler adapters, research/discovery, identity-resolution assistance, enrichment, curation assistance, media processing, and immutable artifact construction.

It is **not** an HTTP backend and must not become a second business-data authority.

Typical commands:

```powershell
npm run check:panda-curation
npm run test:panda-data
npm run lint:panda-data
npm run crawler:poc
```

See [`tools/panda-data/README.md`](tools/panda-data/README.md) for authority and contract boundaries.

## Database and migrations

`infra/supabase/migrations/*.sql` is the sole schema-migration authority for V2 PostgreSQL state. Application runtime code must not run surprise migrations or create an alternate schema authority.

The NestJS API uses Kysely + `node-postgres`; the production runtime uses a least-privilege Supavisor transaction-pool connection.

## Architecture and product docs

- Current runtime state: [`docs/deployment/runtime-status.md`](docs/deployment/runtime-status.md)
- V2 architecture baseline: [`docs/architecture/zhipanda-v2-architecture-baseline.md`](docs/architecture/zhipanda-v2-architecture-baseline.md)
- Architecture index / ADR disposition: [`docs/architecture/README.md`](docs/architecture/README.md)
- V2 implementation history: [`docs/implementation/nestjs-v2-implementation-map.md`](docs/implementation/nestjs-v2-implementation-map.md)
- V2 production cutover evidence: [`docs/release/issue-333-v2-production-cutover.md`](docs/release/issue-333-v2-production-cutover.md)
- Public Web product contract: [`apps/web/PRODUCT.md`](apps/web/PRODUCT.md)
- Public Web design authority: [`apps/web/DESIGN.md`](apps/web/DESIGN.md)
- Current panda detail template: [`docs/product/panda-detail-template-v2.md`](docs/product/panda-detail-template-v2.md)

Historical V1, OpenNext, Worker/D1, and FastAPI deployment documents remain useful as dated evidence only. When a historical document conflicts with the runtime-status page about the present system, the runtime-status page is authoritative.
