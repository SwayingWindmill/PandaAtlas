# Development Operations

The repository exposes one canonical interface for routine development work:

```bash
npm run ops -- list
npm run ops -- describe verify.dev
npm run ops -- run web.dev
npm run ops -- run verify.dev --scope web
```

The Development Operations module lives in `scripts/development/`.

## Interface

`operations.mjs` supports three actions:

- `list` — show available commands, requirements, and side effects;
- `describe <id>` — show the exact executable command and metadata;
- `run <id> [...args]` — execute a catalog command and forward extra arguments.

Use `--json` with `list` or `describe` when another tool needs machine-readable output.

## Command catalog

`catalog.mjs` is the single source for routine development commands. Every command records:

- a stable command ID;
- category and description;
- executable and arguments;
- required local capabilities;
- expected side-effect class.

The same catalog supplies changed-scope development acceptance in `scripts/release/development.mjs`. CI planning and local execution therefore cross the same interface instead of maintaining separate command lists.

Before selecting scopes, `verify.dev` runs the repository hygiene check. The check rejects tracked or unignored generated output, dependency directories, Python package metadata, test reports, local platform state, and accidental copy-style filenames such as `middleware (1).ts`. Run it directly with:

```bash
npm run check:repository-hygiene
```

Root planning files (`task_plan.md`, `findings.md`, and `progress.md`) remain allowed because they are part of the repository working convention.

## Compatibility adapters

Existing root scripts such as `npm run dev:web`, `npm run verify:dev`, and `npm run infra:status` remain available. They are compatibility adapters that delegate to Development Operations.

New documentation and automation should prefer the canonical interface:

```bash
npm run ops -- run <command-id>
```

Do not add another root script for routine development work when the command belongs in the catalog. Add a catalog entry and, only when existing automation requires it, a compatibility adapter.

## Scope verification

The development acceptance scopes remain:

- `release`
- `web`
- `worker`
- `api`
- `curation`
- `data`

Inspect the selected plan without executing it:

```bash
npm run ops -- run verify.plan
npm run ops -- run verify.plan --base master
```

Run selected scopes explicitly:

```bash
npm run ops -- run verify.dev --scope web --scope api
```

Release certification remains separate. Development Operations does not replace `release:default`, `release:map-close`, or `release:extended`.
