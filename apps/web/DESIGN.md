# ZhiPanda Web Design System

## Overview

ZhiPanda is a photographic, editorial panda world for ordinary fans. The interface should feel warm, alive and exploratory: one named panda is allowed to dominate the first impression, while navigation and trust controls recede until they are needed.

The durable visual thesis is **living panda atlas**: large truthful panda photography, quiet warm-paper reading surfaces, deep forest fields, precise hairlines, selective warm-gold highlights and generous editorial rhythm. It is not a SaaS dashboard, a card catalogue, a generic zoo site or a research-console aesthetic.

## Colors

Use the existing Web tokens as the default public palette:

| Token | Value | Role |
|---|---|---|
| canvas | `#f7f6f1` | warm page ground |
| surface | `#ffffff` | clear reading surface |
| surface-subtle | `#edf3ec` | pale green supporting field |
| ink | `#172019` | primary text; never pure black |
| ink-muted | `#5c685f` | secondary text on light grounds |
| accent | `#397253` | forest action/accent |
| accent-strong | `#24543a` | strong forest action |
| accent-soft | `#dfeee4` | quiet accent field |
| line | `#d7dfd8` | hairlines and separators |
| warning | `#845c19` | uncertainty/warning when semantically needed |
| dark-canvas | `#101611` | immersive dark field |
| dark-surface | `#18211a` | elevated dark field |
| dark-ink | `#edf3ee` | light text on dark fields |
| dark-muted | `#b3c2b5` | supporting text on dark fields |
| warm-gold | `#e7bd3f` | sparse cinematic highlight used by fan-first immersive surfaces |

Do not introduce purple/blue AI gradients, pure black, neutral-gray UI chrome or decorative color without a semantic or photographic reason. On photographic sections, derive contrast through tinted forest overlays rather than gray text over imagery.

## Typography

- Display family: `Manrope`, then the existing CJK fallbacks in `--font-display`.
- Body family: `Noto Sans SC`, then the existing CJK/system fallbacks in `--font-body`.
- Public display headings use tight editorial tracking and compact line height; large photographic scenes may scale beyond the current production `h1` ramp when the surface brief calls for immersion.
- Body copy should remain comfortable, generally `1.55–1.8` line height.
- Eyebrows are small, firm and sparse. They support hierarchy; they are not repeated above every block.
- Avoid tiny body text. Metadata may be small only when it is nonessential and still legible at zoom.

## Layout

- Public pages use a bounded reading shell for ordinary content and may break out to full-bleed photographic or map scenes when the content earns it.
- The first viewport of expressive fan surfaces is a thesis, not a standard two-column hero card.
- Prefer long-form editorial rhythm: strong scene → quiet explanation → strong scene → utility/discovery.
- Use whitespace and hairlines to separate information before adding containers.
- Avoid bento layouts, nested cards and rows of equal marketing feature cards as the default information architecture.
- Lists, timelines, family strips and panoramas should read as content rather than dashboard widgets.

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

### Global navigation

Compact and quiet. Over immersive photography it may float as a dark forest translucent pill; on reading surfaces it should return to the normal public shell. Primary destinations remain Pandas, Families, Map and Moments, with Search and My Pandas as actions.

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