# Explore, Map Tab, Bento Me & Guest Local-First

The app opens directly onto **探索** inside the unified 4-tab bar (**探索 / 找熊猫 / 地图 / 我的**), with no blocking `/welcome` gate (and `/welcome` redirects to `/`).

- **探索** pairs quick access to star or followed pandas (`明星熊猫` / `你关注的 N 只`) with global venue timezone clocks (**此刻谁醒着**), featured panda photography, **精选画报**, an interactive giant panda audio strip (**听熊猫** -> `/sounds`), **科普与趣味** linking to `/play`, venue news, and followed panda updates. Overlapping **逛基地** and **热门场馆** sections live inside the **地图** tab instead.
- **地图** is a top-level full-bleed map tab with filter pills (**全部 / 国内 / 海外 / 有直播 / 野生区**), globe/layer controls, a three-snap animated bottom sheet, venue live-status & live-cam CTA, shortcuts to `/institutions` and the **分布时间轴**, and the venue/wild list.
- **我的** (`熊猫护照`) uses Bento cards (`ProgressRing`图鉴卡 -> `/book`, `关注` / `去过的基地` 双列卡, `我的合集` 横向画册, `里程碑` 摘要, and grouped `通知与提醒 / 我的纠错 / 设置` rows). Signed-out guests can follow pandas/venues, mark `见过`, record facility visits, manage collections, and unlock `/book` & `/milestones` locally via AsyncStorage (`zhipanda:guest:*`), which automatically merges into the account on email sign-in.

## How to get to it (user POV)

- Open `/` (first tab **探索**); `/discover` and `/welcome` redirect to `/`.
- Open `/map` (third tab **地图**).
- Open `/me` (fourth tab **我的**); tap the图鉴 card to open `/book` (`/checkin` redirects to `/book`).
- Tap **声音图鉴** on **听熊猫** to open `/sounds`, or **趣味挑战** under **科普与趣味** to open `/play`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`.

- **Explore overview & Option B switch.** Run `npx e2e run tests/today.e2e.ts` from `apps/mobile`. Verifies signed-out **探索** (`明星熊猫`, `此刻谁醒着`, `听熊猫`), signed-in follow switching the top strip to `你关注的 1 只`, and `生日周`.
- **Direct entry & `/welcome` redirect.** Run `npx e2e run tests/onboarding.e2e.ts` from `apps/mobile`.
- **Guest local-first & sign-in sync.** Run `npx e2e run tests/follow-seen.e2e.ts` and `npx e2e run tests/book.e2e.ts` from `apps/mobile`.
- **Map tab & wild habitats.** Run `npx e2e run tests/map.e2e.ts` from `apps/mobile`.
- **Dead ends & `/discover` redirect.** Run `npx e2e run tests/dead-ends.e2e.ts` from `apps/mobile`.
- **Mini-games secondary hub.** Run `npx e2e run tests/guess.e2e.ts:17` from `apps/mobile`.

## Gotchas

- Headless Chromium used in CI E2E may have no audio hardware output device; `useSoundPlayer` catches backend playback rejections so UI toggling and page navigation stay stable offline/headless.
- Guest storage keys use the `zhipanda:guest:` prefix so `清除本地缓存` (`offline:` prefix) in Settings never clears user-recorded data.
