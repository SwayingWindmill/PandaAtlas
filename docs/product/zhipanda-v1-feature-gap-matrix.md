# ZhiPanda V1 Fan Product Gap Matrix

- Status: Active V1 closure checklist
- Date: 2026-08-10
- Governing architecture: [ZhiPanda V1 Architecture Baseline](../architecture/zhipanda-v1-architecture-baseline.md)
- Product priority: Panda fan experience first

## Status legend

- **Complete** — the fan-facing capability and its main supporting path exist.
- **Partial** — meaningful capability exists, but it does not yet satisfy the V1 fan-facing requirement.
- **Missing** — no equivalent V1 capability was found in the current application structure, API surface, and migrations inspected for this baseline.
- **Support only** — infrastructure exists but does not by itself complete the fan-facing product module.

## V1 matrix

| V1 capability | Status | Current implementation | Gap to close | Persistence / schema work |
|---|---|---|---|---|
| Panda discovery and search | **Complete** | Localized panda/atlas routes and search across names, slug, and search terms | Continue improving fan discovery UX; no foundational gap | No new foundation required |
| Panda profile | **Complete** | Localized panda detail, media, facts, current place, related content | Continue visual/product refinement | No new foundation required |
| Family / lineage | **Complete** | Structured lineage, relationship paths, source-aware parentage | Fan-facing polish only | No new foundation required |
| Map / location exploration | **Complete** | Map, institutions, places, residency-oriented data | Fan-facing polish and clearer discovery links | No new foundation required |
| Panda moments / timeline | **Complete** | `/[locale]/moments` and event/birthday aggregation | Keep as timeline/almanac experience | Authoritative event-type constraint aligned in migration 0036 |
| Calendar | **Complete** | `/[locale]/calendar` provides year/month browsing over published events plus birthday anniversaries derived from confirmed birth events, with links back to pandas and Moments | Keep Calendar as a view over the same event truth; never persist separate calendar facts | Reuses `listPublicMoments`; no new schema |
| User account | **Complete** | Identity/Auth plus signed-in personal surfaces | Keep login friction low and tied to persistence needs | Existing identity foundation |
| Favorite | **Complete** | Favorite is the single fan-facing saved-panda relationship. It reuses the existing account relationship that already powers Passport and Feed, so there is no separate Follow state for users to manage. | Keep notification consent as an optional preference attached to the saved relationship, not a second relationship | Existing `engagement.follows` is the single persistence relation; migration 0034 does not add a duplicate favorites table |
| Collections | **Complete** | Named private collections support create/rename/delete and panda membership through FastAPI and `/[locale]/me/collections` | WSL typecheck, targeted ESLint, production build, clean Supabase reset, API tests, and real PostgreSQL lifecycle verification pass | `engagement.collections` + `engagement.collection_pandas` added in migration 0034 |
| Location check-in | **Complete** | Private place check-ins now support dated visits from place pages and the personal memories view | Keep visit semantics independent from seeing a panda | `engagement.location_checkins` added in migration 0035 |
| Seen Panda | **Complete** | Private seen-panda records now support panda profile actions, optional place/date data, and the personal memories view | Never infer Seen Panda from a place check-in | `engagement.seen_pandas` added in migration 0035 |
| My Pandas / personal center | **Complete** | My Pandas now links favorites/collections, visits/seen-panda memories, and saved game history alongside Passport, Feed, Inbox, and Submissions | Keep the fan-owned data surfaces primary; Passport and Feed remain views powered by the same favorite relationship | No missing personal V1 module remains |
| Random Panda | **Complete** | `/[locale]/games/random` anonymously selects from the current published panda set and links directly to the selected profile | Keep it read-only and instant; no score or login requirement | Reuses published Panda/media data; no new schema |
| Guess Panda | **Complete** | `/[locale]/games/guess` runs anonymous four-choice rounds from pandas with published photos and reveals the profile immediately | Keep the live session score ephemeral; saved attempts remain explicit, private, and optional | Reuses published Panda/media data; no separate question bank |
| Game hub | **Complete** | `/[locale]/games` is the public entry point for Random Panda and Guess Panda and is linked from desktop/mobile navigation and sitemap | Keep the hub lightweight; games consume the same published Panda truth | No schema required |
| Game attempt history | **Complete** | Guess Panda remains anonymous by default, while signed-in fans can explicitly save private results to `/[locale]/me/game-history`, review them across devices, and delete them | Keep persistence opt-in and private; do not turn anonymous play into tracking or add a leaderboard without a separate product decision | `engagement.game_attempts` from migration 0037; correctness is computed server-side from canonical Panda IDs |
| Practical content admin | **Complete** | `/admin/pandas`, `/locations`, `/relationships`, `/events`, `/images`, `/sources`, `/games`, and `/users` now provide domain-oriented operating entry points into the existing Archive/Review/Moderation/Privacy/Audit workflows | Keep generic React-admin CRUD disabled; domain pages must preserve authority and capability boundaries | Reuses existing workbenches rather than creating a shadow admin data layer |
| Source support | **Support only** | Strong source/evidence modeling exists | Keep behind fan-facing content; expose only useful provenance affordances | Existing foundation |
| Media support | **Support only** | Media metadata, R2/release paths, reviewed publication support exist | Ensure fan profiles/games can reuse approved images cleanly | Existing foundation; admin UX may need work |
| SEO canonical / locale metadata | **Complete** | Canonical and localized metadata helpers are present | Maintain coverage as new routes are added | No schema work |
| SEO structured data | **Complete** | Localized panda profiles emit Schema.org JSON-LD with canonical URL, stable Panda ID, names, summary, and published image when available | Keep structured data derived from the same public profile view; expand to other entity types only when useful | No persistence required |

## V1 closure status

The fan-owned V1 loops in this matrix are now implemented: saved pandas and collections, real-world memories, games, calendar, personal-center integration, product-oriented admin entry points, and profile structured data all have usable product surfaces.

Archive governance, moderation, publication, feed, notification, contribution, source, and media capabilities remain supporting infrastructure. Future work should prioritize product quality, content depth, and measured fan use rather than adding parallel foundations or duplicate sources of truth.

## Completed implementation sequence

### Slice 1 — Favorite + Collection

Goal: make “I like this panda” and “I want to organize my pandas” first-class fan actions.

Deliverables:

- one saved-panda relationship presented to fans as Favorite;
- reuse that same relationship for cross-device sync, Passport, and Feed;
- Collection and CollectionPanda persistence;
- profile favorite action;
- collection add/remove flow;
- My Pandas integration;
- localized routes and browser tests.

### Slice 2 — Check-in + Seen Panda

Goal: let fans record their real-world panda experiences.

Deliverables:

- LocationCheckin persistence;
- SeenPanda persistence;
- visit/date/location semantics;
- add/manage flows from personal center and relevant place/panda pages;
- privacy defaults and delete/edit flows.

### Slice 3 — Games

Goal: create lightweight repeat-visit entertainment using existing panda data.

Deliverables:

- `/[locale]/games`;
- `/[locale]/games/random`;
- `/[locale]/games/guess`;
- Random Panda read-only flow first;
- Guess Panda question generation/selection using existing published data;
- add attempt persistence only after the anonymous game loop is working.

### Slice 4 — Calendar

Goal: turn existing birthdays and moments into a fan-friendly recurring destination.

Deliverables:

- `/[locale]/calendar`;
- month/date navigation;
- panda birthdays;
- notable events;
- direct links to panda profiles and Moments;
- no duplicate calendar database.

### Slice 5 — Personal-center closure

Goal: make the user's personal area a coherent fan dashboard.

Deliverables:

- Favorites;
- Collections;
- Check-ins;
- Seen pandas;
- optional game history;
- Passport and Feed positioned as views powered by the same favorite relationship, not separate relationship features.

### Slice 6 — Operating surfaces and discoverability

Goal: make the finished V1 maintainable and discoverable.

Deliverables:

- practical product admin entry points needed by the new modules;
- sitemap updates;
- structured data;
- event-type consistency cleanup;
- cross-route navigation and empty states;
- WSL-only lint, typecheck, tests, build, and release verification.

## V1 closure rule

A backend table, archive workflow, or adjacent feature does not count as completion of a fan-facing V1 capability unless the intended user can actually complete the corresponding experience from the product UI.

Likewise, a new UI must not create a second source of truth when an existing Panda, Location, Event, or identity model should be reused.
