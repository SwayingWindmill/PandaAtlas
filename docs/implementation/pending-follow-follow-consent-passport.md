# Pending Follow, Follow, consent, and private Panda Passport

Issue: #179

Parent delivery map: #172

## Purpose and ownership

This slice implements the Identity & Engagement boundary for account-backed Panda relationships. A signed-out visitor may create a short-lived Pending Follow Intent, authenticate with a Supabase email OTP, and complete exactly one idempotent Follow command. Follow, notification consent, and the private Panda Passport remain separate records and separate commands.

FastAPI and PostgreSQL are the sole authoritative business-write path. The browser never writes to `engagement`, `identity`, `integration`, PGMQ, or Supabase business tables directly.

Identity & Engagement owns:

- Pending Follow Intent lifecycle;
- current Follow relationship and immutable Follow events;
- category/channel notification consent and immutable consent events;
- private Passport projection and rebuild;
- deletion of Engagement-private account data;
- related audit facts, Transactional Outbox events, and PGMQ transport messages.

Community remains authoritative for accepted contribution facts. `engagement.passport_contribution_events` is only a private, deletable, idempotent projection input copied from an upstream Community event. It does not replace Submission, ReviewCase, Change Set, Release, provenance, or publication state.

## Feature flags and cutover

All switches default to disabled:

- FastAPI `IDENTITY_AUTH_ENABLED`: required before authenticated Engagement commands can resolve an account.
- FastAPI `ENGAGEMENT_ENABLED`: hides every Engagement API route behind a safe `404` while disabled.
- Web `NEXT_PUBLIC_ENGAGEMENT_ENABLED`: hides the Follow CTA and renders Passport as not enabled while disabled.
- FastAPI `PENDING_FOLLOW_TTL_SECONDS`: bounded by configuration to 60–3600 seconds; production default is 3600.

Recommended cutover order:

1. Apply additive migration `0011_engagement_follow_consent_passport.sql` while both Engagement flags remain disabled.
2. Run a fresh Supabase reset and `npm run infra:preflight`; confirm `engagement` is absent from Data API schemas and `anon`/`authenticated` have no schema usage.
3. Confirm #178 identity authentication is enabled and real Supabase sessions reach `/api/v1/identity/session`.
4. Deploy FastAPI with `ENGAGEMENT_ENABLED=false` and the web build with `NEXT_PUBLIC_ENGAGEMENT_ENABLED=false`.
5. Exercise Pending Intent, Follow, consent, Passport rebuild, contribution projection, and deletion against staging through server-side clients.
6. Enable FastAPI `ENGAGEMENT_ENABLED=true`.
7. Enable web `NEXT_PUBLIC_ENGAGEMENT_ENABLED=true` only after FastAPI health, Outbox, queue, and audit checks pass.
8. Verify signed-out and signed-in Follow journeys, then monitor the metrics below.

Disabling the web flag removes the user-facing entry points. Disabling the FastAPI flag is the authoritative emergency stop and makes all Engagement routes return safe `404` without deleting state.

## Local configuration

FastAPI:

```text
IDENTITY_AUTH_ENABLED=true
ENGAGEMENT_ENABLED=true
PENDING_FOLLOW_TTL_SECONDS=3600
DATABASE_URL=postgresql+psycopg://postgres:postgres@host.docker.internal:54322/postgres
```

Next.js:

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
API_BASE_URL=http://127.0.0.1:8000
SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENGAGEMENT_ENABLED=true
```

`API_BASE_URL` is server-only and is the sole FastAPI target permitted to receive a verified Supabase Bearer token. `SITE_URL` pins the email OTP return origin; it must be the reviewed public origin in staging and production and must not be derived from the request `Host` header.

Do not expose the Supabase secret key, raw Pending Follow handles, FastAPI administrative credentials, OTPs, JWTs, or signed URLs through `NEXT_PUBLIC_*` variables.

## Data contracts

Private schema `engagement` owns:

- `pending_follow_intents`: hashed primary and continuation handles, stable Panda ID, locale, safe return path, status/outcome, one-hour maximum lifetime, request/correlation IDs, and optional completing account;
- `follows`: one current relationship per account/Panda, active or inactive state, immutable first-follow history, current activation time, and optimistic version;
- `follow_events`: append-only followed/unfollowed events keyed by irreversible account-subject hash and command idempotency key;
- `notification_preferences`: current category/channel consent state and version;
- `notification_preference_events`: append-only consent changes keyed by irreversible account-subject hash;
- `passport_contribution_events`: insert-only during normal projection processing, private inputs keyed by upstream source event ID, protected from updates, and deletable only by the account privacy workflow;
- `passport_entries`: private read projection that may represent Follow history, contribution history, or both;
- `last_viewed_profiles`: account-private server-side last-viewed state reserved for authenticated experiences; the current public Recent Profiles UI remains browser-local;
- `audit_events`: Engagement command and lifecycle audit facts.

`anon` and `authenticated` receive no usage or object privileges on `engagement`. FastAPI connects using the server database role.

### Pending Follow handles

- Raw handles are high-entropy opaque values and are stored only as SHA-256 hashes.
- Same-device primary handles use a short-lived Secure, HttpOnly, SameSite=Lax cookie in production.
- Cross-device continuation handles are carried in the URL fragment, POSTed to a same-origin server route, and immediately removed with `history.replaceState`.
- A continuation handle restores only Panda, locale, safe return path, and Pending Intent context. It never authenticates, establishes a Supabase session, creates a Follow, or changes consent.
- Pending lifetime is never extended beyond the original expiry when context is reused.

### Passport contribution projection

A trusted Community consumer calls the internal repository command with:

- upstream `source_event_id`;
- account ID;
- stable Panda ID;
- upstream occurrence time;
- correlation ID.

The source event ID is the idempotency boundary. Replaying the same account/Panda/source event returns the existing projection without incrementing the count. Reusing it for another account or Panda fails. No browser or public HTTP contribution-write endpoint is exposed by this slice.

Passport rebuild deletes the projection and reconstructs it from current Follow rows plus all retained private contribution projection events. Contribution-only entries have no relationship state or Follow timestamps.

## Canonical web routes and aliases

The public Panda route family is:

- `/{locale}/pandas`
- `/{locale}/pandas/{canonical_slug}`

These are the only Panda collection/profile routes that return `200`. `/{locale}/atlas`, `/{locale}/atlas/{reference}`, unlocalized `/atlas` and `/pandas`, reviewed historical Panda aliases, `/{locale}/my-pandas`, and `/my-pandas` return one permanent `308` directly to the final canonical destination while preserving safe query state. Internal navigation, language alternates, canonical metadata, staged withdrawal verification, and `sitemap.xml` emit only `/pandas` URLs.

The private account surface is `/{locale}/me/passport`. It is `noindex`, omitted from the sitemap, and linked only from authenticated Follow/Passport journeys. Legacy My Pandas URLs permanently redirect to it.

Pending Follow never trusts a browser return path. FastAPI resolves the supplied Panda reference to the current stable ID and canonical slug, then stores `/{locale}/pandas/{canonical_slug}` as the only completion destination. The login page separately allowlists administrator, canonical Panda, Passport, and feed paths; external origins, protocol-relative paths, backslashes, and arbitrary public routes fail closed.

Disabling `NEXT_PUBLIC_ENGAGEMENT_ENABLED` removes Follow and Passport entry points without restoring Saved Panda. Disabling `ENGAGEMENT_ENABLED` remains the authoritative API stop. Route aliases and canonical public Panda reads remain available during an Engagement rollback.

## HTTP commands and reads

Anonymous Pending Intent surfaces:

- `POST /api/v1/follow-intents`
- `GET /api/v1/follow-intents/current`
- `POST /api/v1/follow-intents/cancel`

Authenticated Follow surfaces:

- `POST /api/v1/me/follows/complete-pending`
- `POST /api/v1/me/follows/{panda_id}`
- `DELETE /api/v1/me/follows/{panda_id}`
- `GET /api/v1/me/follows/{panda_id}`

Consent and Passport:

- `PUT /api/v1/me/notification-preferences/{category}/{channel}`
- `GET /api/v1/me/passport`
- `POST /api/v1/me/passport/rebuild`
- `POST /api/v1/me/engagement-data/delete`

Next.js same-origin server routes keep the primary Pending Follow handle in an HttpOnly cookie and forward a verified Supabase Bearer token to FastAPI. The access token and raw primary handle are never returned to browser JavaScript.

## Idempotency and state semantics

- Follow uniqueness is enforced by `(account_id, panda_id)`.
- Follow and Unfollow commands replay immutable Follow events by account-subject hash plus idempotency key before evaluating current state.
- Completing a terminal Pending Intent returns its stable prior result.
- Next.js derives complete/cancel idempotency keys from the stable Intent ID, so a network retry does not create a second command or queue message.
- Already-followed completion consumes the Pending Intent with outcome `already_followed`; it does not duplicate first-follow history.
- Expired Intent permits the authenticated session to remain but creates no Follow.
- Suspended, deleting, and deleted accounts are rejected by the authenticated command dependency.
- Follow never inserts or modifies notification preferences.
- Consent is a separate versioned command for one category/channel pair.
- Outbox insertion uses `(source_context, idempotency_key)` uniqueness; PGMQ receives a message only when the Outbox insert succeeds for the first time.

Status semantics:

- `401`: no valid Supabase session for an authenticated command;
- `403`: authenticated account is unavailable, deletion is blocked, or recent authentication is required for private-data deletion;
- safe `404`: feature disabled, unknown handle, missing Follow, or protected resource not disclosed;
- `409`: idempotency key/source event reused for another command or terminal-state conflict;
- `503`: PostgreSQL, audit, Outbox, or Engagement service unavailable.

## Events

Version 1 Outbox events currently emitted:

- `pending_follow.created`
- `pending_follow.cancelled`
- `pending_follow.expired`
- `follow.activated`
- `follow.confirmed`
- `follow.deactivated`
- `notification_consent.changed`
- `passport.contribution-recorded`
- `passport.rebuilt`
- `engagement.private_data.deleted`

Payloads contain stable internal IDs, event type/schema version, aggregate ID/version, correlation ID, and bounded routing facts. They must not contain raw handles, email addresses, OTPs, JWTs, authorization headers, signed URLs, private notes, or unrestricted evidence data.

Feed and notification consumers must re-evaluate current account, Follow, preference, suppression, and publication eligibility. An Outbox or queue event is not permission to send by itself.

## Account deletion

The deletion command requires recent authentication and an Identity account already in `deleting`. It locks that account row for the transaction so ordinary Engagement writes cannot race the privacy cleanup. In one transaction it:

1. removes completing-account references from Pending Intents;
2. deletes Passport entries;
3. deletes notification preferences;
4. deletes account last-viewed rows;
5. deletes private Passport contribution projection inputs;
6. deletes current Follow rows;
7. records counts in audit and Outbox facts.

Append-only Follow and consent events retain only irreversible account-subject hashes and no account foreign key. Community’s authoritative accepted/published contribution provenance is handled by its own deletion/anonymization policy; deleting the Engagement projection input does not delete an independently justified Archive fact.

Browser-local Recent Profiles and legacy Saved keys are cleared by the client storage boundary and are never imported into Follow, Passport, Feed, analytics, or consent.

## Metrics and alerts

Expose at least:

- Pending Intent created/completed/cancelled/expired counts and completion latency;
- oldest pending age and intents expiring without completion;
- Follow activation/deactivation/already-followed/replay/conflict rates;
- active Follow count and first-follow completion rate;
- consent changes by category/channel and enabled/disabled outcome;
- Passport projection lag, rebuild duration/failure, contribution source-event replay, and projection mismatch count;
- private-data deletion attempts, duration, retries, and rows removed by class;
- Engagement 401/403/404/409/503 counts;
- Outbox age, queue depth, handler retries, DLQ size, and reconciliation mismatch;
- audit write failures and PGMQ transactional-send failures.

Alert on:

- pending age beyond one hour or a persisted pending row past expiry cleanup;
- repeated duplicate/conflicting idempotency keys;
- Follow state without a matching Passport projection after the bounded lag;
- Passport rebuild mismatch against Follow plus contribution inputs;
- deletion workflow stalled or private rows remaining after completion;
- non-empty DLQ, continuously growing queue, missing worker heartbeat, or stale Outbox;
- any `anon`/`authenticated` privilege on `engagement`;
- audit or Outbox write failure.

## Rollback

To stop the slice without destructive migration rollback:

1. Disable web `NEXT_PUBLIC_ENGAGEMENT_ENABLED` and deploy; Follow CTA disappears and Passport reports that it is not enabled while local Recent Profiles remain usable.
2. Disable FastAPI `ENGAGEMENT_ENABLED`; all Engagement API routes return safe `404`.
3. Pause Engagement consumers of `integration_events` if their handler is implicated, while retaining Outbox and logged PGMQ messages.
4. Do not drop `engagement`, remove append-only events, purge queues, or reverse migration `0011`.
5. Reconcile Follow, consent, Passport, audit, Outbox, and queue state; forward-fix the application or projector.
6. Rebuild affected Passports from retained Follow and contribution projection inputs.
7. Re-enable FastAPI first, validate commands and consumers, then re-enable the web flag.

Rollback of the web or API flag does not alter existing Follow or consent state. It also does not recall already delivered email; later correction/retraction follows the notification architecture contract.

## Verification

Required evidence before cutover:

- fresh Supabase reset through migrations `0001`–`0011`;
- foundation preflight proving nine Engagement relations, three strict append-only triggers, Contribution update protection with privacy deletion allowed, no browser-role schema usage, and transactional PGMQ behavior;
- API unit/security suite;
- real PostgreSQL Pending Intent, Follow, consent, Follow-plus-contribution Passport rebuild, replay, expiry, cancellation, and deletion tests;
- web lint, TypeScript, production build, Follow/Passport browser tests, 320 px reflow, no-JavaScript fallback, and admin-login regression;
- repository Release Gate and clean diff/security review.
