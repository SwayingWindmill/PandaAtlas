---
version: 9
slug: "app-locale-prototype-fan-v08-page-tsx"
primary_target: "app/[locale]/prototype/fan-v08/page.tsx"
related_targets:
  - "features/home/home-community.tsx"
  - "features/home/home-community.module.css"
  - "features/home/home-v09-view-model.ts"
  - "features/home/home-v09-review-model.ts"
  - "components/navbar-1.tsx"
  - "components/command-menu-04.tsx"
---

# Fan V12 Home — Chester-structure Zoo × Panda Community

> **Status: active visual direction.**
>
> V10 "Contemporary Zoological Identity" is rejected for Home because its full-width photography, hard grid, hairline indexes, oversized typography and scene/index sequencing still read as magazine, museum, or editorial-front-page design.

## Mode

**Operate.** Home is the fan's panda hub. The visitor should immediately be able to meet, browse, follow, revisit, and navigate rather than passively read a composed visual essay.

## Design Read

**A premium modern zoo website crossed with a lightweight panda fan community: animal-first, friendly, interactive, visual, current, and return-worthy.**

The feeling should be closer to a well-funded contemporary zoo/aquarium digital product plus a fan collection/community layer than to a museum, magazine, fashion editorial, archive, or campaign microsite.

## Taste dials

- **DESIGN_VARIANCE: 6/10**
- **MOTION_INTENSITY: 4/10**
- **VISUAL_DENSITY: 6/10**

Enough variation to feel designed, but product structure and interaction outrank art-direction theatrics.

## Reference ownership

Primary references for Home:
- **Chester Zoo — primary visual reference:** bold zoo-brand color field, strong animal imagery, horizontally browsable content, rounded entity cards, pill actions, clear "what can I do here?" sections, and mobile-first interaction density;
- Monterey Bay Aquarium — animal-first identity, current animal content, strong photography, useful discovery loops;
- Smithsonian National Zoo — named animals, current/historical animal context, approachable institutional trust;
- San Diego Zoo — mature animal browse patterns and visitor-friendly information architecture;
- Letterboxd — personal collection/return-loop ideas only, without ratings culture or popularity authority.

Chester Zoo is a reference for design principles, not a brand clone. ZhiPanda keeps its own panda-specific palette, typography, data, IA, copy and interaction logic.

Do **not** use as Home visual references:
- M+;
- Rijksmuseum / Rijksstudio;
- MoMA;
- V&A;
- Google Arts & Culture;
- WIRED;
- newspaper/magazine layouts;
- museum collection indexes;
- exhibition catalogues.

Those may remain research references for other surfaces, but they are anti-reference for the Home's visual composition.

## Core product feeling

A fan opens Home and thinks:

- "Which panda do I want to look at?"
- "What happened recently?"
- "Who else is here?"
- "Where can I see pandas?"
- "Who is related to whom?"
- "What did I save last time?"

They should **not** think:
- "This is a publication."
- "This is a museum collection."
- "This is an archive index."
- "This is a design portfolio."
- "This is a landing-page template."

## Home structure

1. **Immersive zoo entrance**
   - use one full-viewport real panda photographic scene as the Home entrance;
   - center one short brand statement and two clear product actions over the scene;
   - this is allowed to use very large display type because it functions as a zoo entrance, not an editorial chapter;
   - embed a horizontally browsable panda carousel into the bottom of the same Hero scene;
   - the carousel must expose real named pandas immediately, so the immersive Hero remains interactive and product-like rather than becoming a campaign poster.

2. **Pandas to explore**
   - recognizable panda cards or tiles;
   - image, name, place/status context;
   - mixed but controlled sizes are allowed;
   - cards must read as animal entities, not marketing features.

3. **What's happening**
   - recent panda updates as a visual feed;
   - image/avatar + panda + concise event/change + date/place;
   - should feel closer to zoo animal updates/community activity than a changelog or news article list.

4. **Family**
   - people should understand relationships at a glance;
   - use portraits/photos where available;
   - relationship visualization may be compact, friendly and interactive;
   - do not turn this into a genealogical research diagram on Home.

5. **Places to see pandas**
   - zoo/center cards or map preview;
   - place photography or linked panda photography;
   - practical place identity first;
   - deeper map is one click away.

6. **My Pandas / return loop**
   - visible and useful, not a giant campaign statement;
   - saved/followed pandas when real private data exists;
   - signed-out state should invite saving without pretending the user has favorites.

7. **Collections / fan paths**
   - compact thematic browse paths;
   - family, recently updated, photo-rich, place-based, stories;
   - secondary to pandas and current activity.

## Visual language

- bold, friendly, modern zoo/aquarium product;
- deep bamboo/forest green may act as the main Home ground instead of white;
- warm ivory/off-white is the primary text/surface counterpoint;
- one bright bamboo-yellow/lime accent is allowed for the most important action and small moments of delight;
- the first viewport may be fully photographic when it also contains immediate actions and panda browsing; do not repeat full-screen photography as the rhythm for later sections;
- medium radii are allowed for panda/place entity cards and controls;
- avoid both extremes: neither zero-radius editorial austerity nor soft rounded-card soup;
- subtle elevation is allowed where it helps interactive hierarchy;
- use grouped surfaces and spatial hierarchy rather than endless horizontal rules;
- typography should feel friendly and contemporary, not editorial;
- one Chester-style oversized brand statement is permitted in the first viewport only; later headings return to product scale.

## Explicit anti-magazine rules

Home must not use:
- hard editorial grids as the primary layout language;
- repeated full-width photography followed by large statement text outside the first immersive zoo entrance;
- long-form chapter pacing;
- oversized 5–6rem section statements as the main rhythm;
- hairline index lists as repeated section templates;
- caption-heavy photography;
- "cover", "front page", "edition", "index", "archive", "collection catalogue" visual metaphors;
- visual hierarchy based mainly on typographic scale and empty space;
- black/white editorial austerity as a shortcut to "premium".

## Premium quality means

Premium here comes from:
- exceptional crops of real panda photography;
- coherent entity-card proportions;
- excellent spacing;
- polished hover/focus/touch states;
- strong hierarchy with giant display type reserved for the first zoo-entrance statement only;
- high-quality micro-interaction;
- clear, useful fan actions;
- consistent iconography;
- thoughtful responsive behavior;
- information that feels alive and current.

It does **not** come from making the site look like a luxury magazine.

## Community feeling

Community should come from real product mechanics:
- My Pandas;
- collections;
- recent panda updates;
- shared family/place discovery;
- optional future contributions or observations when product support exists.

Do not fabricate:
- likes;
- follower counts;
- comments;
- trending;
- popularity;
- "people are watching";
- social proof.

## Hero / first viewport

Desktop:
- use a full-bleed real panda photographic scene behind the first viewport;
- a floating warm-ivory pill navigation sits above the scene;
- one short centered brand statement may reach Chester-like display scale;
- two clear pill CTAs sit directly beneath the statement;
- a 255×350-ish portrait panda carousel is embedded into the bottom of the Hero so real panda entities are browseable before leaving the first scene;
- use a functional dark wash only as needed for text contrast.

Mobile:
- keep the same composition rather than falling back to a generic stacked marketing Hero;
- navigation remains a compact floating ivory capsule;
- brand statement and primary CTA remain visible before the panda carousel;
- carousel cards become wider touch targets around 72–80vw and scroll natively;
- background photography may sit behind text when a contrast wash preserves readability; avoid placing small metadata over the panda's face.

## Panda cards

- real entity cards are encouraged;
- image first, then name and one useful secondary line;
- consistent but not monotonous;
- no generic icon + heading + paragraph feature-card pattern;
- no excessive borders or shadows;
- no tiny metadata overload;
- no substitute imagery.

## Recent activity

Use user-facing language:
- "小奇迹新增了一组近期照片"
- "宝力的家族信息更新了"
- "贝贝现在生活的地点已补充"

Do not expose:
- revision IDs;
- release language;
- schema changes;
- verification workflow;
- "public record updated" as the headline style.

## Places

- feel like zoo discovery;
- names and animals matter more than counts;
- counts can support but should not dominate;
- use map/visitor affordances where useful;
- avoid institutional index-list presentation.

## Motion

- small, purposeful product motion;
- hover/tap feedback on panda and place cards;
- gentle image transitions;
- optional controlled hero/media change when switching pandas;
- no scroll hijacking;
- no cinematic chapter transitions;
- no repeated reveal animation across every section;
- reduced motion retains the full experience.

## Navigation

- product-like and compact;
- brand, Pandas, Families, Places, Stories, Search, My Pandas;
- no editorial section numbering;
- no magazine masthead treatment;
- mobile Sheet remains accessible and direct.

## Responsive commitments

Review at:
- 1440 × 1000;
- 1024 × 768;
- 390 × 844;
- 320 × 760;
- light and dark system themes.

Required:
- zero document-level horizontal overflow;
- zero broken images;
- zero console/page errors;
- exactly one H1;
- primary panda action visible quickly at 320px;
- interactive horizontal regions scroll internally;
- search and mobile navigation fit the viewport;
- no desktop-only composition simply stacked on mobile.

## Craft guardrails

- no magazine/museum/editorial-front-page composition;
- no archive-first language;
- no giant typographic statement sections after the first immersive Hero;
- no repeated index rows separated only by hairlines;
- no card soup;
- no bento-as-default;
- no fake metrics;
- no decorative gradients/glass/glows;
- no generic AI landing-page hero;
- no repeated full-screen photos merely to look premium; the first Hero earns full-screen photography through direct browsing and actions;
- no visual trick that makes panda identity or interaction harder to use.
