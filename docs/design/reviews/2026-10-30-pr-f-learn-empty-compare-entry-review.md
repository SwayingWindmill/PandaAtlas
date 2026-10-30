# PR F skill review: 认识大熊猫 shelves, 比一比 picker, 猜熊猫 levels (2026-10-30)

A pre-merge review of PR F, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `360ce97a` (main after #755) on `app/pr-f-learn-empty-compare-entry`. Fixes land in the same branch.

**Surfaces:**
- 认识大熊猫 (`app/learn/index.tsx`): without articles the page used to be one line, 科普还在写。, even with 认脸指南, 认脸挑战 and 名词 published. Now each shelf with something published shows, and the empty ones are listed once at the end under 还在写 (The Learn Shelves Rule). The full-page line stays for a catalog with nothing at all.
- 比一比 picker (`app/compare.tsx`, `features/pandas/pair-picker.tsx`): `/compare` without a full pair picks two pandas with the slots and search 查关系 already used (now shared), then 比一比{A}和{B}. Reached from a new 找熊猫 explore card, 比一比两只熊猫.
- 猜熊猫 levels (`app/guess.tsx`, `features/guess/`): each level is asked for a question on open; a level the server has none for (困难 is 404 in production today) is left out of the control. A placeholder holds the control's height while asking.

**How it was checked:** Expo web dev build against the production API through a local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce`. Dev builds bundle the draft learning catalog (5 articles, 2 认脸指南, 2 认脸挑战, 5 名词); to see the state production is heading to (shelves published, no articles), the draft articles were removed from the local file for the shots and restored before commit. Profiles: `base` 390×844 light and dark; `dt200` with `fontScale = 2` (temporary local patch to react-native-web's `Dimensions`, reverted); `w320`. Proxy modes: `worst` (long names), `error` (HTTP 500), `slow` (20s), `empty`.

Screenshots: `/workspace/pr-f-shots/before/` and `/after/` (local to the review box, not committed); `normal/` default size, `stress/<profile or mode>/` the rest.

**Research input (X, read for this PR):**
- Khushal Dewra, https://x.com/TheKhushalDewra/status/2088982359551152443: a filter that returns nothing leaves "a silent blank section, and to a visitor a blank section just reads as a broken page". Each empty shelf is named, not left blank or dropped silently.
- Sarafatul, https://x.com/Sarafatul1/status/2108952491115343956: "Looks great with 20 items. Breaks with 0." Design the empty state for every CMS section. The learning catalog is CMS-like; each shelf has its own empty state now and was shot with 0.
- Kamal, https://x.com/kamal_author/status/2053547987499163885: "Design subtracts … the empty state that should be a redirect." One quiet group, not a card per missing shelf, and no call to action that leads nowhere.
- UXtigers, https://x.com/uxtigersdotcom/status/1991522746262544406: three ways to treat unavailable commands (error on use, disabled, hidden); disabled with an explanation is the usual default. Weighed for 困难; see the decision under impeccable.
- Blueberry TV, https://x.com/BlueberryTV3/status/1780066331930644971 (春生、香果 … 到底是如何区分的呢？) and Lydia, https://x.com/0x_lydia/status/1983138653095289245 (怎么区分谁是花花？大熊猫长得都一样呀): people ask about two specific pandas they already have in mind, which is why the picker lets them choose both rather than suggesting pairs.
- From PR E: 新京报, https://x.com/BJNewsOfficial/status/2096059299198034315 (一颗"美人痣"区分两只国宝): the difference between two individuals is a written, sourced observation; 比一比 still only repeats what 文献与写作 published.

**Questions skipped:** the review ran unattended; answers came from DESIGN.md, PRODUCT.md and the brief (calm, no invented 科普 or identification text, the user picks the pair).

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | Before | After | Note |
|---|---|---|---|
| Visibility of system status | 2 | 4 | 认识大熊猫 said 科普还在写。 while three shelves were ready; now the page shows what exists and names what is pending. 猜熊猫's level control holds its height while levels are checked. |
| Match with the real world | 3 | 4 | 还在写 is how a magazine lists forthcoming pieces; 比一比 starts from the two pandas the reader has in mind. |
| User control and freedom | 2 | 4 | `/compare` had no way in without a pair (only 去找熊猫); now a picker, and an invalid pair offers 重新选两只. |
| Consistency and standards | 3 | 4 | The picker is the 查关系 picker (one component). Pending rows are a grouped list like 名词. |
| Error prevention | 2 | 4 | 困难 is no longer offered when it has no questions; the same panda twice is caught before 比一比 with 选了同一只熊猫，换一只看看。 |
| Recognition over recall | 3 | 4 | Slots show the portrait and name of each choice. |
| Flexibility | 3 | 3 | Search or scroll; no shortcuts needed. |
| Aesthetic and minimalist design | 3 | 4 | One pending group at the foot of the page, muted, no illustration. |
| Help users recover from errors | 3 | 4 | Failed level checks keep the level (no false hiding); the old 换成随机 empty state remains the fallback. |
| Help and documentation | 2 | 3 | The pending footer: 写好后会出现在这里。 |

**Decision, 困难 hidden rather than disabled:** a disabled segment with an explanation suits an option the user can make available. Here nothing the user does makes 困难 available (the server has no place with four pandas it will pair), so a permanently greyed fourth segment would be a promise with no path. It comes back by itself when the server returns questions. If a user already has 困难 selected (an earlier probe or a later 404) it stays, and the empty state says so with 换成随机.

**Priority issues (all fixed):**
1. The first 还在写 build used a large `SectionHeader`, louder than the 名词 group above it (P2). Now the `ListSection` title, like 名词.
2. At 200% text the two pair slots cut 选一只熊猫 to 选一… and wrapped 第一只 per character (P1, also in 查关系 before this PR). Above `STACK_AT_FONT_SCALE` the slots stack, portrait beside the label, 和 between them.
3. The pending rows first said 认脸指南和挑战; trimmed to 认脸指南 to match the section's name and stay one line at 320pt (P3).

### Native audit (0–4 each)

| Dimension | Before | After | Notes |
|---|---|---|---|
| Accessibility | 3 | 3 | Pending rows read "科普文章，还在写"; slots read "第一只，宝力" with selected state; the level placeholder is labelled 正在查看难度. Dynamic Type emulated only. |
| Performance | 3 | 3 | The level check costs three question requests per visit; the answers are reused for the first round of each level, so choosing a level costs nothing extra. |
| Theming | 4 | 4 | Light and dark checked. |
| Platform | 3 | 4 | Grouped list, segmented control, system back; no custom empty illustration. |
| Adaptivity | 2 | 4 | Slots stack at large text; nothing overflows at 320pt. |
| **Total** | 15/20 | 18/20 | |

## review-animations

| Before | After | Why |
|---|---|---|
| `CONTENT_ENTER` on the learn content | Unchanged; the pending group is inside it | One arrival per open |
| — | Level placeholder → control: no animation | A one-off swap within the first second; same height, so nothing moves |
| — | Picker rows and slots: press highlight only | Repeated actions; no motion needed |

No `transition: all`, no stagger, no looping motion. **Verdict: Approve.**

## break-ui

Fixtures at the data boundary (proxy modes, the dev learning catalog with and without articles), no component mocks.

**Broken (fixed):** pair slots at `dt200` (truncated label, per-character wrap).

**Ugly (fixed):** the oversized 还在写 heading.

**Fragile (recorded, not fixed):**
- On web the focused search field draws the browser's rectangular focus outline inside the rounded field (also in 查关系 before this PR). Native has no outline.
- `empty` mode leaves 认脸 photos as 暂无照片 placeholders; the shelf still shows because the guides are published.
- 比一比两只熊猫 is the fourth explore card, off screen at 390pt until the scroller is swiped.
- A prefetched question is kept until that level is chosen; if the server expired questions quickly, the first answer at that level could be rejected and would show the existing answer error.

**What held up:** 320pt, dark, `worst` names in the picker rows (fit, no clipping), `error` (`LoadFailed` + 重试 on the picker; learn in a dev build falls back to the bundled drafts, so its error state was not seen here), `slow` (skeletons including the level placeholder), `empty`, the same slug twice, `/compare?a=bao-li` (first slot preset, second slot active). Unit tests for `offeredLevels`: empty levels dropped, the current level kept, unknown kept, none left.

## make-interfaces-feel-better

Mode `full`. Scope: the files above.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `learn/index.tsx` | Whole page 科普还在写。 with shelves ready | Shelves, then 还在写 | Content hidden behind an empty article list |
| HIGH | `pair-picker.tsx` | Slots clipped at 200% | Stacked | Never truncate what the user is choosing |
| MEDIUM | `learn/index.tsx` | `SectionHeader` for 还在写 | `ListSection` title | Hierarchy: pending is quieter than content |
| MEDIUM | `guess.tsx` | 困难 offered with no questions | Left out after a check | Don't offer a dead end |

Icons: `Newspaper`, `ScanFace`, `BookA` name each pending shelf (one meaning per glyph, every row has one); `PawPrint` marks an empty slot. No icons on buttons with text or on titles.

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| 还在写 | A sentence per shelf on what is coming | Would be 科普 text the app made up |
| 比一比 picker | "长得像" or "常被比较" suggestions | The user picks the pair; looks-based claims are invented |
| 猜熊猫 | Disabled 困难 with "暂时没有题目" | No user action makes it available; see the decision above |
| 找熊猫 | 比一比 as a button beside search | One more control at the top of a tab root; the explore scroller is where the other two-panda tool (查关系) lives |

**Verdict: Approve.** Not verified: native iOS and real Dynamic Type.

## apple-design

- **Patterns:** Settings-style inset group for pending shelves; the Contacts-like two-slot picker; segmented control for levels.
- **Response:** rows and slots highlight on press; 比一比 is a filled button only once two different pandas are chosen.
- **Dynamic Type:** slots stack above 1.35; pending rows wrap.
- **Reduce Motion:** nothing new animates.
- **Hit areas:** 44pt rows; slots and the segmented control larger.

## Caveats

- Native iOS was not run; this is the web build. Motion reviewed in code.
- The no-articles learn state was seen by removing draft articles from the local file (restored); production has no published learning content today, so it shows the unchanged full-page 科普还在写。 until something is published.
- The level check adds three question requests when 猜熊猫 opens.
