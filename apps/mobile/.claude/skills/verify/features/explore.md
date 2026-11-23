# Explore, live clock & sounds

The app opens on the unified **探索** tab inside a 4-tab bar (**探索 / 找熊猫 / 图鉴 / 我的**). It pairs quick access to star or followed pandas with global venue timezone clocks (**此刻谁醒着**), featured panda photography, **热门场馆**, **精选画报**, an interactive giant panda audio strip (**听熊猫** -> `/sounds`), and **科普与趣味** linking to learning guides and the secondary mini-games hub (`/play`).

## Sub-features

- `star-or-followed-strip` shows **明星熊猫** when signed out or following none, and switches to **你关注的 N 只** once any panda is followed.
- `live-clock` calculates current local time and viewing status (**正在活跃 / 即将开园 / 午休时段 / 夜间休整**) for global institutions and links to official live cams (**看直播**).
- `sound-strip` and `/sounds` play bundled Public Domain / Creative Commons giant panda recordings via `expo-audio` without adding microphone permissions.
- `play-hub` moves the 4 mini-games (**每日一猫 / 猜熊猫 / 认脸挑战 / 月度挑战**) under `/play` via **趣味挑战**.

## How to get to it (user POV)

- Open `/` (first tab **探索**); `/discover` redirects to `/`.
- Tap **声音图鉴** on **听熊猫** to open `/sounds`.
- Tap **趣味挑战** under **科普与趣味** to open `/play`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`.

- **Explore overview & Option B switch.** Run `npx e2e run tests/today.e2e.ts` from `apps/mobile`. Verifies signed-out **探索** (`明星熊猫`, `此刻谁醒着`, `听熊猫`), signed-in follow switching the top strip to `你关注的 1 只`, and `生日周`.
- **Dead ends & `/discover` redirect.** Run `npx e2e run tests/dead-ends.e2e.ts` from `apps/mobile`. Verifies unpublished sections (`归国与专题`, `场馆动态`, `比一比`) remain absent and `/discover` opens **探索**.
- **Mini-games secondary hub.** Run `npx e2e run tests/guess.e2e.ts:17` from `apps/mobile`. Opens `/` -> taps `link "趣味挑战"` -> checks `heading "趣味挑战"` -> taps `button /^猜熊猫/` -> answers rounds cleanly.

## Gotchas

- Headless Chromium used in CI E2E may have no audio hardware output device; `useSoundPlayer` catches backend playback rejections so UI toggling and page navigation stay stable offline/headless.
- **比一比** is intentionally removed from Home while `/compare` and `/comparisons` deep links remain intact.
