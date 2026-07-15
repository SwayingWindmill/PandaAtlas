# PostgreSQL and evidence-attachment recovery drill

This drill proves that PandaAtlas can restore its forward-migrated PostgreSQL schema and a restricted evidence attachment to one consistent recovery point. It uses a disposable local non-production PostGIS container, a PostgreSQL custom-format logical backup, and a versioned local-filesystem attachment-store surrogate.

## Run the drill

Docker must be running. From the repository root:

```powershell
npm run drill:postgres-attachment-recovery
```

The drill starts and removes its own uniquely named container. It does not connect to `DATABASE_URL`, expose a host port, or modify an existing database.

## Recovery sequence

1. Start `postgis/postgis:16-3.4` as an isolated disposable environment.
2. Apply every forward-only Supabase migration, including the restricted `evidence_attachments` metadata table.
3. Commit one safe synthetic evidence source, attachment reference, attachment object, and recovery checkpoint.
4. Create a PostgreSQL custom-format logical dump and copy the attachment into an independent backup directory.
5. Simulate an incident by deleting both the database reference and source object after the selected recovery point.
6. Restore the dump into a separate database and the object into a separate attachment-store directory.
7. Compare complete logical-state hashes, attachment checksums, metadata/object size, foreign-key linkage, and recovery checkpoint.

The measured recovery time starts immediately before database creation and ends after database, object, checksum, and reference-integrity validation. Recovery-point loss is derived by subtracting the restored checkpoint sequence from the selected backup checkpoint sequence; a passing drill reports zero lost committed operations.

## Evidence report

The command writes:

```text
.release-gate/postgres-attachment-recovery.json
```

The report contains only environment classification, pinned image name, migration filenames, statuses, durations, counts, and SHA-256 evidence. It does not record database URLs, credentials, container identifiers, temporary paths, attachment contents, or personal/restricted data.

## Explicit staging boundary

This is real `pg_dump`/`pg_restore` execution against an approved disposable local non-production PostgreSQL environment. It is not evidence for provider-managed PITR/WAL recovery. The attachment exercise uses a versioned local-filesystem surrogate and is not evidence for Cloudflare R2 or another remote object-store restore.

Before the final launch decision, staging must still exercise:

- provider-managed PostgreSQL PITR or its approved equivalent;
- the configured remote attachment store, including version recovery and database-reference reconciliation;
- the actual staging identities, authorization boundary, backup retention, and independent failure domain;
- provider-measured RPO/RTO, recorded without secrets or restricted attachment content.

