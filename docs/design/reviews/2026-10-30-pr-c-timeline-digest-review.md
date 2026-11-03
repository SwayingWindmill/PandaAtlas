# PR C skill review: 时间线 and 本周新鲜事 (2026-10-30)

A pre-merge review of PR C from `/workspace/pandaatlas-plan.md` §7.3, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `373c2b67` (main after #752) on `app/pr-c-timeline-digest`. Fixes land in the same branch.

**Surfaces:**
- 时间线 (`app/pandas/[slug]/timeline.tsx`, `features/timeline/`): new. A panda's completed life events and residencies merged into one dated list, grouped by year, each entry with its sources.
- Panda page (`app/pandas/[slug]/index.tsx`): 看时间线 as the last row of 动态.
- 本周新鲜事 (`features/today/week*.ts(x)`, `app/week.tsx`): a card on 今天 after the story cards, and the full list on `/week`.

**Shared pieces added or changed:** `describeEvent` in `features/timeline/timeline.ts` is now the one wording for an event; `features/pandas/profile.ts` uses it for 动态 and the infobox, so a mother listed in a birth event reads 迎来幼崽出生 instead of 出生.

**How it was checked:** Expo web build against the production API through a local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce`. Production has no release in the last 7 days, so the proxy prepends one fixture release (26 hours old) whose targets are real ids: two old birth events, a 2026 transfer, an old residency, 11 pandas, 37 media and 1 evidence. Pages: bao-li (sources from one publisher), shin-shin (moves), xiao-yatou (a mother, a profile-only birth), a-jie-ningbo-2015 (no records), `/week`.

Profiles: `base` 390×844 @2x light and dark; `dt200` 195×422 @4x plus `fontScale = 2` (temporary local patch to react-native-web's `Dimensions`, reverted); `w320` 320×568. Proxy stress modes: `worst`, `error` (HTTP 500), `slow` (20s), `empty`.

Screenshots: `/workspace/pr-c-shots/before/` and `/after/` (local to the review box, not committed). Default-size shots are in `normal/`.

**Research input:** posts on X about zoo animal biographies, dated timelines and weekly recaps (what is useful, what reads as spam), listed with what each changed in the PR description. **Questions skipped:** the review ran unattended; impeccable's questions were answered from DESIGN.md and plan §6 (free, no rankings, no fan-culture features, at most one push a day and none for the digest).

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | Before | After | Note |
|---|---|---|---|
| Visibility of system status | 3 | 4 | Both pages have skeletons shaped like the loaded layout (two year groups; one group of photo rows). The 今天 card stays hidden while loading rather than flashing a placeholder that may never fill. |
| Match with the real world | 2 | 4 | A life reads as a zoo biography: 2024 · 3 岁, 10月15日, 抵达史密森国家动物园. Before, events were only a flat 动态 list on the panda page. |
| User control and freedom | 3 | 4 | Every source opens in the in-app browser; 全部 and 显示全部 are optional depth. |
| Consistency and standards | 3 | 4 | `ListSection`/`ListCell`, `PandaRow`, `SectionHeader`, `ScreenState`, `LoadFailed`; v2 tokens; one event wording through `describeEvent`. |
| Error prevention | 3 | 4 | Old records arriving this week are not presented as news (a 2021 birth is not 新生). Rolled-back releases are not counted. |
| Recognition over recall | 3 | 4 | Day column, year headers with age, panda photos in the digest. |
| Flexibility | 2 | 3 | Card for a glance, `/week` for the list, folding at 8 rows per kind. |
| Aesthetic and minimalist design | 3 | 4 | No icons on milestone rows; at most three tallies and one line of names on the card; muted publisher. |
| Help users recover from errors | 3 | 4 | `LoadFailed` + 重试 on both pages; 今天 hides the card on an error instead of an error box. |
| Help and documentation | 2 | 4 | The timeline footer says what is included ("只收已经发生、有公开资料的事") and how to correct it. |

**Cognitive load:** one primary action per state (告诉我们 on an empty timeline; the whole card opens `/week`).

**Emotional journey:** the timeline ends with a correction row, not a call to share; the digest is finite (7 days, a date range in the title), has no streak, unread badge or push, and disappears when there is nothing.

**Priority issues (all fixed):**
1. Source links were clipped with no ellipsis, and two sources from one publisher looked the same ("出处：Smithsonian National Zoo and Conserva…" twice) (P1, found in review). Now "出处 {title} · {publisher}", title tinted, up to two lines with an ellipsis, full width.
2. A birth event lists the mother; she was shown as born that day, on the timeline and in the profile (P1, found in review). Now 迎来幼崽出生 for her, and the digest only counts the cubs born that day.
3. A release that backfills old records made 2021 births read as 新生 this week (P1, found in review). Births and moves now count only when they happened in the last 365 days.
4. At 200% text the card's three tallies stacked into a tall column (P2, found in review). Stacked now reads "2 搬家" per line.
5. Empty timeline copy "还没有阿杰有出处的经历记录" was clumsy (P3). Now "阿杰的经历还没有带出处的记录。".

### Native audit (0–4 each)

| Dimension | Before | After | Notes |
|---|---|---|---|
| Accessibility | — | 3 | Source links are `role="link"` with title and publisher in the label; the card reads its range and tallies as one button; year headers are section titles. Dynamic Type only emulated. |
| Performance | — | 3 | The timeline is pure functions over one detail fetch and the places list; the digest reads 30 updates plus residencies and events once per focus. |
| Theming | — | 4 | Light and dark checked on all three surfaces. |
| Platform | — | 4 | Health-highlight style card, Settings-style grouped rows, in-app browser for sources. |
| Adaptivity | — | 4 | Date column stacks above the text at fontScale ≥ 1.35; tallies become a list; no overflow at 320pt. |
| **Total** | — | **18/20** | New surfaces, no before. |

## review-animations

| Before | After | Why |
|---|---|---|
| — | `PAGE_ENTER` on the timeline and `/week` content | Arrival only, under 300ms, skipped by Reduce Motion |
| — | The 今天 card has no entrance | It appears with data after load; animating it would draw attention to news that is meant to be calm |
| — | 显示全部 expands in place | Repeated action, no animation |

No `transition: all`, no stagger, no looping motion. **Verdict: Approve.**

## break-ui

Fixtures at the data boundary (proxy modes and the fixture release), no component mocks.

**Broken (fixed):** the three P1 issues above; at `dt200` the card tallies (fixed as above).

**Ugly (fixed):** empty-state copy; the source link used a full-width space before the title (now a normal space).

**Fragile (recorded, not fixed):**
- The card appears after load and pushes the birthday scroller down once. Hiding when empty (no placeholder) was chosen over a reserved slot that would usually stay blank.
- Source links are footnote-sized text links, under 44pt tall when stacked; they sit apart from other targets, as links in Safari Reader do.
- `PandaRow` does not stack at `dt200`; on `/week` the meta line truncates (same as 找熊猫, unchanged).
- `empty` mode (no places) still renders the timeline with place-less wording (出生, 抵达新家), which is the intended fallback.
- 纠错被采纳 is not in the digest: contributions have no decision date in the API.

**What held up:** `worst` names, 320pt, dark mode, `error` (card hidden on 今天, `LoadFailed` + 重试 on both pages), `slow` (skeletons), `empty` (card hidden, `/week` explains, empty timeline offers 告诉我们), a country-only stay, a mother in a birth event, an unknown birthplace.

## make-interfaces-feel-better

Mode `full`. Scope: the new pages, the card and `features/timeline`, `features/today/week*`.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `timeline.tsx` `SourceLink` | Publisher only, clipped | Title first, publisher muted, 2 lines + ellipsis | Two sources must be told apart |
| HIGH | `features/today/week.ts` | Any event recorded this week | Happened in the last year | News must be new |
| MEDIUM | `features/pandas/profile.ts` | Local `eventText` | Shared `describeEvent` | One wording; the mother fix lands on the profile too |
| MEDIUM | `week-card.tsx` | Tall stacked tallies | One line per tally | Large text stays glanceable |
| LOW | `week.ts` | — | Local calendar days for the range | A UTC day is off in the evening |

Typography: `tabular-nums` on days and counts. Surfaces: continuous corners on the card and groups. No icons on data rows.

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| 今天 | Push or badge for new digest items | Plan: at most one push a day, the digest sends none; research: weekly recaps read as spam when pushed |
| 时间线 | A vertical line with dots | Decoration; the year groups already carry the structure, and it breaks at large text |
| 本周新鲜事 | Photo grid of new media | Photos already live in each panda's album; the count is enough here |
| 时间线 | Newest first | A biography reads from birth |

**Verdict: Approve.** Not verified: native iOS rendering and real Dynamic Type.

## apple-design

- **Patterns:** Health highlights (a summary card that opens a full page), Settings-style grouped rows, year sections like Photos' years, the in-app browser for sources.
- **Response:** rows and the card answer on press (`active:` states).
- **Dynamic Type:** stacking at 1.35 on milestone rows and card tallies.
- **Reduce Motion:** `PAGE_ENTER` skipped.
- **Hit areas:** 44pt on rows and the card; source links noted above.

## Caveats

- Native iOS was not run; this is the web build. Arrival motion reviewed in code.
- The recent release is a proxy fixture; production has no update in the last 7 days, so the card is hidden there today.
- A birth or death taken from the profile has no source of its own and says so.
- Rollback handling assumes `release_rolled_back` names the release it undoes in `previousReleaseId`.
