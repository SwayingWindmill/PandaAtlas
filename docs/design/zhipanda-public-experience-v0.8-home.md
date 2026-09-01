# ZhiPanda Public Experience V0.8 — Fan-first Home

> Status: Proposed implementation baseline
> Date: 2026-09-01
> Scope: Public Home first, then shared fan-first patterns
> Design source: recovered V0.7 `fan-v07` prototype
> Runtime source of truth: current V2 Publication / PublicRead only

## 1. Product position

ZhiPanda's public product is for ordinary panda fans first.

The public experience should feel like entering a living panda world, not opening a research database. The professional evidence, curation, revision and publication systems remain essential, but they support the public experience rather than visually dominate it.

The V0.8 north star is:

> **Start with one panda. Stay for its family, places, moments and the next panda.**

The primary public loop is:

`Panda → story → family → place → moment → another panda → My Pandas`

Search remains a first-class utility, but it is not the emotional identity of Home.

## 2. Why V0.7 is the correct visual baseline

The recovered `fan-v07` Home has the strongest alignment with the product goal because it does four things that the current production Home does less effectively:

1. **A real panda dominates the first impression.** The first viewport is a full-bleed panda image rather than a text/search layout with a secondary visual.
2. **One panda becomes a narrative spine.** Family, places and time are continuations of an individual rather than equal feature cards.
3. **The page creates visual rhythm.** Full-screen photography, quiet editorial sections, map, panorama and return-value sections feel like one journey.
4. **It gives fans a reason to continue.** The page ends in updates, favorites/seen/visited and games rather than in methodology.

V0.8 should therefore evolve V0.7 instead of redesigning Home from zero.

## 3. What changed since V0.7

V0.7 was built against an older Web/runtime boundary. Its product ideas remain useful, but several implementation assumptions are retired:

- old map/public-release adapters;
- old lineage view models;
- direct prototype routes;
- dependencies such as `motion`, `gsap`, `deck.gl`, `family-chart` and older carousel code used by the prototype;
- static preferred panda lists as the main selection strategy;
- prototype-only route names;
- direct assumptions that a cover image or current location is automatically safe to present without current PublicRead semantics.

V0.8 must reproduce the visual language with the current V2 architecture, not resurrect the old implementation stack.

## 4. Planning data snapshot

The latest research audit discussed for this planning pass indicates approximately:

| Research capability | Planning snapshot |
|---|---:|
| Canonical panda subjects collected | 960 |
| Subjects with direct evidence | 937 |
| Subjects with no direct evidence yet | 23 |
| Subjects with confirmed individual image candidates | 785 |
| Subjects without confirmed individual image candidates | 175 |
| Life status available | 527 |
| Birth information available | 366 |
| Sex available | 460 |
| Origin / birthplace available | 473 |
| Current-location information currently usable | 174 |
| Current-location information considered stale | 144 |
| Parentage information available | 171 |
| Studbook / external identifier available | 127 |
| High-impact facts with corroboration | 791 |

These are **research-planning numbers, not public claims**. They must be recomputed before implementation milestones and must never be displayed on the public site unless the corresponding records are in the active Publication Release.

The product implication is more important than the exact counts:

- incomplete records are normal;
- no-image records are normal;
- historical records are normal;
- family data is valuable but not universal;
- current location cannot be assumed for every panda;
- Home must scale from tens to hundreds of published pandas without becoming a grid catalogue.

## 5. Public-data rule

Home may read only the active V2 PublicRead release.

It must not read:

- local research JSON;
- unreviewed acquisition data;
- Curation drafts;
- unpublished recommendation bundles;
- old V1/static-release fallback data;
- hidden browser-only shadow indexes.

Therefore:

- if PublicRead contains 39 pandas, Home says 39 published panda profiles;
- if a later release contains 400 pandas, Home says 400;
- the research inventory of 960 is never silently substituted for the published count.

## 6. V0.7 audit: preserve / upgrade / retire

### 6.1 Preserve almost unchanged

#### A. Full-viewport panda hero

Keep the basic V0.7 composition:

- approximately one viewport tall;
- licensed panda photo fills the frame;
- restrained dark gradient for text contrast;
- floating/overlay navigation;
- one short emotional headline;
- primary CTA to the featured panda;
- secondary CTA to meet another panda;
- small identity block anchored to the image;
- current published-panda count as supporting context.

The hero should feel photographic, not like a card with a large border radius.

#### B. “Start with one panda” narrative thread

Keep the editorial transition from hero into a quiet light section that explains the selected panda through a few meaningful life moments.

Do not show a database field table here.

#### C. Cinematic family scene

Keep a large photographic family transition when the selected panda has enough published relationship data to support it.

This is one of V0.7's strongest fan-facing ideas.

#### D. Journey / place continuation

Keep the principle that a panda's places are a story, not just pins.

#### E. Large panda panorama

Keep a visually generous multi-panda discovery band. This is where the page expands from one panda to the larger world.

#### F. Return-value ending

Keep recent updates and My Pandas near the end of Home. Home should finish with a reason to come back, not with technical release metadata.

### 6.2 Upgrade

#### A. Featured-panda selection

V0.7 used hard-coded preference lists. V0.8 needs a data-driven, deterministic selector over the active PublicRead release.

A Home hero candidate must satisfy all required conditions:

1. published in current release;
2. has a usable licensed hero image;
3. has a stable public profile route;
4. has a displayable name in the current locale or approved fallback;
5. is not withdrawn/restricted;
6. has at least one meaningful continuation path: family, life event or place history.

Candidates may then be ranked with soft signals:

- useful family depth;
- useful journey depth;
- meaningful recent/public event;
- upcoming exact birthday anniversary;
- profile freshness;
- variety across institutions/regions/eras;
- under-exposure in recent Home rotations.

The choice should be stable for a defined period, preferably daily, so SSR, screenshots and sharing are deterministic. It must not be personalized in a way that changes canonical page content.

An editorial override can exist later, but it must point to a valid published candidate and must not bypass media/data rules.

#### B. Hero copy

V0.7 copy is directionally right but can be shorter.

Recommended Chinese structure:

- headline: `从一只熊猫，走进整个世界。`
- lead: one short line about family / places / moments;
- CTA: `认识{熊猫名}`
- secondary: `换一只看看`

Do not put source policy, release versions, search instructions or methodology in the hero.

#### C. Search placement

Search remains globally important, but it should move below the first immersive sequence instead of competing with the hero image.

Target route after #347:

`/{locale}/search?q=...`

Until #347 is implemented, the production slice may retain the current Panda-directory query route, but the V0.8 contract should target the dedicated Search surface.

#### D. Family scene rules

The family scene is conditional.

Render it only if the featured panda has enough published relation data to make the section meaningful, for example:

- at least one confirmed parent/child/sibling continuation; and
- at least one related published profile.

Tentative/disputed relationships may appear only with clear status language. The cinematic treatment must never make a tentative relation look confirmed.

If family data is too sparse, skip this scene rather than rendering an empty family module.

#### E. Journey scene rules

Do not label a place as current when only stale/historical location evidence is available.

Use wording by state:

- current, sufficiently verified: `现在` / current;
- historical: date range;
- stale last-known state: `最后一次公开记录` / last published record;
- coarse location: show the coarse level honestly;
- no location: omit journey detail or show a discovery link, not a fake map pin.

The Home map is a preview. The full Map surface owns complex spatial exploration.

#### F. Panorama implementation

Keep the visual effect but prefer native horizontal scrolling / CSS scroll snap and small client islands over restoring old carousel dependencies.

Requirements:

- works with keyboard;
- normal vertical page scrolling remains stable;
- touch users can swipe naturally;
- no mandatory autoplay;
- reduced-motion mode removes decorative motion;
- cards preserve correct individual identity and media provenance.

#### G. Recent updates

Use publication-backed revision/event data only.

The section should answer fan questions:

- which panda changed;
- what was added or updated;
- when the information was verified/published;
- where to continue.

Do not expose audit IDs or internal release machinery in the main visual hierarchy.

#### H. My Pandas

Use real personal state only.

Signed-out state:

- may invite the user to use My Pandas;
- must not pretend they already have favorites/seen/visited data.

Signed-in state:

- show actual favorite/seen/visited pandas with imagery where licensed;
- prioritize panda content before settings/account controls.

### 6.3 Retire from Home

#### A. Image sphere as the primary hero

The current rotating image sphere is visually novel but weakens the single-panda narrative and makes Home feel like an interactive demo. It should not remain the primary Home visual in V0.8.

It may be retired entirely or reused later in a dedicated playful discovery surface if it proves useful.

#### B. Four equal featured-panda cards immediately after hero

A four-card catalogue block directly after the hero duplicates the Panda Directory and breaks V0.7's continuous narrative.

V0.8 replaces it with the featured panda's story thread, then expands to multiple pandas later through the panorama.

#### C. Large methodology section near the end

Trust remains required, but Home should not end like a data-governance landing page.

Move methodology to:

- compact footer links;
- About / Sources / Method pages (#348);
- contextual source affordances on profile/family/place pages.

A short one-line trust statement is enough on Home.

#### D. Technical delivery/release detail in the normal reading flow

Keep such information available for advanced users, but not as a major Home section.

## 7. V0.8 Home information architecture

### Scene 1 — Immersive Hero

Purpose: emotional entry and immediate panda identity.

Content:

- fixed/floating global navigation;
- full-screen licensed photo of one published panda;
- headline;
- one-sentence lead;
- `认识{熊猫}` CTA;
- `换一只看看` CTA;
- identity label: name + simple year/place only when truthful;
- published profile count.

No giant search bar in this viewport.

### Scene 2 — This panda, in a few moments

Purpose: turn the image into a person/individual the fan can remember.

Content:

- `从{熊猫名}开始`;
- 3–4 meaningful published events, preferably human-readable milestones;
- compact identity facts;
- birthday strip only when exact date semantics support it;
- CTA to full profile.

Avoid generic events that add no story value.

### Scene 3 — Family, when available

Purpose: turn one panda into a relationship story.

Content:

- large image treatment;
- simple statement such as `{熊猫名}不是一个孤立的名字。`;
- 3–6 related published pandas;
- clear relationship labels where helpful;
- CTA to Families / lineage.

If relation data is not sufficient, this entire scene is omitted.

### Scene 4 — Places / journey, when available

Purpose: connect the individual to geography.

Content:

- a few residency/place stops;
- current vs historical vs last-known wording;
- map preview;
- CTA to full Map.

If no meaningful published place history exists, replace this with another meaningful continuation, not an empty map.

### Scene 5 — The panda world opens

Purpose: expand from one panda to many.

Content:

- headline using the active release's published count;
- 6–10 licensed panda images in a large horizontal panorama;
- names and minimal recognition context;
- link to Panda Directory.

This is the first place where Home should feel like a large collection.

### Scene 6 — Find your panda

Purpose: utility after emotional engagement.

Content:

- large simple search field;
- dedicated Search route;
- browse links: Pandas / Families / Places / Moments;
- playful links: Random Panda / Guess Panda.

The search result surface must distinguish panda, institution and place once #347 is complete.

### Scene 7 — Today / recent / birthdays

Purpose: create return value.

Content hierarchy:

1. today / this week if supported;
2. valid birthday anniversaries;
3. recent published events/changes;
4. links back to panda/family/place.

Do not create a fake social feed and do not label scheduled or cached information as live.

### Scene 8 — My Pandas

Purpose: convert exploration into memory and return visits.

Content:

- Favorite;
- Seen;
- Visited;
- actual panda imagery where available;
- CTA to My Pandas.

For signed-out users, show an honest invitation instead of fabricated personal data.

### Scene 9 — Compact trust/footer

Purpose: close the page without changing its emotional register.

Content:

- one short trust statement;
- Sources / Method;
- About;
- Privacy;
- Terms;
- Contribution/corrections;
- language switch.

## 8. Homepage module adaptation

V0.8 must not assume every featured panda has every data type.

Home uses conditional modules:

| Data available for featured panda | Home behavior |
|---|---|
| Licensed image + events + family + places | full V0.8 sequence |
| Licensed image + events + family | omit journey scene |
| Licensed image + events + places | omit family scene |
| Licensed image + meaningful event only | hero + story thread, then expand to world |
| Licensed image but almost no continuation data | do not choose as hero candidate |
| No licensed image | can appear in search/directory, not full-photo Home hero |

This is why partial records can be publicly useful without all becoming Home hero candidates.

## 9. Record states across the wider fan experience

The 960-subject research inventory makes three public record types especially important.

### Complete / rich profile

Fan-facing behavior:

- photography-led;
- story/timeline;
- family;
- journey;
- media;
- related pandas.

### Basic profile

Fan-facing behavior:

- show known facts confidently but modestly;
- render only meaningful modules;
- no wall of `unknown` rows;
- use `资料仍在整理` as a lightweight state, not a warning banner.

### Historic profile

Fan-facing behavior:

- emphasize era, institution, family/descendants and archival events;
- accept year/month-level date precision;
- no pressure to imitate a current living panda profile.

### Identity/reference node

Some historic/unresolved individuals are useful primarily as relation/history nodes. They should not be visually presented as complete ordinary profiles until identity supports that treatment.

## 10. Media rules

Photography is central to V0.8, therefore media truth must be stricter, not looser.

Rules:

1. never use another panda as a substitute image;
2. hero requires licensed/publicly usable media according to current Media domain state;
3. source-page availability does not imply republication rights;
4. alt text describes the actual panda/image;
5. credit/right/source remain reachable without covering the image with metadata;
6. no-image records receive intentional design, not generic panda stock imagery;
7. media failure falls back honestly without breaking the profile/search task.

## 11. Trust and evidence presentation

V0.8 separates **trust capability** from **trust visual dominance**.

Ordinary fan view:

- concise known facts;
- small status language only when uncertainty matters;
- source link at the point of doubt;
- last-known/current distinction where freshness matters.

Deeper view:

- sources;
- evidence state;
- date precision;
- revision history;
- conflicting claims;
- release information.

The rule is:

> Evidence must always be reachable, but it should not compete with the panda for attention.

## 12. Navigation

Recommended primary public navigation:

- 熊猫 / Pandas
- 家族 / Families
- 地图 / Map
- 动态 / Moments

Search is a global icon/action.

My Pandas is a personal action on the right side of the shell.

Games should remain discoverable but not consume one of the core top-level information slots.

Wild Panda / conservation can become a primary or strong secondary destination once the wild-monitoring dataset is productized. Do not mix reserve/monitoring observations into individual panda navigation prematurely.

## 13. Current production Home changes

The current `EditorialHomePage` should be treated as a data-safe implementation source, not the target visual structure.

Keep/reuse where appropriate:

- `GlobalNavigation` semantics;
- `LicensedMediaFigure` media truth/attribution behavior;
- PublicRead release envelope;
- localized content functions;
- current-place truth handling;
- recent revision derivation;
- accessible form semantics;
- V2 server-first data loading.

Replace or restructure:

- current split text + image-sphere hero;
- image sphere as dominant visual;
- four selected profile cards immediately after hero;
- two equal exploration feature cards;
- methodology as a major Home scene.

V0.8 should reuse the safe data contracts while changing the presentation hierarchy.

## 14. Technical implementation boundaries

### Server first

Home remains a server-rendered page.

Server responsibilities:

- load active PublicRead release;
- select deterministic hero candidate;
- construct story/family/place/panorama view model;
- localize textual states;
- produce semantic links and fallback content.

Client islands are limited to mechanisms that actually require them:

- `换一只看看` if implemented without navigation;
- optional small hero transition;
- panorama drag/scroll enhancement;
- map preview interaction;
- personal-state hydration.

### Do not restore old V0.7 dependencies for visual parity

Do not add `gsap`, `motion`, old `deck.gl`, old `family-chart`, or old carousel packages merely because the prototype used them.

Prefer:

- CSS transitions;
- native scroll/scroll-snap;
- existing current map/lineage capabilities;
- current design primitives;
- current generated V2 client / PublicRead.

A dependency is justified only when a current product mechanism cannot be implemented cleanly without it.

## 15. Performance rules

Large photography cannot become an excuse for a slow Home.

Requirements:

- only hero image is priority-loaded;
- below-fold media lazy-loads;
- responsive derivatives and `sizes` are mandatory;
- panorama does not preload every original image;
- full map runtime is not required for first paint;
- no autoplay video in the hero;
- avoid JS-heavy animation libraries;
- reduced-motion support is native and complete;
- core content remains readable when client JS fails.

Target experience:

- first viewport feels photographic immediately;
- user can click the featured panda before interactive enhancements load;
- mobile layout does not require horizontal page overflow.

## 16. Mobile behavior

V0.8 is not a desktop cinematic page squeezed onto mobile.

Mobile rules:

- hero remains image-led, approximately 100svh or a safe shorter equivalent on constrained devices;
- headline uses 2–4 lines, never covers the panda's face when a focal point is known;
- primary/secondary actions stack when needed;
- identity block moves below/alongside actions;
- timeline becomes one-column;
- family member strip can horizontally scroll;
- map uses preview + structured list/sheet;
- panorama shows roughly one large panda at a time;
- search input remains full width;
- all primary actions remain keyboard and touch accessible.

## 17. Accessibility

The immersive design is not allowed to weaken accessibility.

Required:

- semantic `h1` and section hierarchy;
- useful image alt text;
- sufficient text contrast over image;
- visible focus;
- no hover-only information;
- panorama operable without dragging;
- map has structured equivalent;
- family relationships have structured equivalent;
- reduced motion;
- 200% zoom;
- 320 CSS pixel support;
- no essential content encoded only by color.

## 18. V0.8 copy register

Home copy should be short, warm and concrete.

Prefer:

- `认识美香`
- `看看它的家人`
- `它生活过的地方`
- `最近发生了什么`
- `随机遇见一只`

Avoid on the main reading path:

- `authority projection`
- `coverage matrix`
- `release schema`
- `evidence ledger`
- `stable identity UUID`
- `public delivery state`

Those concepts remain available where advanced users need them.

## 19. Dependencies on existing Wayfinder work

### #347 — Public Search Workspace

V0.8 Home should ultimately send search to `/{locale}/search` and use the generated V2 public API/client only.

This is the main functional dependency for the V0.8 discovery rail.

### #346 — Relationship Compare

Not required for the first V0.8 Home slice, but the Family scene should naturally lead into Families/Compare once available.

### #348 — Trust and information pages

Allows the large Home methodology block to disappear while keeping Sources / Method / Privacy / Terms clear and stable.

### Bulk Research → V2 Publication

As more reviewed pandas are promoted, the V0.8 panorama, search, directory, families and places become substantially more valuable without changing the Home architecture.

## 20. Implementation sequence

### V8-H0 — Design/data contract

Deliver:

- this specification;
- recovered V0.7 reference kept immutable;
- deterministic Home hero selection contract;
- conditional module contract;
- no new runtime dependencies.

### V8-H1 — Hero + story thread

Implement on current V2 PublicRead:

- full-bleed licensed hero;
- floating global nav treatment;
- hero identity;
- active-release count;
- first-panda story thread;
- full profile CTA;
- honest no-eligible-hero fallback.

This is the first visual checkpoint.

### V8-H2 — Family + journey continuation

Implement conditional:

- family cinematic scene;
- relation strip;
- place/journey scene;
- current / historical / last-known location semantics;
- lazy map preview.

### V8-H3 — World panorama + Search

Implement:

- multi-panda image panorama;
- directory link;
- dedicated Search integration after #347;
- browse by Families / Places / Moments;
- Random / Guess links.

### V8-H4 — Return loop

Implement:

- recent moments/updates;
- valid birthdays;
- signed-in/signed-out My Pandas treatment;
- compact trust/footer.

### V8-H5 — Wider V0.8 alignment

After Home is accepted, apply the same fan-first hierarchy to:

- Panda Directory;
- Panda Profile;
- Families;
- Institution / Place;
- Moments;
- My Pandas.

Do not redesign all routes before Home proves the visual system.

## 21. Acceptance criteria

V0.8 Home is acceptable when all of the following are true:

### Fan experience

- first viewport is dominated by a real published panda image;
- the panda's name and primary action are immediately clear;
- family/place/time feel like continuations of that panda, not feature marketing;
- user reaches multi-panda discovery naturally;
- user has an obvious search path;
- page ends with a return reason.

### Data truth

- only active PublicRead data is shown;
- public count equals active published count;
- hero image is licensed and belongs to the selected panda;
- stale location is never presented as current;
- tentative/disputed relationships do not look confirmed;
- missing modules disappear cleanly instead of fabricating completeness.

### Architecture

- no V1/public-release fallback;
- no local research read in Web;
- no resurrection of old V0.7 data adapters;
- no unnecessary animation/map/carousel dependency additions;
- Server-first boundary preserved;
- current generated V2/public contracts remain authoritative.

### Quality

- zh/en;
- keyboard;
- reduced motion;
- 320 px;
- 200% zoom;
- no horizontal page overflow;
- no substitute media;
- production build/typecheck/lint pass;
- representative browser journey passes.

## 22. Explicit non-goals

V0.8 Home does not attempt to:

- publish all 960 research subjects;
- expose research-quality scores publicly;
- become a general wildlife portal;
- create a news/social feed;
- show exact sensitive wild-panda locations;
- put full evidence tables on Home;
- rebuild lineage geometry;
- replace Search/Directory with an immersive-only interface;
- add a new frontend framework or design-system dependency.

## 23. Decision summary

The V0.8 decision is:

1. **V0.7 Home remains the visual/product source.**
2. **Current V2 Web remains the architectural/data source.**
3. **V0.8 combines them rather than choosing one.**
4. The current image-sphere Home is not the target direction.
5. The first viewport returns to one full-screen panda image.
6. The Home narrative follows one panda through moments, family and places before expanding to the whole collection.
7. Incomplete/historic/no-image records remain first-class elsewhere; hero selection simply requires stronger media/story readiness.
8. Sources and evidence stay reachable but visually secondary for ordinary fans.
9. Published count always comes from the active release, never from the 960-subject research inventory.
10. Implementation proceeds as narrow V2-native slices, without reviving retired V0.7 dependencies.

The review question for every V0.8 Home change is:

> **Does this make a panda fan want to meet this panda, remember it, and continue to another part of its world?**
