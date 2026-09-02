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

**Panda directory list.** This page is a true browseable list, not a gallery, story page, masonry layout, or database table. Every row gives equal visual priority to the panda thumbnail and the panda name. Photography is an identity cue; typography is the other identity cue. Neither becomes background decoration or a tiny caption.

## Structural thesis

1. Compact directory masthead: title, scope, total count, and a clear prototype/publication boundary. No cinematic hero image.
2. Sticky discovery controls: name search plus a few fan-readable filters.
3. One consistent panda list: every result uses the same thumbnail-and-name-led row anatomy, whether or not it has publishable media.
4. Secondary metadata stays quiet and aligned: birth year, sex, life state, and publication state never compete with thumbnail or name.
5. Progressive loading keeps the 960-subject prototype fast while search and filters always cover the full dataset.

## Constraints

- Every image must belong to the panda it labels; prototype fixtures remain isolated and explicitly non-production.
- Do not infer popularity or rankings.
- Do not imply all published pandas have photos, family data or current locations.
- Omit unknown metadata instead of printing repeated empty rows.
- Search/filter interactions must remain keyboard and touch usable.
- Filtering must preserve row order and row anatomy; there is no masonry reflow, repeated reveal choreography, or smooth-scroll hijacking.
- At 320 CSS px, each row keeps thumbnail and name visible together, then collapses secondary metadata beneath them.
- Thumbnail and name are co-primary identity cues. Metadata, publication state, and affordances must never visually outrank either one.
- Local review may enable `FAN_V08_RESEARCH_CATALOG=1` and load all canonical research Subjects to test real scale. This mode is explicitly prototype-only and must never be described as the public release.
- Research-only Subjects must never link to a production panda profile. Only a matching active PublicRead panda is navigable as a published profile.
- The full research catalog participates in search and filtering, while list rows render in bounded batches so 960 subjects do not create hundreds of media elements on first paint.
- Research media coverage counts describe the local vault only; they do not communicate publication rights or public media eligibility.

## Visual language

- Warm paper as the browsing ground; deep forest only where photography needs contrast.
- Chinese display uses the scoped Noto Serif SC; body uses Noto Sans SC; English/UI uses Manrope from the V8 layout.
- No repeated eyebrow labels, rounded feature cards, glass panels, decorative metrics, gradient text or icon tiles.
- Hairlines, whitespace, photographic crop and type hierarchy do most of the work.

## Motion

Motion is deliberately minimal. Rows do not reflow theatrically. Hover may use a tiny thumbnail scale and arrow shift; filtering and progressive loading update immediately. Reduced-motion users receive the same information with transitions removed.

## Prototype success criteria

Within a few seconds a visitor should understand: this is a panda list, thumbnail and name are the two primary identity cues, how many pandas are in the review dataset, how to search/filter, and which rows represent published profiles versus research-only prototype records. The page should feel calm, premium, and highly scannable rather than like a gallery, spreadsheet, or SaaS result table.
