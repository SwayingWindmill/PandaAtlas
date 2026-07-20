# Versioned public projection

PostgreSQL remains the reviewed source of truth. A public release is an immutable export identified by three independent versions:

- `database_migration_version`: authoritative PostgreSQL schema state.
- `public_schema_version`: public field semantics and compatibility boundary.
- `dataset_release_version`: immutable data snapshot.

The publication batch also pins `publication_batch_id` and `projection_code_version`, so the release can be reproduced from the reviewed source state without relying on deployment time state.

## Build

For a production candidate, build directly from a published PostgreSQL publication batch. The batch supplies the data, schema, migration, projection-code, and release-time provenance:

```powershell
npm run build:public-release -- `
  --database-url $env:DATABASE_URL `
  --publication-batch-id 11111111-1111-4111-8111-111111111111 `
  --output data/public-releases
```

The JSON source mode is reserved for the reviewed golden fixture and contract tests:

```powershell
npm run build:public-release -- `
  --source contracts/golden-dataset/mei-xiang-family.v1.json `
  --output data/public-releases `
  --publication-batch-id golden-dataset `
  --projection-code-version public-release-v2 `
  --database-migration-version 0007 `
  --released-at 2026-07-14T12:00:00Z
```

The builder refuses to overwrite an existing version directory. It emits `pandas.json`, `pandas.csv`, `api.json`, `d1.sql`, and `manifest.json`. The manifest records the release time, all versions, licenses, record counts, byte sizes, and SHA-256 checksums.

A reviewed PostgreSQL release batch must include the complete archive panda revisions plus matching `api_pandas`, `api_distribution`, `api_habitats`, and `api_snapshots` revisions. Archive and runtime panda ID sets, identity fields, names, sex/status, and embedded release versions must match. Geo feature entity IDs must match their public feature IDs, and snapshot entity IDs use the public snapshot `version`; these stable IDs are also the entity-withdrawal keys.

Projection is fail-closed. Only `publication_status=published` records and their `public` payloads are considered. Restricted payloads, unapproved translations, unpublished source references, personal/contact fields, and precise wildlife locations cannot enter an artifact. Unknown sensitive-looking fields stop the build.

### Public Schema 1.2 media

Public Schema `1.2.0` adds reviewed panda media without adding curator-maintained technical fields. A published media asset must identify its panda and provide an HTTPS source page, rights basis, public credit, Chinese and English alt text, reviewed source IDs, status, SHA-256, MIME type, dimensions, byte size, and at least one generated WebP derivative. The processing pipeline owns the technical values.

The same media ID and normalized object are embedded in archive panda records, `api_pandas`, `pandas.csv`, `pandas.json`, `api.json`, and D1. `pandas.json` also exposes the release media collection for independent audit. Legacy storage buckets, internal paths, and signed URLs are compatibility inputs only and are excluded from Public Release output.

`withdrawn` and `unavailable` media retain source, rights, credit, and alt-text evidence but expose no image or derivative URL. A replacement or withdrawal requires a new immutable Public Release; historical release files and rows are never rewritten.

## Compatibility gate

Before switching a release:

1. Verify the frontend-supported Public Schema range includes the manifest version.
2. Rebuild the artifacts and compare them byte-for-byte with the candidate directory.
3. Run the API contract, projection, and D1 SQLite tests.
4. Apply `d1.sql` as one transaction. It inserts immutable history first and updates only `public_release_pointer` last.
5. Confirm `GET /api/v1/releases/current` and the `X-PandaAtlas-*` headers match the manifest on both FastAPI and Worker. Every public pandas, lineage, map, snapshot, and stats response is release-gated and carries the same three headers; panda membership and panda-derived totals come only from the active release records.

`GET /api/v1/releases/current/pandas` serves the canonical archive records. The companion `api.json` and the `api_pandas`, `api_distribution`, `api_habitats`, `api_snapshots`, and `api_stats` D1 records contain the complete immutable bodies used by the catalog, detail, lineage, map, snapshot, and stats routes. Neither runtime consults legacy read tables for these public responses.

### Controlled D1 activation

Do not edit a tracked `data/public-releases/<version>/d1.sql` file to make it acceptable to remote D1. The controlled activation command verifies the immutable artifact, removes only its reviewed outer `BEGIN IMMEDIATE`/`COMMIT` envelope in a temporary file, and delegates the rollback-safe file batch to Wrangler. The pointer update must remain the final statement.

Run preflight first. It performs no write and records an auditable JSON report under `.release-gate/` by default:

```powershell
npm run release:d1:preflight -- `
  --release 2026.07.20.3 `
  --database panda-atlas `
  --config services/worker-api/wrangler.jsonc `
  --remote
```

Preflight validates the manifest identity, `d1.sql` byte size and SHA-256, expected Public Release record count, `api_pandas` count, SQL transaction envelope, candidate release insert, final pointer ordering, current rollback release, and absence of conflicting candidate rows or withdrawals.

Only after the report is reviewed, repeat the same arguments with the explicit write command:

```powershell
npm run release:d1:apply -- `
  --release 2026.07.20.3 `
  --database panda-atlas `
  --config services/worker-api/wrangler.jsonc `
  --remote
```

The command executes the temporary SQL with `wrangler d1 execute --file`, deletes the temporary file, and verifies the active pointer, release metadata, total record count, `api_pandas` count, lack of a whole-release withdrawal, and retained rollback history. A duplicate, partially imported, already-current, withdrawn, or metadata-drifted target fails closed.

## Rollback

Rollback switches the singleton pointer; it does not copy or rewrite records. Run the pointer-only preflight first:

```powershell
npm run release:d1:rollback:preflight -- `
  --to 2026.07.20.2 `
  --database panda-atlas `
  --config services/worker-api/wrangler.jsonc `
  --remote
```

After reviewing the source release, target history, target withdrawal state, and record count, execute explicitly:

```powershell
npm run release:d1:rollback -- `
  --to 2026.07.20.2 `
  --database panda-atlas `
  --config services/worker-api/wrangler.jsonc `
  --remote
```

The update is guarded by the observed source release so a concurrent pointer change cannot be overwritten silently. Post-verification proves that both the source and rollback target remain in immutable history. The equivalent SQL shape is:

```sql
begin immediate;
update public_release_pointer
set dataset_release_version = '2026.07.14.3',
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
  '2026.07.14.3',
  'Emergency wildlife safety withdrawal',
  '2026-07-14T09:00:00Z'
);
```

The `current_public_release` view becomes empty immediately, so the Worker returns `410` for public release API access. Historical release and record rows remain unchanged. An entity-scoped withdrawal supplies both `entity_type` and `entity_id`; `current_public_records` then excludes only that record.

FastAPI applies the same gate before dispatching any non-admin `/api/v1` read. Its checked release artifact supplies the active panda membership, while D1 uses `current_public_records`; detail and lineage references outside that membership return `404`. Map reads remain GeoJSON-compatible but cannot bypass a withdrawn or unavailable release.
