# ZhiPanda Web Design System

## Overview

ZhiPanda is a photographic panda world for ordinary fans. The interface should feel alive, clear and exploratory: one named panda is allowed to dominate the first impression, while navigation and trust controls recede until they are needed.

The durable visual thesis is **a modern digital panda zoo and fan community**: named pandas, real photography, recognizable animal profiles, clear places and families, and personal return paths. The product should feel like a living destination fans browse and revisit, not like an archive, magazine, museum collection, editorial front page, SaaS dashboard, or research console.

This document defines reusable defaults, not an obligation to preserve stale visual choices. A well-supported surface redesign may replace these defaults when browser review and stronger references show a better direction; product truth, accessibility and panda-image identity remain the non-negotiable constraints.

## Colors

Use the ZhiPanda brand palette as the primary public identity, with neutral delivery tokens underneath:

| Token | Value | Role |
|---|---|---|
| brand-deep | `#003e40` | primary immersive brand field |
| brand-ink | `#002526` | deepest text/mark/action color |
| brand-ivory | `#fffff2` | warm high-contrast surface and text color |
| brand-acid | `#fbff36` | signature high-energy CTA/accent; use sparingly |
| brand-leaf | `#65b878` | secondary living/nature accent |
| brand-water | `#66c8cb` | secondary informational accent |
| canvas | `#ffffff` | ordinary reading surface when immersive branding is not appropriate |
| surface-subtle | `#f2f5f3` | quiet supporting field |
| ink-muted | `#626963` | secondary text on light grounds |
| line | `#dfe3df` | separators on reading surfaces |
| warning | `#845c19` | uncertainty/warning when semantically needed |

Do not introduce purple/blue AI gradients, flat beige page grounds, neutral-gray UI chrome or decorative color without a semantic or photographic reason. Prefer keeping important text outside photography; when text must overlay an image, use the lightest local contrast treatment that preserves legibility rather than automatically darkening the whole photograph.

## Typography

- Brand/display Latin: bundled `Archivo Variable` through `--zp-font-display-latin`.
- Brand/display Chinese: bundled `Noto Sans SC Variable` through `--zp-font-display-cjk`; use heavy weights, compact line height and controlled negative tracking rather than serif display styling.
- Body/UI: bundled `Noto Sans SC Variable` through `--zp-font-body`; Latin UI may use Archivo where the label benefits from a tighter branded voice.
- `--font-display` resolves to Archivo for Latin pages and Noto Sans SC Variable for Chinese pages. Do not rely on a font merely being installed on the user's machine.
- Do not use serif/CJK editorial display type by default on animal profile pages; it pushes the product toward magazine styling.
- Body copy should remain comfortable, generally `1.55–1.8` line height.
- Eyebrows are small, firm and sparse. They support hierarchy; they are not repeated above every block.
- Avoid tiny body text. Metadata may be small only when it is nonessential and still legible at zoom.

## Layout

- Public pages should behave like a polished zoo/community product: clear destinations, recognizable animals, useful controls, visual grouping and fast continuation.
- Home should expose multiple things a fan can do immediately: meet a panda, see what is new, browse pandas, open a family, visit a place, or return to My Pandas.
- Do not use long-form editorial pacing, magazine chapter sequencing, museum-index composition, or oversized statement typography as the default Home structure.
- Use photography, spacing, restrained surfaces, typography and interaction together. Hairlines may clarify local structure but must not become the page's visual identity.
- Cards are allowed when they represent a real object or action (panda, place, family, collection), but avoid card soup, nested cards and equal marketing-feature rows.
- Lists, feeds, family views, places and collections should feel interactive and browseable rather than like article indexes.

## Shapes

Current public radii are the allowed baseline:

- small: `0.55rem`
- medium: `0.85rem`
- large: `1.15rem`
- extra large: `1.4rem`
- pill only for compact controls, tags or floating navigation

Large photography may be full-bleed with no radius. Do not round every image or section. Avoid rounded-square icon tiles above headings.

## Elevation and Lines

- Prefer hairlines, tint changes and photographic layering over box shadows.
- Existing card/profile shadows are intentionally soft and low-opacity.
- Do not use dark glows, neon bloom or thick shadow stacks.
- Floating navigation may use restrained blur when it sits over photography; glass is a mechanism, not a visual theme.

## Imagery

- Correct individual identity is absolute: never substitute another panda's image.
- Large real panda photography is the preferred emotional anchor when media rights allow it.
- Crop for the subject, not the container. Keep faces and distinctive posture clear at desktop and mobile focal points.
- If no licensed image exists, use an intentional no-image treatment; do not insert generic stock panda imagery.
- Credits and rights remain reachable without becoming the dominant overlay.
- Historical imagery can carry archival character, but the page must not fake age with decorative filters that obscure the source.

## Motion

- Motion explains spatial continuity or creates a deliberate reveal; it is never decoration for its own sake.
- Prefer CSS/native scrolling and existing platform primitives before adding animation libraries.
- No bounce or elastic easing.
- Horizontal panda panoramas use direct manipulation and scroll snap rather than mandatory autoplay.
- `prefers-reduced-motion` must remove nonessential transitions and preserve the complete journey.

## Components

### Component sourcing

The newest approved prototype and its nearest persisted surface brief determine
what a public surface should look and feel like. Older prototype code is not a
design source merely because it is already implemented.

Use **shadcn/ui first** for ordinary interface primitives and controls. The Web
app also has shadcn-compatible registries configured for:

- `@animate-ui` — restrained animated primitives and state transitions;
- `@react-bits` — expressive, image-led and experiential interaction patterns;
- `@aceternity` — selective image, gallery and specialized interaction pieces;
- `@kokonutui` — niche utility and interaction components when shadcn lacks one;
- `@magicui` — selective effects or utilities only when they fit the approved
  photographic direction.

Before writing a reusable generic UI component, search these sources. Prefer
composition of established primitives over a parallel in-house Button, Dialog,
Tabs, Drawer, Tooltip, Popover, Accordion, form control, card shell or similar
abstraction. Install only the component needed; do not import an entire library
or demo visual system.

ZhiPanda may own branded domain blocks when generic libraries cannot encode the
product semantics. Current examples are `ZhiPandaLogo`, `LicensedHeroVideo`
and `PandaHeroRail`. These blocks must expose stable data/behavior interfaces,
carry accessibility and reduced-motion behavior themselves, and consume brand
tokens instead of page-local magic values.

Registry source is raw material, not visual authority. Adapt it to ZhiPanda's
tokens, typography, accessibility, responsive behavior and reduced-motion rules.
Reject components whose default concept conflicts with the current surface
brief. In particular, registry availability does not justify bento layouts,
AI-style gradients, neon/glow decoration, gratuitous glass, autoplay spectacle
or repeated animation. Photography, content hierarchy and spatial rhythm remain
the visual thesis.

### Global navigation

On the Home immersive entrance, use the branded warm-ivory floating pill navigation over media, with the ZhiPanda mark/wordmark and acid-yellow My Pandas action. On reading surfaces it returns to the normal public shell. Primary destinations remain Pandas, Families, Map and Moments, with Search and My Pandas as actions.

### Buttons and links

Primary actions are solid and high-contrast. Secondary actions are restrained outline/text treatments. Do not create multiple equally loud CTAs in one scene.

### Panda cards

Recognition first: correct image, name, minimal useful context. Cards must not become miniature database records. Missing information is omitted or summarized honestly rather than rendered as repeated empty fields.

### Trust disclosure

Evidence and sources are contextual secondary disclosure. Uncertainty that changes meaning is visible near the fact; IDs, release mechanics and full provenance belong deeper in the experience.

## Responsive Behavior

- Mobile is a deliberate composition, not a shrunken desktop cinematic page.
- Immersive hero text must avoid covering the panda's face when a focal point is known.
- Long timelines become one-column or compact two-track layouts.
- Family/panorama rows may scroll horizontally without causing page-level overflow.
- Maps must have a structured non-map equivalent.
- Primary actions remain touch-friendly and keyboard reachable.

## Accessibility

- Semantic heading order is mandatory.
- Visible focus is part of the visual system.
- Essential state is never encoded only by color.
- Text over imagery must have sufficient measured contrast after overlays.
- Interactive targets must remain comfortably usable on touch.
- 320 CSS pixels, 200% zoom and reduced motion are shipping states, not late QA exceptions.

## Anti-patterns

Do not ship:

- generic SaaS hero + feature-card grids;
- magazine, newspaper, museum-front-page or exhibition-catalogue composition on the public Home;
- hard editorial grids, repeated hairline indexes or oversized typographic statements used as a substitute for product interaction;
- cards nested inside cards;
- purple/blue AI gradients;
- pure black/gray visual systems;
- dark neon glows;
- bounce/elastic motion;
- rounded-square icon tiles above every heading;
- decorative completeness that invents panda facts, places, relationships or images;
- evidence/admin vocabulary in the main fan reading path;
- every section inside a rounded container.

## Signature Patterns

1. **One panda opens the world** — a strong individual photograph can lead into life, family, place and discovery.
2. **Cinematic family transition** — when real published relationships support it, family can become a large emotional scene before deeper lineage tools.
3. **Panda panorama** — the collection expands through generous image-led horizontal discovery, not an immediate dense grid.
4. **Quiet trust** — the site is rigorous underneath, while the fan experience stays human and memorable.
5. **Return loop** — moments, birthdays, updates and My Pandas make the world worth revisiting.