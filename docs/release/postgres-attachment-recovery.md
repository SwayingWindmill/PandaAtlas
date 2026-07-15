# PostgreSQL and evidence-attachment recovery drill

This drill proves that PandaAtlas can restore its forward-migrated PostgreSQL schema and a restricted evidence attachment to one consistent recovery point. It uses the synthetic-only environment approved by `contracts/recovery-drill-environments.v1.json`: a disposable local non-production PostGIS container, a PostgreSQL custom-format logical backup, and a versioned local-filesystem attachment-store surrogate.

## Run the drill

Docker must be running. From the repository root:

```powershell
npm run drill:postgres-attachment-recovery
```

The drill starts and removes its own uniquely named container. It does not connect to `DATABASE_URL`, expose a host port, or modify an existing database.

## Recovery sequence

1. Start `postgis/postgis:16-3.4` as an isolated disposable environment.
2. Apply every forward-only Supabase migration, including the restricted `evidence_attachments` metadata table.
3. Commit one safe synthetic evidence source, v1 attachment reference/object, and recovery checkpoint.
4. Create a PostgreSQL custom-format logical dump and copy v1 into a separate version-keyed backup directory.
5. Commit a v2 attachment generation after the backup, then simulate an incident by deleting the current database reference and object.
6. Restore the dump into a separate database and explicitly select v1 from the version-keyed backup into a separate attachment-store directory.
7. Compare complete logical-state hashes, attachment checksums, metadata/object size, foreign-key linkage, and recovery checkpoint.

The measured database-and-attachment restore time starts immediately before database creation and ends after database, object, checksum, version, and reference-integrity validation. Recovery-point age is measured from backup completion to the simulated incident and compared with the 15-minute RPO target. Operation loss is derived by subtracting the restored journal sequence from the incident sequence; the drill deliberately proves one post-backup operation is absent after restore. The restore component is compared with the four-hour critical-backend RTO target, but it is not reported as the complete backend RTO because incident response, API startup, and health checks occur only in staging.

## Evidence report

The command writes:

```text
.release-gate/postgres-attachment-recovery.json
```

The report contains only environment classification, pinned image name, migration filenames, statuses, durations, counts, and SHA-256 evidence. It does not record database URLs, credentials, container identifiers, temporary paths, attachment contents, or personal/restricted data.

## Explicit staging boundary

This is real `pg_dump`/`pg_restore` execution against the repository-policy-approved disposable local non-production PostgreSQL environment. The policy allows synthetic data only, prohibits host ports and existing database connections, requires cleanup, and forbids provider-managed or independent-failure-domain claims. It is not evidence for provider-managed PITR/WAL recovery. The attachment exercise creates v1 and v2 generations and restores v1 from a separate version-keyed copy on the same local filesystem; it is neither an independent failure domain nor evidence for Cloudflare R2 or another remote object-store restore.

Before the final launch decision, staging must still exercise:

- provider-managed PostgreSQL PITR or its approved equivalent;
- the configured remote attachment store, including version recovery and database-reference reconciliation;
- the actual staging identities, authorization boundary, backup retention, and independent failure domain;
- provider-measured RPO/RTO, recorded without secrets or restricted attachment content.
