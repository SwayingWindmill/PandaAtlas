# Personalized Feed queries and Activity web surfaces

Issue #183 adds the account-scoped Feed read model and the first public Activity web surfaces on top of the Public Activity projection introduced by issue #182.

## Ownership

The Feed context owns:

- account-scoped eligibility derived from the current Follow state;
- the explicit last-viewed command and its private account state;
- account-bound and target-bound signed cursors;
- Feed query latency, empty-result, cursor-error, and Activity projection-lag metrics;
- private Feed HTTP and web surfaces.

The Feed context does not own Activity content, Archive facts, Follow commands, account lifecycle, notification channel selection, delivery, recommendations, ranking, popularity, public user profiles, or social graphs.

## Eligibility and ordering

The personalized Feed contains only:

1. public Activity targeting a Panda that the account currently follows;
2. at most 90 days of Activity published before the current Follow began, labelled `history` and never attributed to the relationship;
3. approved site-wide Activity whose bounded pin window is active.

Activity published on or after `followed_at` is labelled `followed`. Site-wide pins with no matching Follow are labelled `pinned`. Unfollowing a Panda removes both relationship-attributed and pre-Follow historical items from the next query immediately; no Feed denormalization or cleanup job is required.

Items are ordered only by `(published_at desc, activity_id desc)`. There is no recommendation score, popularity score, follower count, sharing count, behavioural profile, or offset pagination.

## Corrections, retractions, and deleted targets

Corrected originals are excluded and the explicit `archive.profile_corrected` Activity is returned in publication order.

Retracted Activity remains visible as a tombstone. Before returning it, the Feed boundary replaces the original localized snapshots with generic bilingual tombstone text, removes media, clears public source references, and disables notification eligibility. The reviewed public retraction reason remains available.

If a target Panda no longer resolves to a public profile, the Activity remains visible with `deleted_target_ids`. The web surface renders a non-linking unavailable-profile marker instead of fabricating a replacement identity.

## Cursor contract

Feed cursors contain only the stable publication key and an explicit scope:

- private scope: `account:<account_id>`;
- public Panda scope: `panda:<stable_panda_id>`.

The serialized cursor is signed with HMAC-SHA256 using `FEED_CURSOR_SIGNING_KEY`. Reusing a cursor for another account or Panda fails with HTTP 400. Production-like environments fail startup when Feed is enabled with the local placeholder signing key.

## Explicit last-viewed command

Reading the Feed never writes account state. The browser exposes a separate “mark current Activity viewed” action that calls:

```text
POST /api/v1/me/feed/last-viewed
```

The command requires an active account, a timezone-aware non-future timestamp, and an account-scoped idempotency key. The timestamp is monotonic. Successful commands write:

- `feed.account_state`;
- append-only `feed.last_viewed_events` using a hashed account subject;
- an Engagement audit event;
- a `feed.last_viewed.marked` integration Outbox event.

Account private-data deletion removes identifiable `feed.account_state`. Append-only hashed event evidence remains without a reversible account identifier.

## HTTP and caching

Private Feed routes:

- `GET /api/v1/me/feed`
- `POST /api/v1/me/feed/last-viewed`

Both use active Supabase identity, `Cache-Control: private, no-store`, and `X-Robots-Tag: noindex, nofollow`.

Public Activity route:

- `GET /api/v1/pandas/{panda_id}/activity`

It uses the stable Panda identity, public-safe Activity only, and `public, max-age=60, stale-while-revalidate=300` caching.

The private Next.js page is `/{locale}/me/feed`. It is dynamically rendered, no-store, noindex/nofollow/nocache, and redirects unauthenticated users through the safe localized login return path. Public Panda profile Activity is server-rendered and remains useful without JavaScript.

## Feature flags and rollout

Backend switches:

```text
FEED_ENABLED=false
ACTIVITY_ENABLED=false
FEED_CURSOR_SIGNING_KEY=<deployment-secret>
```

Web switch:

```text
NEXT_PUBLIC_FEED_ENABLED=false
```

Recommended rollout:

1. apply migration `0013_personalized_feed_queries.sql` with Feed disabled;
2. confirm the private `feed` schema, append-only trigger, and Public Activity projection health;
3. configure a deployment-specific cursor signing key;
4. enable `FEED_ENABLED=true` while keeping the web surface disabled;
5. exercise authenticated API reads and explicit last-viewed commands;
6. build and deploy the web application with `NEXT_PUBLIC_FEED_ENABLED=true`.

Rollback is non-destructive: disable `NEXT_PUBLIC_FEED_ENABLED`, then disable `FEED_ENABLED`. Public Archive pages remain available and Activity projection may continue. Re-enabling Feed immediately derives eligibility from current Follow and Activity state.

## Metrics

`GET /api/v1/feed/metrics` requires the administrator bearer token and reports process-local:

- query count;
- cursor error count;
- empty Feed count;
- failed page-load count;
- maximum query latency in milliseconds;
- maximum unprojected Activity source lag in seconds.

The private Feed response also exposes projection lag through `X-Feed-Projection-Lag` and `Server-Timing` without writing query telemetry to business tables.
