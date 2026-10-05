# Historical Vercel FastAPI Phase 2 preparation

- Status: **Historical / superseded — FastAPI on Vercel was retired during the V2 cutover**
- Original governing decision: [ADR 0002](../../architecture/adr-0002-managed-cloud-deployment-target.md)
- Retired contracts: `contracts/api-serverless-runtime.v1.json` and `contracts/api-request-runtime-boundary.v1.json` (removed by #355)
- Current runtime status: [`runtime-status.md`](../runtime-status.md)

> This file preserves the pre-V2 Phase 2 design as deployment history. It is not a current runbook. Do not recreate the deleted FastAPI entrypoint, contracts, serverless-closure scripts, or npm commands from this record.

## Platform constraints

At the time of this phase, Vercel FastAPI support discovered an exported ASGI application and ran the whole FastAPI application as one Vercel Function. The Python runtime supported project dependencies from `pyproject.toml` and `uv.lock`, respected a project-root `.python-version`, and did not tree-shake Python source. The resulting function had to remain within the Vercel Functions bundle limit.

Official references:

- [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi)
- [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python)
- [How to ship a FastAPI app on Vercel](https://vercel.com/kb/guide/ship-a-fastapi-app-on-vercel)

The Vercel project root for this service was expected to be `services/api`. The phase did not add redirects or legacy `/api` wrappers because the then-current FastAPI support accepted a root `index.py` that exported an ASGI variable named `app`.

The retired `services/api/vercel.json` applied `excludeFiles` to the root `index.py` function. The closure checker compared every tracked or unignored service file with the request closure and this exclusion set.

## Entrypoint

The retired `services/api/index.py` was intentionally a re-export only:

```python
from app.main import app
```

It could not define routes, middleware, lifespan behavior, environment mutation, build-time actions, or another FastAPI instance. `app.main:app` was the single authoritative application object for that phase.

Python was pinned to 3.12 through `services/api/.python-version` for this phase.

## Historical request-closure artifact

The phase used the following fail-closed validation command. It is retired and must not be run as current repository guidance:

```bash
npm run check:api-serverless-closure
```

It also used the following deterministic artifact command, which is likewise retired:

```bash
npm run build:api-serverless-closure
```

The artifact recorded:

- the Vercel entrypoint and target object;
- the Python version;
- every local Python module reachable from `app.main`;
- package data required by request-time modules;
- direct runtime dependency requirements;
- optional groups excluded from the managed request function;
- every tracked service file removed by the reviewed Vercel exclusion set;
- SHA-256 and byte size for every included file;
- hashes for both governing contracts and `vercel.json`.

The captured closure contained 84 request modules and 115 runtime files. It included Python package initializers, notification templates, and runtime metadata while excluding tests, executable scripts, OpenAPI build inputs, acquisition, enrichment, identity-resolution, knowledge-migration, projection, crawler, media, and local-server tooling.

## Dependency boundary

The managed request dependency set for this phase was limited to:

- `fastapi`;
- `pydantic-settings`;
- `sqlalchemy`;
- `psycopg`;
- `pyjwt`;
- `httpx`;
- `python-multipart`.

`uvicorn[standard]` was retained only in the `local-server` optional group. The local Docker image installed that group explicitly. Pillow remained in `dev`; Scrapling and Scrapy remained in `crawler-poc`.

## Evidence in this phase

This preparation proved locally that:

1. the supported Vercel entrypoint imports successfully;
2. it exposes the exact same FastAPI object as `app.main`;
3. an ASGI request reaches the application;
4. the transitive request boundary passes;
5. every external import root is classified;
6. base dependencies exactly match the reviewed runtime set;
7. the closure output is deterministic and path-safe.

## Work that remained at the time

This document did not declare Phase 2 complete. At the time, separate Issue-linked work was still required for:

1. Supabase pooled connection and SQLAlchemy serverless lifecycle behavior;
2. production authentication replacing static administrative bearer tokens;
3. Vercel project configuration and environment evidence;
4. preview deployment contract tests;
5. cold-start, concurrency, latency, and failure testing;
6. rollback acceptance and production cutover authorization.

No deployment, DNS, production traffic, database write, secret change, or Vercel project-setting change was authorized by this preparation. Current deployment authority is `docs/deployment/runtime-status.md`.
