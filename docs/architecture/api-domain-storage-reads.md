# FastAPI domain storage-read boundary

- Status: Enforced initial raw-SQL read slice
- Machine-readable contract: [`contracts/api-domain-storage-reads.v1.json`](../../contracts/api-domain-storage-reads.v1.json)
- Validator: `services/api/scripts/check_domain_storage_reads.py`
- Test integration: `services/api/tests/scripts/test_check_domain_storage_reads.py`

## Purpose

ZhiPanda's modular monolith shares one authoritative PostgreSQL/PostGIS database. Shared storage does not imply that every domain may silently read every table. This boundary inventories raw SQL table reads and requires cross-domain reads to be explicit at exact `schema.table` granularity.

The initial slice guards:

- `app.review_moderation`, which owns the `review_moderation` schema;
- `app.privacy_operations`, which owns the `privacy` schema.

## Enforced rules

The validator parses Python ASTs under each guarded domain root and inspects SQLAlchemy `text(...)` calls.

It recognizes physical table targets introduced by schema-qualified `FROM` and `JOIN` clauses. It excludes:

- CTE references;
- subqueries;
- lateral table functions;
- table-valued function calls;
- the target of `DELETE FROM`;
- aliases and SQL keywords that are not physical tables.

Each detected read must:

1. use a schema-qualified physical table target;
2. target a schema owned by the current domain or an exact `schema.table` entry in `allowed_read_targets`;
3. use a static target rather than constructing the schema or table dynamically.

The contract also rejects missing domain roots, overlapping roots, malformed targets, duplicate entries, redundant exceptions for owned schemas, and schemas claimed by more than one domain.

## Cross-domain reads

An `allowed_read_targets` entry is a reviewed architectural dependency, not schema-wide access. Permission for `identity.accounts`, for example, does not permit reads from any other `identity` table.

New entries require review of:

- why the data belongs in the current use case;
- whether a public query facade or projection would reduce coupling;
- whether the table contains sensitive or private data;
- whether the read should remain transactionally consistent with a same-request write;
- whether the dependency can be narrowed to a stable projection.

The initial table list is populated from the current V1 code inventory. It prevents new cross-domain raw SQL reads from appearing silently while preserving existing behavior.

## Verification

Run the checker from the repository root:

```bash
uv run --directory services/api --frozen --extra dev python scripts/check_domain_storage_reads.py
```

Print the observed read inventory:

```bash
uv run --directory services/api --frozen --extra dev python scripts/check_domain_storage_reads.py --json
```

Run focused tests:

```bash
uv run --directory services/api --frozen --extra dev pytest -q tests/scripts/test_check_domain_storage_reads.py
```

The repository-level test also runs in the normal API pytest scope.

## Current limitations

This slice does not yet detect:

- ORM query construction and relationship loading;
- SQL assembled outside `text(...)`;
- stored procedures or functions that perform reads internally;
- `MERGE ... USING` and other non-`FROM`/`JOIN` source forms;
- migration, batch, or recovery scripts outside guarded application packages;
- column-level sensitivity or row-level authorization correctness.

Those require separate bounded contracts rather than widening this checker until it becomes unreliable.
