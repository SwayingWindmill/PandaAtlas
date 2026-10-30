# PR I skill review: 那年今天 (2026-10-30)

A pre-merge review of PR I, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `aaa8819` (main) on `app/pr-i-on-this-day`. Fixes land in the same branch.

**Surfaces:**
- 今天 card (`features/today/on-this-day-card.tsx`): up to three memories of this calendar day in an earlier year, one per kind in turn (`pickForCard`), 全部 when there are more; a trailing ••• per row with 少显示这只 / 少显示这里 and 关闭那年今天, then one muted footnote with 撤销.
- 那年今天 page (`app/on-this-day.tsx`): every memory for today grouped 你的记录 / 回国 / 来到新家 / 生日, loading skeleton, `LoadFailed`, an empty state, and the 设置 group at the foot.
- 设置 (`features/on-this-day/settings-section.tsx`): a 那年今天 switch with a `History` glyph square, and 恢复少显示的 N 项 when anything is shown less.
- Panda page (`app/pandas/[slug]/index.tsx`): that panda's public memories for today, titled 纪念 when it has died (`DECEASED_POLICY`), else 那年今天.
- 今天生日 on 今天 (`features/today/today-birthdays.tsx`) yields to the card while 那年今天 is on (the birthday is already a row there); 快过生日了 stays.
- Data: `features/on-this-day/on-this-day.ts` (pure, 15 unit tests) and `load.ts`, from published life events, residencies, profile birth dates and, signed in, the fan's own 见过 / 认出 / 去过. No API or migration change.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce`, the clock fixed to a day with data (2027-09-29, also 2027-08-04 for a deceased panda and 2027-10-30 for a day with nothing). Personal history came from a proxy fixture (one 见过, one 认出, one 去过 a year earlier); public memories are real catalog data. Profiles: `base` 390×844 light and dark, `dt200` (195pt-wide viewport at 4×, as 200% zoom), `w320`. Proxy modes: `worst` (longest names), `error` (events and residencies 500), `slow`, `empty`, signed out, and preferences off / two shown less. An interaction script opened •••, chose 少显示这只, then 关闭那年今天, reloaded, and opened 设置.

Screenshots: `/workspace/pr-i-shots/before/` and `/after/` (local to the review box, not committed); `after/normal/` default size and `after/normal/interaction/`, `after/stress/<profile or mode>/` the rest.

**Research input (read when the page plan was written, reused here):**
- parsley72, https://x.com/parsley72/status/1754600874872320302: Google Photos kept surfacing a dog that had died, "I'm still not ready". → A deceased panda is never on 今天 and never pushed; its own page remembers it under 纪念 (`DECEASED_POLICY`, one constant to flip).
- yamsisthemoon, https://x.com/yamsisthemoon/status/1944871467495383047, and Alpha_Hermes, https://x.com/Alpha_Hermes/status/1573939234632740864: Facebook memories resurfacing old photos and a cancer surgery. → Only factual public milestones and the fan's own first sightings; nothing about health or loss reaches 今天.
- shazza_louise96, https://x.com/shazza_louise96/status/1308901594159869952: could not turn memories off. → 关闭那年今天 on every row, the switch in 设置, 撤销 right there.
- remow49 https://x.com/remow49/status/1303659192092446722, RickDronkers https://x.com/RickDronkers/status/1589372676543770625, nicgrasset https://x.com/nicgrasset/status/1194061366207881224: people enjoy On This Day. → Worth a place on 今天, but finite (three rows) and gone on a day with nothing.
- Fans already keep these days: idaily_read https://x.com/idaily_read/status/1585763807476912128 (上野 50 周年), YuanBaoTree https://x.com/YuanBaoTree/status/1783702543539085333 (丫丫回家一年), wan210366 https://x.com/wan210366/status/1993501232443658664 (贡贡顺顺上岛 7 周年), XinhuaChinese https://x.com/XinhuaChinese/status/1808751873945710643 (萌兰、和花、和叶 7 月 4 日生日), CEWProjects https://x.com/CEWProjects/status/2113254101794398589. → The three public kinds: 生日, 来到新家, 回国.
- Apple Photos: 少显示这一天 / 地点 / 人物 and turning Featured Content off (https://support.apple.com/guide/iphone/share-or-delete-memories-iph2af67b000/ios, https://support.apple.com/guide/iphone/hide-people-memories-and-holidays-iph10a9dd2a1/ios). → 少显示这只 / 这里 per subject, the action sheet on iOS, a 设置 switch and a restore row.
- Wikipedia's Explore feed research found On This Day "approachable, finite, and lightly educational" (https://www.mediawiki.org/wiki/Wikimedia_Apps/Team/Explore_Feed_Refresh/Phase_0).

No new posts were read for this PR.

**Questions skipped:** the review ran unattended; answers came from DESIGN.md, PRODUCT.md, the page plan and the brief (deceased handling per the recommended default, local preferences, sourced facts only).

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | First build | After | Note |
|---|---|---|---|
| Visibility of system status | 3 | 4 | After 少显示 the footnote with 撤销 sat under the group, below the fold on a phone; it now sits under the heading, where the tap was. |
| Match with the real world | 4 | 4 | N 岁生日, N 年前的今天回国，住进X: the sentences fans already post. |
| User control and freedom | 3 | 4 | Undo on the spot, the 设置 switch, 恢复少显示的 N 项. |
| Consistency and standards | 3 | 4 | The group used the 24pt featured-card radius; it is now `rounded-group` like 关注的新资料. Source lines follow the timeline (出处 …). |
| Error prevention | 4 | 4 | 关闭 is reversible from 设置 and says so in its footnote. |
| Recognition over recall | 4 | 4 | Every row names its source. |
| Flexibility | 3 | 3 | Card, full page, the panda's own page. |
| Aesthetic and minimalist design | 3 | 4 | The card could fill with three 见过 rows; `pickForCard` now takes one per kind in turn. |
| Help users recover from errors | 3 | 4 | On 今天 a failure hides the card (nothing to recover); the page shows `LoadFailed` + 重试. |
| Help and documentation | 3 | 3 | The 设置 footer says what it shows and that choices stay on this device. |

**Priority issues (all fixed):**
1. At `dt200` (and any window under 280pt) the 56pt photo and the ••• squeezed the text to one character a line (P1). Rows now stack: photo and ••• on top, then the name, sentence and source at full width, separators from the leading edge (`memory-group.tsx:74-76`, `:103-121`).
2. 撤销 out of view after 少显示 (P2), moved under the heading (`on-this-day-card.tsx:59`).
3. The card's first build showed only personal rows on a day with three (P2): one per kind in turn (`on-this-day.ts:358`).
4. Two 今天生日 surfaces for the same panda on the same day (P2): the shelf yields while the card is on.
5. Group and skeleton radius `rounded-card` → `rounded-group`; skeleton spacing on tokens (P3).

### Native audit (0–4 each)

| Dimension | First build | After | Notes |
|---|---|---|---|
| Accessibility | 3 | 4 | Each row reads name, sentence and source; ••• is "更多，{name}" with `expanded` on web; choices announced; undo footnote is a polite live region; switch labelled 在今天页显示那年今天. |
| Performance | 4 | 4 | One fetch on focus (events and residencies, plus the fan's records when signed in); one source looked up per memory (the first that resolves), after the rows are on screen. |
| Theming | 4 | 4 | Light and dark; no warm accent (the 今天 date line keeps it). |
| Platform | 4 | 4 | Photos' Memories and its 少显示 action sheet; Settings glyph row and switch. |
| Adaptivity | 2 | 4 | See priority 1. |
| **Total** | 17/20 | 20/20 | |

## review-animations

| Before | After | Why |
|---|---|---|
| — | `PAGE_ENTER` once on the 那年今天 page | One arrival per open, no entrance on web |
| — | Rows and •••: `active:bg-accent` highlight only | A list row, as Settings; no scale on a grouped row |
| — | 少显示 / 关闭: the row leaves without an exit animation, footnote appears in place | Removal is instant in Photos too; motion would delay the undo |
| — | Inline choices on web open without a slide | Frequent, small; a slide adds motion to a menu |

No `transition: all`, no stagger, nothing looping, nothing celebratory on a birthday. **Verdict: Approve.**

## break-ui

### Part 1 — What broke

| # | Severity | Field | Worst-case value | What happens | Fix |
|---|---|---|---|---|---|
| 1 | Broken | row layout | `dt200` / 195pt window | Text one character per line beside the photo | Stack at large text or under 280pt, `memory-group.tsx:74` |
| 2 | Ugly | undo footnote | three rows on a phone | 撤销 below the fold | Under the heading, `on-this-day-card.tsx:59` |
| 3 | Ugly | card mix | three personal rows | Public anniversaries never on the card | `pickForCard`, `on-this-day.ts:358` |
| 4 | Fragile | name | Fu Duo Duo / Pu Pu / 福多多… | One line, truncated with … at default size; full at large text | Kept: the sentence and the page give the rest |
| 5 | Fragile | source | birthday with no birth event | 来自资料卡，这一条还没有单独的出处 on most birthdays | Kept: honest, as on the timeline |

### Part 2 — Decisions for you

- Deceased pandas: profile only, 纪念, never pushed (`DECEASED_POLICY`); flip `onToday` to show them on 今天 too.
- Preferences are per device (AsyncStorage / localStorage `onThisDay`); syncing them would need an API field. Recommend keeping local until accounts carry other settings.
- 满月 / 百天 are left for N3 (milestones), which will feed the same pool.

### Part 3 — What held up

320pt, dark, `worst` (longest names truncate, no overlap), `error` (今天 hides the card, the page shows 重试), `slow` (skeleton), `empty` and 2027-10-30 (nothing applies: no card, no gap on 今天), signed out (public rows only), off (card gone, 今天生日 back, switch off in 设置, page still lists the day), two shown less (restore row). A deceased panda (奇妙, 2027-08-04) is absent from 今天 and listed under 纪念 on its page. Old releases without events or residencies: each loader falls back to empty, so the card simply does not appear.

Toggle: `/tmp/otd-fixture` with a date and the proxy's auth mode (personal fixture), `CLOCK` and `PREFS` in `/workspace/shotkit/review-i.mjs`.

## make-interfaces-feel-better

Mode `full`. Scope: the files above.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `memory-group.tsx` | Squeezed rows at large text | Stacked rows | Text must stay readable at every size |
| MEDIUM | `on-this-day-card.tsx` | 撤销 below the group | Under the heading | Feedback where the eye is |
| MEDIUM | `on-this-day.ts` | First three rows | One per kind in turn | Variety on a three-row card |
| MEDIUM | `memory-group.tsx`, `on-this-day.tsx` | 24pt card radius on a list | `rounded-group`; 56pt photo at `control` | Concentric with the inset row, matches other lists |
| LOW | `today-birthdays.tsx` | Same birthday twice on 今天 | Shelf shows 快过生日了 while the card is on | One place per fact |

Hit areas: ••• is 44×44 (`size-11`), choices and 撤销 44pt tall, the switch has a 12pt `hitSlop`. Photos carry `PhotoOutline`. Ages and years sit in running sentences, so no tabular figures.

Icons: `Ellipsis` for the per-row more button (glyph-only, named), `History` in a Settings glyph square for the 那年今天 row, `MapPin` as the stand-in photo for a place (the same fill a panda without a photo gets). No icon on the section title, on the rows' text or on the undo line.

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| Card | 祝 / 生日快乐 / cake glyph | Writes text that is not in the data; celebration motion |
| Card | Warm (笋金) accent on the date | The 今天 date line is already the one warm element |
| Deceased | 去世纪念日 on 今天 or as a notification | parsley72 and the brief: never pushed |
| Swipe to dismiss rows | Swipe actions | Hidden gesture on a card in a scroll view; ••• is discoverable |
| 满月 / 百天 | Extra kinds | Deferred to N3 |

**Verdict: Approve.** Not verified: native iOS (the action sheet path) and real Dynamic Type.

## apple-design

- **Patterns:** Photos' Memories (a few, finite, per-subject 少显示, a global off in Settings); grouped list rows; the Settings switch row.
- **Response:** row highlight on press; selection haptic on •••, tap haptic on a choice and on 撤销; the row leaves at once.
- **Dynamic Type:** rows stack at large text; names wrap instead of truncating there.
- **Reduce Motion:** only `PAGE_ENTER`, which respects it.
- **Hit areas:** 44pt for •••, choices, 撤销 and 全部.

## Caveats

- Native iOS was not run; this is the web build, so the action sheet path was reviewed in code. Large text was checked as a narrow window, not with the system font scale.
- Personal rows in the screenshots come from a proxy fixture; public rows are real data at a fixed clock. On 2026-10-30 itself nothing in the catalog applies, so production shows no card today.
- Most birthdays come from the profile with no birth event, so their source line says so.
