---
# Generated from apps/mobile/src/design/tokens.ts by `npm run design:tokens -w @zhipanda/mobile`. Do not edit by hand.
version: alpha
name: 吱熊猫
description: "A calm iOS app about giant pandas: system colors with a bamboo-jade tint and a rare shoot-gold accent, purpose-named type, and photographs that do the talking."
colors:
  grouped-background: "#F2F2F7"
  grouped-background-dark: "#000000"
  background: "#FFFFFF"
  background-dark: "#000000"
  card: "#FFFFFF"
  card-dark: "#1C1C1E"
  label: "#000000"
  label-dark: "#FFFFFF"
  secondary-label: "#636366"
  secondary-label-dark: "#AEAEB2"
  tertiary-label: "#C4C4C7"
  tertiary-label-dark: "#5B5B60"
  separator: "#C6C6C8"
  separator-dark: "#38383A"
  primary: "#165C3C"
  primary-dark: "#7DCAA4"
  button-label: "#FFFFFF"
  button-label-dark: "#000000"
  highlight-soft: "#E3EBE8"
  highlight-soft-dark: "#16241E"
  warm: "#846018"
  warm-dark: "#E3BD6E"
  warm-soft: "#F5EDDB"
  warm-soft-dark: "#2B2312"
  destructive: "#CE2C31"
  destructive-dark: "#FF6961"
  warning: "#B25000"
  warning-dark: "#FF9F0A"
  fill: "#E5E5EA"
  fill-dark: "#2C2C2E"
  pressed: "#D1D1D6"
  pressed-dark: "#3A3A3C"
  on-media: "#FFFFFF"
  on-media-dark: "#FFFFFF"
  media-placeholder: "#3A3A3C"
  media-placeholder-dark: "#3A3A3C"
typography:
  display:
    fontFamily: "system-ui"
    fontSize: 34px
    fontWeight: 700
    lineHeight: 41px
    letterSpacing: 0px
  title:
    fontFamily: "system-ui"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 28px
    letterSpacing: 0px
  headline:
    fontFamily: "system-ui"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0px
  body:
    fontFamily: "system-ui"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 26px
    letterSpacing: 0px
  subheadline:
    fontFamily: "system-ui"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0px
  footnote:
    fontFamily: "system-ui"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0px
  reading-title:
    fontFamily: "system-ui"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: 0px
  reading-heading:
    fontFamily: "system-ui"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 30px
    letterSpacing: 0px
  reading-lead:
    fontFamily: "system-ui"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0px
  reading-body:
    fontFamily: "system-ui"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0px
  reading-caption:
    fontFamily: "system-ui"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
rounded:
  card: 24px
  tile: 16px
  control: 12px
  group: 10px
  pill: 999px
  glyph: 8px
spacing:
  hair-gap: 4px
  stack-tight: 8px
  row: 12px
  inset: 16px
  stack: 20px
  section-tight: 24px
  section: 32px
  page: 40px
  hit-target: 44px
components:
  page:
    backgroundColor: "{colors.grouped-background}"
    textColor: "{colors.label}"
  page-dark:
    backgroundColor: "{colors.grouped-background-dark}"
    textColor: "{colors.label-dark}"
  reading-column:
    backgroundColor: "{colors.background}"
    textColor: "{colors.label}"
    typography: "{typography.reading-body}"
    padding: 16px
  reading-column-dark:
    backgroundColor: "{colors.background-dark}"
    textColor: "{colors.label-dark}"
    typography: "{typography.reading-body}"
    padding: 16px
  grouped-list:
    backgroundColor: "{colors.card}"
    textColor: "{colors.secondary-label}"
    typography: "{typography.footnote}"
    rounded: "{rounded.group}"
  grouped-list-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.secondary-label-dark}"
    typography: "{typography.footnote}"
    rounded: "{rounded.group}"
  list-row-pressed:
    backgroundColor: "{colors.pressed}"
    textColor: "{colors.label}"
    typography: "{typography.body}"
    height: 44px
  list-row-pressed-dark:
    backgroundColor: "{colors.pressed-dark}"
    textColor: "{colors.label-dark}"
    typography: "{typography.body}"
    height: 44px
  separator:
    backgroundColor: "{colors.separator}"
    height: 1px
  separator-dark:
    backgroundColor: "{colors.separator-dark}"
    height: 1px
  disclosure-chevron:
    backgroundColor: "{colors.card}"
    textColor: "{colors.tertiary-label}"
    size: 17px
  disclosure-chevron-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.tertiary-label-dark}"
    size: 17px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.button-label}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    height: 48px
    padding: 24px
  button-primary-dark:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.button-label-dark}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    height: 48px
    padding: 24px
  button-tinted:
    backgroundColor: "{colors.highlight-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    height: 48px
  button-tinted-dark:
    backgroundColor: "{colors.highlight-soft-dark}"
    textColor: "{colors.primary-dark}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    height: 48px
  button-secondary:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    height: 48px
  button-secondary-dark:
    backgroundColor: "{colors.fill-dark}"
    textColor: "{colors.label-dark}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    height: 48px
  row-destructive:
    backgroundColor: "{colors.card}"
    textColor: "{colors.destructive}"
    typography: "{typography.body}"
    height: 44px
  row-destructive-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.destructive-dark}"
    typography: "{typography.body}"
    height: 44px
  caution-line:
    backgroundColor: "{colors.card}"
    textColor: "{colors.warning}"
    typography: "{typography.footnote}"
  caution-line-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.warning-dark}"
    typography: "{typography.footnote}"
  warm-badge:
    backgroundColor: "{colors.warm-soft}"
    textColor: "{colors.warm}"
    typography: "{typography.footnote}"
    rounded: "{rounded.pill}"
    padding: 4px
  warm-badge-dark:
    backgroundColor: "{colors.warm-soft-dark}"
    textColor: "{colors.warm-dark}"
    typography: "{typography.footnote}"
    rounded: "{rounded.pill}"
    padding: 4px
  stat-block:
    backgroundColor: "{colors.card}"
    textColor: "{colors.label}"
    typography: "{typography.title}"
    rounded: "{rounded.tile}"
    padding: 16px
  stat-block-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.label-dark}"
    typography: "{typography.title}"
    rounded: "{rounded.tile}"
    padding: 16px
  story-card:
    backgroundColor: "{colors.media-placeholder}"
    textColor: "{colors.on-media}"
    typography: "{typography.title}"
    rounded: "{rounded.card}"
    padding: 16px
  story-card-dark:
    backgroundColor: "{colors.media-placeholder-dark}"
    textColor: "{colors.on-media-dark}"
    typography: "{typography.title}"
    rounded: "{rounded.card}"
    padding: 16px
---

# Design System: 吱熊猫

> **Single source of truth for the app (`apps/mobile`).** Values live in `apps/mobile/src/design/tokens.ts`; the front matter above, the `@generated` block in `apps/mobile/src/global.css` and `useIOSColors()` are all derived from it. Change a value there, run `npm run design:tokens -w @zhipanda/mobile`, and the unit test fails if you forget. The website keeps its own Radix system in `docs/design/zhipanda-design-system.md` §1–9.
>
> Dev builds render every token at `/dev/design-system` (not linked anywhere in the app).

## Overview

**Creative North Star: "A photograph on the system shelf."**

吱熊猫 is a phone atlas of named giant pandas. The shelf is the iOS 26 interface a fan already knows: a large title, a system back chevron, a Liquid Glass tab bar, and inset grouped lists. The thing on the shelf is a photograph of one animal. Deep jade is the tint on the selected tab, a link, and the filled or tinted button. It does not paint cards. A second, rarer brand note, 笋金 (bamboo-shoot gold), marks what is new or happening today. One signature motion, 竹 *bamboo*, is how things arrive: they bend a little past their mark and settle.

The website keeps its olive paper. The app does not. Android uses the same colors and lists with the system Material tab bar and toolbar; the web export uses the same type with a blurred bottom bar, not Liquid Glass.

**Key Characteristics:**

- Tab roots use a 34px large title that collapses into the bar on iOS.
- Six purpose-named text styles (display, title, headline, body, subheadline, footnote) and a separate reading set for 科普. Weight and color make the rest of the hierarchy.
- Photographs lead: a featured story card, a stretchy hero, large portrait tiles. Grouped lists hold the facts under them.
- Cards press in, iOS 18 zooms a tapped photo into its page, content settles in on the bamboo curve, and 关注/见过 answer with one haptic.
- Lists that navigate are inset groups with a 10px radius, not full-bleed hairlines.
- One tint, a deep bamboo jade; one accent, shoot gold, used as a marker only. Photographs carry the rest of the color.
- Dark mode follows the system (我的 › 外观 can pin light or dark): true black grouped background and elevated `#1C1C1E` groups.

**Reference screens.** 科普 (`learn/index.tsx`, `learn/articles/[slug].tsx`) for the reading column; 今天, a panda (`pandas/[slug]/index.tsx`) and an institution (`institutions/[slug].tsx`) for photo-led pages; 家谱 (`pandas/[slug]/family.tsx`) for lists.

## Colors

Three layers in `tokens.ts`: **primitives** (`gray`, `jade`, `shoot`, `red`, `orange`: raw hex nobody uses directly), **semantic roles** (below: what a screen asks for), and **component tokens** (sizes). Screens read roles through class names (`bg-card`, `text-muted-foreground`, `text-warm`) or `useIOSColors()`. A hex or `rgba()` literal in a screen is a lint warning.

System semantics in both appearances: the iOS grouped background, secondary system grouped background, label, secondary label and separator. The tint is a deep jade in light mode and a pale jade in dark mode, so it reads as a tint rather than a highlighter.

### Primary
- **Jade** (`#165C3C`, light): filled buttons with a white label, the selected tab, links, tint rows, and focus. 7.98:1 on white.
- **Pale jade** (`#7DCAA4`, dark): the same roles in dark mode. A filled button in dark mode takes a black label. 10.86:1 on black.
- **Tinted fill** (`#E3EBE8` / `#16241E`): the ground of a tinted capsule button (关注), with the tint as its label, as iOS draws tinted controls.

### Accent: 笋金 shoot gold
- **Warm** (`#846018` light, 5.73:1 on white, 5.13:1 on `#F2F2F7`; `#E3BD6E` dark, 11.77:1 on black, 9.54:1 on `#1C1C1E`).
- **Warm soft** (`#F5EDDB` / `#2B2312`): a badge's ground with warm text on it (4.91:1 light, 8.71:1 dark).
- **Why:** a muted brass, the color of a new bamboo shoot's sheath. It sits across the wheel from the jade without competing, stays clear of the warning orange (`#B25000`, hue 27° vs 40°), and gives the brand a second, warmer note for moments that are about time: today, new, a birthday, a milestone.
- **Where:** the 今天 date marker, a 新 / 今天 badge, a milestone or birthday chip, a small dot on a calendar day.
- **Where not:** buttons, links, selected states, icons on action rows (all tint), card or page grounds, warnings (orange), large areas of any kind. At most one warm element per viewport.

### Neutral
- **Grouped background** (`#F2F2F7` / `#000000`): the page.
- **System background** (`#FFFFFF` / `#000000`, CSS `paper`): an article column.
- **Elevated group** (`#FFFFFF` / `#1C1C1E`): inset lists, cards, stat tiles.
- **Label** (`#000000` / `#FFFFFF`): primary text.
- **Secondary label** (`#636366` / `#AEAEB2`): the line under a row, footnotes, placeholders, row icons.
- **Tertiary label** (`#C4C4C7` / `#5B5B60`): the disclosure chevron. Never text.
- **Separator** (`#C6C6C8` / `#38383A`): inset row dividers.
- **Fill** (`#E5E5EA` / `#2C2C2E`): secondary buttons, the search field, toggles. **Pressed** (`#D1D1D6` / `#3A3A3C`) is a pressed row (`accent` in the React Native Reusables names).
- **Destructive** (`#CE2C31` / `#FF6961`) and **warning** (`#B25000` / `#FF9F0A`): delete, and a caution line.

### Media colors
Named so photo chrome stops being magic numbers:
- **On media** `#FFFFFF`: text and glyphs on a photo, always over a scrim.
- **Scrim**: black, 0% → 32% at 45% → 72% at the bottom (`components/scrim.tsx`).
- **Media placeholder** `#3A3A3C`: the dark ground under a story card or resident tile while the photo loads, so white text already reads.
- **Photo stroke** `rgba(0,0,0,0.1)` / `rgba(255,255,255,0.1)`: the 1px inside edge on a rounded photo.
- **Glass fallback** `rgba(0,0,0,0.38)`: the disc behind a toolbar glyph where Liquid Glass is unavailable.
- **Bar material** `rgba(255,255,255,0.86)` / `rgba(28,28,30,0.86)`: the web tab bar under a 24px blur.

### Named Rules
**The Tint Rule.** Jade marks what a fan can do: the selected tab, a link, a tint row, the one filled or tinted button, a correct quiz pick. It does not fill a card or sit above a title.

**The Marker Rule.** Shoot gold marks *when*, never *what to do*. If it is tappable, it is jade.

**The Shelf Rule.** Page ground is the system grouped background. Do not bring the website's olive paper onto a screen.

## Typography

**UI font:** the system face. San Francisco for Latin, PingFang SC for Chinese on iOS. The web stack is `-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`. No separate display face.

**Character:** iOS text styles named by purpose. Each binds size, line height, weight and tracking, so a screen picks a style, never a size. Line heights are opened so Chinese does not clip. Tracking is 0 everywhere: Chinese is never letter-spaced.

### Text styles
`<Text variant="…">` in `components/ui/text.tsx`. Sizes and line heights are generated into `global.css` (`text-display`, `text-title`, …); the variant adds the weight.

| Style | Size / line | Weight | Use | Not for |
|---|---|---|---|---|
| `display` | 34/41 | Bold | The one title on a screen: a tab root, a panda's or an institution's name, the featured story | A second title on the same screen |
| `title` | 22/28 | Bold | A section, a card title, a resident's name on a tile. `stat` adds tabular figures for a stat block value | Body emphasis |
| `headline` | 17/24 | Semibold | A name or label that leads a row or chip; emphasis at body size | Whole paragraphs |
| `body` | 17/26 | Regular | Sentences, row titles, buttons | Captions |
| `subheadline` | 15/22 | Regular | A second line in a dense row, a chip's relation, where 13 is too small for Chinese | A size step between body and footnote for hierarchy |
| `footnote` | 13/18 | Regular | Group headers, captions, credits, stat labels, the date. The floor: nothing smaller | Anything a fan must read to act |

### Reading set (科普 only)
The article column in 科普 (articles, terms, face guides, the challenge) is long-form Chinese and gets its own formal set. Do not use it outside the column.

| Style | Size / line | Weight | Use |
|---|---|---|---|
| `readingTitle` | 28/36 | Bold | The article title |
| `readingHeading` | 22/30 | Bold | A section in the article |
| `readingLead` | 17/28 | Regular, secondary label | The dek under the title |
| `readingBody` | 17/28 | Regular | Running text (line height 1.65) |
| `readingCaption` | 13/20 | Regular, secondary label | A caption under a photo, a reference |

### Named Rules
**The Purpose Rule.** Pick the style by what the text *is*, not how big it should look. Hierarchy past that comes from weight (400/600/700) and the secondary label. A date or a meta line is regular weight; only names and titles are bold.

**The Tabular Rule.** Numbers that sit in a column or change in place (ages, counts, years in a stat block) use `tabular-nums`.

## Layout

### Spacing
A 4pt scale (`4 8 12 16 20 24 32 40`, Tailwind numbers `1 2 3 4 5 6 8 10`) with semantic names generated as Tailwind spacing (`p-inset`, `gap-row`, `mt-section`):

| Role | Value | Use |
|---|---|---|
| `hair-gap` | 4 | Icon to its label, a value to its unit |
| `stack-tight` | 8 | Lines that belong together (title and footnote) |
| `row` | 12 | A row's vertical padding; between tiles in a grid or scroller |
| `inset` | 16 | The page's side inset and a card's padding |
| `stack` | 20 | Between blocks inside a section |
| `section-tight` | 24 | Between sections on a dense screen |
| `section` | 32 | Between sections on a page |
| `page` | 40 | Above the first section under a hero; bottom clearance |

More space sits above a section heading than between the heading and the group. A photograph that is the subject runs to both edges and ignores the inset. Tab content clears the bottom bar.

### Page templates
- **Tab root:** system large title (in the column on web), grouped-background page, sections separated by `section`. 今天 is a 34pt bold 今天 with the date in regular secondary label, then the featured card and the scroller.
- **Hero detail** (a panda, an institution): a full-bleed stretchy hero under the status bar with floating glass back/share, then the content column at `inset`, entering with `enter`.
- **List / directory:** inset grouped `ListSection` + `ListCell` (or `NavRow`) at `inset`. A long result list (找熊猫) may run full-bleed.
- **Reading column** (科普): `paper` ground, a lead photograph with its caption below (never text on it), the reading set, large title kept in the column.
- **Photo card:** one photograph, continuous corners (`card` or `tile`), media placeholder, bottom scrim, on-media title, photo stroke, press scale.
- **Stat block:** three elevated tiles in a row, `tile` radius, footnote label with glyph over a `stat` value; stacks past font scale 1.35.
- **Tab roots.** 今天: title and date, story cards, then 本周新鲜事 (only when the last 7 days have something; see The Weekly Digest Rule), 你关注的 avatars, a birthday tile scroller (今天生日 or 快过生日了) and 关注的新资料 rows in one group. 找熊猫: search, area chips, a scroller of explore cards (熊猫在哪里, 基地和动物园, 查两只熊猫的关系, 比一比两只熊猫) while browsing, then the list in one inset group with 56pt photos. 图鉴 is a personal life list: a stat block (见过, 认出, 去过), a `Segmented` 清单 / 按基地 / 按家族, then one inset group per view; signed out, a grid of two lit and four locked real covers, 登录 and 每日一猫, and the three ways in. Empty, the stats at zero, 从第一只开始, the three ways in, and every base at 0. 我的: a profile card (monogram avatar, name, 改名字, a 设置 gear), 关注的熊猫 avatars, then 我的合集 / 去过的地点 / 通知 rows and 我的纠错. 设置 (pushed from the gear): a centered profile header, 外观 as a segmented control, glyph rows, the legal pages, 退出登录.

**The Plate Rule.** The first figure on a panda, an institution or a 科普 article is one published photograph. On a panda or institution page it runs full-bleed under the status bar and stretches on pull-down, as Music and App Store heroes do (`components/stretchy-hero.tsx`). A panda's name is a display title below the photo, then 关注 (tinted) and 见过 (plain); an institution's name sits on its photo over a bottom scrim with a footnote line for type and country. The institution hero is the first resident whose cover is on the reviewed list (`CURATED_COVERS`) and carries no agency watermark (`features/institutions/hero-pick.ts`). With none, the top is a plate in `highlight-soft` fading into the page, the name in display at its foot: no unreviewed photo stands in.

**The Story Card Rule.** 今天 is one featured App Store Today-style card (24pt continuous corners, white display title) and, under it, a horizontal scroller of smaller cards (16pt corners, white title, snapping one card at a time, the next card peeking in). Each card is one photograph with a bottom scrim and a footnote under its title naming the feature and the panda in the photo. Each card uses a different panda. Nothing sits above the title on a card.

**The Clean Photo Rule.** A photo under a title must not carry a burned-in mark. Covers credited to Xinhua/新华 or Pandapia are left out of story cards and institution heroes (`hasBurnedInMark` in `features/today/story-order.ts`; the API only gives the credit, so this goes by credit). They stay on the panda's own page and in lists.

**The Life List Rule.** 图鉴 is the user's own record, as a birder's life list is. Every panda met gets a number in the order first met (No.1 is the first), a 56pt photo, and the first date and place for each way: 见过 (marked on the panda page, Binoculars), 认出 (每日一猫 or 猜熊猫, ScanFace). 去过 (MapPin) belongs to places. Progress is only shown against a finite goal the user can finish: the pandas living at one base now, or one family from the published lineage, each with a neutral track and a tinted Check when complete. No bar against the whole catalog, no ranking, no comparison with other people. Each of the three ways has a row that links to where it is recorded.

**The Timeline Rule.** A panda's 时间线 (`pandas/[slug]/timeline.tsx`) reads as a zoo biography: oldest first, one inset group per year titled "2024 · 3 岁", each milestone a row with its day in a 64pt tabular column (stacked above at large text), one plain sentence (在X出生, 从A搬到B, 首次与公众见面) and a footnote line per source, "出处 {title} · {publisher}" with the title tinted. Only events that happened count; plans and observations stay out. A stay and the transfer that began it are one row with both sources. A milestone from the profile alone says it has no source of its own rather than showing nothing. The page ends with a 纠错 row. No icons on the rows: the row is the data.

**The Weekly Digest Rule.** 本周新鲜事 is finite and calm: the 7 local days ending today, counted by kind (新生, 首次亮相, 有了名字, 搬家, 回国, 新收录, 新照片), at most three tallies and one line of names on 今天, the full list on `/week`. A birth or move counts when it happened in the last year, not when an old one is first recorded. No push, no streak, no unread count; with nothing new, or on an error, the card is not shown at all.

**The Learn Shelves Rule.** 认识大熊猫 shows each shelf that has something published (文章 by category, 认脸 guides and 认脸挑战, 名词) and lists the rest once at the end under 还在写, a plain inset group with one non-tappable row per shelf (科普文章 `Newspaper`, 认脸指南 `ScanFace`, 名词解释 `BookA`) and the footer 写好后会出现在这里。 The rows name a shelf only; they never stand in for 科普 text. Only when every shelf is empty does the page say 科普还在写。 The article count under the title shows only with articles.

**The Compare Rule.** 比一比 (`/compare?a=&b=`) puts two pandas side by side: two 4:5 photos that open each profile, the facts already on the profile (性别, 出生年, 所在地), then 区分要点. 区分要点 only repeats what 文献与写作 has written into the learning catalog: the four 认脸指南 slots (脸型, 左右差别, 黑眼圈, 耳朵) in one inset group with a column per panda (stacked with names at large text), 还没写 where one side is empty, then the hints of 认脸挑战 rounds where one is the answer and the other a choice, then the sources. With nothing written it says 区分要点还在整理 and lists, per panda, which slots are still missing. The app never writes identification text of its own. Pairs are offered for a reason that is a fact: 在认脸挑战里一起出现, or 同住{地点} (the pandas 猜熊猫 draws as choices), never 长得像. `/compare` without a full pair (the 找熊猫 card) is a picker shared with 查关系 (`features/pandas/pair-picker.tsx`): two slots joined by 和, then search over the list in its own order, with no suggested pairs. Picking the same panda twice says 选了同一只熊猫，换一只看看。; a pair that is not in the list says 没找到要比的两只熊猫 and offers 重新选两只.

**The Guess Level Rule.** 猜熊猫 has a `Segmented` 随机 / 简单 / 中等 / 困难. A level is described by how the choices are drawn (其他选项都不和它住在一起, 有的选项和它住在一起, 四个选项住在同一个地方), not by a promise about faces. On open each level is asked for a question once (the answers are kept for the first round); a level the server has no question for is left out of the control rather than shown disabled, the current level always stays, and a level whose probe failed stays. The control holds its height with a skeleton while asking. An empty level reached anyway says so and offers 换成随机. After a wrong answer the first action under 下一题 is 比一比 {answer} 和 {picked}.

**The Stat Block Rule.** A panda page leads its facts with three tiles: 性别 (♂/♀), 年龄 or 享年 (birth year under it), 所在地 (tappable) or 离世. The full birth date and birthplace follow as one footnote line, then family, places lived, updates and sources.

**The Family Chip Rule.** Relatives are a horizontal row of capsules: a 44pt round photo inside a 52pt capsule with 4pt padding, the name in headline and the relation in a footnote. 看家谱 and 查关系 stay grouped rows under the chips.

**The Resident Tile Rule.** An institution's residents are large portrait tiles (4:5), two a row (one at accessibility sizes), 16pt corners, the name in white title over a bottom scrim. The intro is body text, not a card.

## Elevation & Depth

Resting groups are a tone step, not a shadow. Every photograph with rounded corners gets the 1px photo stroke (`components/photo-outline.tsx`), so a pale photo keeps its edge on a pale page. The iOS 26 tab bar and the navigation bar are system materials: Liquid Glass when the system draws it, an opaque bar on Android and web. Do not add a shadow to a list, a button, or a card.

On iOS the stack leaves the bar background unset so the system can draw Liquid Glass. A solid `headerStyle` background disables that, and a solid large-title bar hides the title on iOS 26 (`lib/screen-options.ts`).

### Named Rules
**The System Material Rule.** Blur and glass belong to the tab bar, the navigation bar, and the floating circular back and share buttons over a full-bleed hero (`components/glass-button.tsx`: `GlassView` where `isLiquidGlassAvailable()`, the glass-fallback disc elsewhere). A card does not get its own glass.

## Shapes

Radius roles (`rounded-card` etc., `RADIUS` in `lib/surface.ts`), all with continuous corners (`borderCurve: "continuous"`):

| Role | Radius | Use |
|---|---|---|
| `card` | 24 | The featured 今天 story card |
| `tile` | 16 | Story cards in the scroller, resident tiles, stat blocks, quiz photos |
| `control` | 12 | Search field, segmented control, a small photo in a row |
| `group` | 10 | Inset grouped lists |
| `pill` | 999 | Buttons, capsules and chips |
| `glyph` | 8 | The 30pt square behind a 设置 row glyph, and only there |

**The Concentric Rule.** A shape inside another shape takes the outer radius minus the padding between them (`concentric(outer, padding)`), so the curves share a centre: card 24 with padding 16 → 8; tile 16 with padding 12 → 4; a 44pt avatar in a 52pt capsule with 4pt padding is radius 22 inside 26. Never nest the same radius.

The plate photograph has square corners. Buttons are pills, 48 tall, never under 44.

## Components

Every component has a contract: purpose, when not to use it, variants, states, accessibility and Dynamic Type. All tappable things are at least 44×44 (`component.hitTarget`). `Text` keeps `allowFontScaling`; past a font scale of 1.35 layouts restack (rows put the value under the label, stat blocks stack, photo grids drop a column; resident tiles go to one a row at 2.0).

### Inventory
| Component | File | Purpose | Don't use for | Variants / states | A11y |
|---|---|---|---|---|---|
| `Text` | `ui/text.tsx` | Every string | Sizing by className | The six styles, `stat`, reading set; deprecated variants | `display`/`title` get heading role and level |
| `Button` | `ui/button.tsx` | One decision | Navigation (use a row) | primary, tinted, plain, secondary; pressed, disabled, focus ring | label is the action verb, ≥44 tall |
| `ListSection` / `ListCell` / `NavRow` | `grouped-list.tsx`, `nav-row.tsx` | Facts and destinations | A photo grid | label, detail, meta, icon, chevron, tint (action), destructive; pressed | row is the button; hint for destinations |
| `PressScale` | `press-scale.tsx` | Press feedback on photo cards, tiles, stat blocks, chips | Grouped rows (system highlight) | pressed; reduced motion dims | inherits Pressable role |
| `StoryCard` | `features/today/story-card.tsx` | 今天 cards | Lists | featured (card radius, display), small (tile radius, title) | one label: title and panda |
| `StretchyHero` + `HeroToolbar` | `stretchy-hero.tsx` | The plate on a detail page | Cards inside a page | with or without overlay; zoom target | photo labelled, glass buttons labelled 返回/分享 |
| `GlassButton` | `glass-button.tsx` | Back/share over a photo | Anything not over media | Liquid Glass, fallback disc | 44 circle, label required |
| `Scrim` | `scrim.tsx` | Make on-media text legible | Darkening a photo for mood | height | decorative |
| `PhotoOutline` | `photo-outline.tsx` | Edge on rounded photos | Square plates | radius | decorative |
| `Icon` | `icon.tsx`, `icons.ts` | A category or destination glyph | Buttons, titles, running text | sizes footnote 15, subhead 18, body 22, title3 24, chevron 17; tones secondary, tint, tertiary, label, onMedia | always hidden; the holder carries the name |
| `ScreenState` / `LoadFailed` | `screen-state.tsx`, `load-failed.tsx` | Empty, failed, offline | Inline errors in a row | empty, error + retry | sentence is announced |
| `SectionHeader` | `section-header.tsx` | A titled section on a tab root, with count and link | A grouped list's footnote header | title, count, action | title is a heading; action is a link ≥44 |
| `Segmented` | `segmented.tsx` | Two to four mutually exclusive choices (外观) | Navigation, filters with many options (chips) | track, sliding thumb (`move`; none under Reduce Motion); selection haptic | radiogroup of radios with checked state |
| `PandaTile` | `panda-tile.tsx` | One panda as a photo tile (birthday scroller, place residents) | Rows of facts | name, caption, width, aspect; press scale | one label: name and caption |
| `Skeleton` | `ui/skeleton.tsx` | Loading placeholder in the final layout | Spinners on a page | — | hidden from VoiceOver |
| `OfflineBanner` | `offline-banner.tsx` | No network | Errors from the API | — | announced once |
| Warm badge | (class recipe) `rounded-pill bg-warm-soft text-warm` footnote semibold | 今天 / 新 / milestone | Actions or status | — | the text says it; color is never the only signal |

### Buttons
- **Shape:** pill, height 48, at least 44.
- **Primary:** jade fill, white label (black on pale jade in dark), headline weight. One per decision.
- **Tinted:** tinted-fill capsule, tint label. A toggle that is the page's main action, like 关注.
- **Plain:** tint text, no ground. A second action beside a tinted one, like 见过.
- **Secondary:** system fill, label-colored text. The alternate action.
- **Focus:** 2px tint ring.

### Grouped lists
- **Corner style:** `group` (10) on the group, square cells inside, elevated surface, no border.
- **Separator:** `HAIRLINE` (`StyleSheet.hairlineWidth`; 0.5px on web) inset from the text (50px with a leading icon), omitted on the last cell.
- **Row:** at least 44, body title, optional footnote under it, optional secondary value on the trailing side, a chevron when the row navigates.
- **Header:** footnote in the secondary label above the group, not a tracked label above a title.
- **Key–value rows** (去之前): a footnote label over a body value, as Maps' place card lists hours and address.
- **Section header** (`components/section-header.tsx`): outside a grouped list, a section on a tab root is a `title` heading with an optional secondary count after an ideographic space (关注的熊猫　3) and an optional trailing tint link (看日历, 找熊猫). No icon, no kicker.

**The Settings Glyph Rule.** 设置 alone leads each row with an 18pt tint glyph in a 30pt square, `glyph` radius (8), highlight-soft fill, as the system Settings does (`GlyphSquare`, `ListCell glyph`). Its separators start after the square (`component.settingsGlyph.inset`, 58). 退出登录 is a centered destructive row in its own group. Every other list keeps plain secondary glyphs.

### Inputs
- **Search:** 44 tall, `control` radius, elevated fill, secondary-label placeholder. No outline. The system caret for focus.

### Navigation
- **Tabs:** 今天, 找熊猫, 图鉴, 我的, with Lucide `sun`, `search`, `layout-grid`, `user-round`. iOS uses the system Liquid Glass bar (`expo-router/native-tabs`, SDK 58), which minimizes on scroll. Android uses the Material bar. Both take the glyphs as template PNGs in `assets/tab-icons/` (25pt, stroke 1.9, `apps/mobile/scripts/tab-icons.mjs`). Web uses `(tabs)/_layout.web.tsx`: a bar-material bar with a blur, same glyphs as components.
- **Stack:** the root is a native stack; each tab wraps its own. Large title on a tab root, inline title on a pushed screen. 科普 keeps the large title in the column. Back is the system chevron labelled 返回, edge-swipe on. Do not set a bar background on iOS.
- **Selected tab:** the tint. Unselected tabs are the secondary label.

### Icons
One set: Lucide (`lucide-react-native` on `react-native-svg`), same glyphs on every platform, each exported from `components/icons.ts` and drawn through `components/icon.tsx`.
- **Size** follows the text beside it (sizes above). **Stroke** 1.75; chevrons and toolbar glyphs 2–2.25.
- **Color:** secondary label. Tint only on an action row (官网, 看官方直播, 导航过去) or the selected tab. Tertiary label for the chevron. On media: white, or label inside Liquid Glass.
- **Use one** where Settings, Health or Maps would: a leading glyph on a row naming a fixed category or destination (父母, 看家谱, 查关系, 所在机构, every 去之前 fact, 到访, 看官方直播, 官网, 导航过去), or a footnote-size glyph beside a stat label.
- **One meaning per glyph** (`MapPin` place, `Clock` hours, `CalendarCheck` visit). **All or none in a group.** No icon on a data row (a relative, an event, a source).
- **Don't** put an icon on a button with a text label, a card or section title, beside a large title, in running text, in a tinted square (设置 is the one exception, see The Settings Glyph Rule), or fill a glyph to fake selection. A glyph-only toolbar button (返回, 分享, the 设置 gear on 我的) is a 44 circle with an accessible name.

### Screen state
- **Loading:** `Skeleton` in the final layout; content arrives with `enter`.
- **Empty / error:** one secondary sentence, centered, and a secondary 重试 button when the fan can retry. Not a filled card.
- **Offline:** `OfflineBanner`; cached content stays on screen.

### Sourcing
Navigation is Expo Router's `native-tabs` and native stack (the SDK 58 way to the system tabs and Liquid Glass). `expo-glass-effect`'s `GlassView` is a plain `View` off iOS, so it is only used for the floating buttons when `isLiquidGlassAvailable()`. Buttons, switches and skeletons are React Native Reusables in `src/components/ui/`, recolored to these roles. Grouped lists have no maintained component (RN has no UITableView), so `grouped-list.tsx` fills that one gap. See `docs/design/ui-component-sourcing-policy.md`.

## Do's and Don'ts

### Do
- **Do** pick a text style, a color role, a spacing role and a radius role by name.
- **Do** use a published photograph of the panda the sentence is about.
- **Do** keep draft 科普 out of the public catalog.
- **Do** use the system back button and the system tab bar.
- **Do** test light and dark, Reduce Motion, and a large Dynamic Type size.

### Don't
- **Don't** put a kicker above the title.
- **Don't** put an icon in a tinted square anywhere but 设置.
- **Don't** paint a card, a progress track, or a hero with the tint, or use shoot gold for anything tappable.
- **Don't** hand-roll a glass panel.
- **Don't** bring the website's olive ground or a custom back button onto the app.
- **Don't** write a hex, `rgba()`, a numeric `fontSize` or an arbitrary Tailwind value (`p-[13px]`) in a screen; add a token.
- **Don't** put a title over a photo with a burned-in watermark.

## Motion & Haptics

Follows `.agents/skills/animate-expo` and `make-interfaces-feel-better`. Durations and curves are tokens (`src/design/motion.ts`). UI motion never eases in.

**Signature: 竹 bamboo.** A bamboo stalk bends past its mark and springs back without wobbling. Spring `mass 1, stiffness 170, damping 22` (damping ratio ≈ 0.84, about 3% overshoot, settled in ~0.5s); for CSS/keyframes `cubic-bezier(0.3, 1.15, 0.5, 1)`: 280ms for `enter`, which plays on every page open, and 480ms for `hero`, the rare signature moment. Use it for arrivals: a page's content entering, a photo or card growing into place. **Not** for presses, exits, opacity or color on its own, scrolling, anything repeated in a list, or anything the fan drags (use `snappy`).

| Role | Duration | Curve | Where | Reduce Motion |
|---|---|---|---|---|
| press | 120ms | ease-out `(0.23, 1, 0.32, 1)` | Photo cards, tiles, stat blocks, chips scale to 0.97 (`PressScale`); rows keep the system highlight | Dims to 85% instead |
| enter | 280ms | bamboo | Loaded content fades in and rises 8pt (`CONTENT_ENTER`), once per page; a list shows what was already there without animating it | Skipped (system setting) |
| exit | 200ms | ease-out | Something leaves; shorter than it came | Fade only |
| move | 280ms | in-out `(0.77, 0, 0.175, 1)` | Something on screen changes place | Instant |
| hero | 480ms / spring | bamboo | A card zooming into its page (`Link.AppleZoom` on iOS 18+, the stack push elsewhere) | System |

**Haptics** (`lib/haptics.ts`, iOS and Android): 关注 a light impact; 见过 a success notification once the day is saved, a selection tick when cleared. One haptic per action, never on scroll or navigation.

## Content & Voice

- **Chinese typography:** full-width punctuation (，。：「」); a space between Chinese and a Latin word or a number (`2008 年出生`, `12 只`); no letter-spacing; no italics; titles are not ended with a period.
- **Numbers:** Arabic numerals with tabular figures in stats; thousands separators from four digits (`1,864`); ranges with an en dash (`12–38 公斤`); dates `2026 年 10 月 29 日`, short dates `10 月 29 日`; ages `5 岁`, `享年 31 岁`; birth year `2008 年出生` (not `2008 年生`).
- **Words:** 在世 / 已离世, 所在地, 父母, 经历, 生活过的地方, 熊猫动态, 待确认 / 有争议, 暂无记录 / 暂无照片, 收藏 / 已收藏. Not internal words like 档案, 投影, 交付, 结构化, 精度, 结论状态.
- **Voice:** short, plain sentences about the animal. Errors say what happened and what to do (加载失败，再试一次).

## Governance

- **Lint (warn only):** `apps/mobile/eslint.config.js` warns on hex and `rgba()/hsl()` literals, numeric `fontSize`, and arbitrary Tailwind values in `apps/mobile/src` (tokens and theme excluded). Warnings never fail CI. Older screens are migrated when the four tabs are redesigned, not in bulk.
- **Sync check:** `src/design/tokens.test.ts` runs in `npm test` and fails if `global.css` or this front matter is stale; it also checks contrast (AA for text roles and the accent) and the 4pt grid.
- **Lint this file:** `npx -y -p @google/design.md designmd lint DESIGN.md`.
- **Adding a token:** add it to `tokens.ts` (primitive first, then a role), run `npm run design:tokens -w @zhipanda/mobile`, document the role here, and show it on `/dev/design-system`.
- **Skill review (required for every frontend PR):** any PR that changes a screen, component, token or motion in `apps/mobile` (or the website UI) runs the skill checks in `.agents/skills` before it is merged: `impeccable` (critique + audit, craft floor), `review-animations` (when motion changes), `break-ui` (long names, large Dynamic Type, empty / error / loading, dark mode, small screens, Reduce Motion), `make-interfaces-feel-better`, and `apple-design` / `emil-design-eng` where relevant. Real findings are fixed in the same PR or listed as out of scope. The record goes in `docs/design/reviews/YYYY-MM-DD-pr<number>-skill-review.md` (for each skill: what was checked, findings, the fix or decision), and the PR description links it with a short summary. Example: `docs/design/reviews/2026-10-30-pr749-skill-review.md`.

## Deprecated

Kept so screens that predate v2 render. Do not use on a new or redesigned screen.

| Deprecated | Use instead |
|---|---|
| `Text` `largeTitle`, `h1` | `display` |
| `Text` `title1` (28) | `display`, or `readingTitle` in 科普 |
| `Text` `title2`, `h2` | `title` |
| `Text` `title3` (20) | `title` or `headline` |
| `Text` `callout` (16), `p` | `body` |
| `Text` `subhead` | `subheadline` |
| `Text` `caption`, `small` (12), `text-xs` | `footnote` (13 is the floor) |
| `Text` `h3` | `headline` |
| `Text` `muted` | `footnote` + `text-muted-foreground` |
| Classes `text-large-title`, `text-title1/2/3`, `text-callout`, `text-subhead`, `text-caption`, `text-base`, `text-sm`, `text-xl` | The style classes above |
| `rounded-[10px]`, numeric radii | `rounded-group`, `rounded-tile`, … |
| `EASE_OUT` / `CONTENT_ENTER` from `stretchy-hero.tsx` | `@/design/motion` (re-exported for now) |

## Changelog

- **v2.6 (2026-10-30).** 认识大熊猫 per-shelf empty states (The Learn Shelves Rule); 比一比 picker at `/compare` and a 找熊猫 explore card; 猜熊猫 leaves out levels with no questions (The Guess Level Rule).
- **v2.5 (2026-10-30).** 比一比 (The Compare Rule), reached from a panda's 比一比 rows and from a wrong 猜熊猫 answer; 猜熊猫 levels (The Guess Level Rule).
- **v2.4 (2026-10-30).** A panda's 时间线 (The Timeline Rule), linked from the last row of its 动态; event wording shared through `describeEvent` (a mother in a birth event now reads 迎来幼崽出生). 本周新鲜事 on 今天 and `/week` (The Weekly Digest Rule).
- **v2.3 (2026-10-30).** 图鉴 becomes the life list (The Life List Rule): numbered entries, 按基地 and 按家族 progress against finite groups; the global progress track and the photo grid are gone. 合集 detail on v2: the album mosaic as its header, an 编辑 / 完成 mode with 移出 and 撤销, 改名字 inline and a 删除合集 confirmation card. `Mosaic` moved to `features/collections/mosaic.tsx`.
- **v2.2 (2026-10-30).** `enter` shortened to 280ms (it plays on every page open; `hero` keeps 480ms), and list items already on screen no longer animate in. 科普 kickers moved below the title as a muted meta line. 每日一猫 shows the newest clue on the mystery card in place of the clue ring, and only a newly unlocked clue tile animates. Web tab bar `webHeight` 54 with a 14pt label line. `Segmented` and `SearchField` grow with large text. Governance: every frontend PR attaches a skill review record.
- **v2.1 (2026-10-29).** The four tab roots and the new 设置 page on v2: section headers, photo tiles, avatar scrollers, the 图鉴 stat block and grid, the profile card. `Segmented`, `SectionHeader`, `PandaTile`; radius `glyph` and The Settings Glyph Rule; 外观, the legal pages and 退出登录 moved from 我的 to 设置.
- **v2 (2026-10-29).** Single token source `apps/mobile/src/design/tokens.ts` (primitives → semantic → component) generating `global.css` and this front matter. Six purpose-named text styles plus a 科普 reading set; older variants deprecated. 笋金 warm accent (`#846018` / `#E3BD6E`). Signature 竹 bamboo motion. 4pt spacing roles, radius roles with `control` and `pill`, named media colors (scrim, placeholder, photo stroke, glass fallback, bar material). Warn-level design lint. `/dev/design-system` showcase. Merged the app section of `docs/design/zhipanda-design-system.md` (§10) into this file.
- **v1 (2026-10).** iOS 26 system semantics with the jade tint; four type sizes; story cards, stretchy hero, stat blocks, family chips.
