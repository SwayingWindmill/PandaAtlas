# PR G skill review: 每日打卡 (2026-10-30)

A pre-merge review of PR G, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `9cdcf16` (main after #756) on `app/pr-g-daily-checkin`. Fixes land in the same branch.

**Surfaces:**
- 每日打卡 (`app/checkin.tsx`): 累计来过 and 本月来过 tiles, today's status, a month grid (来过 / 请假 / 可以补请), the 请假 group (本月还能请, 补请, coming leave with 取消) and the rules footer.
- 我的 card (`features/checkin/checkin-card.tsx`): this week as seven circles, the two totals, opens 每日打卡. Signed out, 登录后可以 gains a 每日打卡 row.
- 每日一猫 (`app/daily.tsx`): opening it signed in records the day (once per day per session), then a 每日打卡 row at the foot (今天来过了, 累计 N 天).
- API `GET/POST /api/v2/me/daily-checkins`, `PUT/DELETE /api/v2/me/daily-checkins/leave/:day`, migration `0081_daily_checkins.sql`. Rules: `DAILY_CHECKIN_RULES` in `services/api/src/modules/engagement/application/daily-checkin.ts`.

**How it was checked:** Expo web dev build against a local proxy that mocks the check-in API (60 days of history with gaps, one past and one coming leave day), Playwright + Chrome, `prefers-reduced-motion: reduce`. Profiles: `base` 390×844 light and dark; `dt200` with `fontScale = 2` (temporary local patch to react-native-web's `Dimensions`, reverted) in a 195pt-wide viewport; `w320`. Proxy modes: `worst` (12,345 days), `error` (account lookup 500), `slow` (20s), `empty` (no history). An interaction script took 补请, cancelled a coming leave day and took it again from the November grid.

Screenshots: `/workspace/pr-g-shots/before/` and `/after/` (local to the review box, not committed); `after/normal/` default size and the interaction shots, `after/stress/<profile or mode>/` the rest.

**Research input (X, read when the page plan was written, reused here):**
- bella32896737, https://x.com/bella32896737/status/1664263663983681537: stopped playing Wordle over the pressure and anxiety of breaking a streak twice. → No streak, nothing resets to zero.
- mad1moody, https://x.com/mad1moody/status/1601521572514185216: 45 days of Duolingo, would have quit long ago without the streak freeze. → Leave days, free.
- bgbond, https://x.com/bgbond/status/1275902255506620416: Duolingo guilt-trips you for using a freeze. → After leave the page states the fact only.
- RonaldoCr7Neym, https://x.com/RonaldoCr7Neym/status/2061126838923968871: broke a streak taking a sick dog to the vet and asked Duolingo to restore it. → One 补请 within 48 hours.
- arturturonchik, https://x.com/arturturonchik/status/2111404730341822863: likes products that don't count days or say "good job". → No praise copy; totals are plain numbers.

No new posts were added for this PR.

**Questions skipped:** the review ran unattended; answers came from DESIGN.md, PRODUCT.md, the page plan and the brief (no streak anxiety, no guilt, all free, no article or identification text).

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | First build | After | Note |
|---|---|---|---|
| Visibility of system status | 3 | 4 | A leave change only moved a circle; now one muted footnote says what happened (10月28日 周三补请好了。). |
| Match with the real world | 3 | 4 | 请假 and 补请 are words people use for days off; totals read like a Health summary. |
| User control and freedom | 3 | 4 | Every leave can be given back until the day passes: tap it again on the grid, or 取消 in the list (now a real button). |
| Consistency and standards | 3 | 4 | The month grid is the 熊猫日历 grid; tiles are `StatTile`; the status line matches 每日一猫's 已收进图鉴. |
| Error prevention | 3 | 4 | Only days the rules allow are tappable; past days and used quota are not offered; 补请 disappears when its window or the month's quota is gone. |
| Recognition over recall | 3 | 4 | Legend under the grid; 可以补请 appears only in the month that has one. |
| Flexibility | 3 | 3 | Grid or list for the same action. |
| Aesthetic and minimalist design | 2 | 4 | 今天 / 来过了 was a Settings row; now a quiet status line, or a tinted 去看每日一猫 when today is open. |
| Help users recover from errors | 3 | 4 | 409s map to 这个月的假已经用完了。 / 这一天已经不能改了。; any other failure 没能保存，请再试一次。 The page itself has `LoadFailed` + 重试. |
| Help and documentation | 3 | 3 | The footer states the rules from the server's numbers. |

**Priority issues (all fixed):**
1. The 今天 / 来过了 grouped row made the top of a Fitness-style summary read like Settings (P2). Replaced by a status line (`Check` + 今天来过了 in tint), or a tinted 去看每日一猫 button with 打开每日一猫，今天就算来过 under it.
2. 取消 on coming leave rows was row meta in muted grey, so it read as a value (P2). Now a tinted 44pt button with the label 取消11月3日 周二的假; at large text it moves under the date.
3. At `dt200` the month header squeezed 2026年10月 to one character per line and the grid's 36pt circles overlapped (P1); the 我的 week strip overlapped too. Circles now size to a seventh of the measured row (36 / 32 max, footnote numerals under 32), and the header stacks the month buttons under the title.
4. With the account lookup failing the page stayed on its skeleton forever (P1). It now says 账号暂时不可用，请稍后再试。 like 我的.

### Native audit (0–4 each)

| Dimension | First build | After | Notes |
|---|---|---|---|
| Accessibility | 3 | 4 | Each day reads e.g. "10月28日，可以补请" with a hint (轻点补请这一天 / 轻点请假 / 轻点取消请假); disabled state for the rest; result footnotes are a polite live region. Dynamic Type emulated only. |
| Performance | 4 | 4 | One GET per focus; changes return the new summary, no refetch. The visit POST is fire-and-forget and de-duplicated per day. |
| Theming | 4 | 4 | Light and dark checked; marks use tint, `highlight-soft`, `secondary`, `warm` tokens only. |
| Platform | 3 | 4 | Summary tiles, week strip and month rings follow Fitness/Health; grouped list for the leave group. |
| Adaptivity | 2 | 4 | dt200 and 320pt now fit (see 3). |
| **Total** | 16/20 | 20/20 | |

## review-animations

| Before | After | Why |
|---|---|---|
| — | `PAGE_ENTER` once on 每日打卡 content | One arrival per open |
| — | 我的 card: `PressScale` | Same as the other 我的 cards |
| — | Day cells and 取消: pressed opacity only; no animation when a mark changes | Repeated, small changes; haptic (success on leave, selection on cancel) carries the feedback |
| — | Month change: no slide | Calendar does the same in this app; a slide would add motion to a frequent action |

No `transition: all`, no stagger, no looping or celebratory motion (deliberately: no confetti for a day). **Verdict: Approve.**

## break-ui

Fixtures at the data boundary (proxy modes and seeded history), no component mocks.

**Broken (fixed):** month header and grid at `dt200`; week strip at `dt200`; skeleton forever when the account is unavailable.

**Ugly (fixed):** the Settings-style 今天 row; muted 取消; the week strip left missed and coming days blank, so the row had holes (now a neutral `secondary` track, the same for a missed day and a day not yet come, so a gap is not singled out).

**Fragile (recorded, not fixed):**
- Today's `warm` ring is hidden once today is a visit (the filled circle wins), as on 熊猫日历. Today is still named in the week strip's label and the day's accessibility label.
- 本月还能请 is always the current month, also while browsing November.
- The signed-out sentence wraps with a two-character last line at 390pt (登录后，每天打开每日一猫就会记下一天。).
- At `dt200` the month numerals drop to footnote size inside ~24pt circles; legible, tight.
- `days` returns every record; fine for years of daily use (one row a day), worth paging if it ever grows past that.
- The day boundary is the device's local date, sent as `today`; the server accepts ±1 day around its UTC date.

**What held up:** 320pt, dark, `worst` (12,345 天 fits the tile and the card), `empty` (0 天, all-track week, 这个月还没有记录, 去看每日一猫), `slow` (skeletons), quota used (补请 leaves when the month's two days are taken), cancel and retake. API unit tests cover quotas, the 48h window, visit-over-leave, past-day refusal and month boundaries; an integration test covers the endpoints against Postgres.

## make-interfaces-feel-better

Mode `full`. Scope: the files above.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `checkin.tsx`, `checkin-card.tsx` | Overlapping circles at large text | Measured circle size; stacked header | Never overlap tappable targets |
| HIGH | `checkin.tsx` | Endless skeleton when the account is unavailable | Plain message | Every state must end |
| MEDIUM | `checkin.tsx` | 今天 / 来过了 Settings row | Status line or tinted button | A summary, not a settings list |
| MEDIUM | `checkin.tsx` | Muted 取消 meta | Tinted 44pt button | Actions look like actions |
| MEDIUM | `day-mark.tsx` | Blank week days | Neutral track circles | Rhythm without marking a miss |
| LOW | `checkin.tsx` | No feedback text after a change | One muted footnote | Confirms which day changed |
| LOW | day cells | No pressed state | `active:opacity-60` | Touch response |

Icons: `CalendarHeart` (累计来过, the 每日一猫 row, the 登录后可以 row) and `CalendarDays` (本月来过) as footnote glyphs beside stat labels and on a destination row; `Check` on the status line like 已收进图鉴. No icon on the card title, the month title or the leave rows. A `Coffee` glyph on the first 去看每日一猫 row was removed (an icon on an action whose meaning is the label).

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| Totals | A streak or "longest run" figure | Streak anxiety, the thing the page exists to avoid |
| After a visit or leave | 太棒了 / 继续保持 / 别忘了明天 | Praise and reminders are guilt copy by another name |
| Missed days | Grey cross or red dot | Marks a failure; a missed day stays unmarked |
| Leave | Paid or earned extra days | Everything is free |
| Check-in action | Answering 猜熊猫 or a 每日一猫 guess | Would make a day depend on getting something right; opening 每日一猫 is enough |
| Month change | Slide transition | Motion on a frequent action, not in 熊猫日历 either |

**Verdict: Approve.** Not verified: native iOS and real Dynamic Type.

## apple-design

- **Patterns:** Fitness/Health summary tiles, a week strip of rings, a month of rings; grouped list for actions on leave.
- **Response:** cells and 取消 dim on press; success haptic on taking leave or 补请, selection haptic on cancelling; the circle and a footnote confirm.
- **Dynamic Type:** tiles stack above 1.35; header stacks; circles fit the width.
- **Reduce Motion:** only `PAGE_ENTER`, which respects it.
- **Hit areas:** day cells 48pt tall and a seventh of the width; 取消 and month buttons 44pt.

## Caveats

- Native iOS was not run; this is the web build. Motion reviewed in code.
- Production needs this API deployed and migration `0081` applied before the card shows numbers; until then the 我的 card falls back to 每天打开每日一猫，就记下一天 and 每日一猫 shows no row.
- The proxy mocks the API for screenshots; the API itself was exercised by unit and integration tests.
