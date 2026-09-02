---
version: 2
slug: "app-locale-prototype-fan-v08-pandas-page-tsx"
primary_target: "app/[locale]/prototype/fan-v08/pandas/page.tsx"
related_targets: ["app/[locale]/prototype/fan-v08/pandas/directory-explorer.tsx","app/[locale]/prototype/fan-v08/pandas/directory.module.css","app/[locale]/prototype/fan-v08/pandas/research-catalog.ts","app/[locale]/prototype/fan-v08/prototype.module.css","app/[locale]/prototype/fan-v08/visual-fixtures.ts"]
---

# Fan V8 Panda Directory

## Scope and mode

Visitor mode: **Experience + Explore**. This is not an administrative catalogue. It is the main place an ordinary fan goes when they want to browse many named pandas without already knowing exactly whom to search for.

## Audience and job

A panda fan arrives with one of three intents: find a known name, browse faces until one catches their attention, or continue discovering after a profile/home visit. The page must work when the public release grows from dozens to hundreds of partial profiles.

## Primary action

Open a panda profile because a face, name, life period or place made the visitor curious.

## Chosen direction

**Living contact sheet.** The directory should feel like an edited photographic index rather than a database result grid. A cinematic lead photograph establishes the world, then utility condenses into a quiet search/filter rail. Published photographs form an irregular editorial contact sheet with deliberately varied proportions; pandas without published imagery move into a typographic name index instead of creating rows of gray empty cards.

## Structural thesis

1. Editorial cover: one strong panda image, large directory statement, current published count.
2. Quiet discovery rail: search plus a few fan-readable quick modes; advanced database controls are not the first interaction.
3. Visual index: varied image spans, minimal captions, no equal card grid.
4. Name index: no-image/partial profiles remain first-class through typography rather than fake media placeholders.
5. Continuation: random panda and other discovery routes at the end.

## Constraints

- Every image must belong to the panda it labels; prototype fixtures remain isolated and explicitly non-production.
- Do not infer popularity or rankings.
- Do not imply all published pandas have photos, family data or current locations.
- Omit unknown metadata instead of printing repeated empty rows.
- Search/filter interactions must remain keyboard and touch usable.
- Filtering may reorganize content with restrained layout motion, but there is no repeated reveal choreography or smooth-scroll hijacking.
- At 320 CSS px, the page becomes a deliberate single-column editorial flow rather than a compressed desktop masonry grid.
- The photo grid must not become Pinterest-style randomness; varied spans follow a small repeatable composition pattern.
- Local review may enable `FAN_V08_RESEARCH_CATALOG=1` and load all canonical research Subjects to test real scale. This mode is explicitly prototype-only and must never be described as the public release.
- Research-only Subjects must never link to a production panda profile. Only a matching active PublicRead panda is navigable as a published profile.
- The full research catalog participates in search and filtering, while photographed results render in bounded batches so 785 media records do not create hundreds of image elements on first paint.
- Research media coverage counts describe the local vault only; they do not communicate publication rights or public media eligibility.

## Visual language

- Warm paper as the browsing ground; deep forest only where photography needs contrast.
- Chinese display uses the scoped Noto Serif SC; body uses Noto Sans SC; English/UI uses Manrope from the V8 layout.
- No repeated eyebrow labels, rounded feature cards, glass panels, decorative metrics, gradient text or icon tiles.
- Hairlines, whitespace, photographic crop and type hierarchy do most of the work.

## Motion

One authored interaction: changing search/filter state lets the visual contact sheet reflow smoothly through Motion layout animation. Entry photography may use the existing restrained settle. Reduced-motion users get immediate state changes without spatial animation.

## Prototype success criteria

Within a few seconds a visitor should understand: how many pandas are publicly available, how to search, how to browse visually, that some profiles intentionally have no public image, and where to click next. The page should feel more like a premium nature/editorial product than a filtered database or SaaS gallery.
