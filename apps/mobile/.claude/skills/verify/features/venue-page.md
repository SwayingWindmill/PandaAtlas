# Venue page

A zoo or base has its own page: a hero with the name, top capsules for resident count (`N 只`), free entry (`免费`) when applicable, a clickable official live cam link (`看直播` -> `link "看官方直播"`), and a `关注` button, followed by an inline live clock/activity card (`VenueLiveCard` for venues with verified schedules) and up to three tabs. 概况 has the summary, residents' faces, news, location and sources. 熊猫 has search, `全部 / 未见过 / 我关注` filter pills, featured resident tiles with birth year and `见过` badge, compact rows for coverless pandas, and former residents. 攻略 has the visiting guide, viewing times and recording a visit.

## Sub-features

- `venue-open-map` opens the page from the 地图 Tab's place list or marker sheet (`进入场馆与攻略`).
- `venue-open-guide-link` opens the page straight on 攻略 via `/institutions/<slug>?tab=guide`.
- `venue-tabs` switches 概况 / 熊猫 / 攻略. A tab with nothing in it is not shown.
- `venue-follow` toggles 关注 (cloud when signed in, local guest storage when signed out).
- `venue-visit` records a visit on 攻略. This lives in [Collections and visits](./collections-visits.md).

## How to get to it (user POV)

- 地图 Tab (`/map`), then a zoo in the list or on the map, then `进入场馆与攻略`.
- 探索, then 此刻谁醒着, then open a zoo.
- A panda's profile, then its 所在地 stat tile or `PandaVenueLive` card.
- The route `/institutions/<slug>`, optionally with `?tab=guide` or `?tab=pandas`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`, and the fixture zoo is `fixture().zoo` (with `.name`, `.slug` and `.facility`).

- **From the map.** Run `npx e2e run tests/map.e2e.ts:6` from `apps/mobile`. It opens `/find`, taps `link /^熊猫地图/`, selects the zoo (tapping its marker, or picking it from `getByTestId("map-places")` when the marker groups several zoos), and taps `button "打开<zoo>的页面"`. The result is that `heading "<zoo>"`, `radio "概况"` and `radio "攻略"` are visible.
- **Deep link to 攻略.** Run `npx e2e run tests/collections-visits.e2e.ts:57`. It opens `/institutions/<slug>?tab=guide` signed out. The result is that `radio { name: "攻略", checked: true }` is visible, and guests can tap `button "记下今天去过<facility>"` locally.
- **Live cam & resident filters.** Run `npx e2e run tests/profile.e2e.ts` from `apps/mobile`. It verifies `Segmented` stays vertically stable across panda tabs, clickable `link "看官方直播"` opens the live URL, and `熊猫` shows resident filter tabs (`全部` / `未见过`).
- **Live look with real data.** Start the production preview and open `http://localhost:8796/institutions/smithsonian-national-zoo`. The capsules include `住着 N 只熊猫` and a clickable `看官方直播` link (`看直播`), followed by the live activity schedule card. 熊猫 lists filter pills and 以前住过 with 美香 and 添添 `2000–2023`.

## Gotchas

- Every run's zoo sits at the same coordinates. On a reused database the map marker groups earlier runs' zoos, and a tap zooms in instead of selecting. Pick the zoo from the list.
- A tab that would be empty is not rendered. If the fixture zoo has no former residents and no residents, there is no 熊猫 tab. That is correct, not a failure.
- 关注 needs a settled session. Tapped while the session is still loading, it does nothing by design.
