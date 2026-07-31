# Archive Governance Cutover Runbook

This runbook owns the operational transition from historical four-eyes publication records to the single-accountable-approver application flow. It never deletes or rewrites historical Releases, reviews, audit events, sources, actors, or operation evidence.

## Preconditions

- Migrations through `0024_archive_workbench_cutover.sql` are applied on a production-like clone.
- `ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED=true` is enabled for the rehearsal API process.
- Archive Editor and Senior Archive Editor capability assignments have been reviewed.
- The operator has a recent authenticated session before changing cutover state.
- Public Projection, Activity, Notification, Outbox, and audit health are visible.

## Rehearsal artifact

Run from `services/api` with the clone database URL:

```bash
uv run python scripts/rehearse_archive_governance_cutover.py \
  --output ../../artifacts/archive-governance-cutover.json \
  --require-go
```

The artifact includes:

- counts for historical four-eyes and accountable Change Set states;
- Release counts by operation;
- Archive and public pointer identities;
- orphan checks for Release evidence, operations, and Activity source events;
- historical Archive/publication audit count;
- a deterministic SHA-256 over the canonical comparison payload;
- explicit GO/NO-GO status and blockers.

Store the artifact outside the repository or in the immutable release evidence location owned by #196. Do not commit production-derived data.

## Hold publication

Use `/admin/archive` and select **Hold new publication**. The command requires:

- `archive.cutover.manage`;
- recent authentication;
- the current cutover version;
- a required reason and idempotency key.

The database trigger `trg_publication_batches_cutover_hold` blocks every new `publication_batches` insert while state is `held`. Existing Releases, Public Projection retries, Outbox processing, Activity, Notification, reads, audit, and recovery remain available.

## Drain and compare

1. Confirm no publication command is currently in flight.
2. Let existing Outbox and Public Projection work drain or record every known lag item.
3. Produce a fresh rehearsal artifact.
4. Compare state counts and SHA-256 with the approved rehearsal baseline.
5. Confirm no waiting-second-approval item was auto-published.
6. Confirm old dual-approval audit remains attributable.
7. Confirm `archive_release_pointer` and `public_release_pointer` differ only for known projection lag.
8. Confirm no orphan blocker is present.

A NO-GO result keeps publication held. Use forward fixes; do not edit immutable Releases or audit records.

## Resume publication

Use `/admin/archive` and select **Resume new publication** with a fresh reason. Resume is also versioned, idempotent, capability-checked, recently authenticated, and audited.

After resume:

- validate one ordinary Change Set without publishing;
- publish one approved ordinary canary through the explicit command;
- verify the immutable Release and Outbox event;
- verify Public Projection advances the public pointer;
- verify no duplicate Activity or Notification event;
- verify queue metrics and cutover state.

The full canary, browser, accessibility, staging, recovery, and cross-platform evidence belongs to #196.

## Application rollback

Application rollback is allowed only as a compatibility rollback:

- immediately hold new publication first;
- preserve migrations `0020` through `0024` and all new data as readable;
- deploy the prior compatible application version;
- do not delete single-approver Releases, operation records, cutover audit, or command receipts;
- do not re-enable automatic dual approval or reinterpret `ready` as a historical approval;
- keep Public Projection and Outbox recovery running when compatible;
- create a new issue for every forward fix required before resume.

Moving either Release pointer backward outside an explicit immutable rollback Release is prohibited.

## Emergency handling

Emergency takedown remains available only while publication is open because it creates a Release. When publication is held and urgent risk must be reduced, a Senior Archive Editor must record the situation, decide whether to temporarily resume for one audited takedown, and immediately return to held state. The one-business-day formal Change Set follow-up remains mandatory.
