# ADR-0002: Single accountable Archive approver governance

- Status: Accepted for compatibility migration; runtime cutover disabled
- Date: 2026-07-30
- Owners: Trusted Archive / Curation
- Supersedes: the implicit four-eyes publication assumptions introduced by migration `0005`
- Related delivery: #175, #190, #191, #194, #195, #196

## Context

The current workflow treats a Change Set author and an independent reviewer as two separate actors. A review writes `approved` or `rejected`, and only `approved` Change Sets may enter a publication batch. The later publisher is a third operational action, but the stored `approved` fact is routinely described as approval rather than a validation result.

The target governance model has one accountable Archive Editor for ordinary publication and one Senior Archive Editor for sensitive publication. Machine and human validation may produce `ready`, but `ready` is not an approval, authorization, or publication fact. Publication remains an explicit command with capability, recent-authentication, reason, base-version, conflict, audit, and Outbox requirements.

## Decision

1. Keep every historical Change Set, review row, reviewer identity, reason, timestamp, immutable Release, publication actor, and audit event attributable.
2. Add `governance_mode`, `validation_state`, validation actor/time/reason, base Archive version, and governance version to Change Sets.
3. Expose a compatibility read model. Historical `approved` records appear as `legacy_approved`; they are never silently rewritten to `ready`.
4. Add append-only revalidation evidence. A legacy `submitted` or `approved` record may become `ready` only after a future explicit command records actor/role snapshot, reason, validation hash, and base Archive version.
5. Keep the old workflow active while `ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED=false`.
6. When the flag is enabled, legacy create/submit/review/batch-create/publish mutations fail with `archive_governance_migration_required`. Read-only preview, rollback, and withdrawal remain available.
7. Migration `0018` creates no Release, changes no public pointer, converts no draft, and writes no revalidation row.
8. Migration sequence `0017` is reserved for the parallel #188 contributor-submission slice. This compatibility change uses `0018` and must not merge before `0017` exists on `master`.
9. Issue #191 owns accountable validation and publish commands. Issue #195 owns workbench and production-like cutover tooling. Issue #196 owns final cross-platform certification.

## State compatibility

| Old state or fact | Compatibility state | Target behavior | Actor/history preservation | Automatic action |
| --- | --- | --- | --- | --- |
| `draft` | `draft` / `not_validated` | Remains editable only by existing legacy rules until new commands exist | Creator and revisions unchanged | None |
| `submitted` | `submitted` / `not_validated` | Revalidation candidate | Creator, revisions, submission time unchanged | Never becomes ready automatically |
| `approved` plus review row | `approved` / `legacy_approved` | Legacy publication remains eligible while old mode is active; cutover requires explicit revalidation policy | Reviewer, reason, review row, audit and source evidence retained | Never rewritten to ready |
| `rejected` plus review row | `rejected` / `validation_failed` | Historical rejection remains final evidence; reopening requires a new command/record | Reviewer and reason retained | None |
| first-approved or awaiting-second data from imported systems | Imported legacy state plus `requires_explicit_revalidation=true` | Explicit revalidation may create a new `ready` evidence row | Imported actor snapshots and source identifiers retained | No auto-publish |
| new validation failure | `validation_failed` | Correct and revalidate through #191 | Append-only validation evidence | None |
| new validation success | `ready` | Eligible only for the #191 accountable publish command | Validator snapshot retained separately from publisher snapshot | No Release until publish command |
| published legacy Release | Immutable Release and public pointer history | Remains byte-for-byte attributable | Publisher, review, audit, source and diff evidence retained | None |

## Inventory classification

The machine-readable inventory is `contracts/archive-governance-migration.v1.json`, enforced by `scripts/release/check-archive-governance-migration.mjs`.

- Schema and triggers: migrations `0005`, `0010`, and compatibility migration `0018`.
- Domain, API, command and contracts: publication domain, schemas, service, repository, admin route, and OpenAPI contract.
- Capabilities: legacy `archive.review` remains historical/compatibility-only; #191 introduces accountable validation/publish capability semantics without granting them to Administrator or service accounts by default.
- Tests and fixtures: publication real-database, Activity projection, real DB chain, storage contracts, identity capability contracts, and the admin-shell absence assertion.
- UI: no Archive Change Set workbench exists in the current Web application. The only relevant UI fact is that `archive.review` is not exposed in the bounded identity shell. #195 owns the replacement workbench and labels.
- Metrics: no dedicated approval-state metrics exist. The migration evidence model defines required counts, orphan counts, source/target hashes, and Release-count stability; #191/#195 add runtime metrics.
- Runbooks: no four-eyes cutover runbook existed. This ADR is the compatibility and rollback baseline; #195 adds rehearsal/cutover operations and #196 certifies them.
- Fixtures: no standalone approval fixture exists. Existing real-database test setup creates the authoritative legacy records and remains classified until replacement fixtures are added.

## Cutover invariants and evidence

Every rehearsal or cutover record must capture:

- counts by stored status, governance mode, and validation state before and after;
- orphan Change Set revisions, review rows, publication-batch links, and validation rows;
- deterministic hashes over Change Set IDs, revision IDs, source payload hashes, actor IDs, review IDs, and Release IDs;
- published Release count before and after, which must remain unchanged during compatibility migration;
- no duplicate `data_version`, Release, Outbox event, or public pointer transition;
- no missing creator, substantive modifier, reviewer, validator, publisher, source, reason, or correlation identifier.

Required alerts after cutover include legacy mutation rejection volume, revalidation backlog and age, validation failure, stale base, publish conflict/failure, audit failure, Outbox lag, projection lag, and migration invariant mismatch.

## Feature flag and rollback

```text
ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED=false
```

The default is false. Enabling it before #191 is deployed intentionally stops legacy publication mutations. Rollback sets the flag to false. It does not drop migration `0018`, delete compatibility evidence, rewrite Change Sets, remove reviews, or change a public Release pointer.

Database rollback is forward-fix only. New columns, tables, indexes, and the compatibility view remain because later code may have written additive evidence. Application rollback must continue reading the compatibility fields while operating the legacy commands.

## Removed and replacement contracts

No contract is removed by #190. Once the feature flag is enabled, legacy mutation endpoints return an explicit `409` response with code `archive_governance_migration_required`; they are not reinterpreted as accountable validation or publication. #191 must introduce named replacement commands before the flag can be enabled in any non-test environment.
