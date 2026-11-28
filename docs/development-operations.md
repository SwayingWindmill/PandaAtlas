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

Cloudflare deployment belongs to the `web` and `api` scopes.

`web.*` commands target the vinext/Vite Web workspace (Next remains development-only route-type tooling). `api.*` commands target the NestJS workspace and use npm/Node only. Offline Python acquisition and curation run through `tools/panda-data` or bounded scripts under `scripts/curation`.

## Local processes and memory

To find any PandaAtlas node/workerd process still running (an earlier session's dev server, a leftover workerd), with its ports, start time and memory, run:

```powershell
npm run ops -- run dev.processes
```

Reuse or stop what it lists deliberately before starting another runtime; a stale dev server can hold more than a gigabyte. Builds need no `NODE_OPTIONS` heap override: `npm run build:cloudflare` peaks at about 1.5 GB in one process, below Node's default limit, and caps at or under 1.5 GB have caused heap out-of-memory failures.

`web.dev`, `api.dev`, and the `foundation.*` commands remain available when a task needs individual local runtime layers.

## Verification

V2 backend checks:

```powershell
npm run typecheck:v2
npm run test:v2
npm run lint:v2
npm run check:architecture:v2
npm run build:v2
```

Database-backed API integration uses the same Development Operations catalog as the local foundation:

```powershell
npm run infra:start
npm run ops -- run api.integration
npm run ops -- run api.db-types
npm run infra:stop
```

`npm run ops -- run api.contract` regenerates the Nest OpenAPI document and generated TypeScript client, then fails if either generated output changed from its pre-check contents. A failing check leaves the regenerated files in place for review.

`api.db-types` runs the existing Kysely generator and `scripts/development/dump-db-schema.mjs` against the pinned local Supabase database and applies the same drift rule to `database.*.generated.ts` and `infra/supabase/schema.current.sql` outputs.

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

CI runs the same planner: a pull request verifies the scopes it changed (`--base origin/main`), and every push to `main` verifies all scopes (`--all`), and runs the API integration suite against local Supabase; a push to `main` that touches the Web, API, API client or root manifests also repeats the Cloudflare deployability build with the browser suites. A merge result is therefore verified as a whole, and runs on `main` are never cancelled by a later push.

Every `verify:dev` run checks repository hygiene, and every run that executes scopes also checks documentation references. That check imports the workspace `ignore` package, so the planner asks CI to install root dependencies whenever any scope runs, including a Python-only change such as `tools/panda-data`. A change to Markdown or a `.gitignore` selects the `release` scope so it is checked too. In committed Markdown, a link, image or link definition, or an inline path that starts with a tracked top-level directory, must point at an existing file (paths the tracked `.gitignore` files ignore, `.agents/` playbooks and ADR inline paths excepted). Run them alone with:

```powershell
npm run check:repository-hygiene
npm run check:doc-references
```

Bounded batch work uses `contracts/batch-operations.v1.json` and the `batch-operations.yml` workflow:

```powershell
npm run batch:plan -- --operation curation.validate --json
npm run check:batch-workflow-interface
```

## Production ownership

[Deployment runtime status](deployment/runtime-status.md) owns the production topology; [Production release and rollback](runbooks/production-release.md) owns releases.

## Local state

Hidden local state needs an owner and a lifecycle. Treat ignored directories as one of these categories:

- **Repository assets** such as `.agents/` and `.github/` are tracked source and follow normal review.
- **Generated state** such as `.next*`, `.vinext/`, `.cloudflare/`, `apps/web/dist/`, `.wrangler/`, `.pytest_cache/`, `.ruff_cache/`, `.release-gate/`, and local virtual environments is disposable. Keep it only while the command or investigation that produced it is active; remove stale copies instead of naming new historical variants.
- **Tool-local state** such as Supabase link metadata, `.devspace-local/`, `.claude/`, and Impeccable local context may stay only while the corresponding tool still uses it. Keep the minimum current config/state; logs, screenshots, backups, retired deployment links, and retired runtimes are not durable project records.
- **Acquisition working state** lives only under the root `.acquisition/` seam owned by `tools/panda-data`. Adapter runs write `.acquisition/bundles/`; do not use `.acquisition/` as a general scratch directory or recreate it under another runtime.
- **Scratch state** such as `.codex-temp/` is task-local. Durable evidence belongs in an existing governed data/evidence location or an external backup; credentials and secret-bearing screenshots/JSON do not belong in repository-local scratch.

Before finishing a task, remove scratch and generated state that no active next step consumes. Prefer deleting obsolete local paths over adding another ignore, compatibility path, cleanup wrapper, or retention mechanism.
