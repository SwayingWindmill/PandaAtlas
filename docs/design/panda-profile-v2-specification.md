# Panda Profile V2 product and interaction specification

Status: accepted design proposal for Wayfinder issue #231
Parent map: #230
Implementation owner: #234

## 1. Decision

Panda Profile V2 becomes ZhiPanda's primary individual reading and exploration surface.

It is not a database detail page and it is not a free-form article. It is an identity-led, source-aware editorial experience that lets a visitor:

1. confirm that they found the correct panda;
2. understand the panda's current or final known state;
3. read a coherent life story built from approved public records;
4. move into family, moments, places, institutions, lineage, map, media, and sources;
5. inspect uncertainty, conflicts, rights, and revisions without losing the narrative.

The design replaces the current continuous sequence of bordered sections with a stronger reading rhythm:

- identity stage;
- current-state strip;
- life chapters;
- family and place pathways;
- topic chapters;
- media sequence;
- trust and revision area.

Existing route and anchor compatibility remain stable. Presentation may change substantially.

## 2. Design inputs and pinned versions

Reviewed on 2026-07-31:

- Impeccable: `pbakaus/impeccable@32930818a109fafa87199babe92fa8e530cff5d3`
- Taste Skill: `Leonxlnx/taste-skill@e988add20dab0fa97d7a76781c48961c8184288e`

The design uses the following Impeccable passes:

- `shape`: task model, hierarchy, narrative order, module boundaries;
- `craft`: representative responsive prototype construction;
- `critique`: hierarchy, clarity, emotional resonance, anti-pattern review;
- `adapt`: mobile, long names, translation, low-media, and reduced-motion behavior;
- `harden`: sparse, disputed, superseded, restricted-media, and delivery states;
- `audit`: accessibility, performance, responsive, source, and media review;
- `polish`: typography, rhythm, token consistency, microcopy, and final handoff.

Taste Skill design read:

> A bilingual natural-history magazine crossed with a trusted panda passport. Warm and image-aware, but able to remain visually complete without a photograph. Editorial in reading mode, product-like only where comparison or evidence is required.

Selected dials:

- `DESIGN_VARIANCE: 7`
- `MOTION_INTENSITY: 4`
- `VISUAL_DENSITY: 6`

Rationale:

- Variance 7 permits offset grids, varied media proportions, non-repeating chapter layouts, and a memorable identity stage without creating an experimental navigation burden.
- Motion 4 supports purposeful entrance, timeline orientation, and state transitions. It does not justify scroll hijacking, parallax, magnetic controls, or continuous animation.
- Density 6 keeps source and status information close to facts while preserving long-form reading space.

## 3. Current-state audit

### 3.1 What must be preserved

The existing profile already provides important trust behavior:

- canonical localized profile routes;
- stable identity and aliases;
- fact conclusions and last-verified metadata;
- reviewed story or explicit story absence;
- event date and source publication date separation;
- relationship status and source links;
- coordinate-free footprint fallback;
- fail-closed media states;
- public source access state;
- release, schema, and revision visibility;
- keyboard-readable and no-JavaScript content.

These are product capabilities, not visual constraints.

### 3.2 Problems to resolve

The current page presents most modules with the same visual grammar:

- repeated bordered containers;
- repeated section heading plus status badge;
- repeated grid lists;
- equal visual weight for primary life information and audit metadata;
- a large identity card that still reads like an archive record;
- a sticky section bar that lists empty or low-value destinations too readily;
- timeline, family, footprint, source, and media blocks that feel mechanically adjacent rather than narratively related;
- evidence metadata exposed everywhere in the same form, producing noise instead of confidence.

The page is trustworthy but not yet a distinctive panda-reading experience.

### 3.3 Public-data baseline

The reviewed release inspected for this design is `2026.07.24.2`, public schema `1.2.0`.

It contains 38 pandas, 43 events, 26 residencies, 24 parentage assertions, 38 media records, 5 institutions, 7 places, and 43 public sources.

The current public profile envelope contains a panda detail record plus institutions, places, facilities, lineage, and parentage assertions. The present frontend view model exposes identity, four above-the-fold facts, timeline, family, footprint, media, sources, and revision.

Panda Profile V2 must work with this small release while defining the contract required for richer reviewed records later.

Local research categories are capacity input only. They are not public facts and cannot populate the production profile without the existing review and publication process.

## 4. Experience principles

### 4.1 Identity before inventory

The first viewport answers:

- Who is this panda?
- Is this the correct individual?
- What is their current or final known status?
- What is the most meaningful next thing to read?

Stable IDs, aliases, release metadata, and detailed evidence remain accessible but do not compete with the name and current state.

### 4.2 Story before taxonomy

The profile should read as a life, not as a list of database categories.

Approved facts are grouped into human-readable chapters such as:

- Early life;
- Growing up;
- Places and journeys;
- Family;
- Daily life and care;
- Research and health;
- Later life or legacy.

Taxonomy remains in the public contract and evidence views, not as the primary heading system.

### 4.3 Evidence at the point of doubt

Confirmed, provisional, disputed, superseded, approximate, and restricted states remain visible.

The default presentation uses concise inline signals. Full candidate values, assertion IDs, source lists, publication dates, and revisions open through native disclosures or dedicated evidence anchors.

Evidence is never reduced to color alone.

### 4.4 No-photo completeness

The visual composition must remain intentional when media is:

- unavailable;
- source-link-only;
- restricted;
- withdrawn;
- missing in the requested locale.

A missing photograph must not turn the first viewport into an empty rectangle.

### 4.5 Every visual journey has a structured journey

Timeline, family, and place treatments remain complete as semantic HTML.

Interactive enhancements may improve orientation, but no core fact, relation, event, or place depends on canvas, SVG geometry, animation, or client-only rendering.

## 5. Profile V2 information architecture

The canonical route remains:

- `/{locale}/pandas/{slug}`

Legacy profile routes remain redirects under the existing compatibility policy.

### 5.1 Identity stage: `#overview`

Desktop composition:

- 12-column offset grid;
- media or no-media composition occupies 5 columns;
- identity and reviewed summary occupy 5 columns;
- a compact current-state rail occupies 2 columns;
- name, alternate name, pinyin, life status, and follow action remain above the fold;
- current place, birth date, sex, and parent summary sit on one baseline rather than in four cards;
- primary pathways link to family, moments, and life journey.

Mobile composition:

1. back context and record state;
2. name, alternate name, pinyin, and follow control;
3. current or final known state;
4. media or no-media composition;
5. concise reviewed summary;
6. fact strip;
7. primary pathways.

The name must not be pushed below a tall image on narrow screens.

### 5.2 Story lead: `#story`

This is a short reviewed introduction, not a generated biography.

Rules:

- maximum 2 to 4 paragraphs in the initial reading view;
- each paragraph is localized and reviewed;
- optional highlighted fact or quote must link to its evidence;
- no placeholder prose when unavailable;
- when translation is missing, show the reviewed source-language text only if publication policy permits, with an explicit language label.

### 5.3 Life in moments: `#timeline`

The profile timeline is a curated individual sequence. The full cross-panda temporal explorer belongs to Panda Moments.

Profile timeline behavior:

- use year markers as the reading spine;
- show a bounded set of meaningful events by default;
- group related events within a year;
- distinguish event date, announcement date, source publication date, and last verification date;
- show approximate or month/year precision honestly;
- include a link to the equivalent filtered Panda Moments route;
- use whitespace and typographic hierarchy rather than a stack of equal cards.

The section remains a semantic ordered list.

### 5.4 Family pathway: `#family`

The profile provides an individual-centric family summary:

- parents;
- children;
- siblings when published;
- selected grandparents when useful;
- relation status and source count;
- direct links to relative profiles;
- direct link to focused Lineage state;
- direct link to a Family Story when one exists.

The profile does not embed the full lineage graph.

Relationship uncertainty is shown next to the relation, not in a detached legend only.

### 5.5 Life journey: `#footprint`

The profile presents a chronological place journey:

- place or institution name;
- residency period and precision;
- transfer or return event where applicable;
- current/final-known marker;
- source and verification access;
- links to place, institution, and filtered Map routes.

No precise coordinate is inferred from coarse public data.

A coordinate-free route strip is the default structured experience. A small map preview may be added later only when published precision and provider constraints permit it.

### 5.6 Topic chapters: new dynamic anchors

Topic chapters appear only when approved public content exists.

Recommended chapter IDs:

- `#daily-life` for behaviour, personality descriptions, preferences, enrichment, diet, and husbandry training;
- `#growth-care` for growth measurements, development, maternal care, and public debut context;
- `#health-research` for health, veterinary care, husbandry, and research;
- `#culture` for naming, cultural context, diplomacy, and public significance when approved.

Rules:

- facts remain atomic and source-linked in the contract;
- the page may combine related facts into a reviewed chapter summary;
- unsupported personality inference is prohibited;
- medical detail requires an explicit public-sensitivity policy and may be summarized, restricted, or omitted;
- topic chapters must not become a repeated grid of fact cards.

Preferred layout patterns:

- short editorial lead;
- one featured fact strip;
- a chronological or thematic list;
- native disclosure for evidence and candidate values;
- optional licensed media.

### 5.7 Media sequence: `#media`

Media is an editorial sequence rather than a generic gallery grid.

Rules:

- lead media may be used in the identity stage;
- remaining media use varied but controlled aspect ratios;
- captions, credit, rights, source URL, and release state remain available;
- alt text describes the image, not its licensing state;
- source-link-only media does not render the remote image in ZhiPanda;
- restricted or withdrawn media shows a reason category without exposing private details;
- no-media state uses typography, identity marks, and a life-stage motif rather than an invented panda image.

### 5.8 Trust center: `#sources` and `#revisions`

Sources and revisions remain server-rendered sections.

Default view:

- source count;
- last verified date;
- release and schema version;
- number of disputed or superseded conclusions;
- concise revision summary.

Detailed view:

- source publisher, title, language, publication date, access state, and URL;
- fact-to-source links;
- candidate and superseded values;
- relationship assertion IDs;
- revision entries and release identifiers.

Native `<details>` elements are preferred for progressive disclosure and no-JavaScript equivalence.

## 6. Section navigation

The navigation is generated only from visible modules.

Stable compatibility anchors retained:

- `overview`
- `story`
- `timeline`
- `family`
- `footprint`
- `media`
- `sources`
- `revisions`

New anchors may be inserted for topic chapters.

Desktop:

- compact sticky chapter rail after the identity stage;
- active state may be enhanced with a client island;
- without JavaScript it remains a normal anchor list.

Mobile:

- sticky `目录 / Contents` disclosure with the current section label;
- native links remain visible inside the disclosure;
- no horizontal scroll is required to discover all chapters.

Empty or unavailable modules do not create dead navigation targets unless the unavailable state itself is essential public information, such as explicit no licensed media.

## 7. Cross-surface ownership

| Information or task | Profile V2 | Panda Moments | Family Story | Lineage | Map / place / institution |
| --- | --- | --- | --- | --- | --- |
| Individual identity and current/final status | Primary | Reference | Reference | Node label | Reference |
| Short individual life sequence | Primary | Filtered deep view | Family context | No | Place context |
| Full temporal browsing across pandas | Link only | Primary | No | No | No |
| Individual family summary | Primary | Event context | Family narrative | Structured relation exploration | No |
| Multi-generation family narrative | Link only | Event context | Primary | Evidence path | Place context |
| Relationship graph and path selection | Link only | No | Link | Primary | No |
| Individual place journey | Primary | Event context | Family context | No | Spatial deep view |
| Institution history and residents | Link | Event context | Family context | No | Primary |
| Atomic sources, uncertainty, and revisions | Primary for the individual | Event evidence | Story evidence | Assertion evidence | Entity evidence |
| Follow/favorite action | Primary | Optional contextual action | Optional | Optional | Optional |

## 8. Module and state matrix

### 8.1 Shared state vocabulary

- `complete`: the published module meets its declared coverage definition;
- `partial`: approved records exist but the module is a known subset;
- `empty`: review confirms that no public records are available for the module;
- `unavailable`: the module cannot be delivered because of a delivery, locale, rights, or contract condition;
- `restricted`: records exist but are intentionally not public;
- `source_link_only`: a source may be visited, but ZhiPanda cannot host or re-license the media;
- `disputed`: competing conclusions are currently published;
- `superseded`: a previous conclusion remains visible for revision history but is not current.

### 8.2 Visibility matrix

| Module | Rich profile | Sparse profile | Historic/deceased profile | Empty behavior | Partial behavior |
| --- | --- | --- | --- | --- | --- |
| Identity stage | Always | Always | Always | Never hidden | Missing facts use explicit unknown labels |
| Reviewed story | Show | Hide when unavailable | Show when approved | No placeholder biography | Language or period gaps stated |
| Timeline | Show curated sequence | Show when at least one event exists | Show, including death/legacy if public | Hide anchor if no events | State that sequence is a published subset |
| Family | Show | Show if assertions exist | Show if assertions exist | Hide when no published assertions | Status shown per relation |
| Footprint | Show | Show if residency/place exists | Show final-known place and prior residencies | Hide when no records | Precision and gaps stated |
| Daily life | Show only with approved facts | Usually hidden | Show only with approved historic evidence | Hidden | Chapter states that coverage is partial |
| Growth and care | Show when applicable | Hidden | Show historic records when approved | Hidden | Measurements retain dates and units |
| Health and research | Show only under public-sensitivity policy | Hidden | May include reviewed legacy/research context | Hidden or restricted state | Do not imply complete medical history |
| Culture | Show when approved | Hidden | Often useful for legacy context | Hidden | Translation and attribution visible |
| Media | Gallery | Explicit no-media or source-link-only state | Gallery, restricted, or no-media | Designed no-media state may remain visible | Rights state shown per item |
| Sources | Always when profile is public | Always | Always | Public profile cannot have zero provenance silently | Source access gaps shown |
| Revisions | Always | Always | Always | Version identifiers remain | Localized summary may be partial |

### 8.3 Fact-level states

| State | Default presentation | Detailed evidence presentation |
| --- | --- | --- |
| Confirmed | Value plus concise verified marker | source IDs, dates, precision |
| Provisional | Value plus `暂定 / Provisional` text | reason and sources when public |
| Disputed | Current display strategy plus `有争议 / Disputed` | all candidate values and sources |
| Superseded | Not shown as current | prior value, replacement, revision date |
| Unknown | `暂无已审核记录 / No reviewed record` | no fabricated candidate |
| Approximate | Approximate date or place wording | precision enum and source |
| Restricted | Public reason category only | no private content or hidden identifiers |

## 9. Visual direction

Working concept: **Living Panda Passport**.

It combines the warmth of a field magazine with the clarity of a trusted identity record.

### 9.1 Color roles

The implementation should derive exact accessible tokens, but the direction uses:

- warm paper canvas rather than neutral gray;
- deep green-black ink rather than pure black;
- bamboo green as the primary action and orientation color;
- persimmon or warm coral for moments and active chronology;
- muted sky or mineral blue for place journeys;
- restrained plum for disputed or revision emphasis;
- semantic warning and error colors remain distinct from decorative accents.

Dark mode uses deep botanical surfaces, not a generic black inversion.

### 9.2 Typography

Recommended roles:

- expressive editorial display face for panda names and chapter openings;
- high-legibility bilingual sans for body, controls, evidence, and long source titles;
- tabular numerals for dates, measurements, and release identifiers;
- Chinese and English line-height tuned independently through locale tokens.

Do not require a new production font until licensing, subset size, Chinese glyph coverage, and fallback metrics are verified. The prototype may use system or project fonts while demonstrating hierarchy.

### 9.3 Shape system

Documented rule:

- editorial surfaces: 16px to 24px corner radius only when a distinct surface is necessary;
- controls: pill only for short actions or compact state labels;
- evidence disclosures and lists: mostly flat, separated by rhythm or a single divider;
- media: one controlled image-mask family, not random blobs;
- nested cards are prohibited.

### 9.4 Layout rhythm

The profile alternates visual chapters instead of repeating one component:

- offset identity stage;
- full-width fact baseline;
- narrow reading column for story;
- wide timeline spine;
- two-path family/place section;
- topic chapters with varied image/text balance;
- media sequence;
- compact evidence ledger.

Variation is structural, not decorative.

## 10. Motion direction

With `MOTION_INTENSITY: 4`, motion is optional enhancement.

Allowed:

- 160 to 240 ms opacity and transform transitions;
- active chapter indicator movement;
- timeline items revealing once as they enter the viewport;
- media caption and evidence disclosure transitions;
- subtle follow-button state confirmation.

Not allowed:

- parallax on the lead photograph;
- scroll hijacking;
- horizontal pinned profile sections;
- infinite decorative loops;
- animated counters without task value;
- motion that changes reading order;
- React state driven directly by continuous scroll events.

Reduced-motion mode removes automatic entrance movement and keeps only instant state changes or minimal opacity transitions.

## 11. Responsive rules

### 11.1 Under 768 px

- strict single-column flow;
- name before tall media;
- no negative horizontal offsets;
- primary actions wrap to full-width or two-column controls;
- chapter navigation becomes a disclosure;
- dates remain adjacent to their event text;
- sources use one column and wrap long URLs or identifiers;
- media keeps intrinsic aspect ratio and never forces horizontal scroll;
- no hover-only explanation.

### 11.2 768 px to 1199 px

- identity stage uses a 5/7 or 6/6 split;
- current-state rail moves below identity text when necessary;
- family and place pathways may form two columns;
- topic chapters alternate only when content supports it.

### 11.3 1200 px and above

- use the full 12-column composition;
- maintain a readable story measure of about 65 to 75 characters per line;
- avoid stretching evidence rows across the entire viewport;
- use intentional empty space rather than adding decorative panels.

### 11.4 Long and translated content

- no fixed-height text containers;
- names and aliases wrap without overlap;
- English and Chinese controls may have different intrinsic widths;
- date and state labels do not rely on abbreviation;
- source titles and stable IDs use safe wrapping;
- localized chapter order may remain the same, but typography tokens may differ.

## 12. Representative prototype scenarios

Prototype files live under `docs/prototypes/panda-profile-v2/`.

### 12.1 Rich public profile

Subject: 喜伦 / Xi Lun from public release `2026.07.24.2`.

Approved data used:

- identity and birth date;
- parents 伦伦 and 洋洋;
- birth, public debut, and 2024 transfer events;
- Zoo Atlanta and Chengdu residencies;
- licensed Wikimedia Commons media published by ZhiPanda;
- public source and release metadata.

Any future topic chapter shown in the prototype is marked `DESIGN FIXTURE - NOT PUBLISHED` and contains no claim about the subject.

### 12.2 Sparse public profile

Subject: 轮辉 / Lun Hui from public release `2026.07.24.2`.

Purpose:

- identity-first record;
- limited event data;
- no hosted media;
- no empty navigation;
- clear next actions without generated biography.

### 12.3 Historic/deceased design fixture

Purpose:

- demonstrate deceased status, final-known place, legacy language, historic media restrictions, uncertain dates, and revision context;
- use an explicit fixture identity rather than imply that unpublished historic data is public;
- confirm that the page does not use present-tense current-state language for a deceased individual.

## 13. Public contract requirements

The implementation should introduce a versioned Profile V2 public record rather than make the frontend infer narrative structure from unrelated arrays.

### 13.1 Proposed top-level shape

```ts
interface PublicProfileV2Record {
  identity: PublicProfileIdentity;
  lifecycle: PublicProfileLifecycle;
  presentation: PublicProfilePresentation;
  modules: PublicProfileModule[];
  relationships: PublicProfileRelationship[];
  events: PublicProfileEvent[];
  residencies: PublicProfileResidency[];
  media: PublicProfileMedia[];
  sources: PublicProfileSource[];
  conflicts: PublicProfileConflict[];
  revision: PublicProfileRevision;
  relatedJourneys: PublicProfileJourneyLink[];
}
```

The exact schema name and version are owned by #234. The following capabilities are required.

### 13.2 Identity

- stable panda ID;
- canonical slug and legacy slugs;
- localized display names and translation state;
- pinyin and approved romanizations;
- aliases and historic spellings with source IDs;
- record tier or replacement coverage model;
- public identity status when a relation-only node lacks a full profile.

### 13.3 Lifecycle

- life status conclusion;
- birth date with precision and conclusion state;
- death date with precision when public;
- sex conclusion;
- current or final-known place conclusion;
- last verified date;
- candidate and superseded values;
- source IDs per conclusion.

### 13.4 Presentation

- reviewed localized summary;
- reviewed story paragraphs or structured rich text subset;
- optional reviewed chapter leads;
- curated highlight references that point to underlying event or fact IDs;
- explicit translation state per field;
- no unreviewed generated prose.

### 13.5 Modules

Each module requires:

- stable module ID;
- localized title when not fixed by the application;
- state: complete, partial, empty, unavailable, restricted, or source-link-only;
- coverage statement;
- item IDs and ordering owned by the public projection;
- source IDs;
- last verified date;
- optional public omission reason;
- no private moderation or review notes.

### 13.6 Topic facts

Atomic facts require:

- stable fact ID;
- controlled category and subcategory;
- typed value and unit;
- effective or observation date with precision;
- conclusion state;
- localized public label or reviewed narrative fragment where needed;
- source IDs;
- candidate and superseded values;
- sensitivity/publication state;
- revision identity.

The frontend must not map uncontrolled local-research category strings directly to public sections.

### 13.7 Events

Events require:

- stable event ID and type;
- event status;
- event date or range with precision;
- announcement date when applicable;
- source publication dates remain on sources;
- participants;
- from/to facility, institution, place, or coarse location;
- whether the event changes current residency;
- localized reviewed summary when available;
- source IDs;
- conflict and supersession links.

### 13.8 Relationships

Relationships require assertion-level records:

- stable assertion ID;
- parent and child IDs;
- relation role;
- confirmed, tentative, disputed, superseded, or unknown state;
- source IDs;
- effective/review dates when available;
- public profile availability for both nodes;
- no inference from legacy `father_id` or `mother_id` when an assertion exists.

### 13.9 Residencies and places

- stable residency ID;
- place, institution, and facility references;
- coarse-location fallback;
- start/end dates with precision;
- status and residency type;
- current/final-known marker;
- source IDs and last verified date;
- public precision sufficient for Map route generation;
- no inferred coordinates.

### 13.10 Media

- stable media ID;
- state: available, no-licensed-media, source-link-only, restricted, withdrawn, expired, or unavailable;
- hosted derivatives, dimensions, bytes, MIME type, and hash;
- localized alt text and caption state;
- credit, rights, source URL, and source IDs;
- focal point or crop-safe metadata if the design needs alternate aspect ratios;
- release and withdrawal identity;
- public reason category for unavailable states.

### 13.11 Sources, conflicts, and revisions

Sources require publisher, title, URL, language, publication date, last verified date, and normalized access state.

Conflicts require:

- affected fact, event, relation, or module ID;
- public status;
- candidate values or assertions;
- source IDs;
- reviewed public explanation when available.

Revision requires:

- release ID;
- public schema version;
- projection code version when appropriate;
- localized public summary;
- changed public fields or module IDs;
- superseded release link;
- withdrawal state.

## 14. Backend read-model and query requirements

### 14.1 Primary read

Recommended route shape:

`GET /v1/public/pandas/{slug}/profile?locale={locale}`

The response remains inside the Public Content Envelope and includes all content required for the server-rendered initial page.

Requirements:

- canonical slug resolution and redirect metadata;
- locale delivery state;
- release and coverage identity;
- deterministic module ordering;
- ETag or immutable release caching;
- no local-research fallback;
- no per-module network waterfall for first render.

### 14.2 Optional bounded reads

Large future profiles may use bounded server requests for:

- full source index;
- full revision history;
- expanded media list;
- expanded event history.

The initial response must still contain:

- identity stage;
- current/final state;
- reviewed story lead;
- visible module summaries;
- first curated timeline items;
- primary family and place pathways;
- source and release summary.

Client-side loading is not required to understand the profile.

### 14.3 Query behavior

- cursor pagination for large sources, media, events, or revisions;
- stable sort keys independent of localized display text;
- filters use controlled enums;
- release-bound cache keys;
- locale changes preserve the panda and anchor;
- profile links into Moments, Lineage, and Map use stable entity IDs plus canonical public query parameters;
- withdrawn records fail closed under existing policy.

## 15. Reusable frontend ownership

### 15.1 Profile-owned modules

- `ProfileIdentityStage`
- `ProfileCurrentState`
- `ProfileFactBaseline`
- `ProfileChapterNavigation`
- `ProfileStoryLead`
- `ProfileTimelineSpine`
- `ProfileFamilyPathway`
- `ProfileJourneyStrip`
- `ProfileTopicChapter`
- `ProfileMediaSequence`
- `ProfileTrustCenter`

### 15.2 Shared patterns after two real callers

- `ConclusionSignal`
- `DatePrecisionLabel`
- `EvidenceDisclosure`
- `SourceReferenceList`
- `NoLicensedMediaComposition`
- `RestrictedContentNotice`
- `PublicReleaseSummary`
- `RelatedJourneyLink`

Shared patterns own semantics and mechanics. Profile modules own composition.

### 15.3 Server/client boundary

Server Components own:

- all public content rendering;
- module visibility;
- source and status text;
- semantic timeline and relationship lists;
- metadata and structured data;
- no-JavaScript navigation.

Narrow client islands may own:

- active chapter indication;
- mobile chapter disclosure enhancement;
- follow/favorite state;
- media lightbox when approved;
- non-essential reveal transitions.

## 16. Accessibility acceptance criteria

- one clear `h1` containing the public display name;
- logical heading hierarchy independent of visual chapter size;
- skip link and stable `main` target retained;
- chapter navigation labels the destination and includes only rendered anchors;
- timeline is an ordered list with machine-readable dates when exact enough;
- approximate dates are not encoded as false exact dates;
- relationship state is announced as text;
- candidate and superseded values are keyboard reachable;
- all controls meet visible focus and target-size requirements;
- no meaning relies on color, shape, image, hover, or motion alone;
- media has reviewed localized alt text or correct decorative treatment;
- rights and source links are readable without opening a client-only lightbox;
- reduced motion removes automatic movement;
- 200% zoom and 320 px width retain all core tasks;
- no-JavaScript mode retains identity, story, events, family, journey, media state, sources, and revisions.

## 17. Performance acceptance criteria

- server-first initial render;
- no large client-only profile shell;
- route First Load JS should remain within the existing minimal Atlas/Profile budget of 170 KiB unless #234 documents and approves a new budget;
- lead media uses correct dimensions, responsive derivatives, and priority only when it is the actual LCP candidate;
- below-the-fold media is lazy loaded;
- no unbounded source, event, or media array in the initial response;
- animations use transform and opacity only;
- no continuous scroll state in React;
- layout reserves media space to avoid cumulative shift;
- no third-party font or animation dependency without bundle, license, fallback, and exit-cost review.

## 18. Localization acceptance criteria

- all application copy exists in Chinese and English;
- all editorial content carries field-level translation state;
- locale switching preserves slug, anchor, and compatible query state;
- missing translation never produces generated copy;
- source language is visible where relevant;
- names preserve the reviewed original language when translation is missing;
- Chinese and English typography may use separate tokens;
- date formatting respects precision and locale;
- titles, captions, empty states, and restricted states are reviewed in both languages before publication.

## 19. Media and data-honesty acceptance criteria

- only approved public projection data renders as fact;
- design fixtures never enter production responses;
- no personality, motive, popularity, or emotional state is inferred;
- no media is substituted from another panda;
- source-link-only media is linked, not copied or embedded as hosted media;
- restricted and withdrawn media fail closed;
- every current conclusion can expose its source IDs and verification date;
- disputed and superseded values remain inspectable;
- event and source publication dates remain distinct;
- current place and map links respect public precision;
- missing modules do not trigger generated filler;
- release and schema identity remain visible in the trust center.

## 20. Impeccable critique and hardening record

### 20.1 Shape result

Primary task hierarchy:

1. confirm identity;
2. understand current/final state;
3. read meaningful life sequence;
4. continue into family, time, or place;
5. inspect evidence.

The previous archive-first hierarchy is rejected.

### 20.2 Critique result

Risks identified and resolved:

- **Hero becomes a marketing banner:** keep stable identity and verified state in the first viewport.
- **Editorial prose hides facts:** retain a concise fact baseline and point-of-doubt evidence.
- **Every category becomes a card:** use dynamic chapters and varied structural patterns.
- **Rich design requires media:** define a complete no-media identity composition.
- **Motion becomes spectacle:** cap motion at level 4 and require reduced-motion equivalence.
- **Sparse records look broken:** remove empty navigation and provide truthful next journeys.
- **Historic profiles use present tense:** introduce current versus final-known language rules.
- **Evidence becomes an afterthought:** keep inline state signals and a complete server-rendered trust center.

### 20.3 Adapt result

- asymmetric desktop composition collapses to strict mobile flow;
- name precedes media on mobile;
- long aliases and bilingual titles wrap naturally;
- modules disappear cleanly without leaving layout holes;
- no-media and restricted-media designs remain intentional;
- all enhanced controls have static semantic fallbacks.

### 20.4 Harden result

The design explicitly covers:

- sparse identity-first records;
- no reviewed story;
- no events;
- relation-only nodes;
- disputed and superseded conclusions;
- approximate dates;
- no licensed media;
- source-link-only media;
- restricted or withdrawn media;
- historic/deceased language;
- missing translation;
- changed or unavailable sources;
- partial release coverage;
- delivery unavailability.

### 20.5 Audit result

The design does not require:

- a hero photograph;
- canvas or SVG for core meaning;
- client rendering for public content;
- new third-party dependencies;
- exact coordinates;
- uncontrolled local categories;
- generated biography text.

### 20.6 Polish result

Final visual and copy rules:

- one expressive identity stage, not a stack of hero cards;
- one documented shape system;
- dates use consistent precision language;
- actions use explicit labels such as `查看家族 / Explore family`;
- status labels do not use mystery icons;
- evidence density increases only inside disclosures and the trust center;
- decorative elements never imitate evidence marks, seals, or official badges.

## 21. Implementation handoff for #234

Recommended sequence:

1. Define and validate the Profile V2 public schema and compatibility strategy.
2. Build the release projection for identity, lifecycle, modules, topic facts, events, relationships, residencies, media, sources, conflicts, and revisions.
3. Add representative approved records and explicit fixture-free tests for rich, sparse, no-media, disputed, and historic/deceased states.
4. Implement shared semantic patterns before full chapter composition.
5. Implement the identity stage and trust center server-first.
6. Implement timeline, family, and journey modules with stable anchors and cross-surface links.
7. Implement dynamic topic chapters and media states.
8. Add only the narrow client islands required for navigation, follow state, and optional media enhancement.
9. Run targeted web and contract checks during implementation.
10. Defer broad browser, accessibility, release, staging, rollback, and withdrawal evidence to #234 as the map-closing ticket.

Required first-cohort profile scenarios:

- rich reviewed profile;
- sparse identity-first profile;
- historic or deceased profile;
- no licensed media;
- source-link-only media;
- disputed fact or relationship;
- missing translation;
- partial timeline;
- changed or restricted source.

## 22. Acceptance decision

Panda Profile V2 is ready for implementation when:

- the identity stage works with and without hosted media;
- the visible navigation is generated from actual modules;
- rich, sparse, and historic/deceased prototypes preserve the same product identity;
- public-contract requirements cover every rendered state;
- no production behavior depends on local research or design fixtures;
- Profile, Moments, Family Story, Lineage, Map, institution, and place ownership is unambiguous;
- accessibility, performance, localization, media, and evidence requirements are implementable under the existing architecture;
- #234 can implement the page without reopening the primary IA or visual-direction decisions.
