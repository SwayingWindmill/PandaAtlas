# Scoped Moderation and Appeals

Scoped Moderation extends the existing `review_moderation` bounded context with account-level sanctions and appeals. It does not replace contribution `ReviewCase` processing, Identity authorization, Community Intake ownership, or Notification delivery policy.

## Authoritative facts and projection

Migration `0026_scoped_moderation_and_appeals.sql` adds six durable fact sets:

- `review_moderation.sanctions`
- `review_moderation.restoration_events`
- `review_moderation.appeal_cases`
- `review_moderation.appeal_decisions`
- `review_moderation.moderation_audit_events`
- `review_moderation.moderation_command_receipts`

Sanctions, restorations, appeal decisions, audit events, and command receipts are append-only. `moderation_subjects` and open `appeal_cases` are versioned projections. Every command carries an idempotency key and `expected_version`; idempotent replay is checked before optimistic-concurrency validation.

A newer sanction in the same scope supersedes the prior projection without deleting or rewriting the prior fact. Historical sanctions remain readable but only the currently projected sanction is reported as active.

## Sanction kinds and scope

The API accepts these explicit mappings:

| Kind | Scope | Effect |
| --- | --- | --- |
| `warning` | `account` | Records a durable warning without blocking a product capability. |
| `submission_restricted` | `submission` | Blocks formal Community Intake submission commands. |
| `attachment_restricted` | `attachment` | Blocks attachment reservation and upload commands. |
| `notification_restricted` | `notification` | Suppresses optional Notification audience selection and rechecks delivery immediately before transport. |
| `account_suspended` | `account` | Projects Identity state to `suspended`. |
| `account_closed_for_abuse` | `account` | Projects an indefinite moderation-owned suspension and abuse-closure notice. |

Mandatory account and moderation notifications are not suppressed by `notification_restricted`. Follow state, Panda Passport history, immutable submission revisions, evidence metadata, published Archive facts, role history, and consent history are never deleted by a sanction.

## Authorization

Every administrator route requires an explicit capability and the browser uses only bounded FastAPI commands through a same-origin Next.js proxy.

- Reviewer: `moderation.sanction.read` and `moderation.temporary_submission_freeze`.
- Moderator: sanction read/apply/restore, temporary freeze, appeal read/decide, and metrics.
- Administrator and Archive Editor: no moderation capabilities are inherited.

A Reviewer command can create only a `submission_restricted` sanction and the effective duration may not exceed 24 hours. Sensitive writes require recent authentication. Self-sanction and self-restoration are rejected.

## Identity and expiration

Account suspension is projected to `identity.accounts` in the same transaction as the sanction fact, Identity state event, authorization audit event, moderation audit event, and Outbox facts. Restoration performs the reverse state transition only when the current Identity suspension is owned by moderation.

Time-bounded restrictions stop being effective at `ends_at`, but stored projection flags and a moderation-owned Identity suspension are not silently rewritten by a background clock. `expired_restriction_projected` is a fail-closed operational alert. An operator must inspect the current version and append an explicit restoration command. This preserves an accountable reason and prevents accidental restoration of staff roles, revoked email consent, or unrelated Identity state.

## Appeals

Authenticated users may read `/api/v1/moderation/notice` and open `/api/v1/moderation/appeals` even while their account is suspended. Internal explanations are never returned by these user routes.

Each sanction may have at most one non-closed appeal. The first response is due after five business days. An appeal moves from `open` to `under_review` to `closed`, with version checks on every mutation. Supported final outcomes are:

- `upheld`: retain the current sanction;
- `overturned`: append restoration and close the appeal in one transaction; and
- `dismissed`: close an invalid or non-reviewable appeal without changing the sanction.

The API does not expose a `modified` result until a future contract can express and atomically apply the replacement sanction.

## Metrics and alerts

`GET /api/v1/admin/moderation/metrics` reports:

- active sanctions and oldest active-sanction age;
- active restrictions by scope and suspended accounts;
- open appeals, SLA overdue count, and oldest appeal age;
- repeat-abuse subjects;
- expired stored projections;
- restorations and unauthorized attempts in the last 24 hours; and
- Identity/projection consistency failures.

`review_moderation.moderation_alerts` is the database alert source for appeal SLA, expired projection, and Identity consistency failures.

## Contracts and rollback

`services/api/openapi/moderation-v1.yaml` owns the bounded contract. The canonical `panda-atlas-v1.yaml` registers each path through explicit Path Item references.

`MODERATION_CONTROLS_ENABLED=false` is the application rollback switch. It stops user notice/appeal and administrator moderation commands before database access. It does not delete sanctions, restorations, appeals, decisions, audit records, receipts, Identity state events, or Outbox history. Migration `0026` is additive and rollback is forward-fix only.
