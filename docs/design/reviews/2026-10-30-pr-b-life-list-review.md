# PR B skill review: 图鉴 life list and 合集 detail (2026-10-30)

A pre-merge review of PR B from `/workspace/pandaatlas-plan.md` §7.2, run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `8e4658ee` (main after #751) on `app/pr-b-life-list`. Fixes land in the same branch.

**Surfaces:**
- 图鉴 (`app/(tabs)/book/index.tsx`, `features/book/book.ts`): rebuilt as a personal life list with 清单 / 按基地 / 按家族, signed-out and empty states.
- 合集 detail (`app/collections/[id].tsx`): the last v1 page, moved to v2.

**Shared pieces added or changed:** `Mosaic` moved from `collections/index.tsx` to `features/collections/mosaic.tsx` so the detail page can reuse it as its header. `PandaListItem` gained `placeId` (used to group residents by base).

**How it was checked:** Expo web build against the production API through a local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce`. Signed-in pages ran against a mocked session and mocked `/me` endpoints (panda-book, seen-pandas, visits, collections). An interaction script also shot 编辑 mode, 移出, 撤销, 改名字, the 删除合集 confirmation, and the 按基地 / 按家族 views.

Profiles: `base` 390×844 @2x light and dark; `dt200` 195×422 @4x plus `fontScale = 2` (temporary local patch to react-native-web's `Dimensions`, reverted); `w320` 320×568. Proxy stress modes: `worst` (long production names), `error` (HTTP 500 on every `/api/`), `slow` (20s), `empty` (no records).

Screenshots: `/workspace/pr-b-shots/before/` and `/after/` (local to the review box, not committed). Default-size shots are in `normal/`.

**Research input:** posts on X about birding life lists (Merlin, eBird), Pokédex seen/caught counts, Seek badges, Apple Fitness awards and travel check-in apps, listed with what each changed in the PR description. **Questions skipped:** the review ran unattended; impeccable's questions were answered from DESIGN.md and plan §6 (free, no rankings, no fan-culture features).

## impeccable

Native app rendered through web, so Assessment A (critique plus native audit).

### Critique: Nielsen heuristics (0–4)

| Heuristic | Before | After | Note |
|---|---|---|---|
| Visibility of system status | 3 | 4 | Skeletons now mirror the loaded layout on both pages (合集 had a generic block before this review's fix). 撤销 strip and errors announce politely. |
| Match with the real world | 2 | 4 | Before, 图鉴 showed "8 只已认识，共收录 925 只" with a bar that can never meaningfully fill. Now it reads like a birder's life list: No.1 is the first panda met, with the date and place. |
| User control and freedom | 2 | 4 | 合集: 移出 sat beside every row as a big grey pill, one tap from loss. Now behind 编辑, with 撤销 after each removal. 删除合集 has a confirmation card with 取消. |
| Consistency and standards | 1 | 4 | 合集 detail used v1 (`border-hairline`, `rounded-lg`, raw pills). Now `ListSection`/`ListCell`, v2 tokens and text styles; 图鉴 uses the shared `Segmented`, `StatTile`, `PandaThumb`. |
| Error prevention | 2 | 4 | Removal needs edit mode; delete needs confirmation; rename is capped at `NAME_MAX` with the limit shown. |
| Recognition over recall | 3 | 4 | Photos on every row, the album mosaic as the 合集 header, icons for each way (Binoculars 见过, ScanFace 认出, MapPin 去过). |
| Flexibility | 2 | 3 | Three views of one record (清单, 按基地, 按家族); long lists fold at 12 rows with 显示全部. |
| Aesthetic and minimalist design | 3 | 4 | Neutral tracks; the tint only on 去过 marks and completion checks. |
| Help users recover from errors | 3 | 4 | `LoadFailed` + 重试 on both pages; a collection that no longer exists says so with a way back instead of an error. |
| Help and documentation | 2 | 4 | The three ways in are rows that link to where each is recorded, with a footer on how to add or cancel 见过. |

**Cognitive load:** one primary action per state (登录，开始记 signed out; 去找熊猫 on an empty collection; 删除合集 in its card). Progressive disclosure for rename, edit and delete.

**Emotional journey:** the list starts at No.1 and each row keeps the first meeting's date and place, so it reads as memories rather than a quota. Base and family groups give small goals that can actually be finished (a Check appears), as the posts on "the progress bar lies" asked. Signed out shows two real lit covers among locked ones and the real catalog size, without pressure.

**Priority issues (all fixed):**
1. 合集 detail on v1, destructive 移出 always visible (P1).
2. 图鉴's global progress against 925 pandas: a goal no one finishes (P2).
3. Large-text squeeze on life rows, group rows, 合集 rows and the 合集 header at dt200 (P1, found in this review).
4. 合集 loading skeleton did not match the loaded layout (P3, found in this review).
5. The No.1 entry showed only the 见过 date when the 认出 date was earlier (P2, found in review): the detail now lists each way with its own date, oldest first.

### Native audit (0–4 each)

| Dimension | Before | After | Notes |
|---|---|---|---|
| Accessibility | 2 | 3 | Row labels carry number, name and detail; group rows read title, progress and visit; 移出 / 撤销 labels name the panda; live regions for undo and errors. Dynamic Type only emulated. |
| Performance | 3 | 3 | Life list folds at 12 rows; grouping is pure functions over already loaded data. |
| Theming | 3 | 4 | Light and dark checked on both pages. |
| Platform | 2 | 4 | Music-style edit mode, Photos album header, Reminders-style inline rename, account-style confirmation card. 44pt hit areas. |
| Adaptivity | 2 | 4 | Rows and the 合集 header stack at fontScale ≥ 1.35; no overflow at 320pt. |
| **Total** | **12/20** | **18/20** | |

## review-animations

| Before | After | Why |
|---|---|---|
| 合集 detail had no arrival motion | `PAGE_ENTER` on the content; the confirmation card rises once when asked for | Arrival only, under 300ms, skipped by Reduce Motion |
| — | Switching 清单 / 按基地 / 按家族 swaps in place | Repeated action, no animation |
| — | 编辑 / 移出 / 撤销 have no animation | Frequent actions should feel instant; the undo strip is announced, not animated |

No `transition: all`, no stagger, no animation on keystrokes. **Verdict: Approve.**

## break-ui

Fixtures at the data boundary (proxy modes and mock `/me`), no component mocks.

**Broken (fixed):**
- `app/(tabs)/book/index.tsx` at dt200: names wrapped to one character per line beside the 56pt photo ("喜 / 伦"). Life rows and group rows now stack: photo above, text full width, separator at 16.
- `app/collections/[id].tsx` at dt200: "Kouhin / 幸浜" broke per character; the header text squeezed beside the 88pt mosaic. Rows and header now stack; the chevron is dropped when stacked.

**Ugly (fixed):**
- 合集 skeleton was a small right-aligned block over two slabs; now a mosaic, two lines and four photo rows.
- Empty 合集 said "还没有熊猫" in the header and "还是空的" in the card; the card now only says what to do.

**Fragile (recorded, not fixed):**
- 撤销 re-adds the panda at the end of the collection: the API appends and has no order field.
- The 删除合集 card appears below the rows; on a long collection it can open under the fold (same pattern as 账号's 注销 card).
- Signed-in 图鉴 under `error` shows the session layer's "账号暂时不可用" (unchanged from before).
- 见过 is marked with today's date; a past date can't be backfilled yet.

**What held up:** `worst` names on both pages, 320pt, dark mode, `empty` (stats at zero, 从第一只开始, every base at 0), `slow` skeletons, `error` with 重试, a missing collection id.

## make-interfaces-feel-better

Mode `full`. Scope: the two pages and `features/book/book.ts`.

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `collections/[id].tsx` | 移出 pill on every row | 编辑 mode + 撤销 | Destructive actions shouldn't be one stray tap away |
| HIGH | book and 合集 rows | Single row at every text size | `useStacked()` column layout | Names collapsed at large text |
| MEDIUM | `features/book/book.ts` (`entryDetail`) | Only one date | Each way with its own date, oldest first | The row must match the number it carries |
| LOW | `collections/[id].tsx` | `updatedAt.slice(0, 10)` | Local calendar date | A UTC date is a day off in the evening |
| LOW | 合集 skeleton | Generic blocks | Final layout | No jump on load |

Typography: `tabular-nums` on No.N, counts and dates. Surfaces: continuous corners on every rounded surface; tracks neutral (`bg-foreground` on `bg-secondary`). Icons from `components/icons.ts` only, one meaning each.

**Considered but rejected:**

| Location | Candidate | Rejected because |
|---|---|---|
| 图鉴 | Keep a global "x / 925" bar | Plan and research: a goal nobody finishes reads as failure |
| 图鉴 | Compare lists with friends | Plan §6: no rankings or social comparison |
| 合集 | Swipe to delete | Not available on web; edit mode works everywhere |

**Verdict: Approve.** Not verified: native iOS rendering and real Dynamic Type.

## apple-design

- **Patterns:** Photos album header (mosaic + count), Music playlist edit mode, Reminders inline rename, a grouped destructive row opening a confirmation card, `Segmented` for views of one list, Fitness-like finite goals with a check.
- **Response:** rows answer on press (`active:` states); nothing waits on animation.
- **Dynamic Type:** stacking at 1.35 on every new row type and the header.
- **Reduce Motion:** `PAGE_ENTER` skipped.
- **Hit areas:** 44pt minimum on 编辑, 移出, 撤销, 完成, 取消.

## Caveats

- Native iOS was not run; this is the web build. Arrival motion reviewed in code.
- Signed-in states only against a mocked session and mocked `/me` data.
- Production has few open residencies per base (2–3), so group denominators are small; pandas whose location is only "China" are not in any base.
