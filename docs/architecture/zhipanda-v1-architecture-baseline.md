# ZhiPanda V1 Architecture Baseline

- Status: Governing baseline for V1 product implementation
- Date: 2026-08-10
- Product priority: Panda fan experience first
- Related decisions: [ADR 0001](adr-0001-single-source-api-boundary.md), [ADR 0002](adr-0002-managed-cloud-deployment-target.md)
- Runtime status: [Deployment runtime status](../deployment/runtime-status.md)

## 1. Product architecture starts from the fan experience

ZhiPanda V1 is first and foremost a product for panda fans.

Architecture choices must serve a simple user loop:

1. discover a panda;
2. understand the panda quickly;
3. explore family, places, events, photos, and related pandas;
4. save pandas and organize personal collections;
5. record places visited and pandas seen;
6. return through birthdays, calendar moments, updates, and lightweight games.

The product should feel warm, visual, exploratory, personal, and easy to use. Internal archival, review, provenance, and publication machinery may support this experience, but they are not the product's primary positioning and should not dominate public information architecture or implementation priorities.

## 2. V1 product modules

The V1 product baseline consists of the following modules.

### Panda

The Panda module is the core of the product. Every fan-facing relationship should resolve to the same stable `panda_id`.

Responsibilities:

- panda profile;
- Chinese and English names and aliases;
- search and discovery;
- profile media;
- current place and life summary;
- related pandas;
- links into family, timeline, map, calendar, collections, and games.

### Family

Responsibilities:

- parents and children;
- siblings and grandparents;
- family paths;
- structured lineage browsing;
- clear representation of uncertain or disputed parentage when needed.

### Location

Responsibilities:

- institutions and places;
- panda residency history;
- map exploration;
- current and historical panda presence;
- location detail pages.

### Event and Calendar

A single event model should support panda life moments and calendar experiences rather than creating separate competing fact stores.

Fan-facing event categories should support at least:

- birth;
- birthday anniversary;
- naming;
- public debut;
- transfer / arrival / return;
- breeding-related milestone;
- cub birth;
- other notable milestone;
- memorial / death where appropriate.

Calendar views should derive recurring birthdays from panda birth data and combine them with dated panda events.

### Favorite and Collection

Responsibilities:

- save a panda quickly;
- browse saved pandas;
- create named collections;
- add and remove pandas from collections;
- make personal organization available from the user's personal area.

Favorite is the single fan-facing saved-panda relationship. Existing Follow persistence is reused internally to power Favorite, Passport, and Feed; users must not be asked to manage a second Follow relationship. Notification consent remains a separate opt-in preference, not a relationship.

### Check-in and Seen Panda

These are two separate fan records.

`LocationCheckin` means the user visited a panda-related place.

`SeenPanda` means the user personally saw a particular panda, optionally associated with a location and visit date.

Neither record should be inferred automatically from the other.

### Game

V1 game scope is intentionally small:

- Random Panda;
- Guess Panda.

The game module should reuse the same panda identities and published fan-facing profile data instead of maintaining duplicate panda records.

Game attempts may be stored for signed-in users when persistence is useful, while anonymous play should remain possible unless a specific feature requires an account.

### User and Personal Center

Responsibilities:

- authentication;
- favorites;
- collections;
- check-ins;
- seen pandas;
- recent activity where useful;
- Passport / follow features where they support the fan experience;
- game history when implemented.

Account requirements should be introduced only when persistence, privacy, synchronization, or user-specific actions actually require them.

### Admin and Content Support

V1 requires practical content-management surfaces for the product's core entities, including pandas, locations, relationships, events, media, sources, games, and users.

Existing archive, review, moderation, audit, and publication systems remain valid supporting capabilities. They should sit behind the product rather than redefine the product around editorial operations.

## 3. Runtime architecture

The repository's accepted runtime decisions remain in force. V1 fan-facing product work must use them rather than recreating the older all-in-one Next.js implementation assumption.

### Web

`apps/web` is the Next.js fan-facing application.

It owns:

- public pages;
- localized routing;
- fan interaction surfaces;
- personal-center UI;
- game UI;
- metadata and structured presentation.

### Authoritative domain and persistence

`services/api` remains the authoritative FastAPI domain implementation for persistent domain rules and writes.

Supabase PostgreSQL/PostGIS is the approved authoritative managed data platform.

New V1 persistent modules such as collections, check-ins, seen pandas, and stored game attempts should be added to this authority rather than creating browser-only shadow truth when cross-device persistence is expected.

### Public reads

Public read delivery may use the checked FastAPI contract and approved managed runtime path. Transitional Worker/D1 projection infrastructure must not become the home for new product authority.

### Media

Reviewed public media continues to use the repository's approved media path, with R2 retained as the target public-media store under ADR 0002.

## 4. Module rules

1. Panda identity is shared. Do not create game-specific, collection-specific, or calendar-specific panda copies.
2. Event data is shared. Calendar, timeline, and panda detail should derive from the same event/birth facts.
3. Favorite is the single saved-panda relationship; Passport and Feed are views powered by it. Collection, Check-in, Seen Panda, and notification consent remain distinct concepts.
4. LocationCheckin and SeenPanda are not aliases for each other.
5. Public product modules should expose small, clear interfaces and keep implementation complexity behind them.
6. New V1 product work goes through the authoritative API/database path when persistence is required.
7. Do not add new D1 product authority or OpenNext-only behavior during the managed-cloud migration.
8. Do not split V1 into microservices. The FastAPI domain remains a modular monolith with one authoritative PostgreSQL/PostGIS database.
9. Do not introduce infrastructure complexity merely to support small fan-facing features.
10. All project command execution is performed through WSL according to the repository `AGENTS.md` rule.

## 5. Public information architecture target

The exact visual design may evolve, but V1 should have clear fan-facing destinations for:

```text
/[locale]/pandas
/[locale]/pandas/[slug]
/[locale]/lineage
/[locale]/map
/[locale]/moments
/[locale]/calendar
/[locale]/games
/[locale]/games/random
/[locale]/games/guess
/[locale]/my-pandas
/[locale]/me/collections
/[locale]/me/checkins
/[locale]/me/seen
```

Existing equivalent routes may be retained where they already provide the intended experience, but missing V1 destinations should not be considered complete merely because a backend primitive exists.

## 6. Product priority order

Until the fan-facing V1 loop is closed, implementation priority is:

1. Favorite + Collection;
2. Check-in + Seen Panda;
3. Random Panda + Guess Panda;
4. Calendar;
5. complete personal-center integration;
6. practical admin/content-management entry points needed to operate those features;
7. consistency cleanup across event/location/media semantics and SEO structured data.

Infrastructure, moderation, feed, notification, contribution, and archive capabilities may continue to be maintained, but they should not displace the missing fan-facing V1 modules above unless required for reliability or security.

## 7. Relationship to older documents

The original ZhiPanda V0.1 architecture remains useful as the source of the fan-facing V1 product scope, especially favorites, collections, check-ins, seen pandas, Random Panda, Guess Panda, calendar, personal center, and content-management expectations.

Its deployment assumption of one Next.js application owning the entire backend is no longer the governing runtime design. Accepted ADRs and current repository boundaries supersede that implementation detail.

Conversely, later archive-heavy product documents do not supersede the fan-first product direction defined here. Their data-quality and governance mechanisms are supporting capabilities, not the primary V1 product identity.
