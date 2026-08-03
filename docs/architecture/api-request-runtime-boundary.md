# FastAPI request-runtime boundary

- Status: Enforced architecture boundary; Vercel entrypoint and deterministic closure implemented; managed deployment not yet authorized
- Governing deployment decision: [ADR 0002](adr-0002-managed-cloud-deployment-target.md)
- Machine-readable contract: [`contracts/api-request-runtime-boundary.v1.json`](../../contracts/api-request-runtime-boundary.v1.json)
- Serverless runtime contract: [`contracts/api-serverless-runtime.v1.json`](../../contracts/api-serverless-runtime.v1.json)
- Validation command: `npm run check:api-runtime-boundary`
- Serverless closure command: `npm run check:api-serverless-closure`

## Purpose

Panda Atlas keeps request-response API behavior and batch-oriented research tooling in the same Python source tree during migration. A managed request function must not accidentally import crawler, enrichment, identity-resolution batch, media-processing, release, or recovery code.

The boundary checker starts at `app.main`, follows every statically resolvable local Python import, and validates the complete transitive request closure. The current closure is allowed to include API routers, domain services, authorization, database access, public projections, notification delivery helpers, and other bounded request-time modules.

## Batch-only internal modules

The following namespaces cannot be reached from the request entrypoint:

- `app.acquisition`;
- `app.enrichment`;
- `app.identity_resolution`;
- `app.knowledge.migration`.

Executable files under `services/api/scripts/` are also outside the request runtime. A request module must not import a local `scripts` package or use a dynamic import to bypass the static boundary.

This restriction does not delete or deprecate those modules. They remain available to bounded local and GitHub Actions workflows. The restriction means they cannot become request handlers or transitive imports of a managed API function.

## Dependency separation

The base dependencies in `services/api/pyproject.toml` are the reviewed managed-request dependency set. Heavy, batch-specific, and local-server distributions remain optional:

| Import root | Distribution | Required optional group |
|---|---|---|
| `PIL` | `pillow` | `dev` |
| `scrapling` | `scrapling` | `crawler-poc` |
| `scrapy` | `scrapy` | `crawler-poc` |
| `uvicorn` | `uvicorn[standard]` | `local-server` |

The checker fails when one of these distributions moves into the base dependency list or when a request-reachable module imports a prohibited Python root. Playwright, Selenium, and similar browser automation imports are also prohibited from the request closure.

## Packaging rule

The generic setuptools `app*` wheel remains a development distribution, not an approved serverless artifact. `services/api/index.py` is the supported Vercel ASGI entrypoint and only re-exports `app.main:app`.

`services/api/scripts/build_serverless_closure.py` consumes this boundary and the serverless runtime contract. It creates a deterministic manifest of request modules, package initializers, package data, direct runtime requirements, excluded optional groups, Vercel-excluded tracked files, and SHA-256 evidence. `services/api/vercel.json` applies the matching `excludeFiles` set to the actual function bundle. Neither step deploys the application.

The current structural implementation is documented in [`docs/deployment/vercel-api-phase-2.md`](../deployment/vercel-api-phase-2.md).

## Verification behavior

Run the boundary directly:

```bash
npm run check:api-runtime-boundary
```

Print the resolved module closure for review:

```bash
python services/api/scripts/check_request_runtime_boundary.py --json
```

Validate or build the deterministic serverless manifest:

```bash
npm run check:api-serverless-closure
npm run build:api-serverless-closure
```

The API development scope runs both runtime checks before Ruff and pytest. Changes to `services/api/**`, `contracts/api-request-runtime-boundary.v1.json`, or `contracts/api-serverless-runtime.v1.json` therefore cannot pass development acceptance while the request closure reaches a prohibited module, dependency, or file.

## Phase 2 work that remains

This boundary does not complete the managed API migration. Phase 2 still requires separate reviewed work for:

1. Supabase project, region, pooled connection, backup, Auth, and RLS evidence;
2. SQLAlchemy connection and pooling behavior suitable for serverless execution;
3. replacement of temporary static administrative bearer tokens;
4. deployed contract, latency, cold-start, concurrency, and rollback acceptance.

Crawler, research, import, media, release, and recovery execution remains outside request handlers and moves to bounded GitHub Actions workflows under ADR 0002 Phase 3.
