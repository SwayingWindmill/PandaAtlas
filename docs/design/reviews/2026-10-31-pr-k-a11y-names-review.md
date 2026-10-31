# PR K skill review: 无障碍与名字整理 (2026-10-31)

A pre-merge review of PR K (page plan N7, batch 1), run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `7355927` (main, after #759 and #760). Fixes land in the same branch.

**Surfaces:** every route in the app, audited at runtime: 今天 `/`, 图鉴, 找熊猫, 我的, 设置, 里程碑, 那年今天, panda page, 时间线, 家族, place, institution, 合集, 去过, 熊猫日历, 地图, 认识熊猫, 每日一猫, 猜猜看, 机构, 关于, 本周, 对比, 每日打卡, 通知, 账户. Code changed in:
- `components/grouped-list.tsx`: `NARROW_WIDTH` (280), `useStacked()` and `useSingleColumn()` used by every restack; new `SwitchRow`, where the whole row is one `switch` and the 51×31 track (`component.switchTrack`, new in `design/tokens.ts`) is drawn and hidden.
- `components/segmented.tsx`: each segment's hit area spans the 44pt track.
- `components/ui/text.tsx`: `role="heading"` without a level gets 2 (footnote) or 3 (headline).
- `components/page.tsx` (`NO_WEB_BAR_TITLE`), also used by `app/learn/index.tsx` and `features/learning/reading-page.tsx`: no empty bar title on web.
- `components/stretchy-hero.tsx`, `app/pandas/[slug]/index.tsx`, `app/institutions/[slug].tsx`: the hero toolbar comes first in reading order; no drift under Reduce Motion.
- `components/scrim.tsx`, `app/daily.tsx`, `app/institutions/[slug].tsx`, `features/family/family-tree.tsx`: decorative SVGs hidden.
- Restacks: `app/(tabs)/book/index.tsx`, `app/collections/index.tsx`, `app/places/[slug].tsx`, `app/institutions/[slug].tsx`, `app/calendar.tsx`, `features/on-this-day/memory-group.tsx`.
- Switches: `features/on-this-day/settings-section.tsx`, `features/milestones/settings-section.tsx`, `app/notifications.tsx`. 时间线 source links: `app/pandas/[slug]/timeline.tsx`. `/dev/design-system` shows `SwitchRow`.
- Data: none. The name cleanup is a proposal only (see Part 2 of break-ui).

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce`, clock fixed at 2026-10-30, signed in (aal2). A runtime audit script went through all 25 routes and listed, per route, visible controls under 44pt in either direction, controls without a name, SVGs not hidden from assistive tech, and images without alt or a labelled holder. Accessibility-tree snapshots (Playwright `ariaSnapshot`) were read for heading levels, reading order and grouping. Contrast was computed from the tokens. Profiles: `base` 390×844 light and dark, `dt200` (195pt-wide viewport at 4×, as 200% zoom), `w320`, and the proxy's `worst` mode. 我的 and 每日打卡 used a daily check-ins fixture in the mock (the before shots of 我的 were broken by the mock, not by main).

Screenshots: `/workspace/pr-k-shots/before/` and `/after/` (local to the review box, not committed). `normal/` holds the default size with `.ax.yaml` tree snapshots, and `stress/<dark|dt200|w320|worst>/` the rest.

**Questions skipped:** the review ran unattended. Answers came from DESIGN.md, the page plan (N7) and the brief. Name changes were not applied: they wait for the owner.

## Audit numbers (all 25 routes)

| Check | Before | After |
|---|---|---|
| Controls under 44pt | 22 | 0 |
| SVGs exposed to assistive tech | 14 | 0 |
| Controls without a name | 0 | 0 |
| Images without alt or a labelled holder | 0 | 0 |
| `h1` per screen | 2 to 9 on 14 of 17 snapshotted screens (empty bar title, footnote headers read as `h1`) | 1 |

The 22 small controls were the segments of every `Segmented` (32pt tall inside a 44pt track), the 32×20 switches in 设置 and 通知, and the source links on 时间线 (20pt tall).

## Contrast (WCAG, from tokens)

| Pair | Light | Dark |
|---|---|---|
| Warm accent text on `warmSoft` (the pill) | 4.91 | 8.71 |
| Warm accent on white / grouped | 5.73 / 5.13 | — |
| Secondary label on card / grouped / fill | 5.99 / 5.37 / 4.77 | 7.69 / — / 6.30 |
| Tint on every surface | ≥ 6.58 | ≥ 6.58 |
| Tertiary label | 1.74 | 2.52 |

All text roles pass AA (4.5). The tertiary label fails as text and is used only for chevrons, as `global.css` says; placeholders use the muted foreground. No change.

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | Before | After | Note |
|---|---|---|---|
| Visibility of system status | 4 | 4 | Switches now announce their state as the row (`switch "显示里程碑" [checked]`). |
| Match with the real world | 3 | 3 | Names like 「Kouhin / 幸浜」 and 「娅光 (Ya Ya」 still show; the fix is in the proposal, waiting for the owner. |
| User control and freedom | 4 | 4 | — |
| Consistency and standards | 3 | 4 | Heading levels followed the variant only; a footnote section header read as `h1`. Now one `h1` per screen. |
| Error prevention | 4 | 4 | — |
| Recognition over recall | 4 | 4 | Family tree, map and calendar already have linear lists (家人, the place list, the day list). |
| Flexibility | 3 | 4 | Large text: switch rows, calendar header, 图鉴 stats and grids restack. |
| Aesthetic and minimalist design | 4 | 4 | — |
| Help users recover from errors | 4 | 4 | — |
| Help and documentation | 3 | 3 | — |

**Priority issues (all fixed):**
1. Small hit areas (P1): segments 32pt tall, switches 32×20, source links 20pt. Segments now take the whole track, switches are whole rows (`SwitchRow`), and source links are 44pt.
2. Reading order on detail pages (P1): 返回 and 分享 were read after the whole page because the toolbar was rendered after the scroll view. It is now first in the tree, kept on top with `zIndex`.
3. Headings (P2): `role="heading"` on a footnote or headline had no level, so the web read it as `h1`, and the empty navigation bar title was a second `h1`. Levels now default to 2 / 3, and the web bar title is not rendered when the page draws its own.
4. Decorative SVGs read (P2): the scrim gradient, the 每日一猫 and institution plates and the family-tree connectors were exposed. Now `aria-hidden`.
5. Large text (P2): at `dt200` the switch label was one character a line, the calendar month title stood vertical beside the arrows, and 合集 / residents / 图鉴 grids kept two columns at 97pt. All restack now, by one rule (`useStacked`, `useSingleColumn`).

### Native audit (0–4 each)

| Dimension | Before | After | Notes |
|---|---|---|---|
| Accessibility | 2 | 4 | Names everywhere, 44pt everywhere, one switch per row, headings and order fixed. Photo descriptions (plan N7) are not written: they need human writing and review. |
| Performance | 4 | 4 | No new loads. |
| Theming | 4 | 4 | AA in light and dark (table above). |
| Platform | 3 | 4 | The switch is the iOS 51×31 size, and the row is the control, as in Settings. |
| Adaptivity | 2 | 3 | Restacks at 280pt. Two `dt200` spots stay tight (break-ui 5 and 6). |
| **Total** | 15/20 | 19/20 | |

## review-animations

| Before | After | Why |
|---|---|---|
| Hero plate drifts 0.35× against the scroll | No drift under Reduce Motion; the stretch that follows the finger stays | Motion against the scroll is what Reduce Motion is for |
| System switch (web: 32×20, no motion) | Track 51×31, knob slides with `move` (280ms, in-out), instant under Reduce Motion | One curve for things that change place |
| Segmented thumb | Unchanged (`move`, none under Reduce Motion) | — |

No `transition: all` (the track lists `backgroundColor`, the knob `transform`), nothing loops, no stagger. **Verdict: Approve.**

## break-ui

### Part 1 — What broke

| # | Severity | Field | Worst-case value | What happens | Fix |
|---|---|---|---|---|---|
| 1 | Broken | switch label | 那年今天 at `dt200` | One character a line | `SwitchRow` stacks: label row full width, track under it |
| 2 | Ugly | calendar month | 2026年10月 at `dt200` | Title vertical beside the arrows | Header wraps when stacked; arrows go under the title |
| 3 | Ugly | 合集, residents, 图鉴 grids | `dt200` | Two 97pt columns, names cut | One column under 280pt (`useSingleColumn`), 图鉴 stats stack |
| 4 | Fragile | long place name | 中国大熊猫保护研究中心卧龙神树坪基地 at `dt200` | Third line ends in … on rows | Kept: the place page has the full name, and the row's label reads it in full |
| 5 | Fragile | calendar grid | two-digit days at `dt200` | Days sit close (10 11) | Kept: the day list below reads each day in full; a narrower grid would need a week view |
| 6 | Fragile | 图鉴 segmented | 按家族 at `dt200` | Last character slightly clipped | Kept: three segments in 195pt; the label is read in full |
| 7 | Fragile | `/places/[slug]` on web | — | React warns about a non-boolean `accessible` attribute in development | Pre-existing: the same warning shows on main. Its source was not found in this PR's code; development builds only |
| 8 | Wrong | panda names | 「Kouhin / 幸浜」, 「娅光 (Ya Ya」, Latin-only names | Shown as is in lists, 图鉴, family, 每日一猫 | Proposal written, nothing applied (Part 2) |

### Part 2 — Decisions for you

- **Names (plan N7):** a proposal, not a change. 76 pandas in the current public release: 29 「罗马字 / 汉字」, 8 Latin-only names marked Chinese, 6 cut at an import bracket (娅X), 33 with no Chinese name (curation candidates matched by birth date, for a human to check). The plan counted 45 + 33; the current release has 43 + 33. No name was invented: every suggestion is a spelling already in the data or the curation table. Shirahama names keep the data's Japanese forms (浜) unless you choose simplified (滨). After you confirm, either the curation data is fixed and a release published, or the app gets a display-only fallback; a ready fallback (`cleanChineseName`) is kept out of this PR.
- **Photo descriptions** (plan N7) need human writing and review, so none were written.
- **`components/ui/switch.tsx`** is no longer used. Kept for now; delete it in a later cleanup if nothing comes back to it.

### Part 3 — What held up

320pt, dark, `dt200`, `worst` on 图鉴, a panda page and a long place. 家族, 地图 and 熊猫日历 already offer linear versions (家人 list, place list by region, day list) with one label per row. Rows and stat tiles are grouped with one combined label. `PAGE_ENTER`, `PressScale` and the segmented thumb already respected Reduce Motion.

## make-interfaces-feel-better

Mode `full`. Scope: the files above.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `segmented.tsx` | Tap target 32pt inside a 44pt track | Whole track | Misses near the edge did nothing |
| HIGH | `grouped-list.tsx` | 32×20 switch, label not tappable | Whole row toggles, 51×31 track | Settings behaviour, bigger target |
| MEDIUM | `stretchy-hero.tsx` | Toolbar read last | Read first | Back is the first thing a screen reader user looks for |
| MEDIUM | `timeline.tsx` | Source link 20pt tall | 44pt, full width | Small links in long lists |
| LOW | `text.tsx` | Footnote headers as `h1` | Level 2 / 3 | Heading navigation lists real sections |

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| Panda photos | Generated alt text | Plan N7 says descriptions need human writing; a guessed 「左耳有缺口」 would be a made-up fact |
| Names | Applying the fallback now | The owner confirms names first |
| Calendar | A list-only mode at large text | The day list already exists under the grid |
| Tertiary label | Darken to pass AA | It is not text; chevrons only |

**Verdict: Approve.** Not verified: native iOS VoiceOver and real Dynamic Type.

## apple-design

- **Patterns:** Settings switch rows (the row is the switch), 44pt targets, segmented controls that take the full track, one large title per screen.
- **Dynamic Type:** restacks at 1.35 and one column at 2.0, or under 280pt wide on the web, where text size reaches layout only as zoom.
- **Reduce Motion:** hero drift and the switch knob added to the list; motion that follows the finger stays.
- **VoiceOver:** back first, headings by level, decorative art hidden, rows read as one.

## Caveats

- Native iOS and Android were not run. This is the web build; `fontScale` stays 1 on web, so large text was checked as a narrow window (200% zoom).
- 我的 and 每日打卡 used a daily check-ins fixture in the local mock.
- `/places/[slug]` shows a pre-existing development warning about the `accessible` attribute (break-ui 7).
- Name suggestions follow the data as published on 2026-10-30; no release was changed.
