---
name: 吱熊猫
description: A giant-panda atlas on the iOS system shelf. One photograph, a green tint, grouped lists.
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
  tint: "#1B7F64"
  tint-dark: "#3DDC97"
  button: "#1B7F64"
  button-label: "#FFFFFF"
  fill: "#E5E5EA"
  fill-dark: "#2C2C2E"
  warning: "#B25000"
  warning-dark: "#FF9F0A"
  destructive: "#CE2C31"
  destructive-dark: "#FF6961"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.21
    letterSpacing: "0em"
  title1:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.29
    letterSpacing: "0em"
  title2:
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

吱熊猫 is a phone atlas of named giant pandas. The shelf is the iOS 26 interface a fan already knows: a large title, a system back chevron, a Liquid Glass tab bar, and inset grouped lists. The thing on the shelf is a photograph of one animal. Green is the tint on the selected tab, a link, and the filled button. It does not paint cards.

The website keeps its olive paper. The app does not.

**Key Characteristics:**

- Tab roots use a 34px large title that collapses into the bar on iOS.
- Lists that navigate are inset groups with a 10px radius, not full-bleed hairlines.
- Body is 17px, with line height opened for Chinese.
- One tint, the panda green. Photographs carry the rest of the color.
- Dark mode is true black grouped background and elevated `#1C1C1E` groups.

## Colors

System semantics, both appearances. The tint is darkened from a bright system green so a white label on the button, and the tint used as text, clear WCAG AA.

### Primary
- **Panda green** (`#1B7F64`): filled buttons, the selected tab, links, and focus. The same fill in dark mode, so the white label still clears AA.
- **Bright tint** (`#3DDC97`): tint text and icons on the dark grouped background. Not a button fill.

### Neutral
- **Grouped background** (`#F2F2F7` / `#000000`): the page.
- **System background** (`#FFFFFF` / `#000000`): an article column.
- **Elevated group** (`#FFFFFF` / `#1C1C1E`): inset lists and cards.
- **Label** (`#000000` / `#FFFFFF`): primary text.
- **Secondary label** (`#636366` / `#AEAEB2`): the line under a row, footnotes, placeholders.
- **Separator** (`#C6C6C8` / `#38383A`): inset row dividers.
- **Fill** (`#E5E5EA` / `#2C2C2E`): secondary buttons and the search field's quiet ground on a group... the search field sits on the elevated surface.

### Named Rules
**The Tint Rule.** Green marks what a fan can do: the selected tab, a link, the one filled button, a correct quiz pick. It does not fill a card or sit above a title.

**The Shelf Rule.** Page ground is the system grouped background. Do not bring the website's olive paper onto a screen.

## Typography

**UI font:** the system face. San Francisco for Latin, PingFang SC for Chinese on iOS. The web stack is `-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`. No separate display face.

**Character:** iOS text styles, with line heights opened so Chinese does not clip. Weights are regular (400), semibold (600) and bold (700).

### Hierarchy
- **Large Title** (700, 34/41): the tab root, and a 科普 title drawn in the column.
- **Title1** (700, 28/36): a featured article title, a count that is the screen's answer.
- **Title2** (700, 22/28): a section in a reading column.
- **Title3** (600, 20/26): a smaller section.
- **Headline** (600, 17/24): a row that needs emphasis inside body size.
- **Body** (400, 17/26): names, sentences, buttons.
- **Callout** (400, 16/24) and **Subhead** (400, 15/22): supporting lines.
- **Footnote** (400, 13/18): section headers above a group, captions, the version line.
- **Caption** (400, 12/16): the floor. Nothing smaller.

### Named Rules
**The System Style Rule.** Pick a text style. Do not invent a size between them.

## Layout

Phone pages inset 16px. A grouped list sits in that inset; its header is a footnote aligned with the cell text. More space sits above a section heading than between the heading and the group. A photograph that is the subject runs to both edges and ignores the inset. Tab content clears the bottom bar.

**The Plate Rule.** The first figure on a panda or a 科普 article is one published photograph. The caption sits under the picture. Text is not placed on the picture.

## Elevation & Depth

Resting groups are a tone step, not a shadow. The iOS 26 tab bar and the navigation bar are system materials: Liquid Glass when the system draws it, an opaque bar on Android and web. Do not add a shadow to a list, a button, or a card.

On iOS the stack leaves the bar background unset so the system can draw Liquid Glass. A solid `headerStyle` background disables that, and a solid large-title bar hides the title on iOS 26.

### Named Rules
**The System Material Rule.** Blur and glass belong to the tab bar and the navigation bar, drawn by the system. A card does not get its own glass.

## Shapes

Inset groups are 10px. Quiz photos and featured articles are 12–16px. Buttons are pills, 48px tall, at least 44px. Search is a 10px filled field, 44px tall. Photographs in a list may be a small rounded square. The plate photograph has square corners.

## Components

### Buttons
- **Shape:** pill (999px), height 48px.
- **Primary:** panda green fill, white label, body semibold. One per decision.
- **Secondary:** system fill, label-colored text. The alternate action.
- **Focus:** 2px tint ring.

### Grouped lists
- **Corner style:** 10px on the group, square cells inside.
- **Background:** elevated surface.
- **Border:** none on the group. A 0.5px separator inset 16px from the leading edge, omitted on the last cell.
- **Row:** at least 44px, body title, optional footnote under it, optional secondary value on the trailing side, a chevron when the row navigates.
- **Header:** footnote in the secondary label, above the group, not a tracked label above a title.

### Inputs
- **Search:** 44px, 10px radius, elevated fill, secondary-label placeholder. No outline.
- **Focus:** the system caret. A tint ring when the control is a button.

### Navigation
- **Tabs:** four sections, 今天, 找熊猫, 图鉴, 我的. iOS uses SF Symbols and the system Liquid Glass bar (`expo-router/native-tabs`, SDK 58). The bar minimizes on scroll down. Android uses Material symbols and the Material bar. Web uses a blurred bottom bar, which is not Liquid Glass.
- **Stack:** large title on a tab root, inline title on a pushed screen. 科普 home, articles, terms, face guides and the challenge keep the large title in the column and leave the bar as a back button. Back is the system chevron, labeled 返回, and the edge-swipe stays on.
- **Selected tab:** the tint. Unselected tabs are the secondary label.

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
- **Don't** paint a card, a progress track, or a hero with the green tint.
- **Don't** hand-roll a glass panel. The system bar is the only glass.
- **Don't** bring the website's olive ground, four type sizes, or custom back button onto the app.
