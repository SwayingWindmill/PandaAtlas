# Versioned public projection

PostgreSQL remains the reviewed source of truth. A public release is an immutable export identified by three independent versions:

- `database_migration_version`: authoritative PostgreSQL schema state.
- `public_schema_version`: public field semantics and compatibility boundary.
- `dataset_release_version`: immutable data snapshot.

The publication batch also pins `publication_batch_id` and `projection_code_version`, so the release can be reproduced from the reviewed source state without relying on deployment time state.

## Build

From the repository root, run:

```powershell
npm run build:public-release -- `
  --source contracts/golden-dataset/mei-xiang-family.v1.json `
  --output data/public-releases `
  --publication-batch-id golden-dataset `
  --projection-code-version public-release-v1 `
  --database-migration-version 0006 `
  --released-at 2026-07-14T00:00:00Z
```

The builder refuses to overwrite an existing version directory. It emits `pandas.json`, `pandas.csv`, `d1.sql`, and `manifest.json`. The manifest records the release time, all versions, licenses, record counts, byte sizes, and SHA-256 checksums.

Projection is fail-closed. Only `publication_status=published` records and their `public` payloads are considered. Restricted payloads, unapproved translations, unpublished source references, personal/contact fields, and precise wildlife locations cannot enter an artifact. Unknown sensitive-looking fields stop the build.

## Compatibility gate

Before switching a release:

1. Verify the frontend-supported Public Schema range includes the manifest version.
2. Rebuild the artifacts and compare them byte-for-byte with the candidate directory.
3. Run the API contract, projection, and D1 SQLite tests.
4. Apply `d1.sql` as one transaction. It inserts immutable history first and updates only `public_release_pointer` last.
5. Confirm `GET /api/v1/releases/current` and the `X-PandaAtlas-*` headers match the manifest on both FastAPI and Worker.

## Rollback

Rollback switches the singleton pointer; it does not copy or rewrite records:

```sql
begin immediate;
update public_release_pointer
set dataset_release_version = '2026.07.14.2',
    switched_at = '2026-07-14T09:00:00Z'
where singleton = 1;
commit;
```

## Emergency withdrawal

Withdraw a whole release by appending an event with no entity fields:

```sql
insert into public_release_withdrawals (
  dataset_release_version, reason, withdrawn_at
) values (
  '2026.07.14.2',
  'Emergency wildlife safety withdrawal',
  '2026-07-14T09:00:00Z'
);
```

The `current_public_release` view becomes empty immediately, so the Worker returns `503` for public API access. Historical release and record rows remain unchanged. An entity-scoped withdrawal supplies both `entity_type` and `entity_id`; `current_public_records` then excludes only that record.
