# Venue page

A zoo or base has its own page: a hero with the name, capsules for free entry, a live camera and how many pandas live there, a 关注 button, and up to three tabs. 概况 has the summary, residents' faces, news, location and sources. 熊猫 has resident tiles and former residents. 攻略 has the visiting guide, viewing times and recording a visit.

## Sub-features

- `venue-open-map` opens the page from the map's place list or marker.
- `venue-open-guide-link` opens the page straight on 攻略 from 今天's 观猫时机.
- `venue-tabs` switches 概况 / 熊猫 / 攻略. A tab with nothing in it is not shown.
- `venue-follow` toggles 关注. Signed out, it opens sign-in.
- `venue-visit` records a visit on 攻略. This lives in [Collections and visits](./collections-visits.md).

## How to get to it (user POV)

- 找熊猫, then 熊猫地图, then a zoo in the list or on the map, then 打开<zoo>的页面.
- 今天, then the 观猫时机 shortcut or the 观猫时机 card. These open on 攻略.
- A panda's profile, then the place it lives.
- The route `/institutions/<slug>`, optionally with `?tab=guide` or `?tab=pandas`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`, and the fixture zoo is `fixture().zoo` (with `.name`, `.slug` and `.facility`).

- **From the map.** Run `npx e2e run tests/map.e2e.ts:6` from `apps/mobile`. It opens `/find`, taps `link /^熊猫地图/`, picks the zoo from `getByTestId("map-places")`, and taps `button "打开<zoo>的页面"`. The result is that `heading "<zoo>"`, `radio "概况"` and `radio "攻略"` are visible.
- **Deep link to 攻略.** Run `npx e2e run tests/collections-visits.e2e.ts:57`. It opens `/institutions/<slug>?tab=guide` signed out. The result is that `radio { name: "攻略", checked: true }` is visible, and so is `button "登录后记下到访"`.
- **Tabs.** On the page, tap `radio "熊猫"`, then `radio "攻略"`. 熊猫 shows `住在这里的熊猫 N 只`. 攻略 shows the heading `参观攻略`.
- **Live look with real data.** Start the production preview and open `http://localhost:8796/institutions/smithsonian-national-zoo`. The capsules read `免费参观`, `有官方直播` and `住着 N 只熊猫` in the accessibility tree. 熊猫 lists 以前住过 with 美香 and 添添 `2000–2023`.

## Gotchas

- Every run's zoo sits at the same coordinates. On a reused database the map marker groups earlier runs' zoos, and a tap zooms in instead of selecting. Pick the zoo from the list.
- A tab that would be empty is not rendered. If the fixture zoo has no former residents and no residents, there is no 熊猫 tab. That is correct, not a failure.
- 关注 needs a settled session. Tapped while the session is still loading, it does nothing by design.
