# Published Activity → user return map-close

Issue #186 closes the delivery map rooted at #173. The closing candidate owns one integrated verification package across Activity projection, personalized Feed, native Inbox, email delivery, rollback, recovery, browser behavior, and immutable evidence.

## Product return loop

```text
reviewed publication or editorial action
  -> integration Outbox event
  -> Activity projector and deterministic rebuild
  -> followed-panda Feed query
  -> NotificationIntent and native Inbox item
  -> optional email DeliveryJob and PGMQ message
  -> Resend submission using Delivery ID as the idempotency key
  -> signed provider webhook
  -> final delivered / failed / bounce / complaint state
  -> user returns to /{locale}/me/feed or /{locale}/me/inbox
```

FastAPI and PostgreSQL remain the sole authoritative business write path. The Web notification center calls only the authenticated Next.js proxy boundary. It first resolves the current session and does not request Inbox or preference data for a signed-out visitor.

## Private Web surfaces

The map-close candidate enables these feature-flagged private routes:

- `/{locale}/me/feed`
- `/{locale}/me/inbox`
- `/{locale}/me/passport`

`/{locale}/me/inbox` is dynamic, no-store through its API boundary, and `noindex`. It provides:

- unread count, one-item read, and read-all behavior;
- correction and retraction tombstones;
- stable cursor pagination;
- `zh-CN` and English copy;
- optional email preferences that remain separate from Follow;
- an immutable mandatory boundary for security and role notifications;
- signed-out, blocked-account, unavailable, empty, and populated states;
- keyboard-sized controls and a 320 px no-overflow browser contract.

The production budget is enforced by `npm run check:notification-center-budget`:

- first-load JavaScript gzip limit: 140 KiB;
- estimated initial transfer gzip limit: 500 KiB.

## Authoritative gates

Linux is the only full authoritative map-close gate. It runs the complete default release certification, browser matrix, secure boundary checks, Follow-through-login, Inbox return-loop browser journey, admin shell, and immutable map-close manifest.

Windows runs a separate compatibility gate rather than duplicating the complete expensive certification. It verifies:

- release orchestration contracts;
- Web lint, TypeScript, and production build;
- locked FastAPI environment, Ruff, and regression tests;
- the private Inbox and notification preference Chromium journey.

The Linux Supabase job runs only after both Linux authoritative and Windows compatibility gates pass. It resets the database and executes:

- `test_engagement_real_db.py`;
- `test_activity_projection_real_db.py`;
- `test_feed_real_db.py`;
- `test_notification_real_db.py`;
- identity deletion, retry, and transaction restore drill;
- notification staging evidence collection.

## Evidence artifacts

The Linux map-close job uploads `release-gate-map-close`. The Windows job uploads `release-gate-map-close-windows`. The PostgreSQL/PGMQ job uploads `supabase-foundation`.

The `supabase-foundation` artifact contains:

```text
.release-gate/activity-real-db.xml
.release-gate/engagement-real-db.xml
.release-gate/feed-real-db.xml
.release-gate/notification-real-db.xml
.release-gate/identity-engagement-recovery.json
.release-gate/notification-staging.json
.release-gate/published-return-foundation-manifest.json
.release-gate/published-return-foundation-manifest.sha256
```

The manifest binds every evidence file to the candidate commit and records SHA-256, byte length, platform, generation time, map issue #173, and closing issue #186.

## External transport staging

`npm run drill:notification-staging` is fail-closed and never prints credentials, recipient addresses, or provider message IDs. It requires:

- `RESEND_API_KEY`;
- `RESEND_FROM_EMAIL`;
- `RESEND_WEBHOOK_SECRET`;
- `AUTH_SMTP_HOST`;
- `AUTH_SMTP_PORT`;
- `AUTH_SMTP_USERNAME`;
- `AUTH_SMTP_PASSWORD`;
- `AUTH_SMTP_FROM_EMAIL`;
- `NOTIFICATION_STAGING_TO_EMAIL`.

The Resend API credential, webhook secret, and Auth SMTP credential must be distinct. When all values exist, the drill sends one repository-owned Resend staging message with the Delivery ID as the provider idempotency key, verifies the signed webhook algorithm, sends one independent TLS Auth SMTP message, and stores only hashes of provider and recipient identifiers.

When credentials are absent, the report outcome is `environment-blocked`, `provider_request_attempted` is false, and the missing environment names are recorded. This state is honest evidence but is not sufficient to close #173. As of July 30, 2026, the repository has no configured Actions secrets, so external Resend and custom Auth SMTP staging remains the final environmental blocker.

## Feature-flag rollback

To stop new external mail while retaining authoritative notification facts:

```text
NOTIFICATION_EMAIL_ENABLED=false
```

Keep `NOTIFICATION_ENABLED=true`. NotificationIntent, native Inbox, read state, preference state, Outbox receipts, and queued facts remain intact. Delivery workers extend PGMQ visibility while email is paused; they do not destroy messages or rewrite domain facts.

The Web notification center can be withdrawn independently with:

```text
NEXT_PUBLIC_NOTIFICATION_ENABLED=false
```

This removes navigation and returns the route to the feature-disabled boundary without deleting private data.

## Closing rule

Issue #186 and parent #173 may close only when:

1. the Draft Development Gate passes;
2. the final candidate receives `delivery:map-close` exactly once;
3. Linux authoritative, Windows compatibility, and Supabase foundation jobs pass;
4. `notification-staging.json` has outcome `passed`, not `environment-blocked`;
5. final artifact URLs and manifest hashes are recorded on #186;
6. no required check modified tracked files.
