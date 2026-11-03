# PR H skill review: the last pre-v2 styles (2026-10-30)

A pre-merge review of PR H, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `8743a48` (main) on `pr-h-design-tokens`. A token migration, not a redesign: every replacement keeps the rendered size where a role of that size exists. Fixes land in the same branch.

**Surfaces:**
- 图鉴 (`app/(tabs)/book/index.tsx`), empty state: 从第一只开始 `title3` → `title`; 各个基地 `title3` → `SectionHeader` (the header every other 图鉴 section uses).
- 合集 detail (`app/collections/[id].tsx`): the count beside the album mosaic, `title3` → `stat`.
- 家谱 (`features/family/family-tree.tsx`, `app/pandas/[slug]/family.tsx`): `muted`, `small` and `text-xs` → `footnote`; `rounded-lg` → `rounded-control` (12), `rounded-xl` → `rounded-tile` (16); the empty note `rounded-lg` → `rounded-group`.
- 到访 card (`features/visits/facility-visits.tsx`): the 记下今天去过 label drops `text-subhead font-semibold`; the small `Button` already sets subheadline semibold.
- Panda and institution pages: motion imported from `@/design/motion` instead of `stretchy-hero.tsx`; institution skeleton `rounded-2xl` → `rounded-tile`.
- 纠错 (`rounded-lg` → `rounded-control`), 分享 card (`rounded-xl` → `rounded-tile`), `Skeleton` base (`rounded-md` → `rounded-group`, both 10).
- Page entrances: 图鉴, panda, institution, 认识大熊猫, articles and the reading page use `PAGE_ENTER`; 猜熊猫, 每日一猫 and 认脸挑战 drop their local copy of it.
- `eslint.config.js`: the design rules are errors and gain rules for deprecated `Text` variants, old type-size and radius classes, and motion imported from `stretchy-hero.tsx`. `DESIGN.md` v2.8.

**How it was checked:** a scan of `apps/mobile/src` for every row of DESIGN.md › Deprecated (the new lint rules find none; a probe file with each pattern fails as expected). Expo web dev build against the local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce`. Every shot waits until each on-screen image has loaded and its fade has finished, so no image is caught mid-fade. Profiles: `base` 390×844 light and dark; `dt200` with `fontScale = 2` (temporary local patch to react-native-web's `Dimensions`, reverted) in a 195pt-wide viewport; `w320`. Proxy modes: `worst` (long production names), `slow` (20s, for skeletons), `empty` (signed in, nothing recorded, for the 图鉴 empty state). Accessibility roles read from the DOM.

Screenshots: `/workspace/pr-h-shots/before/` (main) and `/after/` (local to the review box, not committed); `normal/` default size, `stress/<profile or mode>/` the rest.

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit). The brief limits this PR to tokens, so the critique asks whether each screen reads the same or better.

### Critique: Nielsen heuristics (0–4)

| Heuristic | Before | After | Note |
|---|---|---|---|
| Consistency and standards | 3 | 4 | 各个基地 was a hand-made 20pt heading beside `SectionHeader`s; now the same header. Radii are the named roles, so 家谱 cards match tiles and controls elsewhere. |
| Aesthetic and minimalist design | 3 | 3 | Unchanged by design; the empty 图鉴 title is 2pt larger and bold, like other titles. |
| Recognition over recall | 3 | 3 | Unchanged. |
| Visibility of system status | 3 | 3 | Skeletons keep their sizes. |

**Priority issues:**
1. The 合集 count (5 只熊猫) was a heading (`title3` maps to `role="heading"`), so a screen reader heard two headings for one album, the name and the count (P2). Fixed: `stat`, which has the same size and tabular numerals but no heading role. Checked in the DOM: headings on `/collections/c1` are the page title and 熊猫.
2. 家谱 years were `text-xs` (12pt), below the 13pt floor (P3). Fixed: `footnote`.

### Native audit (0–4 each)

| Dimension | Before | After | Notes |
|---|---|---|---|
| Accessibility | 3 | 4 | Heading structure fixed (1); 12pt text gone. 从第一只开始 and 各个基地 are level-2 headings. |
| Performance | 4 | 4 | No runtime change. Web no longer mounts entering animations on six pages. |
| Theming | 4 | 4 | Light and dark: the focus card in dark keeps its dark-on-green text; no colour changed. |
| Platform | 4 | 4 | No change. |
| Adaptivity | 3 | 3 | dt200 and 320pt same as before (see break-ui). |
| **Total** | 18/20 | 19/20 | |

## review-animations

| Before | After | Why |
|---|---|---|
| 图鉴, panda, institution, 认识大熊猫, articles and the reading page played `CONTENT_ENTER` on web too | `PAGE_ENTER`: same on iOS and Android, nothing on web | On web an entering view overlaps its neighbours; 猜熊猫, 每日一猫 and 认脸挑战 already skipped it there |
| Three local `REVEAL` constants equal to `PAGE_ENTER` | `PAGE_ENTER` | One token, one definition |
| `CONTENT_ENTER`, `EASE_OUT` re-exported from `stretchy-hero.tsx` | Removed; the lint rejects importing them from there | Motion tokens live in `@/design/motion` |

Native timing, curve and Reduce Motion behaviour are unchanged (`PAGE_ENTER` is `CONTENT_ENTER` off web). No new motion. **Verdict: Approve.**

## break-ui

**Broken:** none found.

**Ugly:** none new. The before/after pairs match except the intended changes: the 图鉴 empty titles (20 → 22pt bold) and 家谱 years and labels (12 → 13pt).

**Fragile (recorded, not fixed):**
- 家谱 cards have fixed sizes (`family-layout.ts`); at `dt200` the tree needs horizontal scrolling (one x-scroller, the same on main). Names truncate inside the cards with `worst` data (成都大…). A Dynamic Type layout for the tree is a redesign, out of scope.
- The 家人 list on 家谱 still uses the older hairline list with a `›` text glyph rather than `ListSection`; a follow-up.
- Panda names: 45 pandas have a zh-Hans primary name like `Kouhin / 幸浜` and 33 have none, so some rows show mixed or English names. That is data, not styling.
- Shooting 每日一猫 signed in throws `Cannot read properties of undefined (reading 'toLocaleString')`: the screenshot proxy answers the unmocked `/api/v2/me/daily-checkins` with `{ items: [] }`. A fixture gap, on main too; production returns the summary.

**What held up:** dark, 320pt, `dt200` (图鉴 empty state, 合集 header stacks under the mosaic, institution), `worst` (long names in 图鉴 and 家谱), `slow` (panda, institution, 家谱 and 图鉴 skeletons keep their shapes and radii), `empty` (图鉴 empty state with 各个基地).

## make-interfaces-feel-better

Mode `full`. Scope: the files above.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | `collections/[id].tsx` | Count announced as a heading | `stat` | One heading per album; numbers stay tabular |
| MEDIUM | `book/index.tsx` | 各个基地 a one-off `title3` | `SectionHeader` | Same header as every other section |
| LOW | `family-tree.tsx` | 12pt years, `muted`/`small` mix | `footnote` throughout | One caption size, at the 13pt floor |
| LOW | radii across 家谱, 纠错, 分享, institution, `Skeleton` | Tailwind sizes | Roles (control 12, tile 16, group 10) | Same pixels; named so a role change reaches them |
| LOW | `facility-visits.tsx` | Label restyled inside a small `Button` | Inherits the button's text | One source for button type |

Icons: none added or removed.

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| 家谱 names | `headline` (semibold) for the bold body names | Changes the look of every card; the brief is tokens only |
| 家谱 cards | Grow with text size | A layout redesign of the tree |
| `text.tsx` | Delete the deprecated variants | Lint at error level already stops new uses; deleting is churn with no visible gain |

**Verdict: Approve.** Not verified: native iOS and real Dynamic Type.

## apple-design

- **Type:** every caller now uses the six text styles; the 13pt floor holds on the changed screens.
- **Hierarchy:** headings are titles and section headers only; counts are values.
- **Shape:** radii follow the roles (tile 16 for cards and the tree frame, control 12 for chips and the family cards, group 10 for skeletons and notes).
- **Motion:** page arrival only where it does not fight the platform; Reduce Motion respected through `PAGE_ENTER`.

## Caveats

- Native iOS was not run; this is the web build. Motion reviewed in code.
- `before/normal/book-base-light.png` shows letter placeholders where photos had not loaded yet (the first run of the shot script waited on the wrong element); `after/` waits correctly. The list itself is untouched by this PR.
- The 图鉴 empty state needs a signed-in account with nothing recorded; shot through the proxy's `empty` mode.
