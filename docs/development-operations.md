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

Issue-to-PR delivery is governed by `contracts/delivery-workflow.v1.json`. Validate the current Issue-linked branch and isolated worktree with:

```bash
npm run check:delivery-contract
```

CI uses `npm run check:delivery-contract:repository` for the static contract, templates, and read-only workflow. The pull-request workflow separately validates the real PR body, open Issue state, and duplicate open deliveries. See [`docs/development-delivery.md`](development-delivery.md).

Repository shape has a machine-readable contract at `contracts/repository-structure.v1.json`. It validates allowed top-level zones, the exact npm workspace list, application and service package names, boundary documents, runtime-status markers, and selected local documentation links. Run it directly with:

```bash
npm run check:repository-structure
```

The active npm workspaces are `apps/web` and `services/worker-api`. `services/api` is a Python service and must not become an npm workspace. New top-level zones or application/service package manifests require an explicit contract and boundary-document update.

Before selecting scopes, `verify.dev` runs the repository hygiene check. The check rejects tracked or unignored generated output, dependency directories, Python package metadata, test reports, local platform state, and accidental copy-style filenames such as `middleware (1).ts`. Run it directly with:

```bash
npm run check:repository-hygiene
```

Root planning files (`task_plan.md`, `findings.md`, and `progress.md`) remain allowed because they are part of the repository working convention.

Research inputs have a separate policy check. New executable research logic must live in reusable modules under `scripts/research/`, while changing dates, subjects, sources, and operations belong in `data/research-batches/<batch-id>.json`. Round-specific or date-specific scripts are rejected outside `scripts/research/archive/`.

Run the policy directly with:

```bash
npm run check:research-script-policy
```

Research code under `scripts/research/`, JSON manifests under `data/research-batches/`, and changes to `contracts/research-batch.v1.json` select the `release` development scope, which runs the policy before the development-gate contract tests.

Bounded batch work uses the fixed operation catalog in `contracts/batch-operations.v1.json`. Produce a local dry-run plan with:

```bash
npm run batch:plan -- --operation research.validate --json
```

Validate the catalog and manual GitHub Actions workflow with:

```bash
npm run check:batch-workflow-interface
```

`batch:run` executes only code-allowlisted ready adapters. Planned operations, arbitrary commands, non-JSON or escaping manifest paths, and approval-gated execution without the `production-batch` environment fail closed. Generated plans and results stay under ignored `.batch-work/`.

The API scope begins with the FastAPI request-runtime and serverless closure checks. They follow imports reachable from `app.main`, validate the Vercel `index.py` re-export, and reject batch-only namespaces, executable script imports, dynamic imports, heavy optional dependencies, unclassified import roots, dependency-group drift, and forbidden closure files. Run them directly with:

```bash
npm run check:api-runtime-boundary
npm run check:api-serverless-closure
```

The resolved request closure can be inspected with `python services/api/scripts/check_request_runtime_boundary.py --json`.

Write the deterministic closure artifact under ignored release evidence with:

```bash
npm run build:api-serverless-closure
```

The artifact records request modules, package data, direct runtime dependencies, excluded optional groups, file sizes, and SHA-256 hashes. It does not deploy the API.

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
