# Vercel FastAPI Phase 2 preparation

- Status: **Structural entrypoint and deterministic request closure implemented; deployment not authorized**
- Governing decision: [ADR 0002](../architecture/adr-0002-managed-cloud-deployment-target.md)
- Runtime contract: [`contracts/api-serverless-runtime.v1.json`](../../contracts/api-serverless-runtime.v1.json)
- Request boundary: [`contracts/api-request-runtime-boundary.v1.json`](../../contracts/api-request-runtime-boundary.v1.json)
- Current runtime status: [`runtime-status.md`](runtime-status.md)

## Platform constraints

Current Vercel FastAPI support discovers an exported ASGI application and runs the whole FastAPI application as one Vercel Function. The Python runtime supports project dependencies from `pyproject.toml` and `uv.lock`, respects a project-root `.python-version`, and does not tree-shake Python source. The resulting function must remain within the Vercel Functions bundle limit.

Official references:

- [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi)
- [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python)
- [How to ship a FastAPI app on Vercel](https://vercel.com/kb/guide/ship-a-fastapi-app-on-vercel)

The Vercel project root for this service is expected to be `services/api`. This repository does not add redirects or legacy `/api` wrappers because current FastAPI support accepts a root `index.py` that exports an ASGI variable named `app`.

`services/api/vercel.json` applies `excludeFiles` to the root `index.py` function. The closure checker compares every tracked or unignored service file with the request closure and this exclusion set, so a new file cannot silently enter the Vercel project without being classified.

## Entrypoint

`services/api/index.py` is intentionally a re-export only:

```python
from app.main import app
```

It cannot define routes, middleware, lifespan behavior, environment mutation, build-time actions, or another FastAPI instance. `app.main:app` remains the single authoritative application object.

Python is pinned to 3.12 through `services/api/.python-version`, which is supported by the current Vercel Python runtime.

## Request-closure artifact

Run the fail-closed validation:

```bash
npm run check:api-serverless-closure
```

Write the deterministic artifact under ignored release output:

```bash
npm run build:api-serverless-closure
```

The artifact records:

- the Vercel entrypoint and target object;
- the Python version;
- every local Python module reachable from `app.main`;
- package data required by request-time modules;
- direct runtime dependency requirements;
- optional groups excluded from the managed request function;
- every tracked service file removed by the reviewed Vercel exclusion set;
- SHA-256 and byte size for every included file;
- hashes for both governing contracts and `vercel.json`.

The current closure contains 84 request modules and 115 runtime files. It includes Python package initializers, notification templates, and runtime metadata while excluding tests, executable scripts, OpenAPI build inputs, acquisition, enrichment, identity-resolution, knowledge-migration, projection, crawler, media, and local-server tooling.

## Dependency boundary

The managed request dependency set is limited to:

- `fastapi`;
- `pydantic-settings`;
- `sqlalchemy`;
- `psycopg`;
- `pyjwt`;
- `httpx`;
- `python-multipart`.

`uvicorn[standard]` is retained only in the `local-server` optional group. The local Docker image installs that group explicitly. Pillow remains in `dev`; Scrapling and Scrapy remain in `crawler-poc`.

## Evidence in this phase

This preparation proves locally that:

1. the supported Vercel entrypoint imports successfully;
2. it exposes the exact same FastAPI object as `app.main`;
3. an ASGI request reaches the application;
4. the transitive request boundary passes;
5. every external import root is classified;
6. base dependencies exactly match the reviewed runtime set;
7. the closure output is deterministic and path-safe.

## Work that remains

This document does not declare Phase 2 complete. Separate Issue-linked work is still required for:

1. Supabase pooled connection and SQLAlchemy serverless lifecycle behavior;
2. production authentication replacing static administrative bearer tokens;
3. Vercel project configuration and environment evidence;
4. preview deployment contract tests;
5. cold-start, concurrency, latency, and failure testing;
6. rollback acceptance and production cutover authorization.

No deployment, DNS, production traffic, database write, secret change, or Vercel project-setting change is authorized by this preparation.
