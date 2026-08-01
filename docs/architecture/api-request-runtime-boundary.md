# FastAPI request-runtime boundary

- Status: Enforced architecture boundary; managed deployment not yet implemented
- Governing deployment decision: [ADR 0002](adr-0002-managed-cloud-deployment-target.md)
- Machine-readable contract: [`contracts/api-request-runtime-boundary.v1.json`](../../contracts/api-request-runtime-boundary.v1.json)
- Validation command: `npm run check:api-runtime-boundary`

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

The base dependencies in `services/api/pyproject.toml` are the current request-capable dependency set. Heavy or batch-specific distributions remain optional:

| Import root | Distribution | Required optional group |
|---|---|---|
| `PIL` | `pillow` | `dev` |
| `scrapling` | `scrapling` | `crawler-poc` |
| `scrapy` | `scrapy` | `crawler-poc` |

The checker fails when one of these distributions moves into the base dependency list or when a request-reachable module imports its Python root. Playwright, Selenium, and similar browser automation imports are also prohibited from the request closure.

## Packaging rule

The generic setuptools `app*` wheel is a development distribution, not an approved serverless artifact. A future Vercel API package must be constructed from the validated `app.main` entrypoint closure and the reviewed request dependency set. It must not package the entire Python source tree merely because the development wheel can see it.

This slice does not create a Vercel handler or change the existing Uvicorn entrypoint. It creates the fail-closed seam that a later handler and packaging step must consume.

## Verification behavior

Run the boundary directly:

```bash
npm run check:api-runtime-boundary
```

Print the resolved module closure for review:

```bash
python services/api/scripts/check_request_runtime_boundary.py --json
```

The API development scope runs the boundary before Ruff and pytest. Changes to `services/api/**` or `contracts/api-request-runtime-boundary.v1.json` therefore cannot pass development acceptance while the request closure reaches a prohibited module or dependency.

## Phase 2 work that remains

This boundary does not complete the managed API migration. Phase 2 still requires separate reviewed work for:

1. a Vercel-compatible FastAPI handler and route configuration;
2. a serverless artifact builder that consumes the validated closure;
3. Supabase project, region, pooled connection, backup, Auth, and RLS evidence;
4. SQLAlchemy connection and pooling behavior suitable for serverless execution;
5. replacement of temporary static administrative bearer tokens;
6. deployed contract, latency, cold-start, concurrency, and rollback acceptance.

Crawler, research, import, media, release, and recovery execution remains outside request handlers and moves to bounded GitHub Actions workflows under ADR 0002 Phase 3.
