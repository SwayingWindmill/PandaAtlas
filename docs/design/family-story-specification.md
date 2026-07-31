# Family Story template specification

Status: accepted design proposal for Wayfinder issue #233
Parent map: #230
Depends on: Panda Profile V2 (#231) and Panda Moments (#232)
Implementation owner: #234

## 1. Decision

Family Stories become curated, versioned public reading experiences built from reviewed panda identities, relationship assertions, canonical events, places, institutions, media rights, and source records.

They complement the structured Lineage explorer. They do not replace it, infer relationships, merge distinct event records, or generate narrative claims from proximity, co-residence, shared sources, names, or dates.

Working concept: **Family Fieldbook / 熊猫家族志**.

The visual language combines a natural-history fieldbook, a family album, and an evidence-aware archive. It should feel warm, lively, and memorable without turning real pandas into fictional characters.

## 2. Design inputs

Pinned on 2026-07-31:

- `pbakaus/impeccable@32930818a109fafa87199babe92fa8e530cff5d3`
- `Leonxlnx/taste-skill@e988add20dab0fa97d7a76781c48961c8184288e`

Impeccable passes used:

- `shape`: family-story ownership, story scope, relationship evidence, chapter model, and cross-surface boundaries;
- `craft`: contrasting long-family and twin-family prototypes;
- `critique`: anti-family-tree-poster, anti-card-grid, anti-generated-narrative, and relationship-honesty review;
- `adapt`: small families, large families, long names, bilingual copy, no-media, and narrow screens;
- `harden`: partial membership, tentative/disputed/superseded edges, missing media, missing translations, withdrawn content, and delivery failure;
- `audit`: semantic reading order, relationship status text, image rights, URL anchors, and no-JavaScript journeys;
- `delight`: chapter transitions, family motifs, date ribbons, and member identity marks;
- `polish`: typography, evidence language, member hierarchy, and implementation handoff.

Taste Skill dials:

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 4`
- `VISUAL_DENSITY: 6`

Rationale:

- variance 8 allows each family to have a distinctive chapter rhythm without changing evidence semantics;
- motion 4 supports chronology and member focus, but no autoplay, parallax, or family-tree animation is required;
- density 6 keeps member, date, place, source, and status visible without becoming a genealogy dashboard.

## 3. Public-data observations

The current public release is `2026.07.24.2`, public schema `1.2.0`.

Representative reviewed structures used by the prototypes:

### 3.1 Smithsonian multigenerational story

Core scope:

- Mei Xiang / 美香;
- Tian Tian / 添添;
- Tai Shan / 泰山;
- Bao Bao / 宝宝;
- Bei Bei / 贝贝;
- Xiao Qi Ji / 小奇迹;
- Bao Li / 宝力 as the next maternal generation through Bao Bao.

Important states:

- Mei Xiang has four confirmed published child relationships;
- Bao Li has a confirmed relationship to Bao Bao;
- Bao Li's relationship to An An is tentative;
- Bao Li's grandparent relationships to Mei Xiang and Tian Tian are published;
- Tian Tian's two tentative parent dependency assertions remain outside this bounded story scope and stay available through Lineage; their exclusion is explicit and does not imply that they are absent from the archive;
- Mei Xiang has no licensed public image in the current release;
- Bao Li has licensed media;
- programme chronology spans the parents' Smithsonian chapter, four offspring births, the announced return plan, the completed 2023 return, Bao Li's 2024 arrival, and 2025 public debut.

The template must not imply that the published family scope is biologically exhaustive.

### 3.2 Ueno twin-family story

Core scope:

- Shin Shin / 真真;
- Ri Ri / 力力;
- Xiao Xiao / 晓晓;
- Lei Lei / 蕾蕾.

Important states:

- both parents have confirmed published relationships to both twins;
- the twins share reviewed birth and naming chronology;
- parent return and twin return are separate canonical events;
- parents have licensed public media;
- all four current members have licensed public media in release `2026.07.24.2`; the prototype deliberately features the parents only, while twin media remains available through individual profiles;
- the story spans Ueno and the Ya'an Bifengxia base;
- no precise coordinates are inferred from institution records.

## 4. Product ownership

Family Story owns:

- a bounded editorial family scope;
- a reviewed title, dek, and chapter sequence;
- member roles inside this story;
- a relationship-evidence summary;
- a curated event sequence;
- family-level place and institution context;
- a family-level media sequence;
- source and revision disclosure;
- links into the underlying structured surfaces.

Family Story does not own:

- canonical panda identity;
- canonical relationship assertions;
- a complete lineage graph;
- canonical event records;
- current residence;
- institution or place identity;
- media licensing decisions;
- source metadata;
- user-generated comments;
- general CMS pages.

Those remain owned by Profile V2, Lineage, Panda Moments, place/institution surfaces, the public archive, and the media release system.

## 5. Canonical route and anchors

Proposed route:

- `/{locale}/families/{familySlug}`

Stable anchors:

- `overview`
- `members`
- `relationships`
- `chapters`
- `moments`
- `places`
- `media`
- `sources`
- `revisions`

Optional chapter anchors use reviewed stable IDs:

- `chapter-origins`
- `chapter-arrivals`
- `chapter-births`
- `chapter-growing-up`
- `chapter-returns`
- `chapter-next-generation`

Locale switching preserves the family ID, chapter anchor, and compatible query state.

## 6. Family identity and scope

A Family Story requires:

- stable family-story ID;
- canonical slug;
- localized title;
- localized short title;
- localized dek;
- story type;
- declared scope;
- membership list;
- relationship assertion references;
- chapter order;
- release and revision metadata;
- translation state;
- coverage state.

Scope must explicitly state what the story includes and excludes.

Examples:

- “Mei Xiang, Tian Tian, four published offspring, and one published maternal grandchild”;
- “Shin Shin, Ri Ri, and the two Ueno twins”;
- “published maternal line from A to C”;
- “twins born on a reviewed date and their two published parents”.

The scope cannot be “the complete family” unless the release contract explicitly guarantees completeness.

## 7. Membership model

Membership is editorial inclusion, not proof of a relationship.

Each member entry requires:

- stable panda ID;
- story role;
- generation index;
- display order;
- relationship-to-focus assertion IDs;
- membership rationale;
- profile route;
- localized name state;
- media state;
- optional featured chapter IDs;
- public omission note when a known dependency record cannot be displayed.

Suggested story roles:

- `focus`
- `co_parent`
- `parent`
- `child`
- `twin`
- `sibling`
- `grandparent`
- `grandchild`
- `maternal_line`
- `programme_member`
- `dependency_only`

A member can have several roles, but the rendered label must be understandable and not expose raw codes.

## 8. Relationship evidence model

Every displayed relationship edge must reference a reviewed public assertion.

Required fields:

- relationship assertion ID;
- parent panda ID or dependency identity;
- child panda ID;
- parent role;
- status;
- source IDs;
- last verified date;
- public note;
- supersedes / superseded-by assertion IDs;
- conflict group ID when disputed;
- publication state;
- translation state for notes.

Status vocabulary:

- `confirmed`
- `tentative`
- `disputed`
- `superseded`
- `unknown`
- `restricted`

Rules:

- confirmed and tentative edges never share the same visual treatment;
- disputed relationships display candidates or a conflict summary;
- superseded edges are excluded from the default current diagram but remain in revisions;
- unknown means no reviewed conclusion, not “no relationship”;
- dependency-only parents may appear as named evidence nodes without pretending they have full profiles;
- grandparents must be derived server-side from active relationship assertions, with the path shown;
- `father_id` and `mother_id` are not independent evidence and must not be used when assertion records are unavailable.

## 9. Template architecture

### 9.1 Family identity stage

The first viewport answers:

- which family scope is this;
- why this group is being told together;
- how many public members and relationship assertions are included;
- what period and places are covered;
- whether media is rich, limited, or unavailable;
- where to continue: members, chapters, lineage, or moments.

It uses typography, relationship lines, dates, and place labels rather than requiring a hero image.

### 9.2 Member constellation

A member constellation is a structured summary, not the full Lineage graph.

It may use:

- generation bands;
- maternal-line ribbon;
- twin pairing;
- programme cohort;
- member identity slips;
- compact parent-child paths.

It must also render as a semantic nested list.

The constellation displays only edges included in the family-story scope.

### 9.3 Relationship evidence rail

The rail provides:

- count by status;
- source count;
- last verified date;
- explicit partial-scope language;
- link to focused Lineage;
- native disclosures for assertion IDs and sources.

The rail is not a detached “trust card”; it remains adjacent to the family structure.

### 9.4 Chapter sequence

Chapters are curated reading units that reference canonical records.

A chapter may contain:

- reviewed title and summary;
- member references;
- event IDs or event-group IDs;
- place and institution references;
- relationship assertion references;
- media references;
- source references;
- chronology bounds;
- coverage state;
- localized editorial copy.

Common chapter purposes:

- origins;
- arrival or programme beginning;
- births;
- naming and public debut;
- maternal care;
- growing up;
- transfer or return;
- next generation;
- legacy or historical context.

Not every family receives every chapter.

### 9.5 Family moments

Family moments consume Panda Moments canonical event IDs.

Rules:

- shared events render once with all participants;
- separate same-day event IDs remain separate unless an explicit reviewed group exists;
- event dates, announcement dates, source publication dates, and verification dates remain distinct;
- birthdays may appear as derived anniversary reminders but never as new source events;
- cancelled or announced plans do not change residence;
- family chronology does not infer relationship from co-participation.

### 9.6 Places and programme

The family-place section may show:

- institution chapters;
- ordered place journey;
- programme context;
- from/to movement;
- current or final-known place;
- country-level or coarse-location precision.

It cannot infer coordinates or complete residence histories.

### 9.7 Media sequence

Media can be:

- rich editorial sequence;
- one-image chapter accent;
- source-link-only;
- restricted;
- withdrawn;
- unavailable.

Rules:

- never substitute another panda;
- captions identify the member;
- credits, rights, source URL, and release state remain available;
- family composite graphics cannot imply unreviewed physical co-presence;
- images from different dates or places are labelled separately;
- no-media stories use identity marks, dates, and relationship typography.

### 9.8 Sources and revisions

Family Story exposes:

- family release ID;
- family schema version;
- member and assertion count;
- source count;
- last verified date;
- chapter translation state;
- partial-scope statement;
- relationship revision history;
- withdrawn member/chapter/media behavior.

Native `<details>` is preferred for evidence disclosure.

## 10. Template variations

### 10.1 Long programme family

Best for:

- a pair with several offspring;
- international programme history;
- long chronology;
- several institutions or returns;
- mixed media coverage.

Layout traits:

- wide date ribbon;
- generation-based member constellation;
- alternating chapter measure;
- programme-place track;
- large no-media typographic stage when needed.

### 10.2 Twin or litter story

Best for:

- one birth cohort;
- two parents;
- shared naming and public debut;
- compact movement history.

Layout traits:

- paired vertical rhythm;
- same-day event clusters;
- parent evidence strip;
- mirrored but not duplicated child paths;
- tighter chronology;
- one or two media accents.

### 10.3 Maternal line

Best for:

- three or more published generations;
- one explicit parent role per edge;
- a focused lineage journey.

Layout traits:

- vertical generation ribbon;
- one active path;
- sibling branches summarized rather than expanded;
- assertion status on every step.

### 10.4 Small bounded family

Best for:

- one parent and one child;
- sparse archive;
- dependency-only related identity;
- media-limited story.

Layout traits:

- no empty graph;
- two identity marks;
- one evidence path;
- one or two chapters;
- explicit partial-coverage language.

### 10.5 Historical or disputed family

Best for:

- approximate dates;
- unavailable media;
- competing relationship conclusions;
- archival revisions.

Layout traits:

- evidence-first opening;
- timeline ranges;
- candidate paths;
- no decorative certainty;
- revisions remain prominent.

## 11. Variation rules

The template defines zones, not one fixed composition.

Required zones:

- identity;
- scope;
- member structure;
- relationship evidence;
- at least one chapter;
- sources and revisions.

Optional zones:

- programme context;
- moments;
- places;
- media;
- derived anniversaries;
- cultural context.

Variation is chosen by declared story type and available reviewed content, not randomly in the browser.

The frontend may select a server-defined layout recipe such as:

- `programme_longform_v1`
- `twin_parallel_v1`
- `maternal_line_v1`
- `small_bounded_v1`
- `historic_evidence_v1`

Layout recipe changes are versioned editorial decisions.

## 12. Editorial contract

No public story copy is generated at request time.

Required editorial fields:

- title;
- short title;
- dek;
- scope statement;
- chapter title;
- chapter summary;
- transition text;
- member role label;
- programme or place context;
- no-media explanation;
- coverage note;
- revision summary.

Each field carries:

- locale;
- review status;
- reviewer identity or accountable publication reference;
- source or record references;
- last reviewed date;
- sensitivity state;
- translation state.

Authoring workflow:

1. select a stable family scope;
2. validate every member identity;
3. validate every displayed relationship assertion;
4. select canonical events and places;
5. draft source-linked chapter copy;
6. review media rights;
7. review Chinese and English independently;
8. run relationship and event consistency checks;
9. publish through the accountable archive workflow;
10. project into the family public contract.

## 13. Proposed public contract

```ts
interface PublicFamilyStory {
  id: string;
  slug: string;
  storyType: FamilyStoryType;
  layoutRecipe: string;
  content: LocalizedFamilyContent[];
  scope: PublicFamilyScope;
  members: PublicFamilyMember[];
  relationships: PublicFamilyRelationship[];
  chapters: PublicFamilyChapter[];
  moments: PublicFamilyMomentReference[];
  places: PublicFamilyPlaceReference[];
  media: PublicFamilyMediaReference[];
  sources: PublicSourceSummary[];
  coverage: PublicFamilyCoverage;
  revision: PublicRevisionSummary;
  release: PublicReleaseReference;
}
```

Family scope:

- declared member count;
- generation count;
- focus panda IDs;
- included relationship roles;
- included period;
- included institutions and places;
- partial-scope explanation;
- excluded or unavailable categories.

Chapter references canonical records by ID. It does not embed private archive notes.

## 14. Query and delivery

Recommended read:

- `GET /v1/public/families/{slug}`

Optional supporting reads:

- family index or search;
- bounded chapter detail;
- release-pinned family read;
- related family stories by panda ID.

Requirements:

- server projection resolves members, assertions, events, places, media, and sources;
- no browser-side join across all panda profiles;
- no N+1 requests;
- release-bound ETag;
- immutable caching for release-pinned reads;
- current route may use short revalidation;
- invalid family scopes produce typed not-found or unavailable responses;
- withdrawn relationship or media changes invalidate affected stories;
- local research and design fixtures never serve publicly.

## 15. Frontend boundary

Server components own:

- story identity and scope;
- member structure;
- relationship states;
- chapter copy;
- chronology;
- place summaries;
- media rights state;
- sources and revisions;
- no-JavaScript journeys.

Narrow client islands may own:

- active chapter indication;
- optional member focus;
- reduced-motion chapter transition;
- media lightbox enhancement;
- copy-link feedback.

The full family graph and event corpus are not downloaded to the browser.

## 16. Cross-surface journeys

To Profile V2:

- every public member links to a profile;
- dependency-only identities are clearly labelled;
- return context preserves family and chapter.

To Lineage:

- open focused lineage with depth appropriate to the family scope;
- selected relationship assertion remains identifiable;
- Family Story never replaces path exploration.

To Panda Moments:

- open filtered family period, member, event, or institution query;
- selected event remains identifiable;
- anniversary state remains derived.

To institutions, places, and Map:

- link only to normalized public entities;
- preserve coarse precision;
- no coordinates inferred.

## 17. State matrix

### Family coverage

- `complete_for_declared_scope`
- `partial`
- `empty`
- `unavailable`
- `restricted`

### Member state

- full public profile;
- partial public profile;
- dependency-only identity;
- missing translation;
- restricted;
- withdrawn.

### Relationship state

- confirmed;
- tentative;
- disputed;
- superseded;
- unknown;
- restricted.

### Chapter state

- approved;
- partial;
- source-language-only;
- withheld;
- superseded;
- unavailable.

### Media state

- gallery;
- single accent;
- source-link-only;
- restricted;
- withdrawn;
- none.

The page must remain coherent when any optional zone is absent.

## 18. Visual direction

Shared foundation with Profile V2 and Panda Moments:

- warm paper;
- botanical ink;
- bamboo action color;
- persimmon chronology;
- mineral blue places;
- plum relationship dispute/revision;
- serif display type and bilingual sans body;
- flat evidence disclosures.

Family-specific language:

- thread, margin notes, chapter numbers, generation markers, and identity seals;
- relationship paths look like annotated editorial lines, not an org chart;
- members are not repeated rounded cards;
- photographs remain documentary, not decorative wallpaper;
- no scrapbook stickers, fake handwriting, hearts, or fictional family quotes.

## 19. Motion

Allowed:

- chapter focus transition after explicit navigation;
- relationship-path emphasis;
- member focus;
- media reveal;
- selected chronology marker.

Not allowed:

- animated family tree construction;
- autoplay chapter carousel;
- parallax portraits;
- bouncing relationship lines;
- scroll-jacked horizontal generations;
- motion that hides status changes.

Reduced-motion output is structurally identical.

## 20. Responsive behavior

Under 768 px:

- identity stage is single column;
- member constellation becomes a nested semantic list;
- generation lines stay in normal flow;
- chapter navigation uses native disclosure;
- no horizontal family tree;
- event and place paths stack vertically;
- evidence follows the affected relationship;
- member names, statuses, and source links wrap at 320 px.

At 768–1199 px:

- two-column member/chapter compositions are allowed;
- relationship rail may sit beside the member list;
- media remains bounded.

At 1200 px and above:

- asymmetric editorial spread;
- relationship structure and chapter copy may sit side-by-side;
- chronology can use a wide date margin;
- reading measure remains bounded.

## 21. Accessibility

- one `h1`;
- logical heading hierarchy;
- skip link;
- member constellation has a complete semantic list equivalent;
- relationships are announced with both parties, role, and status;
- no status is color-only;
- chapter navigation uses links and `aria-current`;
- images identify the correct member;
- credits and rights are keyboard reachable;
- evidence disclosures use native controls;
- no drag, hover, swipe, or zoom is required;
- 200% zoom and 320 px preserve all tasks;
- no-JavaScript mode preserves members, chapters, Lineage links, Moments links, sources, and revisions;
- reduced motion is respected;
- dependency-only members are not misleadingly announced as full profiles.

## 22. Performance

- server-first render;
- no client-only story shell;
- bounded family response;
- no full lineage or moments corpus;
- optimized released media only;
- lazy-load below-fold images;
- reserve media dimensions;
- no third-party genealogy library without bundle, accessibility, localization, and exit-cost review;
- no map library on the Family Story route;
- only transform and opacity for optional motion;
- route budget is added and enforced by #234.

## 23. Localization

- Chinese and English are reviewed separately;
- family title and chapter structure can differ by locale only when a versioned editorial decision documents it;
- IDs, member order, relationship assertions, events, and places remain stable;
- missing translation never triggers generated copy;
- names preserve reviewed forms;
- relationship role grammar is localized;
- date ranges use locale-aware formatting;
- source language remains visible;
- locale switching preserves chapter and member focus.

## 24. Data honesty

- editorial membership is not evidence;
- every edge references a public relationship assertion;
- grandparents show their assertion path;
- tentative and disputed edges remain explicit;
- superseded edges are not current;
- dependency-only identities are not full profiles;
- shared event IDs render once;
- separate event IDs remain separate;
- no family completeness claim without a declared guarantee;
- no relationship inferred from co-residence, birth date, naming, institution, source, or media;
- no exact place inferred from a country or institution;
- no substitute images;
- no generated family dialogue, personality, or emotional motivation;
- partial archive coverage is not represented as inactivity or absence.

## 25. Prototype A: Smithsonian generations

Design purpose:

- long programme family;
- three published generations;
- six core first/second-generation members plus Bao Li;
- confirmed and tentative relationship states;
- long chronology;
- mixed institution and country-level places;
- mostly no-media with one licensed descendant image.

Layout recipe: `programme_longform_v1`.

Key chapters:

1. a long Smithsonian chapter;
2. four births across 2005–2020;
3. announced and completed return;
4. Bao Li as a next-generation return to Washington;
5. current family distributed across public locations.

## 26. Prototype B: Ueno twins

Design purpose:

- compact four-member family;
- twin birth and naming;
- confirmed parent relationships;
- parent and child return chapters;
- licensed media for all four members, with parent media selected for the family-level sequence and twin media left to individual profiles;
- two primary places.

Layout recipe: `twin_parallel_v1`.

Key chapters:

1. parents arrive in Ueno;
2. twins are born;
3. twins receive names;
4. parents return in 2024;
5. twins return in 2026.

## 27. Implementation handoff for #234

Recommended sequence:

1. create the family-story schema and layout-recipe vocabulary;
2. expose reviewed relationship assertions with status, source, and revision links;
3. build server projection for family scope, members, chapters, canonical moments, places, media, and evidence;
4. add authoring/review validation that rejects missing assertions and private/local IDs;
5. add fixtures for confirmed, tentative, disputed, superseded, dependency-only, no-media, and missing-translation states;
6. implement the structured member/relationship journey first;
7. implement chapter and chronology rendering;
8. implement media and place sections;
9. add Profile, Lineage, Moments, institution, place, and Map return journeys;
10. add only narrow client enhancements;
11. deliver at least two production stories using different layout recipes;
12. run map-close browser, accessibility, performance, release, staging, rollback, and withdrawal verification.

## 28. Acceptance decision

The template is ready for implementation when:

- editorial scope and relationship evidence are separate;
- every rendered edge is assertion-backed;
- long, compact, maternal-line, sparse, and disputed families can share semantics without sharing one repetitive layout;
- chapters reference canonical records rather than copying hidden archive data;
- media-rich and no-media families both feel intentional;
- cross-surface journeys are stable;
- the public contract supports every rendered state;
- no production behavior depends on design fixtures or local research;
- #234 can implement two contrasting first stories without reopening the primary architecture.
