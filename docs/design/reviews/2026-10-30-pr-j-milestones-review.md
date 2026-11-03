# PR J skill review: 里程碑 (2026-10-30)

A pre-merge review of PR J, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `app/pr-i-on-this-day` (PR I, 那年今天), itself on `aaa8819` (main). The branch is stacked because the milestones feed 那年今天's pool. Fixes land in the same branch.

**Surfaces:**
- 里程碑 page (`app/milestones.tsx`): the fan's own milestones, grouped 熊猫 (the 1st, 10th, 50th, 100th and 200th panda seen or recognized) and 地方 (the 2nd, 5th, 10th and 20th visit to one place), newest first, with the switch at the foot. Reached from 我的; turned off, it says so and offers 打开里程碑.
- 我的 (`app/(tabs)/me/index.tsx`): a 里程碑 row under 去过的地点 with the latest milestone as its trailing value, as 通知 shows its unread count. Hidden while off.
- 图鉴 (`app/(tabs)/book/index.tsx`): a panda that was a milestone carries its number (1, 10, 50…) in the warm pill (`features/milestones/badge.tsx`) in place of the plain `No.` figure.
- Panda timeline (`app/pandas/[slug]/timeline.tsx`, `features/timeline/timeline.ts`): 满月, 满百天, 1 / 10 / 20 / 30 岁生日 and 当妈妈了 / 当爸爸了 as rows. The worked-out days carry the warm 里程碑 badge and 按出生日期推算; becoming a parent cites the lineage sources, and is merged into a recorded cub birth when one tells the same day.
- 那年今天 (`features/on-this-day/on-this-day.ts`): a living cub's 满月 and 满百天 on the day (group 满月和百天), and the fan's own record says 是你第一次回来 / 是你认出或见过的第 N 只 when that day was a milestone. No new surface on 今天.
- 设置 (`features/milestones/settings-section.tsx`, also on the 里程碑 page): a 里程碑 switch with a `Flag` glyph square and a footer listing the nodes from config.
- Config: `MILESTONE_CONFIG` in `features/milestones/milestones.ts` is the one place for the nodes (pandas `[1, 10, 50, 100, 200]`, visits `[2, 5, 10, 20]`, birthdays `[1, 10, 20, 30]`, `hundredDays: 100`). The footer, tests and DESIGN.md read from it.
- Preferences: `features/milestones/prefs.ts`, AsyncStorage / localStorage `milestones` `{ off }`, per device.
- Data: no API, migration or release change. Built from the fan's 见过 / 认出 / 去过 already loaded for 我的, published profiles, life events and parent links.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce`. The clock was fixed per shot: 2026-10-30, and for 那年今天 2027-06-01 (first panda), 2027-07-03 (满月), 2027-09-11 (满百天), 2027-10-26 (是你第一次回来) and 2027-12-31. Personal history came from a proxy fixture (`/tmp/milestone-fixture`): ten 见过 / 认出 and repeat visits. Panda facts are real catalog data. Profiles: `base` 390×844 light and dark, `dt200` (195pt-wide viewport at 4×, as 200% zoom), `w320`. Proxy modes: `worst`, `error`, `slow`, `empty` (nothing saved), signed out, and off. An interaction script went 我的 → 里程碑, turned it off, checked 图鉴 and 我的, then 打开里程碑. Unit tests: `milestones.test.ts`, plus new cases in `timeline.test.ts` and `on-this-day.test.ts`.

Screenshots: `/workspace/pr-j-shots/before/` and `/after/` (local to the review box, not committed). `after/normal/` holds the default size, and `after/normal/interaction/` the interaction script. `after/stress/<profile or mode>/` holds the rest.

**Research input (read when the page plan was written, `pandaatlas-new-pages-plan.md` N3, reused here):**
- guttenbirder22, https://x.com/guttenbirder22/status/2087681112722313724: birders mark every 100th species as "such fun milestones in life". → Round counts of pandas: 1, 10, 50, 100, 200.
- p0kekira, https://x.com/p0kekira/status/2097031868474646786: thought a bird was new, then found in eBird it had been seen before. → The app remembers which panda was which number and says so on 那年今天 and in 图鉴.
- RigganRVA, https://x.com/RigganRVA/status/1394821903668424704: Strava's Local Legend rewards how often you go, not speed. → 第 N 次回到这里, with no leaderboard and no comparison with anyone.
- AdvancedLena, https://x.com/AdvancedLena/status/1477034223810846721: set a Goodreads goal to 1 to stop being told she was behind. → No goals, no progress bars, no "距离下一个还差".
- growingourfury, https://x.com/growingourfury/status/1187327191668928513: a challenge "sucked the joy out". → No streaks, no challenges, and the whole thing can be turned off.
- meganireneb, https://x.com/meganireneb/status/1486878439969738752: Strava emailed "you're no longer a Local Legend" while she was injured. → Nothing is ever taken away and nothing is pushed. A milestone is a past fact.

No new posts were read for this PR.

**Questions skipped:** the review ran unattended, so answers came from DESIGN.md, PRODUCT.md, the page plan and the brief. Visit and birthday nodes were chosen here (see Part 2), deceased pandas follow `DECEASED_POLICY`, and preferences are local.

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | First build | After | Note |
|---|---|---|---|
| Visibility of system status | 3 | 4 | 我的 shows the latest milestone beside the row. Off, the page says what is hidden and where. |
| Match with the real world | 4 | 4 | 满月, 满百天, N 岁生日 and 当妈妈了 are the words zoos and fans use. |
| User control and freedom | 3 | 4 | One switch on the page and in 设置, 打开里程碑 on the off page. Turning it off hides badges and counted rows everywhere at once. |
| Consistency and standards | 2 | 4 | The first build put a `Flag` icon on timeline rows, which breaks the Timeline Rule (no icons on rows). It is now the warm 里程碑 pill. In 图鉴 the number takes the same pill. |
| Error prevention | 4 | 4 | Nothing to lose: the switch only hides, and the records stay. |
| Recognition over recall | 3 | 4 | The 那年今天 row tells the fan it was their 10th panda or their first time back. |
| Flexibility | 3 | 3 | Page, 我的 row, 图鉴, timeline, 那年今天. |
| Aesthetic and minimalist design | 2 | 4 | The first build listed every first visit (a copy of 去过的地点), every fifth birthday, the birth source under each counted row, and the footer twice. See priority issues. |
| Help users recover from errors | 3 | 4 | `LoadFailed` + 重试 on the page (reviewed in code); 我的 just shows no trailing value; the timeline keeps its 重试. |
| Help and documentation | 3 | 4 | The footer lists the nodes from config and says there is no goal and no comparison. |

**Priority issues (all fixed):**
1. `Flag` icon on timeline rows (P1, Timeline Rule): replaced by `MilestoneBadge` "里程碑" (`timeline.tsx`). Counted rows show the badge and 按出生日期推算.
2. The page repeated 去过的地点: every first visit to a place was a milestone (P2). The visits config now starts at 2. A first visit is already the 去过 list, and 那年今天 tells it as 是你第一次回来 on its anniversary.
3. Timeline clutter (P2): 5 / 15 / 25 岁 rows and the birth source repeated under each counted row. Birthdays are now `[1, 10, 20, 30]`. Counted rows show no source line (the birth row above carries it); 当妈妈了 keeps its lineage sources.
4. Footer shown twice on the page (P3): the page's own footer was removed, leaving the settings section's.
5. Summary "N 个里程碑" on the timeline header clashed with the feature name (P3): now "N 条记录", and counted rows are not counted.
6. Turned off, a recorded cub birth merged into 当妈妈了 kept the milestone wording (P3). It now goes back to the recorded text (`recordedText`, `timeline.ts`, tested).

### Native audit (0–4 each)

| Dimension | First build | After | Notes |
|---|---|---|---|
| Accessibility | 3 | 4 | Rows read title then panda and date. The badge is text, so it is read. The switch is labelled 显示里程碑. 我的 row reads 里程碑, then the latest. |
| Performance | 4 | 4 | One load on focus (the fan's records, already used by 我的), pure functions after that. |
| Theming | 4 | 4 | Light and dark. The warm (笋金) accent is only on the badge, which DESIGN.md reserves for milestones and today. |
| Platform | 4 | 4 | Grouped list, Settings glyph row and switch, Health-style "highlights" without awards. |
| Adaptivity | 2 | 3 | At `dt200`, titles were cut at 2 lines. `TITLE_LINES = 3` now fits panda titles in full; a long place name still ends in … on the third line at 195pt (see break-ui 3). |
| **Total** | 17/20 | 19/20 | |

## review-animations

| Before | After | Why |
|---|---|---|
| — | `PAGE_ENTER` once on the 里程碑 page | One arrival per open |
| — | Rows: `active:bg-accent` highlight only | List rows, as Settings |
| — | Reaching a milestone: nothing | No confetti or celebration: it is a record, not a reward (growingourfury, AdvancedLena) |
| — | Switch: system switch, rows leave at once | Settings behaviour |

No `transition: all`, no stagger, nothing looping. **Verdict: Approve.**

## break-ui

### Part 1 — What broke

| # | Severity | Field | Worst-case value | What happens | Fix |
|---|---|---|---|---|---|
| 1 | Ugly | title | `dt200`, 第 10 只熊猫 | Cut to 第 10 / 只熊… | `TITLE_LINES = 3`, `milestones.tsx:24` |
| 2 | Broken | 我的 | fan with seen pandas but no daily check-ins (proxy fixture) | `totalVisitDays` of undefined | Fixture gap in the mock, not the app: the API always returns check-ins. Fixture added. |
| 3 | Fragile | place title | 第一次回到成都大熊猫繁育研究基地 at `dt200` | Third line ends in … | Kept: the 去过 page and the place page have the full name |
| 4 | Fragile | twins | two cubs born the same day | Order varied between loads | Sorted by date then name: 当妈妈了，A和B出生 |
| 5 | Fragile | mother with no birth date | cub birth event | Read as her own birth | Merged into 当妈妈了 only when the parent link says so |
| 6 | Fragile | 图鉴 at `dt200` | long list | Rows squeeze (as on main) | Pre-existing, out of scope |

### Part 2 — Decisions for you

- **Nodes:** pandas 1 / 10 / 50 / 100 / 200 follow the plan. Visits 2 / 5 / 10 / 20 and birthdays 1 / 10 / 20 / 30 were chosen in this review. Change `MILESTONE_CONFIG`.
- **满百天** is birth + 100 days (`hundredDays`), as zoos count it. 满月 is the same day one month later.
- **Deceased pandas:** counted rows stop at the death date. A deceased cub gets no 满月 / 满百天 on 那年今天, and nothing is pushed (`DECEASED_POLICY`).
- **当妈妈了 / 当爸爸了** only with a parent link that has sources and a dated cub. Otherwise nothing.
- **Preferences** are per device, like 那年今天.
- The plan's 成年 node was not added: there is no sourced age of adulthood per panda. Round birthdays stand in for it.

### Part 3 — What held up

320pt, dark, `worst`, `error` (every API call fails, so the session falls back to signed out and the page shows the 登录 state, as 我的 does; the timeline shows 时间线暂时打不开 + 重试; the page's own `LoadFailed` path, reached when only the fan's records fail, was reviewed in code), `slow` (skeleton), `empty` (the page says 还没有里程碑, with no 0 / 10 progress), signed out (no 我的 row, no badges, panda milestones still on timelines), off (no row on 我的, no chips in 图鉴, no counted rows or 满月 on timelines and 那年今天, page offers 打开里程碑). Interaction: off → reload stays off → back on.

Toggle: `/tmp/milestone-fixture` and the proxy's auth mode for personal history, `CLOCK` and `PREFS` in `/workspace/shotkit/review-j.mjs`.

## make-interfaces-feel-better

Mode `full`. Scope: the files above.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `timeline.tsx` | `Flag` icon on rows | Warm 里程碑 pill | Timeline Rule, one accent for one meaning |
| MEDIUM | `milestones.ts` | First visit of every place | From the 2nd visit | Not a second 去过 list |
| MEDIUM | `timeline.tsx` | Birth source under every counted row | None, the birth row has it | Less repetition |
| MEDIUM | `book/index.tsx` | `Flag` + number | Number in the warm pill | Reads as the panda's number, not a button |
| LOW | `milestones.tsx` | Footer twice | Once | — |

Hit areas: rows are full width and at least 44pt, and the switch has a 12pt `hitSlop`. Numbers sit in sentences or in the pill, so no tabular figures are needed.

Icons: `Flag` only in the 我的 row and the Settings glyph square, `MapPin` for places, and panda photos for pandas. No icons on timeline rows.

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| Page | Progress to the next node (7 / 10) | A goal by another name (AdvancedLena) |
| Page | Streaks, yearly totals, ranking among fans | Comparison and streaks are out (brief, meganireneb) |
| 今天 | A birthday or milestone card | 那年今天 already tells the day, so no duplication |
| Push | "你认出了第 10 只熊猫" notification | Nothing pushed, nothing taken away |
| Timeline | 5-year birthdays | Clutter on long-lived pandas |

**Verdict: Approve.** Not verified: native iOS and real Dynamic Type.

## apple-design

- **Patterns:** Health and Photos highlights (past facts, no awards), grouped list rows, the Settings switch row, a trailing value on a 我的 row.
- **Response:** row highlight on press, and the switch takes effect at once on every surface.
- **Dynamic Type:** titles up to three lines. Rows stack at large text via `useStacked`.
- **Reduce Motion:** only `PAGE_ENTER`, which respects it.
- **Hit areas:** 44pt rows and the switch.

## Caveats

- Native iOS was not run. This is the web build; large text was checked as a narrow window.
- Personal milestones in the screenshots come from a proxy fixture (with a daily check-ins fixture added to the mock). Panda milestones are real data.
- 乐宝 (le-bao) has a birth date of 2026-06-03 in the data, which looks wrong. The milestones follow the data as published.
- The before shot of 我的 is broken by the old mock (missing check-ins), not by main.
