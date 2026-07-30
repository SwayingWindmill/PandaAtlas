# Notification orchestration, native Inbox, and email delivery

Issues #184 and #185 define the private Notification context on top of Public Activity, Identity, Engagement preferences, contribution-review events, PostgreSQL Outbox records, PGMQ, and Resend.

## Ownership

Notification owns:

- source-event receipts and logical Notification Intent deduplication;
- the audience snapshot used when an Intent is created;
- channel decisions and the exact preference version used for each decision;
- native Inbox items, unread counts, and explicit read commands;
- immutable daily and weekly Digest snapshots;
- email delivery jobs, TransportAttempt evidence, retry and dead-letter state;
- signed provider-webhook receipts and email suppression state;
- correction and retraction propagation;
- notification-specific audit and operational metrics.

It does not own Archive facts, Activity content, Follow commands, account state, submission review decisions, Supabase Auth email, or public user profiles. Application notification email and Supabase Auth email must use separate credentials and operational boundaries.

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

Follow and email consent are separate. A Follow makes the native station Inbox eligible, but does not enable email.

Every Intent stores:

- the account and account-state audience snapshot;
- the category;
- whether the message is mandatory;
- the exact preference snapshot and preference versions;
- a public-safe content snapshot;
- a decision for station, email, and web push.

Absent optional consent produces `suppressed` with reason `consent_absent`. Explicit opt-out produces `preference_disabled`. Mandatory security/role messages force station and email and cannot be disabled.

The existing Engagement preference route remains compatible, but writes to Notification-owned preference tables:

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

## Delivery chain

The delivery path is deliberately split into durable stages:

```text
notification.intent.created / notification.digest.queued
  -> transport Outbox receipt
  -> notification_deliveries PGMQ message
  -> database lookup + repository-owned template render
  -> Resend API with Idempotency-Key = Delivery ID
  -> submitted DeliveryJob + TransportAttempt evidence
  -> signed Resend webhook
  -> notification_webhooks PGMQ message
  -> final delivered / failed channel and Digest state
  -> bounce / complaint suppression for future email
```

PGMQ messages contain only stable identifiers and routing metadata:

- Delivery ID;
- source event ID;
- target type and target ID;
- correlation ID;
- schema version.

Recipient email, subject, rendered HTML/text, preference snapshots, and Activity content are never placed in PGMQ or a DLQ. The worker reads those values inside its database transaction immediately before delivery.

The four logged queues are:

```text
notification_deliveries
notification_deliveries_dlq
notification_webhooks
notification_webhooks_dlq
```

Workers use `pgmq.read`, visibility timeouts, `pgmq.set_vt`, and `pgmq.archive`. They never use destructive `pgmq.pop`. A crash before the transaction commits makes the message visible again; a repeated provider request uses the same Delivery ID as the Resend idempotency key.

## Retry and dead-letter policy

Retryable provider outcomes include transport failures, timeouts, HTTP 408/409/425/429, and HTTP 5xx. Backoff is exponential and bounded. The defaults are five attempts, a 30-second base delay, and a one-hour cap.

After exhaustion, the original queue message is archived and an ID-only record is sent to `notification_deliveries_dlq`. The DeliveryJob and TransportAttempt retain the failure code and correlation identity. Operator requeue is explicit and limited to failed or dead-lettered deliveries:

```text
npm run notification:retry -- --delivery-id <uuid>
```

DLQ records are retained as operational evidence; requeue does not silently erase them. Each explicit operator requeue starts a new bounded retry cycle while TransportAttempt numbers continue increasing across cycles.

## Provider webhook boundary

Resend callbacks enter through:

```text
POST /api/v1/webhooks/resend
```

The route is available only when Resend email delivery is enabled. It verifies `svix-id`, `svix-timestamp`, and `svix-signature` against the raw request body and enforces a five-minute timestamp tolerance before writing any provider event.

Webhook bodies are capped at 64 KiB. Only a minimal provider projection is retained: provider event ID, event type, provider message ID, provider timestamp, and bounce type. Recipient addresses, subjects, and rendered content are not copied from the webhook payload.

Duplicate provider event IDs are harmless. A hard bounce or complaint creates an account email suppression and disables only pending email delivery. Native Inbox/station delivery remains enabled. Supabase Auth email is not changed by this application suppression.

## Templates

Version 1 templates are repository-owned and reviewed in both HTML and plain text:

```text
services/api/app/notification/templates/zh-CN/
services/api/app/notification/templates/en/
```

Intent and Digest templates escape public-safe snapshot content before HTML substitution. Email links point to the private localized Inbox. Template key, version, and locale are recorded on each DeliveryJob and included in provider request metadata.

## Privacy deletion

When account state is `deleting`, the existing private-data deletion command removes identifiable Notification preferences, Intents, channel decisions, Inbox items, delivery attempts, Digest items/batches, DeliveryJobs, TransportAttempts, and email suppressions. The TransportAttempt immutability trigger permits deletion only through this account-state boundary.

PGMQ/DLQ messages and provider webhook evidence do not contain recipient email, subject, or rendered content. Transport Outbox receipts retain the source-event ID under the existing private Outbox retention boundary. Existing hashed preference/read evidence and audit records remain subject to the established legal/audit retention boundary.

## Feature flags and configuration

Backend switches:

```text
NOTIFICATION_ENABLED=false
NOTIFICATION_EMAIL_ENABLED=false
NOTIFICATION_CURSOR_SIGNING_KEY=<deployment-secret>
NOTIFICATION_TRANSPORT=resend
NOTIFICATION_PUBLIC_BASE_URL=https://<public-host>
NOTIFICATION_WORKER_VISIBILITY_TIMEOUT_SECONDS=120
NOTIFICATION_WORKER_MAX_ATTEMPTS=5
NOTIFICATION_WORKER_BASE_BACKOFF_SECONDS=30
NOTIFICATION_QUEUE_ALERT_DEPTH=100
NOTIFICATION_QUEUE_ALERT_AGE_SECONDS=300
RESEND_API_URL=https://api.resend.com/emails
RESEND_API_KEY=<application-notification-key>
RESEND_FROM_EMAIL=<reviewed-sender>
RESEND_WEBHOOK_SECRET=<signed-callback-secret>
```

`NOTIFICATION_EMAIL_ENABLED` requires `NOTIFICATION_ENABLED`. Resend credentials and the signed webhook secret are required before email can be enabled. The application Resend API credential must differ from both the signed webhook secret and the Supabase Auth SMTP credential.

Worker commands each process one bounded batch and are suitable for a scheduler or managed worker loop:

```text
npm run notification:relay -- --limit 100
npm run notification:deliver -- --limit 100
npm run notification:webhooks -- --limit 100
```

## Rollout and rollback

Recommended rollout:

1. apply `0014_notification_orchestration.sql` and `0015_notification_delivery_workers.sql` with both flags disabled;
2. run `npm run infra:preflight` and confirm the four queues are logged, private schemas remain inaccessible to browser roles, and ten Notification immutability triggers are present;
3. configure a deployment-specific cursor key, public base URL, Resend key, sender, and webhook secret;
4. enable `NOTIFICATION_ENABLED=true` and run the projector/Inbox acceptance tests;
5. run the relay and delivery workers with `NOTIFICATION_EMAIL_ENABLED=false`; queued delivery messages remain paused through visibility timeouts;
6. configure the signed Resend webhook and verify duplicate, delivered, bounce, and complaint callbacks;
7. enable `NOTIFICATION_EMAIL_ENABLED=true` and monitor queue depth, age, provider latency, retries, and DLQs.

Rollback is non-destructive:

- set `NOTIFICATION_EMAIL_ENABLED=false` first; workers stop provider sends and keep delivery messages recoverable;
- stop relay/delivery/webhook worker schedules;
- set `NOTIFICATION_ENABLED=false` only when the Inbox/projector must also be disabled;
- keep `0015` tables and queues in place so attempts, DLQ evidence, and webhook receipts remain available;
- after correction, re-enable email and explicitly requeue only reviewed failed/dead-lettered Delivery IDs.

Do not drop a queue, delete TransportAttempt evidence, or retry the entire DLQ as a rollback shortcut.

## Metrics and alerts

`GET /api/v1/notification/metrics` requires administrator authentication and reports:

- created Intent and suppression counts;
- unread Inbox, source-to-Intent latency, retractions, and state inconsistencies;
- queue depth and oldest visible message age for all four queues;
- retry and dead-letter counts;
- maximum provider latency and provider-error count;
- bounce and complaint counts;
- webhook signature-verification failures;
- threshold-derived queue/DLQ alerts.
