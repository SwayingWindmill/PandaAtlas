# PR E skill review: 比一比 and 猜熊猫 levels (2026-10-30)

A pre-merge review of PR E from `/workspace/pandaatlas-plan.md`, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `1473fa79` (main after #753) on `app/pr-e-lookalike-compare`. Fixes land in the same branch.

**Surfaces:**
- 比一比 (`app/compare.tsx`, `features/compare/`): new. Two pandas side by side (`/compare?a=&b=`): photos that open each profile, the facts already on the profile, then 区分要点 taken only from the learning catalog (认脸指南 slots, 认脸挑战 tips) with their sources.
- Panda page (`app/pandas/[slug]/index.tsx`): a 比一比 section after 以前住过, up to three rows, each with the fact that puts it there (在认脸挑战里一起出现, 同住{地点}).
- 猜熊猫 (`app/guess.tsx`, `features/guess/difficulty.ts`): a level picker 随机 / 简单 / 中等 / 困难, a line under the photo saying how the choices were drawn, and 比一比 {answer} 和 {picked} after a wrong answer.

**How it was checked:** Expo web build against the production API through a local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce`. Dev builds include the draft 认脸指南 (宝力, 伦伦) and the two draft 认脸挑战, so the ready state could be seen; production only reads published entries and shows the pending state for every pair today. Pairs: 宝力 / 伦伦 (two written slots, two hints), 宝力 / 青宝 (only 宝力 written), 美香 / 添添 (nothing written), the same slug twice. The guess answer is submitted through the proxy (POST forwarded).

Profiles: `base` 390×844 @2x light and dark; `dt200` 195×422 @4x plus `fontScale = 2` (temporary local patch to react-native-web's `Dimensions`, reverted); `w320` 320×568. Proxy stress modes: `worst` (long names), `error` (HTTP 500), `slow` (20s), `empty`.

Screenshots: `/workspace/pr-e-shots/before/` and `/after/` (local to the review box, not committed). Default-size shots are in `normal/`, stress shots in `stress/<profile or mode>/`.

**Research input:** posts on X about Merlin's and iNaturalist's similar-species views and bird-quiz hints and levels, listed with what each changed in the PR description. **Questions skipped:** the review ran unattended; impeccable's questions were answered from DESIGN.md, PRODUCT.md and the plan (free, calm, no rankings, no invented panda facts).

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | Before | After | Note |
|---|---|---|---|
| Visibility of system status | 3 | 4 | Compare has a skeleton of two 4:5 photos and a group; the level picker stays on screen while a new question loads. The level line under the photo says which level this question is, also in 随机. |
| Match with the real world | 2 | 4 | 比一比 reads like a field guide's similar-species plate: two photos, one trait per row. Levels are described by where the choices live, which is how the server draws them. |
| User control and freedom | 3 | 4 | Each side opens the profile; 下一题 stays the primary action after a wrong answer; an empty level offers 换成随机. |
| Consistency and standards | 3 | 4 | `ListSection`/`ListCell`, `Segmented`, `ScreenState`, `LoadFailed`, `LearningSources`, `PressScale`; v2 tokens. |
| Error prevention | 2 | 4 | No looks-based claims: pairs come from facts, points only from published text with sources. A slug pointing at itself or nowhere shows 没找到要比的两只熊猫. |
| Recognition over recall | 2 | 4 | Column names above the points so a row still reads after the photos scroll away; stacked with names at large text. |
| Flexibility | 2 | 3 | Levels are optional (随机 by default). |
| Aesthetic and minimalist design | 3 | 4 | No icons on rows, one card for hints, 还没写 in muted text rather than a gap. |
| Help users recover from errors | 3 | 4 | `LoadFailed` + 重试 on compare; an empty level says so and offers 换成随机. |
| Help and documentation | 2 | 3 | The pending card lists, per panda, which slots are still missing. |

**Cognitive load:** one decision per screen. After a wrong answer: 下一题 (filled), 比一比 (tinted), 看资料 (secondary).

**Emotional journey:** a wrong answer leads to learning the difference, not to a score. No points, streaks or share cards.

**Priority issues (all fixed):**
1. The first pending card explained the interface in a paragraph and used 「·」 bullets (P1, PRODUCT.md). Now a headline, a short 还缺这些 label, plain lines, and 每一条都附公开出处。
2. Two hint cards with the same title when both pandas had a challenge (P2). Merged into one 认脸挑战里的提示 card with hairlines.
3. After scrolling, the side-by-side points lost which column was which (P2). Column names added above the rows.
4. At 200% text the place under each photo was clipped to two lines ("繁育研究基…") (P2). Facts wrap now.
5. At 200% text the wrapped 比一比 button label sat left (P3). Centered.
6. The worst-case name was cut to one line in the column header (P2, break-ui "never truncate what the user compares"). Two lines now.

### Native audit (0–4 each)

| Dimension | Before | After | Notes |
|---|---|---|---|
| Accessibility | — | 3 | Each point reads as one element ("脸型。宝力：…。伦伦：…"); the column header is hidden from screen readers because every point already names both; each side is a link with name and facts; the picker is labelled 难度. Dynamic Type only emulated. |
| Performance | — | 4 | The panda index and the learning catalog are memoised; the comparison is a pure function. |
| Theming | — | 4 | Light and dark checked. |
| Platform | — | 4 | Settings-style rows, segmented control, system back. |
| Adaptivity | — | 4 | Points stack with names at large text; no overflow at 320pt. |
| **Total** | — | **19/20** | New surfaces, no before. |

## review-animations

| Before | After | Why |
|---|---|---|
| — | `PAGE_ENTER` on the loaded compare content | Arrival once per page open, under 300ms, skipped by Reduce Motion. Added in review: the first build popped in, unlike the other v2 pages. |
| — | Sides use `PressScale` | Press feedback on the photos that open a profile, 120ms ease-out, dims under Reduce Motion |
| — | Level change: no animation, a selection haptic | Repeated action; the skeleton is the feedback |
| Verdict reveal (`CONTENT_ENTER`, native only) | Unchanged | The new 比一比 button is inside it |

No `transition: all`, no stagger, no looping motion. **Verdict: Approve.**

## break-ui

Fixtures at the data boundary (proxy modes, the dev learning catalog), no component mocks.

**Broken (fixed):** clipped place at `dt200`; the left-aligned wrapped button label at `dt200`.

**Ugly (fixed):** explanatory paragraph and bullets in the pending card; duplicate hint cards; column header cut to one line in `worst`.

**Fragile (recorded, not fixed):**
- 猜熊猫's answer tip "妙音2010 年出生。" has no space between the name and the year. That text comes from the API (`recognitionTips`), not this PR.
- `empty` mode leaves 猜熊猫's options as 熊猫 (no names), the existing fallback.
- The 困难 level returns 404 in production today (no place has four pandas with photos that the server will pair); the UI says 困难这一档暂时没有题目。 with 换成随机.
- Production has no published 认脸指南 or 认脸挑战, so 比一比 shows 区分要点还在整理 for every pair, and the panda page offers only 同住 pairs until they are published.

**What held up:** 320pt, dark mode, `worst` names (two-line titles and headers), `error` (`LoadFailed` + 重试), `slow` (skeletons), `empty` (没找到要比的两只熊猫 with 去找熊猫), the same slug twice (also 没找到要比的两只熊猫). In unit tests: a panda never suggested against itself, and a panda with no place (no 同住 suggestions).

## make-interfaces-feel-better

Mode `full`. Scope: `app/compare.tsx`, `features/compare/*`, the guess changes.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `compare.tsx` `Points` | Paragraph about the page, `·` bullets | Headline, short label, plain lines | PRODUCT.md: short labels, no separators |
| MEDIUM | `compare.tsx` `Columns` | Rows with no column names | Names above, hidden from VoiceOver | Rows must be readable after scroll |
| MEDIUM | `compare.tsx` `Side` | Facts clamped to 2 lines | Wrap | A place is what the reader compares |
| MEDIUM | `compare.tsx` | Content popped in | `PAGE_ENTER` | Consistency with the other v2 pages |
| LOW | `guess.tsx` buttons | Label left on wrap | `text-center` | Optical balance at large text |

Surfaces: continuous corners on cards and photos, `PhotoOutline` on photos, hairlines inset like grouped lists. Tabular figures are not needed (no numbers that change).

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| 猜熊猫 | Pre-answer hints (progressive reveal) | The answer stays on the server until submitted; the client cannot pick a hint without leaking it |
| 比一比 | "长得像" suggestions from photo similarity | Invented claims; Merlin users report confused look-alikes. Pairs come from facts only |
| 比一比 | A generated sentence when one side is missing | The app does not write identification text; 还没写 instead |
| 猜熊猫 | Points per level, a streak | Product rules: calm, no gamification |

**Verdict: Approve.** Not verified: native iOS rendering and real Dynamic Type.

## apple-design

- **Patterns:** Settings-style grouped rows for 比一比 on the panda page; a segmented control for levels; two equal photo cards; sources in the in-app browser.
- **Response:** sides and rows answer on press (`PressScale`, row highlight).
- **Dynamic Type:** points stack above 1.35 with names; facts and labels wrap.
- **Reduce Motion:** `PAGE_ENTER` skipped; press dims instead of scaling.
- **Hit areas:** 44pt on rows, buttons and the segmented control; the photo sides are larger.

## Caveats

- Native iOS was not run; this is the web build. Motion reviewed in code.
- The ready state was only seen with draft content in a dev build; production shows the pending state until 文献与写作 publishes (see `docs/learning-content-brief.md`, 比一比要用的内容).
- Difficulty comes from the server; the client only labels it.
