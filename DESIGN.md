---
name: 吱熊猫
description: A giant-panda atlas. Olive paper, a hairline list, and one photograph of a named animal.
colors:
  canvas: "#fcfdfc"
  canvas-dark: "#111210"
  ink: "#1d211c"
  ink-dark: "#eceeec"
  muted: "#60655f"
  muted-dark: "#afb5ad"
  line: "#d7dad7"
  line-dark: "#383a36"
  surface-subtle: "#eff1ef"
  surface-subtle-dark: "#212220"
  jade: "#29a383"
  warning: "#ab6400"
  destructive: "#ce2c31"
typography:
  display:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: "32px"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "0em"
  title:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "0em"
  body:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "0em"
  meta:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "999px"
  plate: "0px"
spacing:
  page: "20px"
  section: "40px"
  row: "12px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
    typography: "{typography.body}"
  plate:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    width: "100%"
---

## Overview

**Creative North Star: "A plate in the atlas."**

吱熊猫 is a book of named pandas, not a kit of cards. The page is olive paper. A hairline separates one fact from the next. When a screen is about one animal, that animal's photograph is the page: edge to edge, with the name and the distinguishing mark set underneath in the column, never on a scrim.

**Key Characteristics:**

- One photograph, full width, captioned in the column.
- Lists are hairline rows. A row is a name, then at most one muted line.
- Four sizes only: 32, 20, 16, 12. Noto Sans SC.
- Jade is rare, and the 科普 screens do not use it.
- Dark mode is the same structure on the dark olive ground.

## Colors

Olive is the neutral, from Radix, for both appearances. Jade is the only accent, and only where a fan would miss something without it: a saved heart, a "now" mark, keyboard focus. Amber is a warning. Red is an error or a wrong quiz pick. Learning screens stay on olive and ink.

**The Paper Rule.** The ground is olive-1 (`#fcfdfc` light, `#111210` dark). Do not introduce a second neutral, a gradient ground, or true black.

**The Accent Rule.** Jade does not fill a button, a card, or a progress bar. A primary action is ink on paper, reversed.

## Typography

The display size is the screen's only title, 32px, weight 900. Section titles are 20px, weight 800. Body is 16px. Meta, captions under a row, and the version line are 12px. There is no 14px and no size above 32px.

**The Four Size Rule.** If a hierarchy is weak, change weight, color, or space. Do not add a size.

## Layout

Phone pages pad 20px, then let a plate photograph ignore that pad and run to both edges. More space sits above a heading than between the heading and its first row. A manual's way forward is the next row, labeled with the entry's name. The small line under that name says 上一篇 or 下一篇.

**The Plate Rule.** The first figure on 科普 is one published photograph of a named panda. The caption sits under the picture. Text is not placed on the picture.

## Elevation & Depth

Resting surfaces do not float. Shadows are only for a layer that actually opens above the page, such as a menu. A quiz result does not arrive on a card.

**The Flat Rule.** A hairline or a change of type does the separating. A shadow and a border are not combined, and a resting row has neither a shadow nor a fill.

## Shapes

Buttons are pills, 48px tall. Photographs in a list may be square. The plate photograph has square corners and no frame. Do not wrap a fact in a rounded rectangle.

## Components

- **Primary button.** Ink fill, paper label, pill. One per decision: 看资料, 下一题.
- **Secondary button.** Subtle olive fill. The alternate action beside the primary.
- **Index row.** Hairline above, the entry name in 16px bold, an optional 12px line, at least 44px tall. The whole row is the control.
- **Definition row.** A 12px label over a 16px sentence, used for face-guide marks.
- **Plate.** The edge-to-edge photograph and the caption under it.

## Do's and Don'ts

- Do use a published photograph of the panda the sentence is about.
- Do keep draft 科普 out of the public catalog.
- Do reveal quiz names only after the answer, and do not repeat the choice photo as the question.
- Don't put an icon in a tinted square.
- Don't use a gradient hero, a scrim, or glass.
- Don't use the same rounded card for every fact.
- Don't put a kicker above the title.
- Don't introduce a color, a type size, or a shadow the rest of the atlas does not already use.
