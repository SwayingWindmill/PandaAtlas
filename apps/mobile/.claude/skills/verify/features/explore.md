# Explore, Live Hall, Map Tab, Bento Me & Guest Local-First

The app opens directly onto **探索** inside the unified 4-tab bar (**探索 / 找熊猫 / 地图 / 我的**), with no blocking `/welcome` gate (and `/welcome` redirects to `/`).

- **探索** (`/(tabs)/(today)`) opens with a Chinese date eyebrow (`M 月 D 日　周X`) + `熊猫日历` capsule (`link "熊猫日历，查看日历"` → `/calendar`), followed by the top `WeekHero` (with sibling `全部记忆` pill → `/on-this-day`) or `FeaturedPandaCard`, **明星熊猫 / 你关注的 N 只** (consolidated with monthly/followed birthday shortcut), **此刻谁醒着** (compact `VenueActivityBar` per card + `link "查看全部直播与作息"` → `/live`), **每日一玩** (side-by-side `每日一猫` / `猜熊猫`, header `link "趣味挑战"` → `/play`), **精选专题** (cover grid + conditional `双胞胎怎么分` / `海外与归国` shortcuts), **听熊猫** (scene labels, → `/sounds`), Apple News-style **认识大熊猫** rows (→ `/learn`), **场馆动态**, and **关注的最新动态** (hidden completely when signed out or empty).
- **此刻直播与作息** (`/live`) shows a 3-region global day/night pulse (`东亚 / 欧洲 / 北美`) + 3-column summary (`正在活跃 / 可看直播 / 午休或闭园`), 4 filter chips (`全部 / 有直播 / 正在活跃 / 海外`), photo-anchored active/nap venue cards with full `VenueActivityBar`, and compact nighttime resting rows.
- **地图** is a top-level full-bleed map tab with filter pills (**全部 / 国内 / 海外 / 有直播 / 野生区**), globe/layer controls, a three-snap animated bottom sheet, venue live-status & live-cam CTA, shortcuts to `/institutions` and the **分布时间轴**, and the venue/wild list.
- **我的** (`熊猫护照`) uses Bento cards (`ProgressRing`图鉴卡 -> `/book`, `关注` / `去过的基地` 双列卡, `我的合集` 横向画册, `里程碑` 摘要, and grouped `通知与提醒 / 我的纠错 / 设置` rows). Signed-out guests can follow pandas/venues, mark `见过`, record facility visits, manage collections, and unlock `/book` & `/milestones` locally via AsyncStorage (`zhipanda:guest:*`), which automatically merges into the account on email sign-in.

## How to get to it (user POV)

- Open `/` (first tab **探索**); `/discover` and `/welcome` redirect to `/`.
- Tap **全部直播与作息** (`link "查看全部直播与作息"`) on **此刻谁醒着**, or navigate directly to `/live`.
- Tap **熊猫日历** in the Explore header to open `/calendar`, or **全部记忆** over the WeekHero to open `/on-this-day`.
- Tap **全部 4 项** (`link "趣味挑战"`) on **每日一玩** to open `/play`, or tap **每日一猫** / **猜熊猫** directly.
- Tap **声音图鉴** on **听熊猫** to open `/sounds`, or **全部 N 篇** (`link /科普$/`) on **认识大熊猫** to open `/learn`.
- Open `/map` (third tab **地图**) and `/me` (fourth tab **我的**).

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`.

- **Explore overview, `/live` navigation & Option B switch.** Run `npx e2e run tests/today.e2e.ts` from `apps/mobile`. Verifies signed-out **探索** (`明星熊猫`, `此刻谁醒着`, `每日一玩`, `听熊猫`, no cold boxes), tapping `查看全部直播与作息` to open `heading "此刻直播与作息"`, signed-in follow switching the strip to `你关注的 1 只` and populating `关注的最新动态`, and `生日周`.
- **Calendar entry from Explore header.** Run `npx e2e run tests/calendar.e2e.ts` from `apps/mobile`.
- **Direct entry & `/welcome` redirect.** Run `npx e2e run tests/onboarding.e2e.ts` from `apps/mobile`.
- **Guest local-first & sign-in sync.** Run `npx e2e run tests/follow-seen.e2e.ts` and `npx e2e run tests/book.e2e.ts` from `apps/mobile`.
- **Map tab & wild habitats.** Run `npx e2e run tests/map.e2e.ts` from `apps/mobile`.
- **Dead ends & `/discover` redirect.** Run `npx e2e run tests/dead-ends.e2e.ts` from `apps/mobile`.
- **Mini-games secondary hub.** Run `npx e2e run tests/guess.e2e.ts:17` from `apps/mobile`.

## Gotchas

- Headless Chromium used in CI E2E may have no audio hardware output device; `useSoundPlayer` catches backend playback rejections so UI toggling and page navigation stay stable offline/headless.
- Guest storage keys use the `zhipanda:guest:` prefix so `清除本地缓存` (`offline:` prefix) in Settings never clears user-recorded data.
- Keep `查看日历` solely on `ExploreHeader`'s `熊猫日历` pill (not duplicated on the birthday strip link) so `tests/calendar.e2e.ts` matches uniquely in Playwright strict mode.
