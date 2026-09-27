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

**Digital Panda Portrait Library.** The photograph is the object rather than content inside a UI card. Cards have no white container, border or dashboard chrome. Portraits use a 4:5 frame and follow the image-led catalogue principle of Chester Zoo's animal directory: the localized name, alternate name and minimal identity context live inside the photograph at its lower edge rather than forming a separate text card beneath it. A restrained local gradient is allowed only to protect text contrast without flattening the photograph. Optional location remains tertiary.

Desktop uses four generous portrait columns, reducing to three before a deliberate two-column mobile composition. Missing-photo records preserve the same portrait geometry with a quiet archival treatment. Remote media uses ordered identity-matched candidates and falls back to the no-photo treatment when every source fails; early portrait images no longer compete aggressively with the hero image for network priority.

The entrance is now a photographic hero rather than a database masthead. One licensed panda image fills the opening scene, then fades naturally into the same deep-teal field used by the search rail and portrait library. The large title remains the only headline; the total panda count is a compact supporting pill instead of a KPI. Search follows immediately in the same color world. Quick filters are intentionally limited to All / Living / With photo; gender, historic status, photo presence, birth-year range and place move into a right-side filter sheet.

The global header follows Chester Zoo's visible desktop composition rather than merely borrowing its hierarchy: one large warm-white rounded navigation bar floats over media with the approved ZhiPanda resting-panda mark, primary destinations, language/My Pandas actions and one acid-lime Find a Panda action. There is no second utility strip, dark full-width bar, circular app-toolbar control, or decorative active underline. Search remains sticky for long-directory browsing; after it, the portrait field begins immediately.

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
