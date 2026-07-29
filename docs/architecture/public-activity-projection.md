# Public Activity projection

Issue #182 introduces Public Activity as a rebuildable bounded context between published Archive state and the later Feed and Notification contexts.

## Ownership

Public Activity owns:

- the public-safe `ActivityItem` projection and stable `(published_at, activity_id)` ordering;
- stable Panda and institution targets;
- source-event consumption receipts, duplicate evidence, projection lag, failures, and rebuild state;
- authorized editorial announcement source records and their audit events;
- downstream Activity integration events.

Public Activity does not own Archive facts, Follows, Feed eligibility, notification channel selection, community submissions, review records, private evidence, or account data.

## Accepted sources

Two source boundaries are accepted:

1. A published Archive revision may include zero or more reviewed `activities` descriptors in `EntityRevisionPayload`. Publishing the containing batch writes the corresponding `archive.activity.*` event to `integration.outbox_events` in the same PostgreSQL transaction as the Archive Release.
2. `ActivityRepository.publish_editorial` accepts an `EditorialAnnouncementCommand` only from an active `RequestIdentity` with `activity.editorial.publish`. Site-wide placement additionally requires `activity.sitewide.publish`; a bounded pin additionally requires `activity.pin.manage`.

Drafts, rejected Change Sets, submissions, review results, raw attachments, private sources, contributor identities, internal notes, Follow counts, and restricted facts cannot pass the strict Activity Pydantic contracts. Source references must resolve through `public.public_evidence_sources`. Media must resolve to a UUID-backed `public-media` asset with a public HTTP(S) path and a non-empty reviewed license.

## Activity contract

Approved type codes are:

- `panda.birth`
- `panda.death`
- `panda.named`
- `panda.relocated`
- `panda.birthday`
- `panda.health_major`
- `archive.profile_corrected`
- `editorial.announcement`

Every item carries a stable source type, source ID, source version, source event ID, target IDs, importance, visibility, site-wide and notification eligibility, occurrence time and precision, publication time, localization key/version, reviewed localized snapshots, optional approved media, optional bounded pin, and public release provenance.

Archive descriptors cannot impersonate editorial announcements, request site-wide distribution, or create pins. Site-wide and pinned items must be public, pin windows must be bounded, and a PostgreSQL-serialized capacity check allows at most three overlapping pins. Simplified Chinese content is mandatory for V1. Importance overrides require a recorded reason.

## Projection actions

- `publish` creates a deterministic Activity ID for a new source.
- `snapshot_update` updates public presentation without changing the original `published_at` ordering key or emitting a fresh notification-worthy item.
- `correction` creates a new correction Activity and marks the prior item as corrected.
- `retraction` retains internal history, marks the latest item retracted, and removes it from ordinary public queries.

Archive batch rollback and emergency takedown commands are not inferred from complete snapshot contents in this slice. They must publish explicit source-level correction or retraction descriptors. The full rollback/takedown bridge remains owned by issue #194.

## Idempotency and ordering

One canonical non-duplicate projection receipt is allowed for each `source_type + source_id + source_version + action` tuple. Every consumed `event_id`, including a semantic duplicate with a different event ID, receives its own receipt so polling cannot repeatedly select it.

A SHA-256 digest of the canonical public source payload prevents the same source version from being reused with different content. Editorial command IDs also bind to the original actor and a command-payload SHA-256, so a reused command ID cannot silently publish changed content. Exact event replay increments `replay_count`; a separate semantic duplicate receipt records delivery under a different event ID without creating another item or downstream event.

Projection uses a PostgreSQL transaction-level advisory lock per source. Public pagination uses the stable reverse-chronological key `(published_at, activity_id)`.

## Commands and switches

From the repository root:

```text
ACTIVITY_ENABLED=true DATABASE_URL=... npm run activity:project
ACTIVITY_ENABLED=true DATABASE_URL=... npm run activity:project -- --event-id <uuid>
ACTIVITY_ENABLED=true DATABASE_URL=... npm run activity:rebuild
ACTIVITY_ENABLED=true DATABASE_URL=... npm run activity:rebuild -- --mark-as-backfill
```

`ACTIVITY_ENABLED=false` is the authoritative projector stop switch. Archive publication may continue writing source events to the transactional Outbox while projection is disabled. Re-enabling the projector consumes the backlog without changing Archive publication success.

A normal rebuild truncates only rebuildable Activity items, targets, and receipts, then replays accepted source events in source order. `--mark-as-backfill` additionally marks rebuilt items and receipts as historical backfill so later attribution logic can exclude them.

## Downstream integration events

Successful non-backfill projections write one of:

- `activity.item.published`
- `activity.item.updated`
- `activity.item.corrected`
- `activity.item.retracted`

The downstream payload contains only the Activity ID, stable Panda/institution target IDs, type, importance, visibility, site-wide flag, notification eligibility, publication time, backfill flag, and projection outcome. Feed and Notification Orchestration must use these stable IDs and apply their own Follow, account, preference, mute, and delivery rules.

## Metrics

`ActivityRepository.metrics()` exposes:

- canonical projected event count;
- exact and semantic replay count;
- backfilled canonical event count;
- failed source-event count;
- maximum projection lag in seconds;
- canonical event counts by Activity type.

`activity.projection_failures` stores bounded failure evidence without copying source payloads or private data.

## Security and storage

Migration `0012_public_activity_projection.sql` creates a private `activity` schema. `anon` and `authenticated` have no schema usage or table/function privileges. FastAPI/PostgreSQL remains the sole business write path. Editorial sources, editorial audit events, and projection failures are append-only; Activity items and receipts remain rebuildable projection state.
