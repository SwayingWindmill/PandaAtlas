# PR #749 skill review (2026-10-30)

A formal pre-merge review of every mobile surface touched by PRs #746–#749, run with the skills in `.agents/skills`. Base: `0def24b4` on `cursor/remaining-pages`. Fixes land in the commit that adds this file.

**Surfaces:** 今天, 找熊猫, 图鉴, 我的, 设置; 熊猫详情 with 照片, 家谱, 收进合集, 纠错, 分享; 机构页; 每日一猫; 猜熊猫; 科普 list, article, term, 认脸, 挑战; 欢迎页.

**How it was checked:** Expo web build (`expo start --web`) against the production API through a local proxy, Playwright + Chrome, `prefers-reduced-motion: reduce` throughout. Profiles:

- `base`: 390×844 @2x, light and dark.
- `zoom200`: 195×422 @4x (browser text zoom).
- `dt200`: zoom200 plus `fontScale = 2` (a temporary local patch to react-native-web's `Dimensions`, reverted, so the app's restack rules at fontScale ≥ 1.35 actually fire).
- `w320`: 320×568 (iPhone SE 1st gen width), dark.

Proxy stress modes:

- `worst`: real long production names swapped in, about a third of the pandas. Examples: 福多多（噗噗）, 成都大熊猫繁育研究基地2025年雌仔, 爱浜2016仔, plus a one-character name 乐 and a long place name 中国大熊猫保护研究中心都江堰基地（熊猫谷）.
- `error`: HTTP 500 on every `/api/` call.
- `slow`: 20s delay, which shows the loading state.
- `empty`: every list returns `[]`.

Screenshots: `/workspace/pr-review-shots/before/` and `/after/` (local to the review box, not committed).

**Questions skipped:** the review ran unattended, so impeccable's interactive questions (target persona, brand register) were answered from DESIGN.md (a calm iOS app for panda fans, iOS 26 register) instead of asked.

## impeccable

The app is native iOS (rendered here through web), so only Assessment A applies (critique plus native audit). The craft-floor bans were checked on every surface.

### Critique: Nielsen heuristics (0–4)

| Heuristic | Score | Note |
|---|---|---|
| Visibility of system status | 3 | Skeletons sit in the final layout on every page (slow mode). 每日一猫 shows guesses left and clues unlocked. |
| Match with the real world | 4 | Plain Chinese, the fan's words (在世, 所在地, 见过). |
| User control and freedom | 3 | System back everywhere, and 先逛逛 on 欢迎页. The daily guess cannot be undone, which is by design. |
| Consistency and standards | 3 → 4 | Kickers above titles on five 科普 surfaces and on the daily answer broke DESIGN.md's own rule. **Fixed.** |
| Error prevention | 3 | Guessed pandas leave the daily search. |
| Recognition over recall | 4 | Search with photos on 欢迎页 and 每日一猫. |
| Flexibility | 3 | Search plus place chips on 找熊猫. |
| Aesthetic and minimalist design | 3 → 4 | The daily clue ring was a progress meter standing in for content. The photo viewer counted "1 / 7" twice. **Fixed.** |
| Help users recover from errors | 2 → 4 | Three surfaces lied or lost context on failure: 欢迎页 said "没有找到这只熊猫", 挑战 blamed the question, and 找熊猫 lost its title. **Fixed.** |
| Help and documentation | 3 | 科普 and 认脸指南 carry it; nothing else needed. |

**Cognitive load:** 8 of 8 checks pass. There is one primary action per screen, choices are ≤ 6 (daily search caps matches), progressive disclosure (clues unlock one at a time), no jargon, consistent placement, visible state, no memory burden across screens, and grouped related controls.

**Emotional journey:**
- 欢迎页 → 今天 is warm and photo-led.
- 每日一猫 builds suspense. The card now shows the newest clue itself, which turns each wrong guess into something learned rather than a ring segment.
- The finished card leads with the name.
- Failure states were the low point (a wrong message). They are now one honest sentence plus 重试.

**Strengths:**
- Photography carries the color.
- The type ladder is consistent.
- Restacks at large text are real (stat blocks, grouped rows).
- Skeletons match the loaded layout.

**Priority issues (all fixed):**
1. Wrong copy on failure: 欢迎页 and 挑战.
2. Kickers above titles: 科普 ×5, plus the daily answer.
3. The progress ring standing in for content on 每日一猫.
4. Photo viewer: a blank pager on web, and the counter shown twice.
5. Clipping: tab bar labels at every size, the 设置 `Segmented` at large text, the resident-tile name on web, and the 熊猫详情 stat label at 320pt.

**Persona flags:**
- A low-vision fan at AX sizes: segmented control and daily card, fixed.
- A fan on a 320pt phone: stat blocks, fixed.
- A fan on a flaky network: error copy, fixed.

### Native audit (0–4 each)

| Dimension | Before | After | Notes |
|---|---|---|---|
| Accessibility | 2 | 3 | Fixed: the large-text clipping (Segmented, daily card) and the counter. Remaining: Dynamic Type verified only by emulation on web. |
| Performance | 3 | 3 | expo-image with transitions, FlatList paging. Nothing heavy on the screens reviewed. |
| Theming | 4 | 4 | Light and dark on every surface. All colors are tokens; dark keeps contrast. |
| Platform | 3 | 3 | System back, large titles, a glass toolbar over heroes. The web tab bar is a fallback; native uses the system bar. |
| Adaptivity | 2 | 4 | Fixed: the 320pt stat row, Segmented minHeight, the daily card's minHeight in place of a fixed 4:3, and the tab bar height. |
| **Total** | **14/20** | **17/20** | |

P-levels:
- **P1:** wrong failure copy (欢迎页, 挑战); tab bar labels clipped.
- **P2:** kickers; the clue ring; Segmented and SearchField overflow; the 320pt stat label; the resident tile; the photo pager blank on web.
- **P3:** the duplicate counter; 找熊猫's missing title in loading and error.

All are fixed.

## review-animations

The 10 standards, checked against `design/motion.ts`, `press-scale.tsx`, `segmented.tsx`, `stretchy-hero.tsx`, and the `REVEAL` uses in 每日一猫, 猜熊猫 and 挑战.

| Before | After | Why |
|---|---|---|
| `enter` 480ms bamboo on every page open | `enter` 280ms bamboo; `hero` stays 480ms | Plays on every navigation. Frequent UI motion stays under 300ms; the long signature stays on the rare hero. |
| Every open clue tile animates on mount (5 at once, no stagger) | Only a clue unlocked during this visit animates (`fresh` = index ≥ clues open at load) | Animation should report a change. Tiles that were already open are not news. DESIGN.md also says bamboo is not for anything repeated in a list. |
| — | Press 0.97 / 120ms ease-out, dims under Reduce Motion | Held up: in the 0.95–0.98 range, under 300ms, never `scale(0)`. |
| — | `Segmented` thumb: `move` 280ms in-out, instant under Reduce Motion | Held up: moving something already on screen is in-out. |
| — | `REVEAL` off on web; `ReduceMotion.System` on `CONTENT_ENTER` | Held up. Reduce Motion skips `enter` entirely, which is the system behavior, recorded as intended. |

**Verdict: Approve** after the two fixes. There is no `transition: all`, no ease-in on UI, no animation on keyboard actions, and exit (200) is faster than enter.

## emil-design-eng

| Before | After | Why |
|---|---|---|
| Page content arrives over 480ms on every open | 280ms, same curve | High-frequency motion should feel instant. Under 300ms reads as responsive, not decorative. |
| All daily clue tiles rise together on load | Only a newly unlocked tile rises | Motion with no change behind it is noise. The one tile that moves now marks the reward of a wrong guess. |
| Ring arcs fill as clues unlock | The newest clue text on the card | The interface shows the thing, not a meter about the thing. |
| Tab labels clipped by a 49pt web bar | 54pt web bar, 14pt label line | Clipped glyphs read as broken, even at 10pt. |

## break-ui

Fixtures at the data boundary: the proxy modes above (no component mocks).

**Broken (fixed):**
- `app/welcome.tsx`: on a list load failure, `.catch(() => setPandas([]))` showed "没有找到这只熊猫". It now shows `LoadFailed` "熊猫列表暂时打不开。" with 重试.
- `app/learn/challenge.tsx`: with the panda list down it showed "这道题的熊猫还不在当前资料里。". It now shows `LoadFailed` "熊猫资料暂时打不开。" with 重试 (`useLearningPandas` gained `reload`).
- `app/pandas/[slug]/photos.tsx`: the pager images had `height: "100%"` inside a horizontal FlatList, which resolves to 0 on web, so the viewer was blank. The pager now measures its own height.
- `app/(tabs)/_layout.web.tsx`: tab labels were clipped at the bottom at every size, because a 49pt bar left 38pt for a 25pt icon and a 14pt line.

**Ugly (fixed):**
- `components/segmented.tsx`: fixed `height`, so 跟随系统 overflowed at large text. Now it uses `minHeight`, padded segments and centered text, and the track grows.
- `app/daily.tsx`, mystery card: a fixed 4:3 clipped "猜错一次，多一…" at dt200. The plate now uses `minHeight`; photos keep 4:3.
- `app/institutions/[slug].tsx`, resident tile: a padded, clamped `Text` showed a third line in its padding on web. The padding moved to a wrapper.
- `app/pandas/[slug]/index.tsx`, stat row at 320pt: the 性别 label truncated to "性…". Below 360pt wide, 所在地 takes its own row.
- `app/(tabs)/find/index.tsx`: loading and error lost the web title 找熊猫. The title now stands alone in those states.
- `features/pandas/search-field.tsx`: a fixed `h-11` field, and at dt200 the 每日一猫 placeholder pushed the search glyph out of the field. Now `min-h-11`, `min-w-0` input: the glyph stays and a long placeholder clips at the field edge (as iOS does). Applies to 找熊猫, 欢迎页 and 每日一猫.

**Fragile (recorded, not fixed):**
- 图鉴 with an empty catalog reads "2 / 0". An empty production catalog is not a real state; the count comes from the server.
- The family tree truncates long names ("成都大…"); the list below shows them in full.
- Guess options clamp at 2 lines with an ellipsis.

**Decisions:**
- Clue tiles stay same-size icon cards; the owner's brief asked for them.
- The floating glass back/share over a scrolled hero is the iOS 26 pattern. The web fallback disc is heavier, but kept.
- 今天 under API failure keeps story cards with the media placeholder and stays usable. 图鉴, 我的 and 认脸 degrade acceptably.
- At dt200 on a 195pt-wide viewport, 设置 row titles wrap to 3 lines beside the glyph. This is legible, and the profile compounds browser zoom and fontScale, which is harsher than AX5.

**What held up:**
- Skeletons in every loading state match the final layout.
- Dark mode on every surface.
- The `worst` names on 找熊猫, 熊猫详情, 家谱 and 猜熊猫.
- One-character names.
- Restacks at fontScale ≥ 1.35 (stat blocks, grouped rows).
- No horizontal overflow except intended scrollers.

## make-interfaces-feel-better

| Category | Covered | Result |
|---|---|---|
| Typography and text wrapping | All surfaces, base / dt200 / w320 | 4 clipping fixes (tab labels, Segmented, daily card, stat label) |
| Spacing, alignment and hierarchy | All surfaces | Kickers moved below titles as meta lines; daily answer label removed |
| States (loading, empty, error) | slow / empty / error modes | 3 fixes (欢迎页, 挑战, 找熊猫) |
| Motion | Tokens and every `entering` | `enter` 280ms; tiles animate only when new |
| Images and media | Hero, tiles, photo viewer | Photo viewer pager fixed; duplicate counter removed |

**Findings:**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| High | `welcome.tsx` | "没有找到这只熊猫" on load failure | `LoadFailed` + 重试 | Errors say what happened and what to do (DESIGN.md Voice) |
| High | `learn/challenge.tsx` | Blamed the question when the list failed | `LoadFailed` + 重试 | Same |
| High | `pandas/[slug]/photos.tsx` | Blank pager on web | Measured page height | A viewer with no photo is broken |
| Medium | `(tabs)/_layout.web.tsx` | Labels clipped | 54pt bar, 14pt line | Clipped glyphs |
| Medium | `features/learning/reading-page.tsx`, `learn/index.tsx`, `learn/articles/[slug].tsx` | Tint kicker above the title | Secondary meta line under the title | DESIGN.md: "Don't put a kicker above the title" |
| Medium | `daily.tsx` | Clue ring, "今天的答案" eyebrow | Newest clue on the card; name leads | Craft floor: content, not a meter; no kicker |
| Medium | `segmented.tsx` | Overflow at large text | `minHeight` | Dynamic Type |
| Low | `photos.tsx` | "1 / 7" in title and body | Title 照片, live counter once | Say it once |
| Low | `institutions/[slug].tsx` | Third line leaks on web | Padding on wrapper | Clamp holds |
| Low | `pandas/[slug]/index.tsx` | "性…" at 320pt | Place on its own row below 360pt | Small screens |
| Low | `(tabs)/find/index.tsx` | No title in loading/error | Title kept | Orientation |
| Medium | `features/pandas/search-field.tsx` | Fixed height; glyph pushed out at large text | `min-h-11`, `min-w-0` input | Dynamic Type |

**Considered but rejected:**
- Shortening the daily search placeholder 输入你猜的熊猫名字: with the field fix it clips cleanly at large text, and at default size it fits with room to spare.
- Re-tinting the web glass disc: a platform fallback that native does not use.
- Animating the daily card change between clues: the card text change is the event, and `accessibilityLiveRegion` announces it. A second motion would compete with the tile reveal.

**Verification:**
- Before/after screenshots across profiles and stress modes.
- typecheck, lint (`--max-warnings 0`), unit tests, `verify.mjs`, CI.

**Verdict:** ready after these fixes.

## apple-design

- **Response:** presses answer in 120ms; nothing blocks on an animation.
- **Interruptibility:** the Segmented thumb uses a CSS transition (retargets mid-flight). The stretchy hero follows the finger.
- **Dynamic Type:** the restacks fire at fontScale 1.35. Fixed controls that assumed a single line: Segmented, SearchField, daily card, tab bar.
- **Reduce Motion:** press dims, enter is skipped, the thumb is instant.

## Out of scope

- 挑战's draft rounds in `data/curation/learning/learning.json` (`bao-li-round`, `lun-lun-round`) reference slugs that do not resolve. 挑战 therefore shows "这道题的熊猫还不在当前资料里。" even with the API healthy. This is content data and belongs to the 文献与写作 collaborator.
- Article text was not changed. Only the order of the meta line moved.
- The `impeccable surface-brief` for 科普 was not regenerated.

## Caveats

- Native iOS was not run; this is the web build. Native-only behavior was reviewed in code only: system tab bar, `Link.AppleZoom`, Liquid Glass, haptics.
- Production API through a dev proxy. Today's puzzle has no birthplace clue, so that glyph went unseen.
- Dynamic Type was emulated on web. The `dt200` profile is harsher than any iOS size.
- The web `Page` top padding also sets the 我的 and 图鉴 tops; it was not changed here.
