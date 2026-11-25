# Venue page

A zoo or base has a single-scroll detail page (`/institutions/[slug]`, no middle `Segmented` tabs): a stretchy hero (`INSTITUTION_HERO_HEIGHT = 276`) with name and meta, intro summary, dual **关注场馆 / 去过打卡** capsules, borderless 3-column metrics (`现在住这里 | 在这里出生 | 门票概况`), inline `VenueLiveCard` (local clock, activity bar, `看直播` → `link "看官方直播"`), and `VenueQuickTools` (`导航过去 / 官方直播 / 查看官网`). Below sit **住在这里** (optional `你在本馆已见过 N / M 只` progress bar, `全部 / 未见过 / 我关注` filter tabs, search for `>= 4` residents, initial 6-item preview expanding via `看全部熊猫`), the 6-layer **参观攻略** (2×2 pre-trip Bento, `DayBand`, curated route timeline when configured, photo spots strip, SVG schematic location map + transit, practical tips + official site), **到访记录** (`FacilityVisits`), **场馆动态**, expandable **以前住过**, and a quiet source footer.

## Sub-features

- `venue-open-map` opens the page from the 地图 Tab's place list or marker sheet (`进入场馆与攻略`).
- `venue-open-guide-link` accepts `/institutions/<slug>?tab=guide` harmlessly on the single-scroll page.
- `venue-residents` filters residents directly in-scroll (`全部 / 未见过 / 我关注`, search, and `看全部熊猫` expansion).
- `venue-follow` toggles 关注场馆 (cloud when signed in, local guest storage when signed out).
- `venue-visit` records a visit via top `去过打卡` or `FacilityVisits` (`记下今天去过<facility>`). This lives in [Collections and visits](./collections-visits.md).

## How to get to it (user POV)

- 地图 Tab (`/map`), then a zoo in the list or on the map, then `进入场馆与攻略`.
- 探索 (`/`) → 此刻谁醒着 or `/live` (`此刻直播与作息`), then open a zoo.
- A panda's profile, then its 现居 metric or `PandaVenueLive` card.
- Direct route `/institutions/<slug>` (optional `?tab=guide`).

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`, and the fixture zoo is `fixture().zoo` (with `.name`, `.slug` and `.facility`).

- **From the map.** Run `npx e2e run tests/map.e2e.ts:6` from `apps/mobile`. It opens `/map`, selects the zoo, and taps `button "打开<zoo>的页面"`. The result is that `heading "<zoo>"`, `heading "住在这里"` and `heading "参观攻略"` are visible.
- **Direct guide link & guest check-in.** Run `npx e2e run tests/collections-visits.e2e.ts:57`. It opens `/institutions/<slug>?tab=guide` signed out. `heading "参观攻略"` is visible and guests can tap `button "记下今天去过<facility>"` locally.
- **Live cam & resident filters.** Run `npx e2e run tests/profile.e2e.ts` from `apps/mobile`. It verifies clickable `link "看官方直播"` opens the live URL and resident filter tabs (`全部` / `未见过`) work directly without tapping a tab radio.
- **Large venue worst-case.** Run `npx e2e run tests/worst-case.e2e.ts:63` from `apps/mobile`. Verifies 120 residents preview cleanly and expand via `button "看全部熊猫"` to `住在这里的熊猫　120 只`.
- **Live look with real data.** Start the production preview and open `http://localhost:8796/institutions/chengdu-research-base` or `smithsonian-national-zoo` to inspect the single-scroll metrics, live card, 6-layer guide, and residents.

## Gotchas

- Every run's zoo sits at the same coordinates. On a reused database the map marker groups earlier runs' zoos, and a tap zooms in instead of selecting. Pick the zoo from the list.
- Keep `accessibilityLabel="看官方直播"` unique across `VenueLiveCard` and `VenueQuickTools` (when `VenueLiveCard` renders, `VenueQuickTools` uses `打开<name>官方直播页`).
- Keep top `去过打卡` button label distinct (`去过打卡，<facility>`) from `FacilityVisits`'s `记下今天去过<facility>` so Playwright strict mode matches uniquely.
- 关注 needs a settled session. Tapped while the session is still loading, it does nothing by design.
