# Development Operations

The repository exposes one canonical interface for routine development work:

```powershell
npm run ops -- list
npm run ops -- describe verify.dev
npm run ops -- run web.dev
npm run ops -- run api.typecheck
npm run ops -- run verify.dev --scope web --scope api
```

The implementation lives in `scripts/development/`. `catalog.mjs` is the command source of truth; `operations.mjs` lists, describes, and executes those commands.

## Active runtime scopes

The active scopes are:

- `release`
- `web`
- `api`
- `curation`
- `data`

There is no Worker runtime scope after the V2 production cutover.

`web.*` commands target the Next.js workspace. `api.*` commands target the NestJS workspace and use npm/Node only. Offline Python acquisition and curation run through `tools/panda-data` or bounded scripts under `scripts/curation`.

## Verification

V2 backend checks:

```powershell
npm run typecheck:v2
npm run test:v2
npm run lint:v2
npm run check:architecture:v2
npm run build:v2
```

Web checks:

```powershell
npm run typecheck:web
npm run lint:web
npm run build:web
```

Changed-scope verification:

```powershell
npm run verify:dev:list
npm run verify:dev
```

Repository hygiene and research policy remain explicit checks:

```powershell
npm run check:repository-hygiene
npm run check:research-script-policy
```

Bounded batch work uses `contracts/batch-operations.v1.json` and the `batch-operations.yml` workflow:

```powershell
npm run batch:plan -- --operation research.validate --json
npm run check:batch-workflow-interface
```

## Production ownership

- Web runtime: Vercel
- API runtime: Vercel
- business database: Supabase PostgreSQL
- identity: Supabase Auth
- DNS and media storage: Cloudflare DNS/R2
- recurring V2 async trigger: GitHub Actions calling the authenticated Nest internal job endpoint

FastAPI request-closure checks, Cloudflare Worker/D1 development commands, OpenNext deployment commands, and V1 repository/deployment contracts were retired with the V2 production cutover. Do not reintroduce compatibility adapters for them.

## Local state

Hidden local state needs an owner and a lifecycle. Treat ignored directories as one of these categories:

- **Repository assets** such as `.agents/` and `.github/` are tracked source and follow normal review.
- **Generated state** such as `.next*`, `.open-next/`, `.wrangler/`, `.pytest_cache/`, `.ruff_cache/`, `.release-gate/`, and local virtual environments is disposable. Keep it only while the command or investigation that produced it is active; remove stale copies instead of naming new historical variants.
- **Tool-local state** such as workspace Vercel links, Supabase link metadata, `.devspace-local/`, `.claude/`, and Impeccable local context may stay only while the corresponding tool still uses it. Keep the minimum current config/state; logs, screenshots, backups, and retired runtimes are not durable project records.
- **Acquisition working state** lives only under the root `.acquisition/` seam owned by `tools/panda-data`. Use its named bundle, queue, backfill, review, decision, patch, and report directories; do not use `.acquisition/` as a general scratch directory or recreate it under another runtime.
- **Scratch state** such as `.codex-temp/` is task-local. Durable evidence belongs in an existing governed data/evidence location or an external backup; credentials and secret-bearing screenshots/JSON do not belong in repository-local scratch.

Before finishing a task, remove scratch and generated state that no active next step consumes. Prefer deleting obsolete local paths over adding another ignore, compatibility path, cleanup wrapper, or retention mechanism.
