# NestJS V2 monorepo layout, package boundaries, and build tooling

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #320 `Define the V2 monorepo layout, package boundaries, and build tooling`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

What repository layout and workspace tooling should PandaAtlas V2 use for `apps/web`, `services/api`, generated API clients, shared configuration, contracts, Python tools, and infrastructure; which packages should exist; what must not be shared; and whether npm workspaces alone or additional orchestration such as Turborepo is justified?

## Decision summary

PandaAtlas V2 keeps the monorepo deliberately small:

```text
PandaAtlas/
├─ apps/
│  └─ web/                         Next.js application
├─ services/
│  └─ api/                         NestJS modular monolith
├─ packages/
│  └─ api-client/                  generated HTTP transport package only
├─ tools/
│  └─ panda-data/                  independent Python data runtime
├─ contracts/
│  ├─ http/
│  ├─ integration/
│  ├─ pipeline/
│  └─ fixtures/
├─ infra/
│  └─ supabase/
├─ docs/
├─ .github/workflows/
├─ tsconfig.base.json
├─ eslint.config.mjs
├─ dependency-cruiser.config.mjs
├─ package.json
└─ package-lock.json
```

Core decisions:

1. Use **npm workspaces only** for JavaScript/TypeScript workspaces.
2. Do **not** add Turborepo, Nx, Lerna, Changesets, pnpm migration, or another orchestration layer until measured build/CI duplication creates a concrete problem.
3. Define the npm workspaces explicitly rather than with broad wildcards:

```json
{
  "workspaces": [
    "packages/api-client",
    "apps/web",
    "services/api"
  ]
}
```

4. `tools/panda-data` is a Python project managed by `uv`, not an npm workspace.
5. The only initial shared runtime/package boundary is `packages/api-client`. Do not create generic `shared`, `types`, `utils`, `domain`, `config`, `eslint-config`, `tsconfig`, or `ui` packages pre-emptively.
6. Shared TypeScript compiler/lint defaults are plain root config files, not publishable packages.
7. `services/api` uses a conventional NestJS build with the TypeScript compiler; SWC is used for Vitest only. Do not add a second production compiler pipeline merely for build speed.
8. The generated API client is private and source-based inside the monorepo; it is not published to npm and does not need a separate bundler.
9. Root scripts are a small convenience surface over workspace scripts. Do not rebuild the current V1 `operations.mjs` / dozens-of-gates command layer.
10. Build commands do only build work. Architecture/security/test gates are explicit commands and CI jobs, not hidden `prebuild`/`postbuild` chains.
11. CI is **risk-scoped rather than maximalist**: fast API/Web checks run only for relevant changes; DB integration runs for DB/persistence-affecting changes and on main/staging promotion; full browser/deployment evidence is a staging/release concern, not every PR.
12. Avoid meaningless defensive programming and test duplication. Validate at trust boundaries, enforce actual invariants once, rely on type/database constraints where appropriate, and do not add fallback/retry/check layers without a demonstrated failure mode.

---

# 1. Why npm workspaces are sufficient

The repository will initially contain only three JavaScript/TypeScript workspaces:

```text
packages/api-client
apps/web
services/api
```

npm workspaces already provide the required capabilities:

- one lockfile;
- local package linking;
- workspace-scoped installs;
- workspace-scoped scripts;
- running a script over all workspaces;
- standard package resolution that Vercel understands.

There is no current requirement for:

- remote build caching;
- a large cross-package task DAG;
- dozens of independently buildable packages;
- publish/version orchestration;
- affected-project graph computation beyond simple Git path filtering.

Therefore Turborepo/Nx would currently add configuration, cache semantics and another debugging layer without solving a measured PandaAtlas problem.

This is an explicit simplicity decision, not a prohibition forever.

Revisit an orchestrator only after build/CI evidence shows that repeated workspace builds materially waste developer/CI time and npm workspace scripts are genuinely insufficient.

Do not add Turborepo merely because Vercel owns it or because it is common in monorepo templates.

---

# 2. Keep npm; do not migrate package managers as architecture work

The repository already uses npm and has one root `package-lock.json`.

V2 keeps npm.

Do not migrate to pnpm/yarn solely for fashion or theoretical install savings during the Nest migration.

Package-manager migration may be considered later as independent maintenance if there is measured benefit.

The root continues to declare a pinned package manager version and Node 24 baseline. The exact npm maintenance version may be updated normally, but package-manager churn is not a V2 architecture dependency.

---

# 3. Exact workspace list, not broad wildcard packages

Use explicit workspaces:

```text
packages/api-client
apps/web
services/api
```

Do not use:

```text
apps/*
services/*
packages/*
```

as the target baseline.

Reasons:

- `services/worker-api` must not accidentally remain part of the workspace graph;
- adding a new package is an architectural action worth making explicit;
- it discourages package proliferation;
- it keeps root install/build behavior predictable.

A future real package can be added explicitly in one reviewed line.

---

# 4. Target repository shape

```text
PandaAtlas/
├─ apps/
│  └─ web/
│     ├─ app/
│     ├─ components/
│     ├─ features/
│     ├─ foundation/
│     ├─ lib/
│     ├─ tests/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ eslint.config.mjs
│     ├─ next.config.ts
│     ├─ playwright.config.ts
│     └─ vercel.json                 only if actually required
│
├─ services/
│  └─ api/
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ app.module.ts
│     │  ├─ platform/
│     │  │  ├─ config/
│     │  │  ├─ database/
│     │  │  ├─ http/
│     │  │  ├─ request-context/
│     │  │  ├─ auth/
│     │  │  ├─ observability/
│     │  │  ├─ outbox/
│     │  │  └─ storage/
│     │  └─ modules/
│     │     ├─ evidence/
│     │     ├─ panda/
│     │     ├─ lineage/
│     │     ├─ places/
│     │     ├─ life-history/
│     │     ├─ media/
│     │     ├─ contribution/
│     │     ├─ review/
│     │     ├─ moderation/
│     │     ├─ curation/
│     │     ├─ publication/
│     │     ├─ identity/
│     │     ├─ engagement/
│     │     ├─ game/
│     │     ├─ updates/
│     │     ├─ notification/
│     │     ├─ privacy/
│     │     └─ audit/
│     ├─ test/
│     │  ├─ integration/
│     │  ├─ e2e/
│     │  └─ fixtures/
│     ├─ scripts/
│     │  ├─ generate-openapi.ts
│     │  ├─ generate-db-types.ts
│     │  └─ check-architecture.ts
│     ├─ architecture.config.json
│     ├─ package.json
│     ├─ nest-cli.json
│     ├─ tsconfig.json
│     ├─ tsconfig.build.json
│     ├─ vitest.config.ts
│     └─ vercel.json                 only deployment settings actually needed
│
├─ packages/
│  └─ api-client/
│     ├─ src/
│     │  ├─ generated/
│     │  │  └─ schema.d.ts
│     │  ├─ client.ts
│     │  └─ index.ts
│     ├─ package.json
│     └─ tsconfig.json
│
├─ tools/
│  └─ panda-data/
│     ├─ pyproject.toml
│     ├─ uv.lock
│     ├─ src/panda_data/
│     └─ tests/
│
├─ contracts/
│  ├─ http/openapi.v2.json
│  ├─ integration/
│  ├─ pipeline/
│  └─ fixtures/
│
├─ infra/
│  └─ supabase/
│     ├─ config.toml
│     └─ migrations/
│
├─ docs/
├─ .github/workflows/
├─ tsconfig.base.json
├─ eslint.config.mjs
├─ dependency-cruiser.config.mjs
├─ package.json
└─ package-lock.json
```

This is a target shape, not a mandate to create every empty directory before the relevant code exists.

**Do not create placeholder folders just to make the tree look complete.** A module creates a subdirectory when that layer actually has code.

---

# 5. Nest business-module shape remains capability-first

A mature module may look like:

```text
modules/panda/
├─ domain/
├─ application/
├─ infrastructure/
├─ http/
└─ panda.module.ts
```

But do not force all four folders when a small module does not yet need all four.

Examples:

- a module with no HTTP endpoint does not need an empty `http/`;
- a module with no external adapter does not need an empty provider folder;
- a single use case does not need `commands/handlers/services/facades/use-cases` nested abstractions simultaneously.

The layer boundary matters; decorative folder depth does not.

---

# 6. No generic shared business package

Do not create:

```text
packages/shared
packages/common
packages/utils
packages/domain
packages/models
packages/types
services/api/src/common
services/api/src/shared
services/api/src/utils
```

as escape hatches.

Shared business meaning stays owned by a business module and is consumed through its narrow public port.

If two modules need the same small pure helper, first ask whether it is actually business meaning owned by one module. If it is truly technical/pure and stable, place it under the relevant platform capability or duplicate a trivial implementation rather than prematurely creating a cross-domain dependency package.

A three-line helper is not a reason to create a package.

---

# 7. No shared domain types between Nest and Next

The Web does not import:

```text
services/api/src/modules/**/domain
services/api/src/modules/**/application
services/api/src/modules/**/http/*.dto.ts
```

The API does not import Web types/components.

The transport boundary is:

```text
Nest controllers/DTOs
        ↓
OpenAPI 3.1 generated artifact
        ↓
packages/api-client
        ↓
apps/web
```

Frontend ViewModels remain in `apps/web`.

This prevents monorepo convenience from collapsing the HTTP boundary into direct source imports.

---

# 8. The one initial shared npm package: `@zhipanda/api-client`

`packages/api-client` exists because it represents a real contract boundary, not because monorepos should have a `packages/` folder.

It owns:

- generated OpenAPI TypeScript transport types;
- the tiny `openapi-fetch` client construction layer;
- shared transport-level helpers that are strictly part of calling `/api/v2`.

It does not own:

- frontend ViewModels;
- React hooks/components;
- business/domain models;
- Nest DTO classes;
- database types;
- auth business policy;
- UI error copy.

Conceptually:

```text
packages/api-client/src/generated/schema.d.ts   generated
packages/api-client/src/client.ts               tiny hand-authored wrapper
packages/api-client/src/index.ts                explicit exports
```

The package is private and not published.

---

# 9. Keep `api-client` source-based; no bundler initially

Do not add `tsup`, Rollup, esbuild package builds or npm publishing for the private API client.

The package is tiny and consumed by the Next workspace in the same repository.

Next may transpile the local workspace package directly as needed.

If a later independent Node/browser consumer genuinely requires compiled artifacts, add a normal TypeScript package build then.

Do not pay the complexity cost before there is a consumer.

---

# 10. Contracts are files, not another runtime package

`contracts/` remains language-independent data/contracts.

It has no `package.json` just to become importable.

Target grouping:

```text
contracts/http/
  openapi.v2.json

contracts/integration/
  publication.release-activated.v1.schema.json
  ...

contracts/pipeline/
  acquisition-bundle.v2.schema.json
  identity-resolution-result.v1.schema.json
  ...

contracts/fixtures/
  ...
```

Python and TypeScript tools load these files explicitly.

Do not create `@zhipanda/contracts` whose exports obscure which files are canonical versus generated.

---

# 11. OpenAPI artifact authority

The only canonical checked HTTP artifact is:

```text
contracts/http/openapi.v2.json
```

It is generated from Nest controllers/DTOs under #313.

Do not retain:

```text
services/api/openapi/*.yaml
per-module YAML fragments
public-api-v1 field checklist replicas
```

as V2 HTTP authority.

The API client generator reads the one canonical JSON artifact.

---

# 12. Generated DB types remain inside the API service

The full generated Kysely physical database type is infrastructure detail:

```text
services/api/src/platform/database/generated/database.ts
```

It is not a root package and not exported to Web/Python/business modules.

Module infrastructure narrows the owned table types as needed.

Do not create:

```text
packages/database-types
packages/postgres-schema
```

because that would encourage cross-module physical-storage coupling.

---

# 13. Python is an independent tool project

`tools/panda-data` is not included in npm workspaces.

It has its own:

```text
pyproject.toml
uv.lock
src/panda_data
```

Commands are run with `uv` directly, for example conceptually:

```text
uv run --directory tools/panda-data panda-data ...
```

Do not build a Node wrapper that shells into every Python command simply to make everything look like `npm run`.

GitHub Actions may invoke npm and uv in separate steps.

---

# 14. Root TypeScript config is a file, not a package

Use:

```text
tsconfig.base.json
```

for only broadly safe common compiler rules, for example:

```text
strict
forceConsistentCasingInFileNames
noUncheckedIndexedAccess
useUnknownInCatchVariables
```

Do not force one module-resolution/compiler profile on both Nest and Next.

`services/api/tsconfig.json` adds:

```text
module = NodeNext
moduleResolution = NodeNext
experimentalDecorators
emitDecoratorMetadata
```

`apps/web/tsconfig.json` keeps the Next-appropriate settings.

No `packages/tsconfig` is needed for two TypeScript applications and one tiny client package.

---

# 15. ESLint config is also not a package

Keep a root common flat config file:

```text
eslint.config.mjs
```

Workspace-local configs may import/extend it where framework-specific rules differ.

Examples:

- Web owns Next/React/design rules;
- API owns Nest/layer/import rules;
- root owns simple general TypeScript/repository rules.

Do not create `packages/eslint-config` unless multiple independently versioned repositories/packages later need to consume it.

---

# 16. No generic config package

Do not create:

```text
packages/config
```

for environment/runtime configuration.

Runtime config belongs to each deployment unit:

```text
apps/web
services/api
tools/panda-data
```

because each has different secrets, validation and runtime semantics.

Shared values that are genuine public constants should be duplicated or placed in the appropriate contract, not injected through a magical common config package.

---

# 17. Do not create a shared UI package yet

Only `apps/web` renders the product UI.

Therefore there is no `packages/ui` in the baseline.

A UI package becomes justified only if another real application must consume the same component system.

Splitting one app's own components into a package today would add import/package/build indirection without adding a boundary.

---

# 18. API production build uses Nest CLI + TypeScript compiler

Use the conventional Nest compiler path initially:

```text
nest build
```

with TypeScript semantics/typechecking handled normally.

Use the `@nestjs/swagger` CLI plugin through standard Nest compiler configuration.

Do not use SWC for the production API build initially.

Why:

- the API is not currently large enough for compiler speed to be a material problem;
- standard TypeScript/Nest plugin behavior is simpler;
- #313 OpenAPI metadata generation is straightforward;
- it avoids another compiler/plugin configuration path.

SWC remains selected for Vitest execution under #319, where its speed is useful and typechecking is separately handled by `tsc --noEmit`.

If production API build time later becomes material, switch compilers based on measurement.

---

# 19. No TypeScript project references initially

Do not introduce `composite`, project-reference graphs and `tsc -b` solely because the repository is a monorepo.

Each workspace typechecks independently:

```text
apps/web        tsc --noEmit / Next tooling
services/api    tsc --noEmit
api-client      tsc --noEmit
```

The dependency graph is tiny.

Add project references only if incremental cross-package TypeScript build performance later demonstrates value.

---

# 20. Root package scripts stay small

The target root `package.json` should look conceptually like:

```json
{
  "private": true,
  "workspaces": [
    "packages/api-client",
    "apps/web",
    "services/api"
  ],
  "scripts": {
    "dev:web": "npm run dev -w @zhipanda/web",
    "dev:api": "npm run dev -w @zhipanda/api",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  }
}
```

The exact final script names can vary slightly, but this is the intended scale.

Do not preserve the current root's huge list of domain-specific `check:*`, `gate:*`, `drill:*`, D1 and Python commands.

Workspace-specific commands live in their owning workspace.

Operational workflows belong in GitHub Actions/Nest/Python CLIs, not root npm aliases for every action.

---

# 21. Do not recreate `operations.mjs`

The current root routes many normal commands through:

```text
node scripts/development/operations.mjs run ...
```

V2 should not create an equivalent “command router” abstraction for ordinary build/lint/test/dev operations.

Prefer:

```text
npm run dev -w @zhipanda/api
npm run typecheck -w @zhipanda/api
npm run test -w @zhipanda/api
```

A custom orchestration script is justified only when it performs real domain/release work that cannot be expressed clearly by a standard tool invocation.

Avoid wrapping standard commands merely to centralize command names.

---

# 22. Workspace scripts should be explicit and boring

Conceptual `services/api/package.json` scripts:

```text
dev
build
start
typecheck
lint
test
test:integration
test:e2e
check:architecture
generate:openapi
generate:db-types
```

Conceptual `packages/api-client/package.json` scripts:

```text
typecheck
generate
check:generated
```

Conceptual Web scripts keep:

```text
dev
build
start
lint
typecheck
smoke
test:accessibility
```

Do not create five aliases for the same test command or “preflight/strict/full/extended” variants without a concrete different use case.

---

# 23. No hidden npm lifecycle gates

Avoid patterns such as:

```text
prebuild -> 3 guards -> build
predeploy -> same guards -> deploy
prepreview -> same guards -> preview
```

as the target architecture.

Build should build.

Test should test.

Deploy workflow should explicitly run the required checks before deployment.

This makes local behavior predictable and prevents the same expensive guard from being invoked repeatedly through nested npm lifecycle hooks.

A rare small lifecycle hook is acceptable where npm semantics genuinely require it, but it is not the default governance mechanism.

---

# 24. Architecture checks are consolidated, not multiplied

#319 selected three mechanisms because they cover different classes of problems:

```text
ESLint
+ dependency-cruiser
+ small V2 semantic/storage checker
```

They should appear to developers as one API architecture command:

```text
npm run check:architecture -w @zhipanda/api
```

The implementation may call dependency-cruiser plus the small checker.

Do not expose twenty independent “architecture micro-gates” for every rule.

ESLint remains its own normal lint command because it also covers code quality.

---

# 25. V2 architecture contract is narrow

Create one machine-readable API architecture config, conceptually:

```text
services/api/architecture.config.json
```

It contains only architecture facts needed for enforcement:

- 18 module names;
- allowed synchronous module edges;
- explicit module public import surfaces where required;
- PostgreSQL schema ownership;
- narrowly approved platform integration targets;
- forbidden legacy dependencies/paths.

Do **not** create a V2 equivalent of the V1 repository-structure contract that enumerates every allowed top-level filename/directory.

The architecture gate should prevent invalid dependencies and authority violations, not police harmless repository organization details.

---

# 26. Repository layout is guidance, not ceremonial validation

The target tree documented here is the architecture.

CI does not need to fail because someone adds a harmless root Markdown document or a new docs subdirectory.

CI should fail when code does something architecturally dangerous, such as:

- Web imports API server source directly;
- a module imports another module's repository;
- a module writes another module's schema;
- application imports Nest/provider code;
- Worker/D1 compatibility comes back into V2 runtime.

This distinction is intentional.

---

# 27. Defensive-programming budget

V2 implementation follows this rule:

> Add a defensive check only at a real trust boundary, invariant boundary, concurrency boundary, or failure-prone external boundary. Do not duplicate guarantees already provided reliably by TypeScript, validated DTO/config, database constraints, or an owning module.

Examples of worthwhile defense:

- validate untrusted HTTP input once at the HTTP boundary;
- verify JWT cryptographically;
- validate environment config once at startup;
- enforce DB uniqueness/FK/check constraints;
- use optimistic locking/idempotency for concurrent commands;
- bound external/network/database timeouts;
- classify provider failures at infrastructure adapters;
- validate cross-runtime JSON Schema at the contract boundary.

Examples to avoid:

```text
if (!value) checks after a non-null typed/validated boundary with no alternate source
try/catch that only logs then rethrows unchanged
exists query before INSERT when a unique constraint + conflict mapping is correct
double DTO validation in controller and application for the same syntax rule
default/fallback secrets in production
fallback to old Worker/D1/FastAPI when Nest/Supabase fails
retry loops around non-idempotent commands
multiple wrappers around one provider client “just in case”
generic Result<T,E> around every internal function when exceptions/domain outcomes are clearer
```

Defensive code must have a named failure mode it prevents.

---

# 28. Retry policy is narrow

Do not add generic retry decorators/middleware to all repositories or provider calls.

Retries belong only where:

- failure is transient;
- the operation is replay-safe/idempotent;
- retry ownership is clear;
- attempts are bounded.

Examples:

- queue worker remote delivery with durable attempt state;
- selected transaction serialization/deadlock retries when command replay is safe;
- approved transient provider call.

Ordinary API application commands do not receive invisible broad retries.

---

# 29. No fallback architecture

V2 does not include runtime fallback logic to:

```text
FastAPI
Worker/D1
static trusted dataset
mock database
old generated release files
```

when the new authority is unavailable.

Failures should be explicit and observable rather than silently switching authorities.

This avoids the largest class of “defensive programming” that would recreate the old architecture permanently.

---

# 30. Test budget: test each risk at the cheapest sufficient layer

The #319 test stack is implemented with a **test-pyramid budget**, not “test everything everywhere”.

Rule:

> A behavior should normally have one primary test at the cheapest layer that proves it, plus a higher-level journey only when integration itself is the risk.

Examples:

- Panda domain invariant -> domain unit test, not repeated in HTTP + E2E + Playwright;
- application orchestration -> application test;
- SQL constraint/PostGIS/PGMQ -> DB integration test;
- DTO/Guard/Problem Details -> Fastify inject test;
- end-to-end publication flow -> small API E2E;
- browser navigation/accessibility -> Playwright.

Do not mechanically duplicate the same assertion across every layer.

---

# 31. No blanket test generation

Do not require:

- one spec file per class;
- tests for trivial Nest module metadata;
- tests for constructors/getters with no logic;
- snapshot tests for stable JSON merely because snapshots are easy;
- mocks verifying implementation call counts when observable behavior is sufficient;
- E2E tests for every validation error already covered by DTO/HTTP tests;
- browser tests for every API error path.

Tests exist to protect behavior/invariants and integration boundaries, not to satisfy file symmetry.

---

# 32. Coverage remains a coarse guard, not a per-file bureaucracy

#319's initial domain/application 80% line/branch floor remains.

Implement it as one coarse scope for meaningful domain/application code.

Do not add:

- per-file 80% thresholds;
- per-module thresholds;
- 100% targets;
- mutation testing as a default gate;
- separate coverage gates for generated/infrastructure/bootstrap files.

A critical invariant with a direct test matters more than achieving another percentage point.

---

# 33. PR CI is risk-scoped

Do not run the full production release suite for every change.

Use ordinary GitHub Actions path filters and a few understandable jobs.

### Web/API-client PR change

Run:

```text
npm ci
Web/API-client lint/typecheck
Next build when Web runtime code changed
critical Playwright subset when user-facing journey changed
```

Do not run every historical browser matrix/release drill.

### API code change

Run the fast API gate:

```text
lint
typecheck
check:architecture
unit/application/module tests
Fastify contract tests
OpenAPI/client drift when HTTP contract can change
```

### DB/persistence migration change

Additionally run:

```text
clean migration replay
DB type drift
repository/PostGIS/PGMQ integration tests
```

### Contract/pipeline schema change

Run only the relevant strict schema/fixture generation checks.

No custom “AI impact analyzer” or complex affected-graph engine is required for the baseline. Simple path filters are understandable and sufficient.

---

# 34. Full suite belongs at main/staging/promotion boundaries

A broader integration suite should run when the evidence is valuable:

- merge/push to the main integration branch;
- stable staging deployment;
- production release candidate;
- migration/cutover rehearsal.

This is where full DB integration, managed staging smoke, focused load evidence and critical browser journeys belong.

Do not impose managed staging/network tests on every developer PR.

---

# 35. No redundant contract gates

One contract should have one canonical validator/generator path.

Examples:

```text
HTTP       Nest -> OpenAPI -> api-client drift
Pipeline   JSON Schema Draft 2020-12 -> Python + Ajv strict validation
DB         SQL migrations -> generated Kysely types
Architecture config -> dependency/storage checker
```

Do not create separate independent scripts that re-encode the same field list or schema expectations.

This directly retires the V1 pattern where OpenAPI plus `public-api-v1.json` plus fragment YAML/checklists repeatedly represented similar contract facts.

---

# 36. Package dependency rules

Allowed workspace edges:

```text
apps/web
  -> packages/api-client

services/api
  -> no workspace business dependency

packages/api-client
  -> no Web/API source dependency
```

Disallowed:

```text
apps/web -> services/api/src
services/api -> apps/web
services/api -> packages/api-client
api-client -> services/api/src
api-client -> apps/web
```

The API does not consume its own generated HTTP client internally.

Cross-module collaboration inside Nest occurs through module application ports, not npm packages.

---

# 37. Keep packages private

All three workspaces remain private/unpublished.

There is no need for:

- Changesets;
- independent semantic versions;
- npm publishing tokens;
- package release workflows;
- internal registry.

The repository commit/deployment identifies the compatible set.

The generated OpenAPI artifact has its own contract/version semantics where required.

---

# 38. Vercel project roots remain independent

From #318:

```text
Web Vercel project
  Root Directory = apps/web

Production API Vercel project
  Root Directory = services/api

Staging API Vercel project
  Root Directory = services/api
```

This works with one npm monorepo; each Vercel project remains independently deployable with its own env/secrets/region/rollback.

Do not merge Web + API into one deployment merely because they share a repository.

---

# 39. Vercel config is minimal

Do not recreate the FastAPI serverless-closure/exclude-files machinery.

`services/api/vercel.json` exists only if required for real deployment settings such as:

- Cron definitions;
- explicit function region/duration settings not better owned by project settings.

Do not add:

- custom handler rewrites for Nest;
- source-closure manifests;
- giant exclude lists;
- alternate Vercel entrypoints.

Conventional Nest detection remains the baseline.

---

# 40. Web Cloudflare runtime files are retirement targets

Once Vercel Web cutover is complete under #321, retire Web-only Cloudflare deployment artifacts that no longer serve a real purpose, including as applicable:

```text
open-next.config.ts
wrangler*.jsonc
cloudflare/ worker glue
@opennextjs/cloudflare
Cloudflare Web deploy scripts
```

Cloudflare remains DNS/R2, but the Next application should not keep OpenNext deployment machinery after its rollback window solely for compatibility.

---

# 41. Worker API workspace disappears

Delete:

```text
services/worker-api
```

from both the repository and npm workspace graph after #321 cutover/rollback conditions are met.

No replacement `worker-api-v2` package exists.

PGMQ pumps are Nest worker endpoints/use cases inside the API deployment, not another server package.

---

# 42. FastAPI service path is replaced in place

The long-term service path remains:

```text
services/api
```

but its contents are rebuilt as Node/Nest.

This is a path/name continuity convenience, not architectural compatibility.

Target deletes:

```text
services/api/app
services/api/index.py
services/api/pyproject.toml
services/api/uv.lock
FastAPI openapi YAML
FastAPI serverless closure scripts
Python API tests
```

Python data code moves by responsibility to `tools/panda-data`.

Do not create `services/api-v2` permanently beside FastAPI just to avoid replacing the old tree. Temporary worktree/branch migration mechanics are #321 implementation details.

---

# 43. Root `scripts/` is aggressively simplified

The current root `scripts/` contains many V1 release, D1, Cloudflare, curation and development orchestration utilities.

Target rule:

> A script stays at repository root only if it truly coordinates multiple top-level owners and is simpler as a script than as a package/workflow command.

Otherwise:

- Web-specific -> `apps/web/scripts` or delete;
- API tooling -> `services/api/scripts`;
- Python/data -> `tools/panda-data` CLI;
- deployment/migration -> GitHub Actions/runbook plus owning tool;
- D1/Worker/OpenNext -> delete after retirement.

Do not move every existing script into a new directory just to preserve it.

---

# 44. GitHub Actions stays small and purpose-based

Target workflows should be a small set, conceptually:

```text
ci.yml                        PR/main code quality + scoped integration
staging-acceptance.yml        managed staging verification
migrate-database.yml          protected DB migrations
panda-data.yml                bounded/manual/scheduled Python data jobs
```

Vercel itself handles normal Web/API Git deployment through project integration.

Do not create one workflow per micro-gate.

A workflow can have separate jobs where credentials/environment requirements differ.

---

# 45. No “gate for the gate” layering

Every CI guard must answer a concrete question.

Examples:

```text
typecheck          Does TypeScript compile semantically?
lint               Are source-level rules violated?
architecture       Is the module/storage dependency graph illegal?
unit test          Did business behavior regress?
DB integration     Does real PostgreSQL/PostGIS/PGMQ behavior hold?
OpenAPI drift      Did transport code and generated contract diverge?
staging acceptance Does the managed platform actually work?
```

Avoid guards whose only purpose is to verify that another guard's config file appears in an approved directory.

The checker itself receives focused unit fixtures, but the repository does not recursively govern governance metadata.

---

# 46. Generated files are deterministic but generation is explicit

Generated artifacts include:

```text
contracts/http/openapi.v2.json
packages/api-client/src/generated/schema.d.ts
services/api/src/platform/database/generated/database.ts
```

Developer changes the source and explicitly regenerates the derived artifact.

CI regenerates/checks and fails on drift.

Do not auto-modify the working tree during `npm install`, `build`, or ordinary test execution.

No postinstall code generation.

---

# 47. `postinstall` should remain empty unless a library requires it

PandaAtlas itself should not depend on custom `postinstall` scripts for:

- codegen;
- migrations;
- environment bootstrap;
- browser downloads;
- architecture checks.

Install should install dependencies.

This makes Vercel/CI/local behavior easier to reproduce and avoids hidden side effects.

---

# 48. Dependency versions

Use normal package manifests and one lockfile.

Do not introduce a custom dependency catalog/version-sync package initially.

When Web/API both use the same dependency (for example TypeScript or ESLint), they may use compatible explicit versions and routine dependency tooling can keep them aligned.

A small amount of repeated version text is cheaper than another configuration abstraction.

---

# 49. Web dependency upgrades are separate from Nest migration architecture

The current Web dependencies may need ordinary upgrades/security maintenance, but #320 does not bundle a Next major-version migration into the backend architectural rebuild unless required for compatibility.

Avoid turning the Nest V2 effort into a simultaneous rewrite of every frontend tool.

Upgrade the Web based on security/support/product needs in focused changes.

---

# 50. Local development

Baseline developer workflow remains simple:

```text
npm ci
npm run dev:api
npm run dev:web
```

and separately when needed:

```text
supabase start ...
uv sync / uv run --directory tools/panda-data ...
```

Do not require running an orchestration daemon/Turborepo UI/custom task server to develop one app.

A developer should be able to enter a workspace and run its ordinary package scripts directly.

---

# 51. API test layout and commands

Fast unit/application specs live near source when that improves locality:

```text
src/modules/panda/domain/*.spec.ts
src/modules/panda/application/*.spec.ts
```

DB integration and cross-module E2E remain grouped:

```text
test/integration/
test/e2e/
```

Do not create separate packages for tests.

Do not create `test-utils` npm package unless both Web and API eventually share a real runtime-independent testing library; currently they do not.

---

# 52. Fixtures belong with the boundary they test

Use:

- module-local fixtures for pure domain/application tests;
- `services/api/test/fixtures` for API integration setup;
- `apps/web/tests/fixtures` for browser tests;
- `contracts/fixtures` for language-independent contract fixtures.

Do not create one giant global fixture/data folder that every layer reaches into.

Existing `data/` is migration/research inventory and its retention is classified in #321; it is not the V2 test-fixture architecture.

---

# 53. Data artifacts are not npm packages

Large crawler/research/release/media artifacts go to R2 or controlled data stores under #316/#317.

Do not turn `data/` into a package or bundle its content into Web/API builds.

Only intentionally small checked fixtures/reference data should remain in source control.

---

# 54. API package import aliases are conservative

Prefer short stable aliases only when they materially improve imports, for example:

```text
@api/platform/*
@api/modules/*
```

or equivalent.

Do not define one alias per module/layer/file family.

Relative imports within a module are acceptable and often clearer.

Cross-module access must still use explicit public surfaces; aliases cannot bypass dependency-cruiser rules.

---

# 55. Avoid barrel-file sprawl

Use an `index.ts` only as an intentional public surface.

Do not generate/re-export every file through nested barrels merely to shorten imports.

Benefits:

- dependency graph remains visible;
- accidental cross-module imports are harder;
- tree/tooling resolution is simpler;
- fewer circular dependencies.

---

# 56. Source organization follows behavior, not technical mega-layers

Do not create a repository-wide shape like:

```text
src/controllers
src/services
src/repositories
src/entities
```

The capability module remains the primary grouping:

```text
src/modules/panda/...
src/modules/publication/...
```

This preserves the #310 business architecture and prevents the monorepo layout from reverting to technical-layer organization.

---

# 57. Platform is not `shared`

`services/api/src/platform` contains concrete cross-cutting technical capabilities used by business modules:

```text
config
database
http
request-context
auth adapters
observability
outbox
R2/provider adapters
```

It is intentionally limited to infrastructure/platform concerns.

Do not put domain helpers/business models there simply because multiple modules use them.

---

# 58. Platform imports are also controlled

Not every module may directly import every platform implementation.

Examples:

- HTTP adapters may use platform HTTP/config/request context;
- infrastructure may use DB/R2/provider adapters;
- application gets framework-neutral ports/facades, not direct `pg`, `pino`, Sentry or AWS SDK access;
- domain remains platform-free.

The architecture checker enforces the broad layer rule; do not create per-file allowlists unless a concrete violation shows the need.

---

# 59. V2 config files should be few

Expected important TypeScript configs:

```text
tsconfig.base.json
eslint.config.mjs
dependency-cruiser.config.mjs
services/api/nest-cli.json
services/api/tsconfig.json
services/api/tsconfig.build.json
services/api/vitest.config.ts
apps/web/tsconfig.json
apps/web/eslint.config.mjs
apps/web/playwright.config.ts
packages/api-client/tsconfig.json
```

Do not add config packages or multiple nearly-identical environment-specific compiler configs unless a real tool requires them.

---

# 60. CI path filtering remains understandable

Prefer GitHub workflow path filters such as:

```text
apps/web/**
packages/api-client/**
services/api/**
contracts/**
infra/supabase/**
tools/panda-data/**
```

and a small number of conditions.

Do not build a custom codegraph/impact-analysis service as a prerequisite for ordinary CI.

If path rules become inaccurate as the repo grows, introduce a better affected graph then.

---

# 61. Minimal mandatory PR gate matrix

The V2 baseline should not require every gate on every PR.

| Change scope | Mandatory PR evidence |
| --- | --- |
| docs-only | no runtime test suite unless docs generate artifacts |
| API domain/application | API lint + typecheck + architecture + relevant Vitest |
| API HTTP | above + Fastify contract + OpenAPI/client drift |
| API persistence / SQL migration | above + clean migration replay + relevant DB/PostGIS/PGMQ integration |
| shared JSON Schema | Python + Ajv strict schema/fixtures only |
| API client | generated drift + typecheck + affected Web type/build check |
| Web runtime | Web lint/typecheck/build + critical journey tests as relevant |
| Python panda-data | Ruff/type/tests for affected Python scope + shared contract tests if touched |

Full managed staging acceptance is not a PR gate.

This table is guidance for workflow implementation, not a mandate to invent an automated perfect classifier.

---

# 62. Tests should not block unrelated work

A slow flaky map browser test should not gate a pure Panda domain refactor unless the dependency/change actually affects that journey.

A Python crawler integration should not gate an API DTO change.

A full Supabase reset should not gate a Markdown edit.

The solution is sensible scope ownership and promotion-stage evidence, not deleting important tests.

---

# 63. Maintain one “full verification” command only as optional convenience

It is acceptable to expose one local/CI convenience command such as:

```text
npm run verify
```

that runs the broad JavaScript workspace checks.

It is **not** the only supported workflow and is not automatically invoked by every build/install command.

The command must remain transparent and small enough that developers can see which workspace scripts it calls.

Do not rebuild a hidden 100-step release gate inside it.

---

# 64. Infrastructure migration tooling is not application build tooling

Supabase migrations remain under:

```text
infra/supabase/migrations
```

and use the Supabase/PostgreSQL CLI path.

Do not make `nest build` generate/apply migrations.

Do not make Vercel build run local Supabase.

Do not put migration code under `packages/api-client` or module source.

---

# 65. Build artifacts are untracked unless they are contracts

Do not commit:

```text
services/api/dist
apps/web/.next
coverage output
Playwright report output
node_modules
```

Tracked generated artifacts are limited to items that are intentionally reviewable contracts/source inputs, principally:

```text
contracts/http/openapi.v2.json
packages/api-client/src/generated/schema.d.ts
services/api/src/platform/database/generated/database.ts
```

Even these stay tracked only because drift/review value is deliberate.

---

# 66. Avoid generated-code tests that retest the generator

Do not unit-test every generated `api-client` interface.

Correctness evidence is:

```text
OpenAPI validity
openapi-typescript generation succeeds
generated file has no drift
consumer Web typecheck compiles
selected staging contract smoke
```

Writing hundreds of tests against generated type names would add maintenance without confidence.

---

# 67. Avoid database repository mocks as a parallel persistence implementation

Application tests can fake repository ports narrowly.

Do not create large in-memory repositories that attempt to reproduce every PostgreSQL constraint/query semantic for tests.

That becomes a second implementation and encourages defensive/test duplication.

Use small purpose-built fakes for application behavior and real Postgres for persistence semantics.

---

# 68. Avoid universal base classes

Do not add generic abstractions such as:

```text
BaseRepository
BaseService
BaseController
BaseEntity
BaseCommandHandler
BaseError
BaseWorker
```

unless a concrete repeated behavior genuinely benefits from one.

Nest DI and TypeScript interfaces already provide composition tools.

A handful of similar classes is cheaper than a premature inheritance framework.

---

# 69. Avoid defensive wrapper packages around libraries

Do not create wrapper packages around:

```text
Kysely
pg
Pino
jose
openapi-fetch
Fastify
```

merely to preserve the option to replace them later.

Use narrow adapters where there is an actual architectural boundary:

- domain/application ports around external side effects;
- DB platform provider to own Pool/Kysely lifecycle;
- logger/trace/error-reporting adapter to enforce redaction/context;
- R2 media/storage boundary.

Do not wrap stable library APIs just for hypothetical replacement.

---

# 70. Rejected: Turborepo

Not selected now.

It would add:

- `turbo.json`;
- task graph semantics;
- cache key/input/output rules;
- local/remote cache debugging;
- another tool to understand in CI/Vercel.

With three JS workspaces and almost no expensive shared build dependency, npm workspaces are enough.

A future switch is easy because workspace package boundaries are already standard npm packages.

---

# 71. Rejected: Nx

Not selected because its project graph/code-generation/task orchestration surface is far larger than PandaAtlas currently needs.

The repository already has clear product/runtime boundaries; a framework for managing dozens of projects would be premature.

---

# 72. Rejected: pnpm migration

Not selected as part of V2 architecture.

pnpm is a strong package manager, but the current npm workspaces/lockfile solve the actual need. Switching package manager while rebuilding the backend adds unrelated migration surface.

---

# 73. Rejected: config packages

Not selected:

```text
packages/eslint-config
packages/tsconfig
packages/config
```

Root config files plus local framework-specific config are simpler for the actual workspace count.

---

# 74. Rejected: `packages/types`

Transport types are generated in `api-client`.

Frontend ViewModels stay in Web.

Domain types stay in owning Nest modules.

Database types stay in API infrastructure.

Therefore a generic `packages/types` has no legitimate ownership.

---

# 75. Rejected: repo structure whitelist gate

Do not reproduce `contracts/repository-structure.v1.json` as a V2 root-file whitelist.

It is unnecessary to architecture correctness and encourages governance code that validates repository cosmetics rather than product/system safety.

Keep architecture rules focused on imports, storage authority, contracts and deployment boundaries.

---

# 76. Rejected: all-tests-on-every-PR

Do not run:

```text
full Web browser matrix
full disposable DB suite
all Python crawlers
managed staging smoke
load tests
recovery drills
```

for every PR regardless of scope.

These tests still exist where they protect real risks; they run at the relevant change/promotion boundary.

---

# 77. Rejected: defensive code as a blanket quality metric

More checks are not automatically better code.

Do not reward code for:

- repeated null checks that cannot trigger;
- nested fallback branches with no supported fallback;
- catch-all retries;
- preflight queries duplicating DB constraints;
- broad exception swallowing;
- “future-proof” interfaces with one implementation and no boundary value.

Prefer direct code whose assumptions are enforced at the nearest real boundary.

---

# 78. Existing V1 assets: disposition

### Retain conceptually

- one root monorepo;
- `apps/web`;
- `services/api` path;
- `contracts` as machine-readable boundary artifacts;
- `infra/supabase` as SQL migration authority;
- Playwright browser tests that protect actual product journeys;
- machine-enforced module/storage boundaries as a principle.

### Replace

- FastAPI content of `services/api` -> NestJS;
- V1 API dependency/storage Python checkers -> TypeScript dependency-cruiser/ESLint/small checker;
- manual OpenAPI YAML -> generated OpenAPI 3.1;
- hand-written Web transport types -> generated API client;
- Python data scripts mixed with API -> `tools/panda-data`.

### Delete after #321 conditions

- `services/worker-api`;
- D1/Worker scripts/config;
- OpenNext/Cloudflare Web deployment machinery;
- FastAPI ASGI/serverless closure machinery;
- V1 manual OpenAPI fragments/checklists;
- obsolete root gate/release scripts;
- repository structure whitelist governance that only exists for V1 layout.

---

# 79. Migration sequencing consequence

#321 can move toward the target without requiring a big-bang repository rename.

Important target facts are now fixed:

- `services/api` ultimately becomes Nest;
- `tools/panda-data` receives the surviving Python data capabilities;
- `packages/api-client` is introduced when V2 OpenAPI generation exists;
- `services/worker-api` is temporary and disappears;
- root npm workspaces ultimately contain exactly API client + Web + Nest API.

#321 decides the temporary branch/cutover mechanics.

---

# 80. External facts checked

Official/current documentation checked on 2026-08-26 confirms:

- npm workspaces automatically link local packages and support running scripts in one or all workspaces;
- npm workspace commands do not require an additional task orchestrator;
- Vercel supports multiple independent projects from one monorepo, each with its own Root Directory, URL and environment variables;
- therefore separate Web/API Vercel projects do not require Turborepo to preserve monorepo sharing.

References:

- https://docs.npmjs.com/cli/using-npm/workspaces/
- https://vercel.com/academy/production-monorepos/deploy-all-apps

---

# 81. Decisions deferred

- exact file-by-file deletion/move order while FastAPI and Worker still exist: #321;
- exact temporary coexistence strategy for old/new `services/api`: #321;
- final production branch/DNS/promotion/rollback sequence: #321;
- final consolidated architecture and implementation tickets: #322.

---

# Acceptance for #320

Later planning can assume all of the following without reopening this ticket:

- V2 uses npm workspaces only; Turborepo/Nx/Lerna/Changesets are not in the baseline;
- JavaScript workspaces are explicitly `packages/api-client`, `apps/web`, and `services/api` rather than wildcard workspace discovery;
- Python `tools/panda-data` is independent and managed by uv, not npm;
- only `packages/api-client` exists initially as a shared npm package;
- no generic `shared/types/utils/domain/config/ui/eslint-config/tsconfig` packages are created without a real additional consumer/boundary;
- Web never imports Nest source/DTOs/domain models directly; transport sharing happens only through generated OpenAPI/api-client;
- API client is private/source-based and initially needs no package bundler or publishing workflow;
- root `tsconfig.base.json`/`eslint.config.mjs` provide modest shared defaults while Nest/Next retain framework-specific configs;
- Nest production build uses standard Nest/TypeScript compiler initially; SWC is used for Vitest, not as a second production compiler path;
- no TypeScript project-reference graph is required initially;
- root npm scripts are small direct workspace conveniences and do not recreate `operations.mjs` or dozens of V1 gate aliases;
- build/install commands have no hidden codegen/migration/architecture side effects;
- the API architecture checker is narrow and enforces actual module/storage/framework boundaries rather than repository cosmetics;
- no V2 root-file/directory whitelist gate is introduced;
- CI is risk-scoped with simple path filtering; full DB/browser/staging/load/recovery evidence runs only where the changed risk or promotion stage justifies it;
- tests follow the cheapest-sufficient-layer rule and are not mechanically duplicated across unit/integration/E2E/browser layers;
- coverage remains one coarse domain/application floor rather than per-file/per-module bureaucracy;
- defensive checks exist only for real trust/invariant/concurrency/external failure boundaries; no blanket null checks, catch/log/rethrow, preflight queries duplicating DB constraints, broad retries or fallback runtimes;
- generated contract/type files are produced explicitly and CI checks drift; no postinstall/autogeneration side effects;
- `services/worker-api`, D1/Worker/OpenNext/FastAPI serverless-closure tooling and V1 gate sprawl are retirement targets rather than V2 build requirements.
