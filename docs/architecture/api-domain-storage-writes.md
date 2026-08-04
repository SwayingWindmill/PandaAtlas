# FastAPI domain storage-write boundary

- Status: Enforced initial raw-SQL write slice
- Machine-readable contract: [`contracts/api-domain-storage-writes.v1.json`](../../contracts/api-domain-storage-writes.v1.json)
- Validator: `services/api/scripts/check_domain_storage_writes.py`
- Test integration: `services/api/tests/scripts/test_check_domain_storage_writes.py`

## Purpose

ZhiPanda's modular monolith shares one authoritative PostgreSQL/PostGIS database, but sharing a database must not mean that every domain can silently write every schema. This boundary inventories raw SQL write targets and requires cross-schema transactional writes to be explicit.

The initial slice guards:

- `app.review_moderation`, which owns the `review_moderation` schema;
- `app.privacy_operations`, which owns the `privacy_operations` schema.

## Enforced rules

The validator parses Python ASTs under each guarded domain root and inspects SQLAlchemy `text(...)` calls.

It recognizes schema write targets for:

- `insert into`;
- `update`;
- `delete from`;
- `merge into`;
- `truncate`.

Each detected write must:

1. use a schema-qualified target;
2. target a schema owned by the current domain or listed in `allowed_write_schemas`;
3. use a static write target rather than constructing the schema or table dynamically.

The contract also rejects missing domain roots, overlapping domain roots, duplicate schema entries, schemas simultaneously listed as owned and allowed, and schemas claimed by more than one domain.

## Cross-domain writes

An `allowed_write_schemas` entry is an architectural exception, not general database access. It records that the domain currently performs an intentional same-transaction write outside its owned schema. New entries require review of:

- why a public command or port is insufficient;
- whether immediate consistency is actually required;
- transaction and rollback ownership;
- audit and outbox behavior;
- the narrower table set that should eventually replace schema-wide permission.

The initial contract is populated from the current code inventory. Future work should reduce schema-wide exceptions to table-level permissions or application ports where practical.

## Verification

Run the checker from the repository root:

```bash
uv run --directory services/api --frozen --extra dev python scripts/check_domain_storage_writes.py
```

Print the observed write inventory:

```bash
uv run --directory services/api --frozen --extra dev python scripts/check_domain_storage_writes.py --json
```

Run focused tests:

```bash
uv run --directory services/api --frozen --extra dev pytest -q tests/scripts/test_check_domain_storage_writes.py
```

The repository-level test also runs in the normal API pytest scope.

## Current limitations

This slice does not yet detect:

- ORM object mutation and flush behavior;
- SQL assembled outside `text(...)`;
- stored procedures that perform writes internally;
- read ownership or sensitive cross-schema reads;
- table-level permissions inside an approved schema;
- migration SQL, batch scripts, or recovery scripts outside the guarded application packages.

Those require separate bounded contracts rather than widening this checker until it becomes unreliable.
