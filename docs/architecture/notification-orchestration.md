# Notification orchestration and native Inbox

Issue #184 introduces a private Notification Orchestration context on top of Public Activity, Identity, Engagement preferences, and future contribution-review events.

## Ownership

Notification Orchestration owns:

- source-event receipts and logical Notification Intent deduplication;
- the audience snapshot used when an intent is created;
- channel decisions and the exact preference version used for each decision;
- native Inbox items, unread counts, and explicit read commands;
- delivery attempts and channel delivery state;
- immutable daily and weekly Digest snapshots;
- correction and retraction propagation;
- notification-specific audit and operational metrics.

It does not own Archive facts, Activity content, Follow commands, account state, submission review decisions, email transport, web-push transport, or public user profiles.

## Source events and policy

The projector consumes these versioned integration events:

- `activity.item.published`
- `activity.item.corrected`
- `activity.item.retracted`
- `submission.status.changed`
- `contribution.submission_status.changed`
- `contribution.incorporated`
- `submission.incorporated`
- `identity.security.changed`
- `identity.role.assigned`
- `identity.role.revoked`

Approved categories are birthday, major Activity, submission status, incorporation, correction/retraction, and security/role. Unsupported events receive an `ignored` source receipt instead of silently disappearing.

Activity audience comes from current active Follow relationships, or all active accounts for an approved site-wide Activity. Optional Activity is suppressed for suspended, frozen, or deleting accounts. Mandatory security/role messages are still created for suspended accounts.

## Consent and channel decisions

Follow and email consent are separate. A Follow makes the native station Inbox eligible, but does not enable email or web push.

Every Intent stores:

- the account and account-state audience snapshot;
- the category;
- whether the message is mandatory;
- the exact preference snapshot and preference versions;
- a public-safe content snapshot;
- a decision for station, email, and web push.

Absent optional consent produces `suppressed` with reason `consent_absent`. Explicit opt-out produces `preference_disabled`. Mandatory security/role messages force station and email and cannot be disabled.

The existing Engagement preference route remains compatible, but writes to the Notification-owned preference tables:

```text
PUT /api/v1/me/notification-preferences/{category}/{channel}
```

## Native Inbox

Private routes are:

```text
GET  /api/v1/me/inbox
GET  /api/v1/me/inbox/unread-count
POST /api/v1/me/inbox/{inbox_item_id}/read
POST /api/v1/me/inbox/read-all
```

Inbox ordering is `(created_at desc, inbox_item_id desc)`. Pagination uses an HMAC-SHA256 account-bound cursor. Read-one and read-all are explicit idempotent commands; listing the Inbox never marks items read.

Inbox bodies have a maximum retention window of 90 days. After expiry, the body is replaced with a minimal expired-state tombstone while hashed read-state evidence may remain. Retractions replace the original body with a bilingual retraction tombstone and preserve the reviewed public reason.

## Digest snapshots

```text
POST /api/v1/me/inbox/digests
```

Daily and weekly Digest batches select active, email-enabled, non-mandatory Intents in the requested period. The batch stores ordered item snapshots and a content version. Once queued, content, period, locale, frequency, and idempotency identity are immutable. Privacy deletion is the only allowed batch deletion path and requires the owning account to be in `deleting` state.

Issue #185 owns actual email/web-push transport and worker retry behavior. It will consume `notification.intent.created` and `notification.digest.queued` Outbox events and write delivery attempts/state through the Notification context.

## Corrections and retractions

A correction retracts the original Activity Intent and then creates the explicit correction Intent. A retraction moves all non-delivered channel decisions for the source into `retracted`, replaces Inbox content with a tombstone, and emits audit evidence. Duplicate source events are harmless and conflicting reuse of an event ID is rejected.

## Privacy deletion

When account state is `deleting`, the existing private-data deletion command removes identifiable Notification preferences, Intents, channel decisions, Inbox items, delivery attempts, Digest items, and Digest batches. Source receipts and hashed preference/read events do not contain a reversible account identifier. Audit rows follow the existing legal/audit retention boundary.

## Feature flags and rollout

Backend switches:

```text
NOTIFICATION_ENABLED=false
NOTIFICATION_CURSOR_SIGNING_KEY=<deployment-secret>
```

Recommended rollout:

1. apply migration `0014_notification_orchestration.sql` with Notification disabled;
2. verify the private schema, seven immutability triggers, and browser-role denial;
3. configure a deployment-specific cursor signing key;
4. enable `NOTIFICATION_ENABLED=true`;
5. run `python scripts/run_notification_projector.py --limit 100`;
6. exercise Inbox reads, explicit read commands, preferences, and Digest snapshots;
7. enable #185 transport workers separately.

Rollback is non-destructive: disable `NOTIFICATION_ENABLED`. Activity publication and Follow remain available. Re-enabling the projector resumes from source events that lack durable receipts.

## Metrics

`GET /api/v1/notification/metrics` requires administrator authentication and reports:

- created Intent count;
- suppression counts by reason;
- unread Inbox count;
- maximum source-to-Intent latency;
- retraction count;
- state inconsistency count.
