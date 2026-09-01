# ZhiPanda Public Experience V0.7

> Status: Active prototype experience map
> Updated: 2026-08-15
> Primary contract: `DESIGN.md`
> Product routes: `docs/product/ZhiPanda_PAGE_SPEC_V0.2.md`

## 1. Purpose

This document tracks how the V0.7 prototype expresses the current ZhiPanda design direction across public and personal surfaces.

The product direction is:

> **A living panda world for panda fans.**
> **Fan-first · Panda-first · Individual-first.**

This file does not replace Page Spec or detailed page specifications. It answers three practical questions:

1. Which important surfaces already have a V0.7 prototype?
2. Which existing prototypes still conflict with `DESIGN.md`?
3. Which missing prototypes should be designed next?

## 2. Reference ownership

| Reference | Primary responsibility in ZhiPanda |
|---|---|
| Vantara | Home hero scale, strong animal photography, Family Story cinematic moments |
| Monterey Bay Aquarium | Return-worthy animal experience, current/live content, animal discovery, related-content loops, place + animals + media |
| Smithsonian National Zoo | Named individuals, institution history, current/historical pandas, family legacy |
| San Diego Zoo | Mature animal information hierarchy and browse patterns |
| Chester Zoo | Animal and place/institution discovery |
| Natural History Museum | Editorial depth and special-topic storytelling |
| WIRED | Editorial hierarchy, hairline structure, dense content without card clutter |
| Notion | Quiet product surfaces and restrained controls |
| Apple | Selective photographic scale and visual focus |
| Family Chart | Tree genealogy geometry and relationship interaction |
| OneZoom | Progressive spatial exploration and gradual disclosure of complexity |

Do not combine all reference aesthetics on every page. Use only the references assigned to the page task.

## 3. V0.7 coverage matrix

| Surface | V0.7 prototype | Current state | Next design action |
|---|---:|---|---|
| Home | Yes | Strong direction | Preserve; refine only after other core surfaces catch up |
| Panda Directory | Yes | Refinement in progress | Make browse/search more prominent than Spotlight |
| Panda Profile | Yes | Strong direction | Next major content-detail polish pass |
| Families index | Yes | Strong direction | Preserve current image/story emphasis |
| Family Story detail | No | Missing | P0 prototype |
| Lineage | Yes | Major redesign in progress | Tree / Pedigree / Fan / List; keep Family Chart Tree geometry |
| Panda Compare | No V0.7 | Missing | P0/P1 prototype |
| Map | Yes | Refinement in progress | Map must become first-class content, not a late module |
| Moments | Yes | Foundation present | Strengthen today/recent/birthday return loop |
| Search | Yes | Appropriate utility direction | Lower-priority polish |
| Institution detail | No | Missing | P0 prototype |
| Place detail | No | Missing | P0 prototype |
| My Pandas | Yes | Refinement in progress | Make it image-led and personal rather than a function dashboard |
| Collections | No V0.7 | Missing | P1 personal prototype |
| Memories | No V0.7 | Missing | P1 personal prototype |
| Games hub | Yes | Strong direction | Preserve |
| Guess Panda | No V0.7 | Missing | P1/P2 prototype |
| Random Panda | No V0.7 | Missing | P2 prototype |
| Contribution | No V0.7 | Missing | P2 support prototype |

## 4. Current design audit

### Home — keep

The current V0.7 Home already matches the product thesis better than older page specifications:

- a panda is the emotional and navigational entry point;
- photography dominates the first impression;
- Family / Places / Time become pathways from an individual rather than feature cards;
- the page feels exploratory rather than database-like.

Avoid rebuilding it while the rest of the product is still catching up.

### Panda Directory — reduce Spotlight dominance

Audit finding:

- the current large Spotlight makes `/pandas` read too much like a single-panda detail page;
- the dark Spotlight block is visually isolated from the rest of the light product surface;
- the “All pandas” scan task starts too late.

Direction:

- keep one optional Spotlight, but make it compact and light;
- keep search/filter controls visible near the top;
- make the multi-panda browse grid enter the page earlier;
- never make the immersive variant the only usable discovery interface.

### Panda Profile — next major content pass

Current V0.7 is directionally strong:

- large correct panda image;
- clear identity;
- chapter-based continuation.

Next pass should follow:

1. Identity
2. Now
3. About
4. Life
5. Family
6. Journey
7. Media
8. Sources

The main question is not “how do we show more fields?” but “how does a fan spend time with this panda and naturally continue exploring?”

### Families index — keep

The current large family-story image and member strip support the fan experience well. Continue toward real Family Story detail pages instead of turning the index into a genealogy dashboard.

### Lineage — distinct reading models

V0.7 now uses four modes:

- Tree
- Pedigree
- Fan
- List

Rules:

- Tree remains Family Chart-driven;
- do not redraw Family Chart core relationship geometry for visual novelty;
- evidence remains secondary disclosure;
- Pedigree and Fan must remain genuinely different reading models;
- List remains the simple structured equivalent.

### Map — map first

Audit finding:

- the interactive map entered too late after intro and large mode cards;
- the page explained implementation details before answering fan questions.

Direction:

- concise fan-facing intro;
- compact mode rail;
- large map/activation field immediately after controls;
- desktop: contextual results + map;
- mobile: map + structured result sheet/list;
- never call an interactive map “live” unless it contains real-time information.

### Moments — build return value

Current page already has strong imagery and time structure. Next design pass should strengthen:

- today / this week / recent;
- upcoming or current birthday anniversaries derived from valid exact dates;
- recently published or newly surfaced moments where the data supports it;
- strong routes from a moment back to panda, family and place.

Do not turn Moments into a social/news feed.

### Search — keep utility-first

Search is allowed to be visually quieter than Home or Profile. Main future work:

- stronger Panda / Institution / Place result distinction;
- richer result preview where it helps recognition;
- no-results discovery path;
- optional recent searches if backed by an honest local/private model.

### My Pandas — personal panda space

Audit finding:

- previous first viewport contained almost no panda imagery;
- six equal destinations made it read like an account feature menu.

Direction:

- show real panda content before account machinery;
- never fake signed-in favorites while signed out;
- make Favorites / Seen / Visited the primary personal tracks;
- keep Games / Notifications / Settings secondary;
- use real private data when signed in;
- statistics remain supporting summaries.

### Games — keep

The current V0.7 Games hub is image-led, fan-facing and clearly separate from research/exploration tools. Continue into real Guess Panda and Random Panda prototype flows rather than redesigning the hub again.

## 5. Next prototype priority

### P0 — complete the core panda world

1. **Institution detail**
   - current pandas;
   - historical pandas;
   - major programme moments;
   - family legacy;
   - place/map path;
   - live/media when real;
   - sources secondary.

2. **Place detail**
   - where this place is;
   - which pandas are connected;
   - what happened there;
   - user visit state;
   - map continuation.

3. **Family Story detail**
   - family identity;
   - generational story;
   - strong member photography;
   - chronology and places;
   - relation evidence available but secondary.

4. **Panda Compare**
   - answer “How are these two pandas related?” first;
   - readable path and common ancestors;
   - evidence only after the relationship is understood.

### P1 — strengthen return loops

1. Moments refinement
2. Collections
3. Memories
4. Guess Panda
5. Map mobile bottom-sheet treatment

### P2 — support experiences

1. Random Panda polish
2. Contribution
3. Search refinements
4. static/support page visual consistency

## 6. Promotion rule

A V0.7 prototype is ready to influence production only when:

- it satisfies `DESIGN.md`;
- it preserves product/data truth from Page Spec;
- it has a complete mobile core journey;
- it does not rely on fake media, fake live state or decorative completeness;
- it uses the correct page register;
- the real rendered result has been visually inspected;
- the new design is demonstrably clearer or more engaging than the current production surface.

## 7. Design review question

For every future public page, finish with one question:

> **Does this help a panda fan enter, understand, remember, or continue exploring the panda world?**

If the answer is unclear, revisit hierarchy and content before adding more UI.
