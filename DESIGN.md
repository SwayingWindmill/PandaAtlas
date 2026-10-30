---
name: 吱熊猫
description: A giant-panda atlas on the iOS system shelf. One photograph, a deep jade tint, grouped lists.
colors:
  grouped: "#F2F2F7"
  grouped-dark: "#000000"
  surface: "#FFFFFF"
  surface-dark: "#1C1C1E"
  label: "#000000"
  label-dark: "#FFFFFF"
  secondary-label: "#636366"
  secondary-label-dark: "#AEAEB2"
  separator: "#C6C6C8"
  separator-dark: "#38383A"
  tint: "#165C3C"
  tint-dark: "#7DCAA4"
  button: "#165C3C"
  button-dark: "#7DCAA4"
  button-label: "#FFFFFF"
  button-label-dark: "#000000"
  tinted-fill: "#E3EBE8"
  tinted-fill-dark: "#16241E"
  fill: "#E5E5EA"
  fill-dark: "#2C2C2E"
  warning: "#B25000"
  warning-dark: "#FF9F0A"
  destructive: "#CE2C31"
  destructive-dark: "#FF6961"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.21
    letterSpacing: "0em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.27
    letterSpacing: "0em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.53
    letterSpacing: "0em"
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.38
    letterSpacing: "0em"
rounded:
  card: "24px"
  tile: "16px"
  group: "10px"
  control: "12px"
  pill: "999px"
spacing:
  inset: "16px"
  section: "24px"
  row: "12px"
components:
  button-primary:
    backgroundColor: "{colors.button}"
    textColor: "{colors.button-label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
    typography: "{typography.body}"
  grouped-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.label}"
    rounded: "{rounded.group}"
    padding: "12px 16px"
    typography: "{typography.body}"
---

# Design System: 吱熊猫

## Overview

**Creative North Star: "A photograph on the system shelf."**

吱熊猫 is a phone atlas of named giant pandas. The shelf is the iOS 26 interface a fan already knows: a large title, a system back chevron, a Liquid Glass tab bar, and inset grouped lists. The thing on the shelf is a photograph of one animal. Deep jade is the tint on the selected tab, a link, and the filled or tinted button. It does not paint cards.

The website keeps its olive paper. The app does not.

**Key Characteristics:**

- Tab roots use a 34px large title that collapses into the bar on iOS.
- Four type sizes: display 34, title 22, body 17, footnote 13. Weight and color make the rest of the hierarchy.
- Photographs lead: a featured story card, a stretchy hero, large portrait tiles. Grouped lists hold the facts under them.
- Cards press in, iOS 18 zooms a tapped photo into its page, and 关注/见过 answer with one haptic.
- Lists that navigate are inset groups with a 10px radius, not full-bleed hairlines.
- Body is 17px, with line height opened for Chinese.
- One tint, a deep bamboo jade. Photographs carry the rest of the color.
- Dark mode is true black grouped background and elevated `#1C1C1E` groups.

## Colors

System semantics, both appearances: the iOS grouped background, secondary system grouped background, label, secondary label and separator. The tint is a deep jade in light mode and a pale jade in dark mode, so it reads as a tint rather than a highlighter, and clears WCAG AAA as text on both grounds.

### Primary
- **Jade** (`#165C3C`, light): filled buttons with a white label, the selected tab, links, tint rows, and focus. 7.98:1 on white.
- **Pale jade** (`#7DCAA4`, dark): the same roles in dark mode. A filled button in dark mode takes a black label. 10.86:1 on black.
- **Tinted fill** (`#E3EBE8` / `#16241E`): the ground of a tinted capsule button (关注), with the tint as its label, as iOS draws `.borderedProminent` tinted controls.

### Neutral
- **Grouped background** (`#F2F2F7` / `#000000`): the page.
- **System background** (`#FFFFFF` / `#000000`): an article column.
- **Elevated group** (`#FFFFFF` / `#1C1C1E`): inset lists and cards.
- **Label** (`#000000` / `#FFFFFF`): primary text.
- **Secondary label** (`#636366` / `#AEAEB2`): the line under a row, footnotes, placeholders.
- **Separator** (`#C6C6C8` / `#38383A`): inset row dividers.
- **Fill** (`#E5E5EA` / `#2C2C2E`): secondary buttons and the search field's quiet ground on a group... the search field sits on the elevated surface.

### Named Rules
**The Tint Rule.** Jade marks what a fan can do: the selected tab, a link, a tint row, the one filled or tinted button, a correct quiz pick. It does not fill a card or sit above a title.

**The Shelf Rule.** Page ground is the system grouped background. Do not bring the website's olive paper onto a screen.

## Typography

**UI font:** the system face. San Francisco for Latin, PingFang SC for Chinese on iOS. The web stack is `-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`. No separate display face.

**Character:** iOS text styles, with line heights opened so Chinese does not clip. Weights are regular (400), semibold (600) and bold (700).

### Hierarchy
New and redesigned screens use four sizes, defined as tokens in `components/ui/text.tsx`:
- **Display** (700, 34/41, `variant="display"`): the tab root, a panda's or an institution's name, the featured story title.
- **Title** (700, 22/28, `variant="title"`): a smaller story card, a resident's name on its tile, a section in a reading column. `variant="stat"` is this size with tabular figures, for the value in a stat block.
- **Body** (400, 17/26): names, sentences, buttons. Semibold (600) when a line needs emphasis inside body size.
- **Footnote** (400, 13/18): section headers above a group, captions, stat labels, credits, the date under 今天 (regular weight, secondary label).

The older styles (Title1 28, Title3 20, Callout 16, Subhead 15, Caption 12) remain in `text.tsx` for screens not yet redesigned. Do not reach for them on a new screen.

### Named Rules
**The Four Sizes Rule.** Display, title, body, footnote. Hierarchy past that comes from weight (400/600/700) and the secondary label, not from a fifth size. A date or a meta line is regular weight; only names and titles are bold.

**The Tabular Rule.** Numbers that sit in a column or change in place (ages, counts, years in a stat block) use `tabular-nums`.

## Layout

Phone pages inset 16px. A grouped list sits in that inset; its header is a footnote aligned with the cell text. More space sits above a section heading than between the heading and the group. A photograph that is the subject runs to both edges and ignores the inset. Tab content clears the bottom bar.

**The Plate Rule.** The first figure on a panda, an institution or a 科普 article is one published photograph. On a panda or institution page it runs full-bleed under the status bar and stretches on pull-down, as Music and App Store heroes do (`components/stretchy-hero.tsx`). A panda's name is a display title below the photo; an institution's name sits on its photo over a bottom scrim, as Music sets an artist's name. The institution hero is the first resident whose cover carries no agency watermark.

**The Story Card Rule.** 今天 is one featured App Store Today-style card (24pt continuous corners, white display title) and, under it, a horizontal scroller of smaller cards (16pt corners, white title, snapping one card at a time, the next card peeking in). Each card is one photograph with a bottom black scrim (0 → 72%) and a footnote under its title naming the feature and the panda in the photo. Each card uses a different panda. The card sits on a dark placeholder so the white text reads while the photo loads. Nothing sits above the title on a card.

**The Clean Photo Rule.** A photo under a title must not carry a burned-in mark. Covers credited to Xinhua/新华 or Pandapia (logo-stamped crops) are left out of story cards and institution heroes (`hasBurnedInMark` in `features/today/story-order.ts`). They stay on the panda's own page and in lists.

**The Stat Block Rule.** A panda page leads its facts with three tiles in a row, as Health leads with summary tiles: 性别 (the ♂/♀ glyph), 年龄 or 享年 (with the birth year under it), 所在地 (tappable to the institution) or 离世. Each tile is an elevated surface, 16pt corners, a footnote label with its glyph over a title-size value. Past a font scale of 1.35 the tiles stack. The full birth date and birthplace follow as one footnote line.

**The Family Chip Rule.** Relatives are a horizontal row of capsules: a 44pt round photo inside a 52pt capsule with 4pt padding, the name in semibold body and the relation in a footnote. 看家谱 and 查关系 stay grouped rows under the chips.

**The Resident Tile Rule.** An institution's residents are large portrait tiles (4:5), two a row (one at accessibility sizes), 16pt corners, the name in white title over a bottom scrim.

## Elevation & Depth

Resting groups are a tone step, not a shadow. Every photograph with rounded corners gets a 1px inside stroke, black at 10% in light mode and white at 10% in dark (`components/photo-outline.tsx`), so a pale photo keeps its edge on a pale page. It is a stroke, not a shadow. The iOS 26 tab bar and the navigation bar are system materials: Liquid Glass when the system draws it, an opaque bar on Android and web. Do not add a shadow to a list, a button, or a card.

On iOS the stack leaves the bar background unset so the system can draw Liquid Glass. A solid `headerStyle` background disables that, and a solid large-title bar hides the title on iOS 26.

### Named Rules
**The System Material Rule.** Blur and glass belong to the tab bar, the navigation bar, and the floating circular back and share buttons over a full-bleed hero (`components/glass-button.tsx`: `GlassView` where `isLiquidGlassAvailable()`, a translucent dark disc elsewhere). A card does not get its own glass.

## Shapes

Radii are tokens in `lib/surface.ts`: `card` 24 (the featured story), `tile` 16 (story cards in the scroller, resident tiles, stat blocks), `group` 10 (inset lists). Corners are continuous (`borderCurve: "continuous"`).

**The Concentric Rule.** A shape inside another shape takes the outer radius minus the padding between them, so the curves share a centre: a 44pt avatar in a 52pt capsule with 4pt padding is radius 22 inside 26. Never nest the same radius.

Inset groups are 10px. Quiz photos and featured articles are 12–16px. Buttons are pills, 48px tall, at least 44px. Search is a 10px filled field, 44px tall. Photographs in a list may be a small rounded square. The plate photograph has square corners.

## Components

### Buttons
- **Shape:** pill (999px), height 48px.
- **Primary:** jade fill, white label (black on pale jade in dark), body semibold. One per decision.
- **Tinted:** tinted-fill capsule, tint label. A toggle that is the page's main action, like 关注.
- **Plain:** tint text, no ground. A second action beside a tinted one, like 见过.
- **Secondary:** system fill, label-colored text. The alternate action.
- **Focus:** 2px tint ring.

### Grouped lists
- **Corner style:** 10px on the group, square cells inside.
- **Background:** elevated surface.
- **Border:** none on the group. A hairline separator (`HAIRLINE` in `lib/surface.ts`: `StyleSheet.hairlineWidth`, one device pixel; 0.5px on web) inset 16px from the leading edge, omitted on the last cell.
- **Row:** at least 44px, body title, optional footnote under it, optional secondary value on the trailing side, a chevron when the row navigates.
- **Header:** footnote in the secondary label, above the group, not a tracked label above a title.
- **Key–value rows** (去之前): a footnote label over a body value, as Maps' place card lists hours and address.
- **Dynamic Type:** `Text` keeps `allowFontScaling`. Past a font scale of 1.35, a row's trailing value moves under its label, photo grids drop columns, stat blocks stack, and resident tiles go from two a row to one at 2.0.

### Inputs
- **Search:** 44px, 10px radius, elevated fill, secondary-label placeholder. No outline.
- **Focus:** the system caret. A tint ring when the control is a button.

### Navigation
- **Tabs:** four sections, 今天, 找熊猫, 图鉴, 我的, with Lucide `sun`, `search`, `layout-grid`, `user-round`. iOS uses the system Liquid Glass bar (`expo-router/native-tabs`, SDK 58), which minimizes on scroll down. Android uses the Material bar. Both take the glyphs as template PNGs in `assets/tab-icons/` (25pt, stroke 1.9, made by `apps/mobile/scripts/tab-icons.mjs`), and the bar tints them. Web uses a blurred bottom bar, which is not Liquid Glass, and draws the same glyphs as components.
- **Stack:** large title on a tab root, inline title on a pushed screen. 科普 home, articles, terms, face guides and the challenge keep the large title in the column and leave the bar as a back button. Back is the system chevron, labeled 返回, and the edge-swipe stays on.
- **Selected tab:** the tint. Unselected tabs are the secondary label.

### Icons
One set: Lucide (`lucide-react-native` on `react-native-svg`), the same glyphs on iOS, Android and web. Every glyph the app uses is exported from `components/icons.ts`, one file per icon, and drawn through `components/icon.tsx`. An icon is decoration: the row or button that holds it carries the accessible name.

- **Size:** follows the text beside it. 22 beside body, 18 beside subhead, 15 beside footnote. The disclosure chevron is 17.
- **Stroke:** 1.75. Chevrons and toolbar glyphs 2 to 2.25, so a small glyph keeps its weight.
- **Color:** the secondary label. The tint only when the icon sits on an action row (官网, 看官方直播, 导航过去) or marks the selected tab. The chevron is the tertiary label. Toolbar glyphs over a photo are white, or the label color inside Liquid Glass.
- **Use one** where Settings, Health or Maps would: a leading glyph on a grouped row that names a fixed category or a destination, or a footnote-size glyph beside a stat block's label (性别 shows ♂/♀, 年龄, 享年, 所在地, 离世). 父母, 看家谱, 查关系, the current 所在机构, every 去之前 fact (开放时间, 门票, 熊猫馆, 地址, 什么时候去, 怎么去…), 到访, 看官方直播, 官网, 导航过去. Also the tab bar, the toolbar back and share, the disclosure chevron and the search field.
- **One meaning per glyph.** `MapPin` is a place, `Clock` is hours, `CalendarCheck` is a visit. Reuse the vocabulary in `icons.ts` before adding a glyph.
- **All or none in a group.** Rows with icons inset their separator to the label (50px). A row that is data (a relative's name, an event, a source, a former resident) gets no icon, even in a section where the fixed rows have one.
- **Don't** put an icon on a button (关注, 见过, 记下今天去过), on a card or section title, beside a large title, inside running text, or anywhere just to fill space.
- **Don't** put an icon in a tinted square, and don't fill or recolor a Lucide glyph to fake a selected state.

### Motion and haptics
Follows `.agents/skills/animate-expo` and `make-interfaces-feel-better`.
- **Press:** photo cards, tiles, stat blocks and family chips scale to 0.97 over 120ms on `cubic-bezier(0.23, 1, 0.32, 1)` while pressed (`components/press-scale.tsx`, a Reanimated CSS transition). Grouped rows keep the system highlight.
- **Into a page:** on iOS 18+, a story card, a resident tile and a family chip zoom into the page they open (`Link.AppleZoom`), and the hero photo is the zoom target (`Link.AppleZoomTarget`). Elsewhere the stack's own push plays. A loaded page's content fades in over 280ms.
- **Reduce Motion:** press feedback dims to 85% instead of scaling, and layout animations follow the system setting.
- **Haptics** (`lib/haptics.ts`, `expo-haptics`, iOS and Android): 关注 a light impact on tap; 见过 a success notification once the day is saved, a selection tick when it is cleared. One haptic per action, never on scroll or navigation.

### Screen state
A failed load or an empty catalog is one secondary sentence, centered, and a secondary button when the fan can retry. It is not a filled card.

## Do's and Don'ts

### Do
- **Do** use a published photograph of the panda the sentence is about.
- **Do** keep draft 科普 out of the public catalog.
- **Do** use the system back button and the system tab bar.
- **Do** test light and dark.

### Don't
- **Don't** put a kicker above the title.
- **Don't** put an icon in a tinted square.
- **Don't** paint a card, a progress track, or a hero with the tint.
- **Don't** hand-roll a glass panel. Glass is the system bars and the circular buttons over a hero, nothing else.
- **Don't** bring the website's olive ground or a custom back button onto the app.
- **Don't** add a fifth type size on a redesigned screen, or a size between the four.
- **Don't** put a title over a photo with a burned-in watermark.
