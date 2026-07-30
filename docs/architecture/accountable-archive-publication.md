# Accountable Archive Publication

Issue #191 installs the single-accountable-approver command boundary without rewriting historical four-eyes evidence. The canonical Panda Atlas OpenAPI registers the domain contract through external Path Item references.

## Ownership

Curation owns Change Set validation and the `ready` result. Trusted Archive owns the publish transaction, immutable Release, authoritative Archive pointer, audit evidence, and `archive.release.published` Outbox event. Public Projection owns the separate public pointer and may advance it only after projection succeeds.

`ready` is a validation state, not an approval fact and not a public fact. A Release is authoritative after the publish transaction commits even while its public projection remains pending.

## Validation

`POST /api/v1/admin/archive/change-sets/{change_set_id}/validate` requires `archive.accountable.validate`. The command binds:

- the current authoritative Archive version;
- the complete immutable revision set and payload hashes;
- hydrated reference, source, residency, translation, and media checks;
- ordinary or sensitive risk classification;
- validator identity, role snapshot, reason, correlation ID, and policy version.

Idempotent replay is resolved before optimistic-concurrency and base-version checks. A clean validation increments `governance_version` and sets `status=ready`; blocking issues set `status=validation_failed`. Validation results are append-only.

## Publication

`POST /api/v1/admin/archive/change-sets/{change_set_id}/publish` requires `archive.accountable.publish`. Ordinary work may be published by an Archive Editor. Sensitive work also requires `archive.sensitive.publish` and recent authentication. Administrator, contributor, and service identities receive no publication capability implicitly.

A community contributor cannot publish a contribution-derived Change Set whose `origin_actor_id` is their own account, even if that account later receives an Archive role.

One PostgreSQL transaction:

1. resolves idempotent replay;
2. locks the authoritative Archive pointer and Change Set;
3. checks governance version, base version, ready validation, risk policy, capability snapshot, and self-publication conflict;
4. creates and publishes one immutable `publication_batches` Release;
5. preserves the previous Release snapshot and adds the new Change Set;
6. marks the Change Set published and immutable;
7. advances `archive_release_pointer` but not `public_release_pointer`;
8. writes immutable validation/revision/source/attachment/publisher evidence;
9. writes audit and command receipt evidence; and
10. writes one `archive.release.published` transactional Outbox event.

Any failure rolls back the Release. Audit or Outbox insertion failure therefore fails closed. A later Public Projection failure does not roll back the Release; the previous public version remains active and the pending Release remains visible through lag metrics.

## Metrics and recovery

`GET /api/v1/admin/archive/publication-metrics` exposes ready, published, publish-failed, stale-base, conflict, pending-Outbox, oldest-Outbox-lag, and projection-lag counts.

`ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED=false` hides the new commands and leaves historical data untouched. Migration `0020` is additive and forward-fix only. Correction, rollback, merge/split, and emergency takedown remain owned by #194; workbench and cutover tooling remain owned by #195; broad migration and recovery certification remains owned by #196.
