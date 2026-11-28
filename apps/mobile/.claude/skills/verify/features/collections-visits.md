# Collections, check-in, visits diary & following

A signed-in fan puts a panda into a new collection, finds it under 我的, renames it, empties it and deletes it after a confirmation. On a venue's single-scroll page (`/institutions/[slug]`), tapping the top `去过打卡` capsule opens `/institutions/[slug]/checkin` (`今日逛园打卡`) to record a visit with an optional 1-line `看猫小记` and batch-mark seen pandas from a 3-column visual tile grid + coverless checklist, producing a notched `SouvenirTicket` (`线下逛园纪念票根`) with `查看看猫日记` → `/visits`. The lower `FacilityVisits` section also records today's visit (`记下今天去过<facility>`). `/visits` (`去过的地点`) shows a 3-column stat strip, a `足迹地图` link → `/map?filter=visited`, and a yearly vertical journal timeline pairing each visit with quoted notes, same-day seen pandas (`matchSeenPandasForVisit`), and a muted `移除` action. `/following` (`我的关注`) switches between `熊猫` (default) and `场馆` (with live `VenueActivityBar`, unfollow, `查看攻略`, `看直播`).

## Sub-features

- `collection-create` creates a collection from a panda's profile (加入合集).
- `collection-manage` renames, removes a panda, and deletes with a confirmation.
- `venue-bundle-checkin` opens `/institutions/[slug]/checkin`, saves a visit (with optional `看猫小记`) + selected `见过` pandas (`placeId`), and renders `SouvenirTicket`. While offline, signed-in bundle check-ins queue idempotently under `offline-checkin-queue:v1` (`queuedOffline` ticket notice) and flush automatically via `OfflineQueueBridge` upon reconnect.
- `visit-record` records today's visit on a venue page (cloud when signed in, local guest storage when signed out).
- `visit-diary` renders `/visits` vertical timeline with `足迹地图` → `/map?filter=visited`, pending offline-queue sync bar (`N 条打卡暂存本机`), quoted notes, matched panda chips, and `移除`.
- `following-venues` switches `Segmented` on `/following` between `熊猫 N` and `场馆 M`.

## How to get to it (user POV)

- A panda's profile, then `加入合集`. 我的, then 我的合集, then a collection.
- A venue page (`/institutions/<slug>`), then top `去过打卡` → `/institutions/<slug>/checkin`, or lower `记下今天去过<facility>`. 我的, then 去过的基地 (`/visits`).
- 我的 → 关注 (`/following`), switching `熊猫` / `场馆`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`. Each journey signs in its own user.

- **Collection lifecycle.** Run `npx e2e run tests/collections-visits.e2e.ts:7` from `apps/mobile`. At the end, `button "删除合集"` opens `heading "删除「常去看的」？"`. Confirming returns to `heading "我的合集"`, and `button /^常去看的，/` has count 0.
- **Record and remove a visit.** Run `npx e2e run tests/collections-visits.e2e.ts:41`. It opens the zoo, confirms `heading "参观攻略"`, then taps `button "记下今天去过<facility>"`. The result is `<today>去过`, and the button `今天已记下去过<facility>` is disabled. On `/visits`, `button /^删除.*去<facility>的记录$/` removes it, and `还没有到访记录。` shows.
- **Signed out.** Run `npx e2e run tests/collections-visits.e2e.ts:57`. Opens `/institutions/<slug>?tab=guide` signed out and records the visit locally via guest storage.
- **Bundle check-in, souvenir ticket & diary.** Run `npx e2e run tests/collections-visits.e2e.ts:69`. Taps `button /^去过打卡/`, fills `看猫小记`, checks `checkbox /^<panda.name>/`, taps `button /^保存本次打卡/`, verifies `逛园纪念票根` & note, opens `/visits` via `button "查看看猫日记"`, verifies note + `link "查看<panda.name>"`, and opens `/map?filter=visited` via `link "足迹地图"`.
- **Following venues tab.** Run `npx e2e run tests/follow-seen.e2e.ts:61`. Follows `zoo`, opens `/following`, switches `radio /^场馆 1/`, and verifies `link /^<zoo.name>/`.

## Gotchas

- The delete confirmation moves screen-reader focus with an API that exists only on native, so it is skipped on web. Native focus behavior is not covered by a web run.
- The confirmation replaces the screen, so its `删除合集` is the only one on screen.
