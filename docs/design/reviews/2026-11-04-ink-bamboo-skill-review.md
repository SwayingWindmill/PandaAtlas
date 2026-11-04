# Palette C 熊猫, components and bare glyphs: skill review (2026-11-04)

A pre-merge review of the app redesign on top of PR #810 (`feat/typography-system`, 79d98dc): palette direction C 熊猫, the new components, the de-text pass, glyphs, and bare glyphs everywhere. Run with the skills in `.agents/skills`: impeccable (critique, audit, polish), review-animations, break-ui, make-interfaces-feel-better, apple-design and emil-design-eng.

**What changed**

- **Palette C 熊猫** (`tokens.ts` → `global.css` and the DESIGN.md front matter):
  - Light mode: white page, `#F3F3F5` cards, an ink button `#0A0A0A` with a white label, tint `#0A6CDB`, graphic `#1A8CFF`.
  - Dark mode: black page, `#151517` cards, a white button with a black label, tint `#5AB4FF`, graphic `#4DA8FF`.
  - Numerals take the label color.
  - The 笋金 accent and the `warm*` roles are gone.
- **Components:** `Timeline`, `Chip`, `SourceBadge`, `ProgressRing`, `CompareTable`, `TimeBand`, `Stepper`, `Accordion` (RNR), `Badge` (RNR), `IconRow`, `ConfirmedMark` / `PendingDot` and `SectionHeader icon`. They are shown on `/dev/design-system`, where every sample is marked 示例.
- **Structure over sentences:**
  - Status words become glyphs with spoken labels (The Structure Rule).
  - Section headers, stat tiles and settings rows take glyphs.
- **Bare glyphs:** no icon sits on a square, tile or circle ground. `radius.glyph` is removed.
- **DESIGN.md v2.15 and PRODUCT.md:** both are updated to match.

**How it was checked**

- `expo lint`, `tsc --noEmit`, `tsc -p e2e`, `vitest` (33 files, 197 tests) and `design:tokens:check` all pass.
- Screens were run on an Expo web dev build against the local proxy, using Playwright with Chrome. Profiles: normal, dark, dt200 and w320.
- Not seen on an iOS device.
- Screenshots are in `/workspace/feature-shots/ink-bamboo/{normal,dark}/` on the review box and are not committed:
  - today
  - panda-bao-li and panda-bao-li-family
  - institution-smithsonian and institution-guide
  - settings
  - gallery and gallery-components
  - me-signed-out
- The before shots (the #810 typography state) are in `/workspace/feature-shots/typography/{normal,dark}/`.

## Palette C references

| Reference | What it gave | URL |
|---|---|---|
| WWF brand guidelines | The panda is black and white by brand rule, so black and white are the primary colors | https://wwf-brand.azurewebsites.net/brand-guidelines/brand-elements/ (global logo: https://wwf-brand.azurewebsites.net/publications/global-logo) |
| Chengdu Research Base of Giant Panda Breeding | The home institution's own identity, for the panda subject (logo from the base's site; its colors were not re-checked for this doc) | https://www.panda.org.cn/ |
| Things 3 | White and grey grounds with one blue, and a calm, premium feel | https://apps.apple.com/us/app/things-3/id904237743 |
| Flighty | Neutral cards with one blue for status and graphics; numbers in the text color | https://apps.apple.com/us/app/flighty-live-flight-tracker/id1358823008 |

**Contrast (WCAG 2):**

| Pair | Light | Dark |
|---|---|---|
| Tint on the page | 5.02:1 | 9.41:1 (8.17:1 on a card) |
| Label on the button | 19.8:1 | 19.8:1 or more |
| Secondary label on a card | 4.78:1 | 7.09:1 |
| Graphic on white | 3.37:1 | not measured |

- The graphic color is used for non-text marks only; 3:1 is the bar for those.
- **Deviation:** `highlight-soft` (light) is `#EBF4FF`, not the `sky` 50 primitive `#E7F2FF`. On `#E7F2FF` the tint read 4.44:1; on `#EBF4FF` it reads 4.52:1.

## impeccable

The skill was run from the repo copy at `.agents/skills/impeccable`, because the agent's skill loader did not resolve the name. Its CLI ran `context --target apps/mobile` and `detect`. The references used were `critique.md`, `audit.native.md`, `polish.md`, `craft-floor.md` and `ios.md`.

**Detector**

- **Regex scan:** 53 changed `.ts`/`.tsx` files, 0 findings. The detector says itself that this is an undercount, because the element rules need a page.
- **Live pages** (`/`, `/pandas/bao-li`, `/institutions/smithsonian-national-zoo`, `/settings`, `/dev/design-system`):
  - **First pass:** 13 low-contrast advisories. Each was secondary-label text `#6B6B70` on the fill `#E5E5EA`, at 4.2:1. They came from the unselected 外观 segments and the neutral `Badge`.
  - **After the fix:** 0 findings.

**Critique: findings and fixes**

| Sev | Finding | Fix |
|---|---|---|
| P0 | In dark mode the stat-tile values (雄, 5 岁, the institution name) were drawn black on `#151517`. `tailwind-merge` read `text-stat` / `text-figure` as colors and dropped `text-foreground`. This came in with #810. | `stat` and `figure` added to the font-size group in `lib/utils.ts`, with a test |
| P1 | The primary action did not follow C. 关注 was a tinted capsule and 见过 plain text, so the page had no ink button. | 关注 is now the filled ink button with `Heart`; 见过 is tinted with `Eye`. A new icon tone `onButton` draws the glyph on the button. |
| P1 | Icons sat on tiles or discs: the settings `GlyphSquare`, list thumbs, the pair-picker avatar, the notifications placeholder, the daily lock and clue glyphs, the verification shield, the story lock and an empty album | All are bare glyphs now. The size slot stays so rows still align, and `radius.glyph` / `rounded-glyph` is removed. |
| P2 | Muted text on the fill was 4.2:1 (segmented control, neutral badge) | Unselected segments and neutral badges now use the label color, as iOS draws unselected segments |
| P2 | The age detail "2021 年…" was truncated by the check mark beside it | `ConfirmedMark` moved to the label row; the detail is a plain footnote line |
| P2 | The 参观攻略 header was inset 16pt past the page edge | Header aligned with the page edge |
| P2 | The same compare reason ("在认脸挑战里一起出现") was printed on every row, which is explanatory repetition | The reason is hidden when every row has the same one, and stays in the row's spoken label |
| P3 | The new gallery used "·" separators, which PRODUCT.md bans | Replaced with an ideographic space and a 、 list |
| P3 | Copy and comments still said jade / 笋金 | Comments, DESIGN.md (v2.15) and PRODUCT.md updated |

**Audit health score** (`audit.native.md`, scored after the fixes)

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Statuses carry spoken labels, targets are 44pt or larger, AA contrast holds in both appearances, and Reduce Motion is honored. Not run with VoiceOver on a device. |
| 2 | Performance | 3 | No new list work. SVG glyphs only; the rings and timelines are static. |
| 3 | Appearance & Theming | 4 | Semantic roles throughout, and dark mode is first-class. The P0 above was the one dark-mode miss. |
| 4 | Platform Conformance | 3 | System tabs, back button and grouped lists. Checked on web only. |
| 5 | Adaptivity | 3 | dt200 and w320 show no overflow; landscape and tablet were not checked. |
| **Total** | | **16/20** | **Good** |

**Kept on purpose**

These are controls or selection marks, not icon tiles, so they keep their ground:

- the circular glass toolbar buttons (the 我的 settings gear, 日历, 打卡)
- the welcome selection check badge
- the daily glass pill
- the Stepper's done disc, which is a step marker

## review-animations

- `ProgressRing` and `Timeline` draw static.
- `Accordion` animates its height with a Reanimated `LinearTransition` on the app's `move` timing, and `ReduceMotion.System` drops the movement.
- The panda actions keep their one haptic.

## break-ui

- **Long names:** in the stat tile, an institution name wraps to two lines instead of truncating, and the age detail no longer clips.
- **Empty states:** an empty album shows a bare `FolderHeart` glyph, not a grey tile.
- **Dark mode:** the stat-value bug above was found here. No other text is drawn in the default black.
- **Signed out:** 关注 / 见过 keep the same shapes and lead to sign-in.
- **Not covered:** the `/me` signed-in shot depends on a check-in summary that the local mock proxy does not serve, so only the signed-out 我的 was shot. This is a gap in the mock, not in the app.

## make-interfaces-feel-better

- The page and cards are greyscale and photographs carry the color, so there is one tint per screen.
- Glyphs follow the size of the text beside them. Bare glyphs sit in fixed slots, so text columns line up.
- Numbers use tabular figures and the label color, never the tint.
- Status is a mark, not a sentence: `ConfirmedMark` and `PendingDot`, with the words read by VoiceOver.

## apple-design and emil-design-eng

- An ink filled button paired with a tinted second action matches how iOS pairs a prominent button with a tinted one.
- Settings rows use bare glyphs in a 30pt slot. This is lighter than the system Settings tiles, at the user's request; separators still start after the slot.
- No decorative motion was added, which follows Emil's "you don't need animations" (https://emilkowal.ski/ui/you-dont-need-animations).

## Not touched

These were left on purpose because they are editorial or 科普 copy owned elsewhere:

- daily-panda 在世 / 已经离世
- on-this-day 按资料卡的出生日期推算
- milestones `COUNTED_NOTE`
- 科普 (learn) text, and the "jade rule" comment in the learn article file
- the `DECEASED_POLICY` text
- the settings privacy footers
- the `compare.ts` reason string, which is only hidden when it repeats

场馆动态 does not take the Timeline here; #807 does that.

## Rebase notes for open PRs (#804–#808, #811)

- The `text-warm`, `bg-warm-soft` and `warm-figure` classes are gone. Use `text-primary`, `bg-highlight-soft`, or a neutral `bg-secondary` chip instead.
- `GlyphSquare` is now a bare glyph, and `rounded-glyph` is removed.
- `PandaActions` changed: 关注 uses the default (ink) variant and 见过 the tinted variant. A new icon tone, `onButton`, draws glyphs on the ink button.
- `cn()` now knows `text-stat` and `text-figure`.
