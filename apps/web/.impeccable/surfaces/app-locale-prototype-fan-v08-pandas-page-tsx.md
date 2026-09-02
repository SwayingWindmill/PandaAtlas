---
version: 2
slug: "app-locale-prototype-fan-v08-pandas-page-tsx"
primary_target: "app/[locale]/prototype/fan-v08/pandas/page.tsx"
related_targets: ["app/[locale]/prototype/fan-v08/pandas/directory-explorer.tsx","app/[locale]/prototype/fan-v08/pandas/directory.module.css","app/[locale]/prototype/fan-v08/pandas/react-bits-directory.tsx","app/[locale]/prototype/fan-v08/pandas/research-catalog.ts","app/[locale]/prototype/fan-v08/prototype.module.css","app/[locale]/prototype/fan-v08/visual-fixtures.ts"]
---

# Fan V8 Panda Directory

## Scope and mode

Visitor mode: **Experience + Explore**. This is a panda portrait library for ordinary fans, not an administrative catalogue, spreadsheet, zoo species grid or SaaS card wall.

## Audience and job

A fan arrives to find a known name, browse faces until one catches their attention, or continue discovering after another panda profile. The page must stay enjoyable and fast with roughly one thousand partial individual records.

## Primary action

Recognize an individual through face and name, then open a published profile when one is available.

## Chosen direction

**Digital Panda Portrait Library.** The photograph is the object rather than content inside a UI card. Cards have no white container, border or dashboard chrome. Portraits use a 4:5 frame, localized names sit directly beneath the image, alternate names and a minimal identity line recede, and optional location is last.

Desktop uses four generous portrait columns, reducing to three before a deliberate two-column mobile composition. Missing-photo records preserve the same portrait geometry with a quiet archival typographic treatment.

The masthead contains only the page title and total count. Prototype disclaimers, publication counts, media-coverage explanations, repeated section introductions and research badges stay out of the fan-facing visual layer. Search and fast filters remain sticky; after them the portrait field begins immediately.

## Motion language

React Bits-style primitives are the shared interaction language, implemented locally on the existing Motion runtime:

- **Animated Content** for the masthead and discovery control entrance.
- **Count Up** for the total.
- **Spotlight Card** moves light across the portrait itself, not across a white component shell.
- **Pill Nav-style active indicator** provides filter-state continuity.
- Portrait crop zoom, tiny name movement and a restrained profile-arrow reveal finish the hover response.

No repeated entrance choreography runs across all 60 visible portraits. Reduced-motion removes nonessential transitions. No bounce, elastic easing, chromatic effects or 3D spectacle may compete with the panda.

## Constraints

- Every image must belong to the panda it labels; never substitute another panda.
- Do not infer popularity or rankings.
- Unknown metadata is omitted.
- Research-only subjects never link to production profiles, but internal publication/research mechanics do not need a badge on every portrait.
- `FAN_V08_RESEARCH_CATALOG=1` is a local scale-review data source and does not change the fan-facing visual language.
- Search and filters operate over the complete dataset while cards render in bounded batches of 60.
- At 320 CSS px the page remains two columns with no horizontal overflow.
- Keyboard, touch, focus-visible and reduced-motion behavior remain shipping states.

## Success criteria

The first impression should be a field of named panda portraits, not a collection of UI components. At 1440 CSS px each portrait should have materially more presence than the previous five-column card version; at 390 and 320 CSS px two portraits remain visible across the row. Search and filters stay obvious without becoming the visual subject.
