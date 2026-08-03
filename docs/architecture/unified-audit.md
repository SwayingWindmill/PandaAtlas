# Unified Audit projection

Issue #199 introduces a private, append-only Audit evidence plane without replacing any bounded context's authoritative audit table.

## Ownership and write path

FastAPI and PostgreSQL remain authoritative. Identity, Engagement, Activity, Notification, Community Intake, Review Moderation, and Archive continue writing their own append-only audit facts. Migration `0031_unified_audit_projection.sql` installs same-transaction `AFTER INSERT` triggers that normalize those facts into `audit.event_facts`.

The projection is evidence only. It must not be used to reconstruct or repair business state. Corrections are represented by new source events.

## Normalized event contract

Each projected event records the source context and source event ID, actor or internal subject, actor role snapshot, action, target, idempotency and correlation identifiers where available, reason, result, related case or Release, before/after versions or diff hash, event time, projection time, and a SHA-256 hash of source details.

Raw source `details` are not copied. The Audit schema does not expose token, cookie, OTP, secret, signed URL, ordinary email, or arbitrary payload columns. Rejected Audit reasons are represented only by a payload hash and rejection code.

## Access and sensitive reads

`audit.read` authorizes search, metrics, and integrity-summary reads. `audit.export` remains separate and is not granted to `audit_reader`. Integrity generation and verification require `audit.integrity.manage` plus recent authentication.

Every Audit search, metrics read, and integrity-summary read creates a new `sensitive_read` event in the same transaction. Browser-facing responses are private, `no-store`, and `noindex`.

## Integrity evidence

A summary covers a closed half-open interval `[range_started_at, range_ended_at)`. Events are deterministically ordered by `occurred_at` and `event_id`, canonicalized, and hashed with SHA-256. Summaries optionally chain to the latest preceding digest.

Verification recomputes the digest. A late or unauthorized append inside a sealed interval produces an immutable mismatch check; existing facts and summaries are never updated.

## Metrics and alerts

The read API reports projected event count, source/projection gaps, sensitive-read volume, bulk reads, rejected payloads, exports, integrity mismatches, and the latest summary time. Alert keys are emitted for projection lag, rejected payloads, bulk-read anomalies, integrity mismatches, and missing summaries.

## Feature flag and rollback

The API is disabled unless `UNIFIED_AUDIT_ENABLED=true`. Disabling the flag removes API access but preserves evidence and source triggers. Rollback is therefore operational: disable the flag first, then ship a reviewed additive migration if trigger removal or schema retirement is required. Existing append-only evidence must not be deleted or rewritten.

## Verification

- `npm run infra:reset`
- `uv run --directory services/api --frozen --extra dev pytest -q tests/integration/test_unified_audit_real_db.py`
- `uv run --directory services/api --frozen --extra dev pytest -q`
- `npm run check:api-runtime-boundary`
- `npm run check:api-serverless-closure`
- `npm run test:release-gate`
- `npm run check:delivery-contract`
