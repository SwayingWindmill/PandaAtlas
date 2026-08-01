# Service boundary

`services/` contains independently governed runtime services:

- [`api`](api/) is the authoritative FastAPI and PostgreSQL/PostGIS application boundary.
- [`worker-api`](worker-api/) is the current transitional public read projection.

Authority and projection ownership are defined by [ADR 0001](../docs/architecture/adr-0001-single-source-api-boundary.md). Current, target, transitional, and local-only runtime labels are defined by the [deployment status page](../docs/deployment/runtime-status.md).

Only services with a committed `package.json` may be npm workspaces. The Python API remains outside the npm workspace list and is governed through `pyproject.toml` and its request-runtime boundary.
