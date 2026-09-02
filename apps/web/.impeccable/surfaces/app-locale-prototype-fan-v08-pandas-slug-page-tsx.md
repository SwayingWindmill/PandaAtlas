---
version: 2
slug: "app-locale-prototype-fan-v08-pandas-slug-page-tsx"
primary_target: "app/[locale]/prototype/fan-v08/pandas/[slug]/page.tsx"
related_targets: ["app/[locale]/prototype/fan-v08/pandas/[slug]/detail.module.css","app/[locale]/prototype/fan-v08/pandas/[slug]/detail-motion.tsx","app/[locale]/prototype/fan-v08/pandas/portrait-transition-link.tsx","app/[locale]/prototype/fan-v08/pandas/directory-explorer.tsx","app/[locale]/prototype/fan-v08/pandas/research-catalog.ts"]
---

# Fan V8.5 Panda Detail

## Scope and mode

Visitor mode: **Experience + Explore**. The page continues the Digital Panda Portrait Library into an individual panda story. It is not a public data inspector and it must not inherit the legacy TrustedProfilePage card-heavy hierarchy.

## Audience and job

A panda fan has just chosen one panda from the portrait library. The next page should preserve spatial continuity, make the selected panda emotionally dominant, then reveal life story, family, places, imagery and sources only when real data exists.

## Primary action

Stay with the selected panda long enough to understand who it is, then continue naturally into family, moments, another panda or a source.

## Chosen direction

**Portrait expands into world.** On desktop the first viewport is a split cinematic composition: a large truthful panda portrait occupies roughly 56% of the viewport and the panda's name, alternate name and a single compact fact line occupy the remaining field. On mobile, photography leads and text follows vertically.

The detail page contains no giant information card, no repeated module badges, no empty database rows and no publication/review vocabulary in the main fan path. Missing sections are omitted. Research-only records may therefore have a minimal but intentional profile rather than a wall of unavailable states.

Below the hero, sections behave like editorial scenes rather than widgets:

- Story uses a deep forest reading field when reviewed copy exists.
- Life events use a quiet chronological list separated by hairlines.
- Family is a typographic relationship field with direct links to related panda portraits.
- Footprint is an ordered location record without fake map precision.
- Media becomes an image-led gallery only when multiple legitimate images exist.
- Sources remain reachable as a final dark trust layer instead of competing with the panda at the top.

## Transition language

The directory and detail page use the approved React Bits + GSAP + Motion interaction stack with explicit ownership. GSAP owns the portrait-to-hero spatial morph and its single authoritative timeline; Motion owns the detail-copy reveal and ordinary React micro-interactions.

1. The clicked portrait is reconstructed as a fixed **mask frame** at the exact visible 4:5 geometry.
2. The mask frame animates its position, width, height and corner radius toward the exact detail Hero geometry on one isolated fixed element.
3. The image inside that mask remains `object-fit: cover` at all times, so changing from the 4:5 directory crop to the slightly different Hero aspect ratio changes only the crop. The panda image is never given independent `scaleX` and `scaleY`, preventing face/body distortion.
4. The warm-paper veil and route navigation are placed on the same GSAP timeline so phases cannot drift apart.
5. The destination waits for the morph end time, then the overlay and veil fade away to reveal the already-mounted identical Hero.

Do not restore `Flip.from(..., { scale: true })` directly on the panda image when source and target aspect ratios differ; that produces perceptible non-uniform scaling. Modified-click behavior, normal href fallback and reduced-motion users bypass the cinematic layer and retain standard navigation. Playwright must verify that the overlay geometry actually changes during the transition, not merely that an overlay exists and navigation succeeds.

## Data boundary

The V8.5 prototype explicitly reads the local 960-record research catalogue inside the prototype route so visual review does not depend on launch-process environment variables. Production public routes remain unchanged. The V2 public atlas is opportunistic enrichment for story, family, events, residencies, media and sources; if it is temporarily unavailable, research-directory profiles still render instead of returning an error.

## Constraints

- Every photograph must belong to the individual panda shown.
- Never invent story, family, location, timeline or image data to fill a visual module.
- At 320 CSS px there must be no page-level horizontal overflow.
- The mobile hero must not place text over the panda face.
- Keyboard, touch and modified-click navigation remain valid.
- Reduced motion skips the shared-element animation.
- Trust/evidence stays reachable but visually secondary.

## Success criteria

A directory click should feel like the selected portrait grows into the next scene rather than a generic page load. The first viewport must make the panda unmistakably dominant, while richer published records naturally unfold into story, life, family, places, media and sources. Sparse research records must still look intentional and beautiful rather than incomplete or administrative.
