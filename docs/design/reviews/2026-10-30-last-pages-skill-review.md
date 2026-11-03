# Last pages skill review (2026-10-30)

A formal pre-merge review of the last 11 mobile pages moved to design system v2, run with the skills in `.agents/skills`. Base: `b71688d6` (main after #749) on `cursor/last-pages`. Fixes land in the same branch.

**Surfaces:**
- 找熊猫: 地图 (`map.tsx`), 地点 (`places/[slug].tsx`), 基地和动物园 (`institutions/index.tsx`), 熊猫日历 (`calendar.tsx`), 查关系 (`relationship.tsx`).
- 我的: 我的合集 (`collections/index.tsx`), 去过的地点 (`visits.tsx`), 通知 (`notifications.tsx`).
- Account and info: 登录 (`sign-in.tsx`), 账号与数据 (`account.tsx`, with the two-step verification card in `features/session/verification.tsx`), 关于 (`about.tsx`).

**Shared pieces added or changed:** `PAGE_ENTER` in `design/motion.ts`, `PandaThumb`, `StatTile`, `TextField`, `ListCell`'s `chevron` prop, `PlaceRows` and `WorldMap` in `features/map`, and three icons in `components/icons.ts` (CircleAlert, Download, RotateCw).

**How it was checked:** Expo web build (`expo start --web --clear`) against the production API through a local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce` throughout. The signed-in pages (合集, 去过的地点, 通知, 账号) ran against a mocked session and mocked `/me` endpoints; the aal1 state of 账号 was shot separately.

Profiles:
- `base`: 390×844 @2x, light and dark.
- `dt200`: 195×422 @4x plus `fontScale = 2` (a temporary local patch to react-native-web's `Dimensions`, reverted), so the restack rules at fontScale ≥ 1.35 fire.
- `w320`: 320×568, light; plus dark for 地图, 日历, 查关系.

Proxy stress modes: `worst` (long production names swapped in), `error` (HTTP 500 on every `/api/` call), `slow` (20s delay), `empty` (every list returns `[]`).

Production places carry no coordinates, so the live map draws no dots (before and after). For review only, the proxy filled in approximate coordinates by place name so dots and the selected-cluster state could be seen. Nothing in the app depends on that.

Screenshots: `/workspace/pr-last-pages-shots/before/` and `/after/` (local to the review box, not committed). Default-size shots are in `normal/`.

**Questions skipped:** the review ran unattended, so impeccable's interactive questions were answered from DESIGN.md (a calm iOS app for panda fans, iOS 26 register).

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | Before | After | Note |
|---|---|---|---|
| Visibility of system status | 2 | 4 | Before, several pages showed generic bars while loading. Every page now has a skeleton in the final layout; 通知 shows "N 条未读", 账号 shows each request's status with an icon. |
| Match with the real world | 3 | 4 | Pages read like their Apple counterparts: 日历 is a month grid with a day list, 通知 is an inbox, 账号 is grouped settings. |
| User control and freedom | 3 | 4 | 登录 gained "换个邮箱" on the code step; the 注销 confirmation has 取消. |
| Consistency and standards | 2 | 4 | Before: `h2`/`muted` variants, `border-hairline`, `rounded-lg`, raw `›` chevrons. After: v2 tokens, text styles and `ListSection`/`ListCell` throughout. |
| Error prevention | 3 | 4 | 注销 needs an explicit confirmation card; actions are guarded against double taps (`useWork`). |
| Recognition over recall | 3 | 4 | Photos beside every panda and place (curated photo whitelist), icons beside account rows. |
| Flexibility | 3 | 3 | 日历 has 全部/关注 scope; 地图 opens a place from a dot or the list. |
| Aesthetic and minimalist design | 2 | 4 | One warm accent per screen at most (today on 日历). Photo tiles carry the color. |
| Help users recover from errors | 2 | 4 | Every page has an honest `LoadFailed` sentence plus 重试; account actions say "没能完成，请稍后再试。" |
| Help and documentation | 3 | 3 | Footers explain 导出 (24h JSON) and 注销 (`DELETION_NOTICE`). |

**Cognitive load:** 8 of 8 checks pass. One primary action per screen (获取验证码, 新建, 申请导出), progressive disclosure on 注销 and the code step of 登录, and grouped related controls (通知设置 grouped by topic).

**Emotional journey:** 登录 opens with three panda faces instead of a bare form. 合集 shows a photo mosaic per collection. 去过的地点 leads with two stats. 注销 is calm: a plain confirmation card, no alarm red until the destructive button itself.

**Priority issues (all fixed):**
1. The v1 classes and variants on all 11 pages (P2).
2. Rows collapsing at large text: place names squeezed to one character on 地图 and 基地和动物园, place text squeezed on 去过的地点 (P1).
3. An uncaught error on 通知 when the panda list fails, which raised the dev error overlay (P1).
4. Notification titles orphaning a single "了" beside the time column (P3).
5. 账号 rows misaligned where rows with and without icons met (P3).

### Native audit (0–4 each)

| Dimension | Before | After | Notes |
|---|---|---|---|
| Accessibility | 2 | 3 | Fixed the large-text collapses, labelled switches with the full setting name, unread state in the row label, roles on headings and buttons. Remaining: Dynamic Type verified only by emulation. |
| Performance | 3 | 3 | expo-image with transitions; no heavy work added. |
| Theming | 3 | 4 | Light and dark on every page; the verification QR sits on a white plate so it scans in dark mode. |
| Platform | 2 | 4 | Grouped lists, inbox, month grid, segmented scope, 44pt hit areas, continuous corners. |
| Adaptivity | 2 | 4 | Stacked layouts at fontScale ≥ 1.35 for place rows and visit rows; nothing overflows at 320pt. |
| **Total** | **12/20** | **18/20** | |

## review-animations

Checked against `design/motion.ts` and every `entering` in the 11 pages.

| Before | After | Why |
|---|---|---|
| None of the 11 pages had arrival motion | `PAGE_ENTER`: the 280ms bamboo `CONTENT_ENTER` on iOS/Android, none on web | Arrival only, under 300ms, one curve app-wide. The web build is a preview/test target. |
| 日历 list keyed by month, so the rise replayed on every month step | Keyed by nothing: the list rises on arrival, month steps swap it in place | Repeated actions get no animation (found in review, **fixed**). |
| — | Second step of 登录 and the 注销 confirmation card rise once | They are new content the user asked for; once per open. |
| — | 查关系 result rises when it changes, with `accessibilityLiveRegion="polite"` | Motion reports a change and is never the only cue. |
| — | `ReduceMotion.System` on `CONTENT_ENTER` | Reduce Motion skips it entirely. |

No `transition: all`, no ease-in, no animation on keystrokes, no stagger on lists. **Verdict: Approve** after the calendar fix.

## emil-design-eng

| Before | After | Why |
|---|---|---|
| Month steps replayed the day-list rise | The list swaps in place | High-frequency motion should feel instant. |
| Map dots: a hairline border on a flat fill, the count in `text-xs font-bold` | 2pt card-colored ring, footnote semibold tabular count that ignores font scale; selected dot inverts with a tint ring | A pin label must stay inside its pin; the ring separates dots from land in both themes. |
| Map land in `--color-border` on the background | Land in `--color-card` on `--color-secondary` | Like Maps, the base map is muted under the pins. |
| Notification time column beside the title | Time on its own line under the text | Titles no longer wrap around a column and orphan one character. |

## break-ui

Fixtures at the data boundary (proxy modes), no component mocks.

**Broken (fixed):**
- `app/notifications.tsx`: `void loadPandaIndex().then(...)` had no catch. With the API down, the rejection was uncaught and raised the dev error overlay over the page. Now `.catch(() => undefined)`: messages keep the bell avatar.
- `features/map/place-list.tsx` at dt200: the place name squeezed to one character beside thumb, count and chevron (11 horizontal scrollers on 地图, 2 on 基地和动物园 before). Now the row stacks: thumb above, full name and detail unclamped, count in the text column, no chevron.
- `app/visits.tsx` at dt200: the place text squeezed beside the date tile and 删除 (5 scrollers). Now 删除 moves under the place text.

**Ugly (fixed):**
- `app/visits.tsx` at 320pt: "中国大熊猫保护研究中心雅安碧…" clamped at 2 lines. The place name is no longer clamped.
- `app/notifications.tsx`: titles orphaned "了" beside the time.
- `app/account.tsx`: label alignment broke between rows with and without icons; every row now has a glyph (Check / CircleAlert / Hourglass for status, Download, RotateCw, FileText).

**Fragile (recorded, not fixed):**
- The shared `SearchField` shows the browser focus outline when it autofocuses on web (查关系). Pre-existing, web only.
- 地点 shows the hero panda again among the residents. The residents list stays complete on purpose.
- Collection names clamp at 2 lines under the mosaic; the collection page shows the full name.

**What held up:** skeletons match the loaded layout on every page (slow); `LoadFailed` + 重试 on every page (error); honest empty states (empty); `worst` names on 地图, 地点, 日历, 查关系, 去过的地点 and 通知; dark mode on every page; no horizontal overflow except the map's intended horizontal scroller.

## make-interfaces-feel-better

Mode `full`. Scope: the 11 pages and the shared pieces above. Expo + uniwind (Tailwind classes) with v2 tokens.

| Category | Evidence inspected | Result |
|---|---|---|
| Typography | All pages at base / dt200 / w320; `tabular-nums` on counts, dates, the month title and the code field | 3 findings, fixed |
| Surfaces | Radii (`rounded-card/tile/control/group` with continuous curve), `PhotoOutline` on every photo, hit areas | 1 finding, fixed |
| Animations | Every `entering` | 1 finding, fixed |
| Icons | `components/icons.ts` only, one meaning per glyph | Clear |
| Performance | No `transition: all`, no `will-change` | Clear |

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `app/notifications.tsx` (`load`) | `void loadPandaIndex().then(…)` | `.then(…).catch(() => undefined)` | An uncaught rejection broke the page under API failure |
| HIGH | `features/map/place-list.tsx`, `app/visits.tsx` | Single-row layout at every text size | `useStacked()` column layout | Names collapsed to one character at large text |
| MEDIUM | `app/calendar.tsx` | `key={year-month-scope}` on the animated list | No key | Animation on a repeated action |
| LOW | `app/notifications.tsx` | Time column beside the title | Time below the text | Orphaned characters |
| LOW | `app/visits.tsx` | `numberOfLines={2}` on the place | Unclamped | Place names are the content |
| LOW | `app/account.tsx` | Mixed icon / no-icon rows | A glyph on every row | Text aligns down the group |

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| `features/pandas/search-field.tsx` | Suppress the web focus outline | Shared component, web only, and the outline is a real focus indicator |
| `app/places/[slug].tsx` | Drop the hero panda from the residents grid | The grid is the complete list of who lives there |
| `app/sign-in.tsx` | Animate the three faces | Decoration on a utility page; arrival motion is enough |

**Verification:** typecheck, eslint `--max-warnings 0`, 93 unit tests, `node scripts/development/verify.mjs --base origin/main`, before/after screenshots in every profile and stress mode, a map shot with a cluster selected. **Verdict: Approve.** Not verified: native iOS rendering and real Dynamic Type.

## apple-design

- **Patterns:** inset grouped lists (账号, 关于, 通知设置), an inbox with unread dots and 全部已读 (Mail), a month grid with a day list and today in the accent (Calendar), round avatars in lists (Contacts), a two-step sign-in with the code step in its own state.
- **Response:** presses answer immediately (`active:` states on rows; `PressScale` 0.97 on the collection and panda tiles); nothing blocks on an animation.
- **Dynamic Type:** restacks at fontScale 1.35 on place rows, visit rows, stat tiles; map pin counts keep their size like pin labels.
- **Reduce Motion:** `PAGE_ENTER` is skipped.
- **Hit areas:** 44pt minimum on rows, month buttons, 删除, 新建, 全部已读 (with hitSlop), switches (hitSlop 12).

## Out of scope

- `app/collections/[id].tsx` still uses v1 classes (`border-hairline`, `text-base`, `rounded-lg`, `font-bold`); not among the 11 pages.
- No article or learning text was changed.
- The production API has no place coordinates, so the live map shows no dots.

## Caveats

- Native iOS was not run; this is the web build. Arrival motion is native only and was reviewed in code.
- Signed-in pages were verified only against a mocked session and mocked `/me` endpoints.
- Map dots were reviewed with coordinates injected by the review proxy.
- Dynamic Type was emulated; `dt200` is harsher than any iOS size.
