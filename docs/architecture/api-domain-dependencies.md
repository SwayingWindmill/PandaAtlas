# FastAPI domain dependency boundary

- Status: Enforced initial slice
- Machine-readable contract: [`contracts/api-domain-dependencies.v1.json`](../../contracts/api-domain-dependencies.v1.json)
- Validator: `services/api/scripts/check_domain_dependencies.py`
- Test integration: `services/api/tests/scripts/test_check_domain_dependencies.py`

## Purpose

ZhiPanda remains a modular monolith. Domain packages share one FastAPI process and one authoritative PostgreSQL/PostGIS database, but they must not become an unrestricted graph of internal imports. This boundary makes allowed dependencies explicit and fails closed when a guarded API route or domain package reaches a private surface.

The first enforced slice covers the two highest-risk post-V1 domains already organized as packages:

- `app.review_moderation`;
- `app.privacy_operations`.

Additional domains should be added in small reviewed changes after their current import surfaces are inventoried. The contract is not permission to create new public APIs merely by listing another internal module.

## Enforced rules

The validator scans all Python modules under `app.api` and each registered domain root.

1. API modules may import a registered domain only through that domain's `api_surfaces`.
2. A registered domain may depend on another registered domain only when `may_depend_on` declares the edge.
3. Cross-domain imports must target the dependency's `public_surfaces`.
4. Registered domains may not import the API layer.
5. Dynamic imports are forbidden in guarded API and domain modules.
6. The observed registered-domain dependency graph must be acyclic.
7. Missing domain roots, overlapping roots, malformed surfaces, and unknown dependency names fail closed.

These rules govern Python imports. They do not yet prove database-table ownership or prevent raw SQL from reading another schema. Table ownership and cross-domain write policy remain a later boundary slice.

## Current compatibility surfaces

The initial contract records existing API-compatible modules so the guard can land without a broad refactor:

- Review and moderation: `models`, `service`, `sanction_models`, and `sanction_service`.
- Privacy operations: `models`, `service`, `exports`, and `maintenance`.

These are compatibility surfaces, not the desired final shape. Follow-up work should introduce narrower `public.py`, `commands.py`, `queries.py`, or `events.py` facades and then remove internal service modules from the allowlists.

## Verification

Run the checker directly from the repository root:

```bash
uv run --directory services/api --frozen --extra dev python scripts/check_domain_dependencies.py
```

Print the passing import report:

```bash
uv run --directory services/api --frozen --extra dev python scripts/check_domain_dependencies.py --json
```

Run its focused tests:

```bash
uv run --directory services/api --frozen --extra dev pytest -q tests/scripts/test_check_domain_dependencies.py
```

The repository-level test executes during the normal API pytest scope, so ordinary API development acceptance rejects new violations even before a dedicated root npm command is added.

## Safe evolution

When adding a domain dependency:

1. Prefer a narrow public facade or event contract in the target domain.
2. Add the exact target surface to `public_surfaces` or `api_surfaces`.
3. Add the domain edge to `may_depend_on` only when synchronous coupling is required.
4. Keep notification, projection, analytics, and similar downstream work event-driven where immediate consistency is unnecessary.
5. Do not use `app.common`, `app.shared`, or `app.utils` as an unrestricted bypass.
6. Do not add temporary wildcard surfaces; the contract accepts explicit module prefixes only.

The next recommended slice is to replace direct API imports of the current service modules with narrow facades, beginning with Review & Moderation, then Privacy Operations.
