# ZhiPanda V1 cross-feature recovery rehearsal

This deterministic rehearsal validates the recovery orchestration shared by Moderation, Privacy Operations, and Audit before their feature-specific real PostgreSQL drills are integrated into Issue #200.

Run from a clean checkout:

```text
node scripts/release/run-zhipanda-v1-recovery-rehearsal.mjs
```

The default evidence path is:

```text
.release-gate/zhipanda-v1-recovery-rehearsal.json
```

The report has a deterministic SHA-256 `evidence_id`. Generation time is excluded from that digest, so identical recovery behavior produces the same evidence identity.

## Moderation stop and drain

The rehearsal creates one active sanction and one in-flight appeal, stops new moderation commands, rejects a new sanction without mutating the journal, drains the existing appeal to an overturned and restored state, and rebuilds the projection twice while ignoring duplicate event IDs.

This proves command-stop and replay orchestration only. Issue #197 must still provide the real PostgreSQL sanction, expiry, restoration, appeal, and account-state recovery drill.

## Privacy tombstone replay

The rehearsal applies an irreversible deletion tombstone, blocks authentication, deletes non-held contexts, preserves a narrowly held Archive context, restores an earlier snapshot that resurrects deleted data, and reapplies the tombstone twice without widening the Hold or changing the second result.

This proves restore/replay ordering and idempotency only. Issue #198 must still provide the real PostgreSQL restore, rolling-backup-boundary, Hold, and account-level tombstone replay drill.

## Audit integrity recovery

The rehearsal rejects a business command while required audit persistence is unavailable, accepts a later command after recovery, rebuilds the projection idempotently, detects a changed integrity digest, and removes expired export ciphertext while retaining the audit fact.

This proves fail-closed and integrity-response orchestration only. Issue #199 must still provide the real PostgreSQL audit outage, projection, export-expiry, and digest mismatch drill.

## Operator decision boundary

A passing rehearsal does not change any of these entries in `contracts/zhipanda-v1-operational-readiness.v1.json` from `planned` to `available`:

- `moderation-stop-drain`
- `privacy-tombstone-replay`
- `audit-integrity-recovery`

The operational-readiness contract remains `in-progress` until those three feature-specific drills have executable commands, real environment evidence, and clean-checkout Release Gate coverage.
