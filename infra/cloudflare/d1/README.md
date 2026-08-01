# Cloudflare D1 public projection

- Runtime status: **Current production / Transitional**
- Retirement phase: ADR 0002 Phase 5
- Governing status page: [`docs/deployment/runtime-status.md`](../../../docs/deployment/runtime-status.md)

This directory defines the D1 schema and migrations used by the active Cloudflare public read projection. D1 is not an authoritative Panda Atlas database. It stores reviewed, versioned public projection rows derived from the authoritative FastAPI/PostgreSQL path.

## Allowed changes

Changes are limited to:

- current-production reliability and security fixes;
- public API contract compatibility;
- immutable release activation and rollback safety;
- migration compatibility required for the managed API cutover;
- retirement and rollback-window work.

## Prohibited changes

Do not:

- add new authoritative facts or write ownership to D1;
- create new product features that exist only in the Worker/D1 runtime;
- make `seed.sql` an independent production truth source;
- bypass reviewed immutable Public Release artifacts;
- keep D1 receiving new projections after the Phase 5 retirement criteria pass.

`schema.sql` and `seed.sql` support local development. Production changes use the ordered files under `migrations/` and the guarded release tooling documented in [`docs/release/versioned-public-projection.md`](../../../docs/release/versioned-public-projection.md).
