# ZhiPanda Public Home V0.9 — Content & Visual Strategy

> Status: Implemented prototype / active review
> Date: 2026-09-21
> Scope: Public Home only
> Process: Taste Skill redesign audit → reference study → content strategy → visual direction → mood reference → block sourcing → implementation
> Important: The current prototype Home visual direction is rejected and is not a compatibility target.

## 1. Design Read

**Reading this as: a public discovery homepage for panda fans, with the information richness of a living cultural archive and the browsing energy of a fan collection product — not a landing page, not a single-panda feature article, and not a database dashboard.**

The Home must make three impressions quickly:

1. **There is a lot here.** This is a real panda world, not one hero image and a few cards.
2. **I can enter from many angles.** Panda, family, place, time, recent changes, curated stories, or My Pandas.
3. **The site knows what it is talking about.** Names, images, relations, places, and changes come from public records, not marketing copy.

## 2. Taste dials for planning

- **DESIGN_VARIANCE: 8/10**
  - The Home needs an authored front-page composition rather than a sequence of interchangeable blocks.
- **MOTION_INTENSITY: 4/10**
  - Motion should support navigation, image browsing, and continuity. No cinematic scroll theatre.
- **VISUAL_DENSITY: 7/10**
  - The previous prototypes were too empty. This Home should reveal useful content immediately while keeping hierarchy clear.

This is deliberately denser than the previous V8.5 Home.

## 3. What the previous attempts got wrong

### Attempt A: cinematic dark Home

Problem:
- treated Home like a single panda documentary;
- too much page height spent on one narrative;
- dark forest visual language overpowered the product;
- family / journey / moments became staged scenes rather than useful product entrances;
- looked like a brand campaign rather than a living archive.

Retire:
- full-page dark theme;
- full-screen photographic hero;
- serif/editorial theatre;
- long sequential “one panda opens the world” narrative;
- decorative route animation as a Home chapter.

### Attempt B: light block-based discovery Home

Problem:
- structurally cleaner but content-thin;
- generic Hero → Carousel → Marquee → CTA rhythm;
- obvious registry-block seams;
- family, place, revisions, and stories disappeared from the Home;
- felt like a polished template instead of PandaAtlas.

Retire:
- conventional marketing Hero as the main composition;
- carousel as the only substantial archive content;
- marquee as a substitute for information;
- empty-space-as-premium logic;
- CTA-heavy ending.

## 4. Reference study

### 4.1 M+ — the Home is an institutional front page

Reference:
- https://www.mplus.org.hk/en/
- https://www.mplus.org.hk/en/magazine/web-design-is-visual-culture/

What matters:
- the Home presents multiple live content streams: exhibitions, events, magazine, collection;
- the site is designed as the institution’s own digital home, not a generic museum template;
- visual identity and information density coexist;
- the Home behaves like a cover / index for a much larger world;
- deeper pages are expected to carry the same identity, so Home does not need to explain everything.

Use for PandaAtlas:
- Home should simultaneously expose pandas, families, places, recent changes, and editorial collections;
- sections may have different visual rhythms without looking like separate SaaS components;
- “Today in PandaAtlas” can act like the front page of a living archive.

Do not copy:
- M+ colour chaos;
- museum event/ticket patterns.

### 4.2 Rijksmuseum / Rijksstudio — archive + stories + personal collections

References:
- https://www.rijksmuseum.nl/en/collection
- https://www.rijksmuseum.nl/en/explore-the-collection/
- https://www.rijksmuseum.nl/en/collection/tell-your-story

What matters:
- the collection homepage mixes Discover, artworks, visitor stories, thematic exploration, and personal sets;
- it does not force all objects into one uniform grid;
- the same database supports both authoritative collection access and playful/user-created exploration;
- “Tell your story”, “Art Explorer”, and saved sets turn an archive into something people return to.

Use for PandaAtlas:
- combine authoritative panda records with curated collections and My Pandas;
- provide multiple entry modes rather than only search or alphabetical directory;
- allow editorial sets such as family lines, places, eras, and return stories.

### 4.3 MoMA / V&A — serious records can still be approachable

References:
- https://www.moma.org/collection/about/
- https://www.vam.ac.uk/info/explore-the-collections

What matters:
- MoMA explicitly treats the collection as evolving and provides different browse modes such as on-view and recently added;
- V&A combines working catalogue records with curated collections;
- V&A object pages combine catalogue information, curatorial knowledge, and editorial storytelling;
- incomplete records are normal and are not hidden behind fake completeness.

Use for PandaAtlas:
- show “recently updated” and “newly published” as legitimate discovery modes;
- keep uncertainty and incomplete records honest;
- profile data and editorial stories should reinforce each other rather than live as separate products.

### 4.4 Letterboxd — make a database feel alive

References:
- https://letterboxd.com/welcome/
- https://letterboxd.com/films/
- https://letterboxd.com/lists/popular/

What matters:
- database browsing is mixed with popular activity, lists, personal state, and community context;
- Lists provide editorial and user-made ways to reframe the same underlying catalogue;
- signed-in Home changes from static discovery into a return loop;
- users can browse by many dimensions without first knowing an exact title.

Use for PandaAtlas:
- curated panda collections should be a first-class concept;
- My Pandas should eventually change the Home for returning users;
- “recently updated”, “family story”, and “places” can work like content feeds without ranking pandas by popularity.

Do not copy:
- rating culture;
- popularity ranking as a primary authority signal;
- social metrics unless PandaAtlas intentionally builds community features.

### 4.5 iNaturalist — search across entity types

Reference:
- https://help.inaturalist.org/en/support/solutions/articles/151000170804-how-to-use-the-inaturalist-website-header-search

What matters:
- a single search surface can return different entity types: taxa, users, places, projects;
- people can choose between exploring observations and reading entity information;
- search expresses the product’s information model.

Use for PandaAtlas:
- future global search should understand pandas, families/stories, places, institutions, and curated collections;
- Home search should expose entity types instead of behaving like a plain panda-name field.

### 4.6 Google Arts & Culture — discovery breadth

References:
- https://artsandculture.google.com/
- https://artsandculture.google.com/explore
- https://artsandculture.google.com/project

What matters:
- a single Home contains today’s picks, categories, themes, places, time, colour, collections, editorial, experiments, and recommendations;
- discovery is continuously re-framed;
- content richness is the visual identity.

Use for PandaAtlas:
- one Home can support panda, family, place, time, stories, and personal collections without becoming a dashboard;
- the difference is editorial grouping and visual hierarchy, not fewer modules.

Risk:
- too many disconnected modules can become chaotic; PandaAtlas needs fewer, stronger content streams.

## 5. Product content model available today

The current public data layer already exposes enough information for a richer Home.

### PublicAtlasDataset

Available:
- pandas;
- facilities / institutions;
- places.

Each PandaDetail can include:
- Chinese / English names;
- sex;
- life status;
- birth date;
- current coarse/public location;
- licensed cover media;
- intro / localized summaries;
- father / mother IDs;
- media;
- current place;
- residency history;
- life events;
- public revision summaries;
- verification/source metadata.

### Existing public experience data

Also available in the current product:
- family stories;
- family story members;
- family story events;
- family relationship assertions;
- public moment occurrences.

Caution:
- Home production use must respect the current PublicRead boundary;
- family-story data that is not part of the active V2 envelope must be verified before it becomes production Home content.

## 6. New Home job

The Home is not “a hero followed by sections”.

It is:

> **the current front page of the panda world.**

Every visit should answer some combination of:

- What is worth looking at today?
- Which pandas can I start with?
- What changed recently?
- What families are interesting?
- Which places connect many pandas?
- What curated stories or collections can I explore?
- Where can I search the full archive?
- What should I return to?

## 7. Proposed information architecture

### 01 — Global navigation

Purpose:
- stable product navigation, not visual spectacle.

Desktop:
- brand;
- Pandas;
- Families;
- Places / Map;
- Stories / Moments;
- search;
- My Pandas;
- locale.

Visual rule:
- mostly text;
- no row of outlined/filled CTA boxes;
- search is an icon / expandable command surface;
- My Pandas may have one subtle identity treatment, not a marketing button.

Mobile:
- full-screen or large-sheet index;
- show entity categories and optional public counts where truthful;
- behave like a mini sitemap, not a generic hamburger list.

### 02 — Today in PandaAtlas

Purpose:
- create a strong first screen without falling back to a marketing Hero.

Layout:
- asymmetric 12-column editorial front page;
- one lead item occupying roughly 7–8 columns;
- 2–3 secondary current items occupying the remaining space.

Lead item candidates:
- a panda with newly published information;
- a meaningful recent life event;
- an editorial family story;
- a curated story with a strong licensed image.

Secondary item types:
- recently updated panda;
- family story;
- place with meaningful panda connections;
- today / this month anniversary when semantics are safe.

Rules:
- no generic brand headline;
- title should be content, for example “美香家族的四个公开档案” rather than “认识熊猫，不只记住名字”;
- no invented “trending” or “popular” labels;
- no photo-overlay text covering panda faces.

Data:
- public_revision summaries;
- events;
- family stories;
- places / residency counts;
- licensed public media.

Fallback:
- if no recent revision/event is usable, use a deterministic editorial feature candidate from the public release.

### 03 — Explore Pandas

Purpose:
- immediately expose the archive itself.

Content:
- 8–12 panda records;
- not all equal-size cards;
- mix image-forward entries with compact text entries;
- at least one no-image state if that honestly reflects the release.

Selection should diversify:
- era;
- place/institution;
- sex when known;
- family depth;
- image availability;
- current/historical record type.

Do not:
- rank by popularity unless the product has real popularity data;
- use ratings, scores, fake badges, or “top panda”.

Primary action:
- open full Panda Directory.

### 04 — Recently in the Atlas

Purpose:
- make the database feel alive.

Content:
- latest 5–8 public revisions or verified additions;
- panda name;
- concise public revision summary;
- date / last verified label;
- optional thumbnail.

Presentation:
- editorial change log / newswire;
- not cards;
- strong date/name rhythm.

Data:
- PandaDetail.public_revision;
- latest verified source/conclusion timestamps.

Important:
- show fan-facing change summaries only;
- do not expose release IDs, audit IDs, or curation machinery.

### 05 — Family story

Purpose:
- expose PandaAtlas’s strongest differentiated relationship data.

Content:
- one selected published family story;
- 3–6 real members;
- clear confirmed relation labels;
- one event/story hook;
- CTA to full Family / lineage view.

Possible visual form:
- one strong photograph + horizontal lineage strip;
- or a compact relationship diagram integrated with portraits.

Do not:
- show speculative relationships as confirmed;
- render a family section when the story data is too sparse.

### 06 — Places

Purpose:
- demonstrate that pandas exist across a meaningful geographic history.

Content:
- 3–5 places/institutions with public data;
- count of related published pandas only when computed from PublicRead;
- representative pandas;
- historical/current wording based on data precision.

Possible visual form:
- map crop + place index;
- or large place names with small panda strips.

Do not:
- fake precise coordinates;
- imply “current” from stale residency data.

### 07 — Curated collections / stories

Purpose:
- turn the archive into editorial discovery.

Examples:
- 华盛顿的大熊猫;
- 海外出生的一代;
- 2020 年出生;
- 美香家族;
- 亚特兰大家族;
- 回到中国之后;
- 有公开影像的历史档案;
- 同一地点的几代熊猫.

Production model:
- create an explicit editorial collection configuration that references public panda/place/family IDs or safe query rules;
- never hard-code prose that can drift away from published data.

Prototype:
- may define reviewed curated collections using currently published records.

### 08 — Explore the archive

Purpose:
- serve users who know what they want.

Search model:
- pandas;
- families / family stories;
- places;
- institutions;
- curated collections.

Inspiration:
- iNaturalist multi-entity search;
- MoMA/V&A archive search.

Near-term:
- if dedicated global search is not ready, use the Panda Directory search plus direct links to Families and Map.

### 09 — My Pandas / return loop

Signed out:
- explain the value of saving/following pandas;
- one clear action.

Signed in:
- show real followed/favorite pandas;
- surface recent changes to those pandas;
- no generic CTA copy if the user already has personal state.

Long-term:
- this becomes a Letterboxd/Rijksstudio-style reason to return.

### 10 — Footer

Purpose:
- sitemap and trust access.

Include:
- Pandas;
- Families;
- Map / Places;
- Moments / Stories;
- My Pandas;
- Sources / methodology;
- contribute / corrections;
- locale.

No giant marketing CTA.

## 8. Homepage data feasibility matrix

| Module | Can prototype now | Production-ready data | Additional work |
| --- | --- | --- | --- |
| Today lead story | Yes | Mostly | Need deterministic selector + editorial override |
| Recently updated | Yes | Yes | Home-specific formatting only |
| Panda exploration | Yes | Yes | Better diversified selection algorithm |
| Family spotlight | Yes | Verify boundary | Ensure family stories align with active PublicRead |
| Places spotlight | Yes | Yes | Aggregate related-public-panda counts safely |
| Curated collections | Yes | Not yet as first-class content | Add editorial collection config/model |
| Multi-entity search | Partial | Partial | Dedicated cross-entity search surface |
| My Pandas return feed | Partial | Personal state exists | Home integration / signed-in view model |

## 9. Selection algorithms

### 9.1 Today lead

Hard requirements:
- public record;
- usable title in locale;
- licensed media when image-led;
- at least one meaningful continuation route;
- no disputed state presented as fact.

Ranking signals:
1. meaningful recent public revision/event;
2. editorial family story availability;
3. place history depth;
4. licensed media quality;
5. rotation diversity;
6. stable daily selection.

Add an editorial override later, but never allow it to bypass public-data and media rules.

### 9.2 Explore Panda selection

Build a deterministic set that maximizes diversity instead of popularity.

Suggested scoring:
- different institutions/places;
- different birth decades;
- mix of male/female/unknown only as data permits;
- mix of rich/sparse/historic profiles;
- avoid more than two from one family unless the section is explicitly family-themed;
- minimum number with licensed images;
- optionally include one honest no-image record.

### 9.3 Recent updates

Sort:
1. latest verified/public revision date;
2. slug for deterministic tie-break.

Show:
- public-facing revision summary;
- panda name;
- localized date.

Never show:
- internal data version;
- Curation state;
- audit metadata.

### 9.4 Place selection

Prefer:
- places connected to multiple published pandas;
- places with localized names;
- places with meaningful historic/current residency coverage.

Expose counts only after computing from the current public release.

## 10. Three visual directions

### Direction A — Cultural Index

Reference family:
- M+;
- Google Arts & Culture;
- high-quality cultural front pages.

Layout:
- dense asymmetric front page;
- large lead story + stacked secondary items;
- mixed image scales;
- section titles behave like editorial index labels;
- content modules can touch or align tightly instead of floating inside cards;
- strong typographic grid;
- images carry visual colour.

Feels:
- alive;
- contemporary;
- distinctive;
- content-rich.

Risk:
- can become noisy if hierarchy is weak.

Best fit:
- **strong candidate**.

### Direction B — Living Archive

Reference family:
- MoMA;
- V&A;
- The Met;
- iNaturalist.

Layout:
- calmer;
- more structured;
- strong search/index behavior;
- clear columns, rules, lists, metadata;
- image moments interrupt a disciplined information system;
- recent updates and browse facets are prominent.

Feels:
- authoritative;
- modern;
- useful;
- trustworthy.

Risk:
- can feel institutional or dry if photography and editorial voice are too restrained.

Best fit:
- strong foundation for deeper archive surfaces.

### Direction C — Fan Collection Network

Reference family:
- Letterboxd;
- Rijksstudio.

Layout:
- panda portraits, curated sets, family sets, saved lists, recent activity;
- stronger personal-state presence;
- more dense grids and user-return patterns;
- “collections” become major navigation objects.

Feels:
- addictive to browse;
- fan-native;
- personal;
- alive.

Risk:
- can over-socialize the product before community/personal-state features are mature;
- popularity metaphors can undermine archival trust.

Best fit:
- selective layer, not the full visual identity today.

## 11. Recommended direction

Use a new **Direction D — Editorial Atlas Front Page**.

It is not a neutral average of A / B / C.

It deliberately keeps:
- Direction A's asymmetric editorial hierarchy and image rhythm;
- Direction B's recent-update, family, place, and archive-search information structure;
- only a small amount of Direction C's personal-return behavior.

It deliberately rejects:
- A's campaign-style oversized hero treatment;
- B's dashboard-like stat band;
- C's repeated rounded cards and dense component-library seams.

In plain language:

> **M+ front-page energy + MoMA/V&A archive discipline + Letterboxd/Rijksstudio return loops, expressed as one continuous PandaAtlas editorial grid.**

The Home should not look like a museum website, and it should not look like a premium component demo. It should have the content confidence of a serious archive and the browsing energy of a fan product.

Recommended balance:
- 60% Cultural Index;
- 35% Living Archive;
- 5% Fan Collection Network.

### Direction D visual commitments

- no conventional marketing Hero;
- first viewport is already real content;
- one lead story/image occupies roughly 7–8 columns;
- the right rail carries 2–3 current archive entries without enclosing each in a card;
- section transitions are made by grid, rules, whitespace, and image scale rather than rounded containers;
- Explore Pandas uses mixed spans and at least one text-led/no-image record;
- Recently in the Atlas is a list/newswire;
- Family is one strong image plus a relation strip, not a family card;
- Places is a map/index composition, not a row of place cards;
- Curated Collections can use image tiles but should read as editorial sets;
- search is a serious archive tool, not a decorative input;
- My Pandas is a compact return surface, not the emotional climax of the page.

## 12. Recommended desktop wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ZHIPANDA   Pandas  Families  Places  Stories                    Search  My │
├──────────────────────────────────────────────────────────────────────────────┤
│ TODAY IN PANDAATLAS                                                        │
│                                                                              │
│ ┌────────────────────────────────────────────┐  ┌──────────────────────────┐ │
│ │                                            │  │ RECENTLY UPDATED         │ │
│ │          LEAD STORY / PANDA IMAGE          │  │ Fu Bao                   │ │
│ │                                            │  │ + new public media       │ │
│ │                                            │  ├──────────────────────────┤ │
│ └────────────────────────────────────────────┘  │ FAMILY STORY             │ │
│ Lead title                                    │  │ Mei Xiang family         │ │
│ 2-line factual deck                           │  ├──────────────────────────┤ │
│                                               │  │ PLACE                    │ │
│                                               │  │ Washington               │ │
│                                               │  └──────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ EXPLORE PANDAS                                                View all →   │
│                                                                              │
│ [large portrait] [portrait] [text entry] [portrait] [portrait]              │
│ [text entry]    [wide portrait]          [portrait] [no-image archive]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ RECENTLY IN THE ATLAS                                                       │
│ 21 Sep   熊猫名        更新摘要                                   →          │
│ 18 Sep   熊猫名        更新摘要                                   →          │
│ 14 Sep   熊猫名        更新摘要                                   →          │
│ 08 Sep   熊猫名        更新摘要                                   →          │
├──────────────────────────────────────────────────────────────────────────────┤
│ FAMILY STORY                                                                │
│ [large image]     Mei Xiang ── Bao Bao ── Bao Li                            │
│                   relation / story copy                         Family →     │
├──────────────────────────────────────────────────────────────────────────────┤
│ PLACES                                                                      │
│ [map / geographic visual]       Washington      Chengdu       Atlanta       │
│                                12 pandas        18 pandas     9 pandas       │
├──────────────────────────────────────────────────────────────────────────────┤
│ CURATED COLLECTIONS                                                         │
│ Washington generations     Born in 2020     Returned to China     ...       │
├──────────────────────────────────────────────────────────────────────────────┤
│ EXPLORE THE ARCHIVE                                                         │
│ [ Search pandas, families, places, collections...                       ]    │
│ Pandas · Families · Places · Recently updated                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ MY PANDAS / PERSONAL RETURN LOOP                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Footer                                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 13. Mobile wireframe

```text
┌─────────────────────────────┐
│ ZHIPANDA            Search ☰│
├─────────────────────────────┤
│ TODAY IN PANDAATLAS         │
│                             │
│ [ lead image 4:3 ]          │
│ Lead title                  │
│ short factual deck          │
│                             │
│ Recently updated →          │
│ Family story →              │
│ Place →                     │
├─────────────────────────────┤
│ EXPLORE PANDAS              │
│ [portrait][portrait]        │
│ [wide portrait]             │
│ [text] [portrait]           │
├─────────────────────────────┤
│ RECENTLY IN THE ATLAS       │
│ 21 Sep  Name                │
│ summary                     │
│ ─────────────────────────── │
│ 18 Sep  Name                │
├─────────────────────────────┤
│ FAMILY STORY                │
│ [image]                     │
│ relation strip →            │
├─────────────────────────────┤
│ PLACES                      │
│ [map crop]                  │
│ place index                 │
├─────────────────────────────┤
│ COLLECTIONS                 │
│ horizontal editorial sets   │
├─────────────────────────────┤
│ SEARCH THE ARCHIVE          │
│ [search]                    │
├─────────────────────────────┤
│ MY PANDAS                   │
├─────────────────────────────┤
│ Footer                      │
└─────────────────────────────┘
```

## 14. Visual rules for the next design pass

### Typography
- modern sans display;
- avoid default “premium serif” shortcut;
- large type is allowed only where content deserves it;
- metadata and dates can use compact mono/tabular numerals sparingly.

### Colour
- let panda photography provide most colour;
- neutral base;
- one unmistakable PandaAtlas accent;
- avoid warm beige luxury cliché and previous dark-forest wash.

### Grid
- 12-column desktop editorial grid;
- 4-column mobile;
- sections can use different spans, but share one underlying grid;
- avoid every section becoming a centered max-width card.

### Images
- multiple scales on the same screen;
- captions and metadata normally sit adjacent/below, not over faces;
- images should sometimes bleed to grid edges;
- no gratuitous rounded rectangle on every image.

### Containers
- prefer rules, alignment, whitespace, and image boundaries;
- cards only when the content is truly a self-contained object;
- recent updates should be a list;
- place index should be a list/map composition;
- collections may be image tiles.

### Motion
- navigation/search transitions;
- carousel/drag only when needed;
- light reveal;
- map/family transitions only where meaningful;
- no infinite decorative motion on the primary reading path.

## 15. Block-sourcing rule for implementation

Before coding each generic module:
1. search shadcn official registry;
2. search configured registries;
3. inspect source;
4. install the closest block through shadcn CLI;
5. adapt content/tokens;
6. reject a block if its inherent layout fights the PandaAtlas design.

Do **not** choose the information architecture based on which blocks happen to exist.

Blocks to source rather than hand-write:
- global navigation / mobile menu;
- global search / command;
- image gallery / masonry;
- carousel when a carousel is actually needed;
- tabs / filters;
- dialogs / sheets;
- footer;
- generic empty/loading states.

PandaAtlas-specific composition may remain project-level:
- Today in PandaAtlas selection logic;
- family relationship visualization;
- place/panda data projection;
- recent revision formatter;
- curated collection projection.

Those are domain modules, not generic UI blocks.

## 16. Implementation phases

### Phase 1 — content projection
Create a Home view model that produces:
- lead story;
- secondary current items;
- diversified pandas;
- recent revisions;
- family spotlight;
- place spotlight;
- editorial collections.

No visual implementation until this projection is testable.

### Phase 2 — visual reference / mood
Produce 2–3 high-fidelity Home direction frames using the recommended A+B hybrid.

Focus only on:
- first 2.5 viewports;
- typography;
- grid;
- image rhythm;
- navigation.

### Phase 3 — block sourcing
Search/install blocks that match the approved frame.

### Phase 4 — implementation
Build the Home from the data projection + sourced blocks.

### Phase 5 — Impeccable
Run layout/type/polish audits.

### Phase 6 — browser visual QA
Verify:
- 1440;
- 1024;
- 390;
- 320;
- reduced motion;
- image loading;
- keyboard search/navigation;
- real data/fallback behavior.

## 17. Success criteria

The redesign is successful when:

- a first-time visitor can see at least four different ways to enter the panda world within the first two viewports;
- the first screen contains real content, not generic product positioning copy;
- Home visibly changes as public records/revisions change;
- the page has substantially more information than the current prototype without feeling like a dashboard;
- family/place/revision data appear as first-class product content;
- the visual system cannot be mistaken for a generic shadcn/Hex/Kokonut demo;
- no module exists solely because a registry block was available;
- the same content architecture can scale from dozens to hundreds of published pandas.
