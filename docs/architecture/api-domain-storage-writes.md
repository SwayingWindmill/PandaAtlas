# FastAPI domain storage-write boundary

- Status: Enforced initial raw-SQL write slice
- Machine-readable contract: [`contracts/api-domain-storage-writes.v1.json`](../../contracts/api-domain-storage-writes.v1.json)
- Validator: `services/api/scripts/check_domain_storage_writes.py`
- Test integration: `services/api/tests/scripts/test_check_domain_storage_writes.py`

## Purpose

ZhiPanda's modular monolith shares one authoritative PostgreSQL/PostGIS database, but sharing a database must not mean that every domain can silently write every schema. This boundary inventories raw SQL write targets and requires cross-domain transactional writes to be explicit at table level.

The initial slice guards:

- `app.review_moderation`, which owns the `review_moderation` schema;
- `app.privacy_operations`, which owns the `privacy` schema.

## Enforced rules

The validator parses Python ASTs under each guarded domain root and inspects SQLAlchemy `text(...)` calls.

It recognizes schema write targets for:

- `insert into`;
- top-level `update` statements;
- `delete from`;
- `merge into`;
- `truncate`.

`FOR UPDATE` locking clauses and `ON CONFLICT DO UPDATE` clauses are not treated as separate write targets; the underlying selected or inserted table remains the relevant target.

Each detected write must:

1. use a schema-qualified target;
2. target a schema owned by the current domain or an exact `schema.table` entry in `allowed_write_targets`;
3. use a static write target rather than constructing the schema or table dynamically.

The contract also rejects missing domain roots, overlapping domain roots, duplicate entries, malformed write targets, redundant exceptions for owned schemas, and schemas claimed by more than one domain.

## Cross-domain writes

An `allowed_write_targets` entry is an architectural exception, not general database access. It records one intentional same-transaction write outside the domain's owned schema. Permission for `identity.accounts`, for example, does not permit writes to any other `identity` table.

New entries require review of:

- why a public command or port is insufficient;
- whether immediate consistency is actually required;
- transaction and rollback ownership;
- audit and outbox behavior;
- whether the target should later move behind an application port.

The initial table list is populated from the current code inventory. It prevents new cross-domain targets from appearing silently while allowing existing V1 transactions to remain behaviorally unchanged.

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
- table-level restrictions inside a domain's owned schema;
- migration SQL, batch scripts, or recovery scripts outside the guarded application packages.

Those require separate bounded contracts rather than widening this checker until it becomes unreliable.
