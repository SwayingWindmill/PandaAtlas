# Product and Public Read Glossary

Canonical vocabulary for product surfaces, public API contracts, and domain discussions across the V2 backend, Web, and Mobile applications. Archive-level entities (`Stable Identity`, `Institution`, `Place`, `Residency`, `Public Release`, `Source`, `Fact Assertion`, `Public Conclusion`, `Parentage Assertion`) are defined in [the Trusted Archive glossary](../../contracts/golden-dataset/GLOSSARY.md).

New API endpoints, schemas, client modules, tests, and domain documents must use the canonical terms below and must not introduce new synonyms for existing concepts. Existing legacy wire paths and historical UI labels remain only where compatibility requires them.

## Public Release

The immutable data snapshot version (`publication`) and its atomic activation lifecycle (`building`, `sealed`, `current`). Administrative release workflows belong strictly to `publication`; public read traffic belongs to `Public Read`.

## Public Read

The version-pinned read projection (`public-read`) consumed by Web and Mobile clients, edge caches, and `Ask Panda` grounded search. Public reads never query draft or restricted Archive tables directly.

## Catalog

A singleton reviewed reference collection served as read-only JSON catalogs (`learning`, `comparisons`, `overseas-status`, `venue-news`) under the unified catalog boundary rather than per-catalog backend modules.

## Institution vs. Place

- **Institution**: A zoological, conservation, breeding, or research organization (`institution`, `/api/v2/institutions`). An institution may manage one or more places.
- **Place**: A physical facility, habitat, protected area, distribution area, or coarse location (`place`, `/api/v2/places`). Do not introduce `venue` or `site` as synonyms for `Place` in new contracts. Legacy routes `/api/v2/me/followed-venues` and `/api/v2/venue-news` are kept for wire compatibility only.

## Follow

An authenticated fan's ongoing subscription to updates for a panda or an institution (`follow`). New contracts and code must use `follow` and `Follow`. The legacy route `/api/v2/me/favorites` and Web UI copy 「收藏」 are preserved strictly for backwards compatibility; do not reintroduce `favorite` or `bookmark` in new contracts.

## Place Visit vs. Daily Check-in

- **Place Visit** (实体到访): An authenticated fan's record of physically visiting a place (`/visits` on Mobile). New code and copy refer to this as a visit. The legacy wire path `/api/v2/me/checkins` is retained for backwards compatibility only and must not be reused for new meanings.
- **Daily Check-in** (线上每日打卡): An authenticated fan's daily online check-in streak and leave days (`/checkin` on Mobile, module `daily-checkin`, wire path `/api/v2/me/daily-checkins`). Daily check-ins are separate from physical place visits.

## Seen Panda

A fan's confirmation of having seen a panda in person, tracked per account via `/api/v2/me/seen-pandas`.

## Collection

A user-curated group of pandas managed by an authenticated fan via `/api/v2/me/collections`.

## Panda Book

An account's accumulated discovery progress across panda profiles and games, served via `/api/v2/me/panda-book`.

## Public Update

A changelog entry describing published fact, lineage, residency, media, or life-event changes produced by an active release (`updates`, `/api/v2/updates`). Do not confuse this with `On This Day` or `Venue News`.

## On This Day

Date-matched panda birthdays and published historical milestones (`/on-this-day` on Mobile), computed from published facts and life events rather than update changelogs.

## Games and Grounded Q&A

- **Guess Panda** (猜熊猫): Multiple-choice photo identification challenge using published panda photos (`/api/v2/games/guess/*`, `/guess`).
- **Daily Panda** (每日一猫): Daily clue-based panda deduction puzzle and guess history (`/api/v2/games/daily-panda*`, `/daily`).
- **Ask Panda** (问问熊猫): Grounded question-answering over published panda facts and learning articles (`/api/v2/ask*`, `/learn/ask`).

## Contribution and Review Case

- **Contribution**: An authenticated user-submitted correction or supplement draft and its immutable revisions (`/api/v2/contributions`, `/api/v2/me/contributions`).
- **Review Case**: The editorial triage and decision workflow (`/api/v2/review/cases*`) whose accepted outcome updates Trusted Archive facts for subsequent publication.

## Account, Notification Preference, and Privacy Request

- **Account**: Application authorization identity paired one-to-one with a Supabase Auth user (`/api/v2/me`).
- **Notification Preference**: Per-account delivery channel settings (`/api/v2/me/notifications/preferences`) and native inbox read state (`/api/v2/me/notifications*`).
- **Privacy Request**: Self-service personal data export or account erasure request gated by recent interactive authentication (`/api/v2/me/privacy/requests*`).

## Canonical Vocabulary Reference

| Canonical term | Chinese UI | Legacy wire/code names kept for compatibility | Do not use for new contracts |
|---|---|---|---|
| `Public Read` / `Public Release` | 资料版本 | `publication` (old combined read+release) | mixing draft writes with public reads |
| `Institution` | 熊猫机构 / 园区 | `venue` (`/followed-venues`, `/venue-news`) | `venue` (for institutions/places) |
| `Place` | 地点 / 场馆 | `facility` (one `placeType`) | `site`, generic `location` |
| `Follow` | 关注 (Mobile) / 收藏 (Web) | `/api/v2/me/favorites`, `favorite` | `favorite`, `bookmark`, `subscribe` |
| `Place Visit` | 到访 | `/api/v2/me/checkins` | bare `checkin` |
| `Daily Check-in` | 打卡 | `/api/v2/me/daily-checkins` | sharing `checkin` with `Place Visit` |
| `Public Update` | 动态 / 最近更新 | `activity` | `feed` (for release diffs in backend) |
