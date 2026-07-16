# PandaAtlas 跨 Surface 设计语言方向

> Status: Accepted design decision for [Prototype the cross-surface PandaAtlas design language](https://github.com/SwayingWindmill/PandaAtlas/issues/37).
>
> Decision owner: PandaAtlas product owner.
>
> Decision date: 2026-07-16.
>
> Scope: Public Home, Atlas, trusted panda profile, lineage and distribution / footprint map for the first Public Beta.

## 1. Decision

PandaAtlas adopts a controlled hybrid of the three reviewed prototype directions:

- **A — Living Archive / 温暖档案** is the single cross-site visual and interaction foundation.
- **B — Evidence Ledger / 证据台账** supplies evidence-dense patterns inside the Product register.
- **C — Trail Atlas / 路径图谱** supplies spatial interaction patterns inside map, lineage and cross-entity exploration features.

This is not three design systems and not three equal registers.

The accepted system remains:

> **One shared foundation, two controlled registers, multiple domain modules.**

The two registers remain:

- **Editorial register** for the Home page, archive method, public stories and other reading-led surfaces.
- **Product register** for Atlas, trusted profiles, lineage, map, institutions, places and task-focused public tools.

B and C are controlled pattern families inside the Product register:

- B is an **evidence-density mode**, not a third register.
- C is a **spatial feature mode**, not a third register.

## 2. Primary source

The decision was made against the throwaway interactive prototype captured on the dedicated branch:

- [Prototype branch](https://github.com/SwayingWindmill/PandaAtlas/tree/prototype/issue-37-cross-surface-design)
- [Prototype commit `ac4fdf1`](https://github.com/SwayingWindmill/PandaAtlas/commit/ac4fdf1)
- [Prototype review guide and screenshots](https://github.com/SwayingWindmill/PandaAtlas/blob/prototype/issue-37-cross-surface-design/docs/prototypes/cross-surface-design-language/README.md)
- [Prototype review comment](https://github.com/SwayingWindmill/PandaAtlas/issues/37#issuecomment-4983519107)

The prototype remains a primary decision artifact. Its code is throwaway and must not be merged directly into production.

## 3. Inputs and precedence

This decision implements and does not replace:

- [Frontend system audit](../research/frontend-system-audit-2026-07-15.md)
- [Frontend design principles and standards](./frontend-design-principles-and-standards.md)
- [Core public journeys and information architecture](./core-public-journeys-and-information-architecture.md)
- [Frontend system boundary and token/component architecture](../architecture/frontend-system-boundary-and-token-component-architecture.md)
- [Public content, data-honesty, media and UI-state rules](./content-data-honesty-media-and-ui-state-rules.md)

When this document appears to conflict with an upstream decision, the upstream product fact, accessibility, data-honesty or architecture decision wins.

## 4. Why the hybrid wins

### 4.1 Why A is the foundation

A best communicates the chosen product identity:

- a warm public natural-history archive;
- an individual-first knowledge network;
- editorial quality without marketing inflation;
- reading comfort without hiding evidence;
- continuity between public introduction and task-focused records;
- an experience that can be calm on mobile and exploratory on desktop.

A also maps cleanly to the accepted Editorial and Product registers.

### 4.2 Why B is retained selectively

B makes the following information unusually legible:

- conclusion status;
- freshness and Last verified;
- release and schema versions;
- source access state;
- precision;
- coverage and truncation;
- revision history;
- dense relationship or location results.

Using B globally would make PandaAtlas feel like an internal audit console. Using it selectively gives evidence-heavy regions the rigor they need without turning the whole public site into a database browser.

### 4.3 Why C is retained selectively

C gives PandaAtlas a distinctive exploration model:

- start from an individual;
- follow a relationship;
- move to a place or event;
- inspect the source or revision behind the claim;
- preserve task context across surfaces.

Using C globally would increase cognitive load and slow basic fact lookup. Restricting it to map, lineage and explicit cross-entity exploration preserves its value where spatial reasoning is the task.

## 5. Non-negotiable interpretation

The accepted direction means all of the following:

1. The public site has one recognizable brand foundation.
2. Editorial and Product registers may differ in density and composition, not in trust semantics.
3. Evidence density is applied to information that benefits from comparison, traceability or audit.
4. Spatial composition is applied only when spatial or relational reasoning is central.
5. A plain structured equivalent remains first-class wherever C-style visualization appears.
6. Decorative completeness never outranks source, precision, media rights or delivery state.
7. The prototype is evidence for the decision, not production code.

## 6. Design-system mapping

| Prototype source | Accepted role | Primary surfaces | Explicit limitation |
|---|---|---|---|
| A — Living Archive | Shared visual foundation and both register shells | All public surfaces | Must not turn task pages into long editorial essays |
| B — Evidence Ledger | Evidence-dense pattern family | Profile facts, sources, revisions, complex result sets | Must not become the global shell or default card style |
| C — Trail Atlas | Spatial feature pattern family | Lineage, map, cross-entity trails | Must not replace direct navigation or linear alternatives |

## 7. Cross-site visual foundation

### 7.1 Character

The system should feel:

- warm but not sentimental;
- archival but not antique;
- precise but not clinical;
- bilingual but not mechanically mirrored;
- alive but not animated for spectacle;
- nature-informed but not decorated with generic bamboo motifs.

### 7.2 Palette

Use a restrained light theme for the first Public Beta.

The palette family is:

- mineral or botanical near-black for primary text;
- field-paper or chalk neutral for page background;
- lichen, moss or forest green as the single primary accent family;
- muted structural neutrals for dividers and inactive controls;
- semantic warning, error and status colors owned by Foundation tokens.

Rules:

- Do not use an AI-purple or blue-glow default.
- Do not create a beige-plus-brass lifestyle brand palette.
- Do not assign a unique decorative color to every feature.
- Domain colors may distinguish map layers or relation types only through centralized registries.
- Status color never changes between Editorial, Product, evidence-dense or spatial modes.
- Color never carries status alone.

### 7.3 Typography

Use the already accepted two-family approach:

- **Product Sans** for navigation, controls, facts, tables, status, metadata and task copy.
- **Editorial Serif** for selected display headlines and reading-led section titles.

Editorial Serif is limited to:

- Home hero and major Home section headings;
- archive-method or story titles;
- trusted profile identity heading when the surrounding layout remains task-oriented;
- selected empty or correction-state headline where dignity matters.

Editorial Serif is not used for:

- labels;
- form controls;
- source metadata;
- tables;
- statuses;
- map controls;
- lineage relation labels;
- dense result rows.

Chinese and English typography must be tested independently. A Latin serif choice does not authorize a mismatched Chinese fallback with a different visual register.

### 7.4 Shape

Use a controlled shape hierarchy:

- small-radius or nearly square containers for facts, sources and records;
- medium soft radius for major page groups and editorial feature regions;
- pills only for compact statuses, filters and bounded controls;
- circles only when identity, map marker or graph-node semantics justify them.

Do not mix arbitrary sharp, soft and pill containers merely for visual variety.

### 7.5 Dividers and elevation

Default grouping uses:

- spacing;
- section rules;
- column dividers;
- subtle tonal fields.

Use elevation only where it communicates a real layer:

- sticky fact rail;
- map drawer;
- modal or disclosure;
- floating prototype-only control, which does not carry into production.

Do not convert every section into a shadowed card.

### 7.6 Texture and imagery

The system may use restrained texture through:

- tonal background variation;
- fine rules;
- geometric botanical abstraction that carries no factual claim;
- licensed documentary or explicitly illustrative media.

Do not use:

- unlicensed panda photography;
- generic bamboo wallpaper;
- decorative maps that resemble evidence maps;
- generated documentary imagery;
- fake product screenshots;
- decorative silhouettes in place of a no-media state.

## 8. Global Product Shell

The localized Product Shell establishes continuity across Atlas, profile, lineage and map.

It owns:

- PandaAtlas identity;
- primary public navigation;
- global search entry;
- locale switch;
- current route indication;
- persistent but non-dominant release or delivery notice when required;
- mobile navigation collapse.

It does not own:

- page-specific filters;
- current panda identity;
- map mode;
- lineage depth;
- source lists;
- feature-specific status calculation.

### 8.1 Desktop navigation

Desktop navigation stays on one line.

Primary entries are task-based and match the accepted information architecture. Labels are concise enough to survive English expansion.

The active route uses more than color, such as shape, weight or underline.

### 8.2 Mobile navigation

Mobile prioritizes:

1. brand / return Home;
2. search;
3. current task title;
4. locale;
5. menu.

Do not place all desktop navigation items into a horizontally compressed row.

Opening the menu must preserve:

- current route;
- current locale;
- focus return;
- keyboard dismissal;
- scroll position.

## 9. Editorial register

The Editorial register is led by A.

It permits:

- larger display typography;
- asymmetric composition;
- longer reading width transitions;
- documentary or illustrative media with full provenance;
- chapter-like sequencing;
- restrained entrance motion.

It still requires:

- explicit status where claims appear;
- source access for factual assertions;
- honest CTA destinations;
- no invented social proof;
- no unlicensed media;
- clear fallback and error states.

The Editorial register may introduce a task but must hand off to the Product register before dense interaction begins.

## 10. Product register

The Product register is led by A's calm foundation with higher density.

It prioritizes:

- direct task title;
- visible current scope;
- filters and query state;
- structured facts;
- source and verification access;
- stable controls;
- predictable responsive collapse.

It avoids:

- oversized manifesto headings inside tools;
- long narrative interruptions before the primary task;
- decorative panels that hide data hierarchy;
- feature-specific navigation conventions that compete with the global shell.

## 11. Evidence-dense mode

Evidence-dense mode borrows B's strengths without inheriting its global aesthetic.

### 11.1 When to use it

Use evidence-dense patterns when users need to compare or audit:

- key facts;
- conclusion candidates;
- source support;
- relation status;
- place precision;
- revision entries;
- release metadata;
- result coverage;
- incomplete or degraded delivery.

### 11.2 When not to use it

Do not use evidence-dense mode for:

- Home hero;
- general editorial introduction;
- a simple two-field summary;
- ordinary navigation;
- decorative statistics;
- every result card by default.

### 11.3 Visual behavior

Evidence-dense regions use:

- Product Sans only;
- aligned labels and values;
- consistent field order;
- visible status and precision;
- strong but not black-box grid structure;
- monospace only for identifiers, schema versions or machine-shaped values;
- plain-language labels beside technical values;
- source actions that are explicit text, not mystery icons.

### 11.4 Table rule

A table is appropriate only when row-to-row comparison is the task.

On narrow screens:

- preserve column meaning;
- prefer stacked record rows for primary public tasks;
- allow bounded horizontal scrolling only for truly tabular evidence;
- keep the row identity visible while scrolling where feasible;
- never cause page-level horizontal overflow;
- provide a readable non-table rendering when the table is not essential.

## 12. Spatial feature mode

Spatial feature mode borrows C's path and node composition.

It is owned by feature modules, not global layout.

### 12.1 Eligible uses

- lineage graph;
- footprint and distribution map;
- an explicit “follow this relation/place/source” trail;
- a focused relationship path between known entities.

### 12.2 Ineligible uses

- global navigation;
- ordinary Atlas search results;
- every trusted profile fact;
- source lists;
- correction notices;
- static decorative Home diagrams that imply real graph data.

### 12.3 Required pairing

Every spatial visualization is paired with a first-class structured view.

The structured view preserves:

- focus entity;
- current scope and filters;
- relation or place labels;
- conclusion status;
- precision;
- source access;
- Last verified or snapshot date;
- ordinary links to related public pages.

The structured view is not called “fallback” in user-facing copy. It is an equal representation of the task.

### 12.4 Visual emphasis

Spatial mode may use:

- darker or more concentrated tonal fields within the same page theme family;
- nodes and paths;
- a focused information drawer;
- spatial transition motion;
- feature-specific domain colors from registries.

It may not:

- switch the entire site into an unrelated dark theme;
- hide attribution;
- make a line imply a confirmed relation without status;
- use map marker size as an unsupported importance claim;
- allow visualization state to exist only in local component memory.

## 13. Home page direction

The Home page uses A as the dominant direction.

### 13.1 First viewport

The first viewport establishes:

- PandaAtlas as a trusted individual-first archive;
- the relationship between identity, family, place and sources;
- one primary search or Atlas action;
- one secondary method or archive explanation action;
- no fabricated metrics or social proof.

The first viewport does not become an interactive graph. C may inform a restrained visual relationship motif, but it must not compete with the primary search action.

### 13.2 Below the first viewport

The Home page may use chapter-like sections for:

- start with an individual;
- explore family;
- explore footprint;
- understand sources and revisions.

Each section has a distinct layout job. Avoid repeating equal card grids.

### 13.3 Evidence on Home

Home can show:

- release-scoped collection counts;
- a current published profile specimen;
- Last verified for the shown specimen;
- a release snapshot date.

It must label the scope explicitly. It must not imply global real-world totals.

## 14. Atlas direction

Atlas uses A's Product register as the base and selective B patterns.

### 14.1 Primary hierarchy

1. Page title and current release / coverage context.
2. Search input.
3. active filters and result scope.
4. result list.
5. source or method help where needed.

### 14.2 Result rows

A standard result row prioritizes:

- current locale primary name;
- secondary identity name or alias cue;
- stable identity discriminator;
- birth date or year at supported precision;
- current place at supported precision;
- conclusion and freshness cues where relevant;
- no-media state when needed;
- direct profile action.

Do not turn every result into a visual card with a forced image.

### 14.3 Filtering

Desktop may use a persistent filter rail.

Mobile uses a filter summary and disclosure or sheet while preserving:

- current query;
- selected filters;
- result count scope;
- clear-all action;
- focus return.

Filters do not silently alter the query when the page enters an empty state.

### 14.4 Dense comparison

A B-style comparison table may be offered for expert or evidence-heavy use, but the default public Atlas remains a readable list.

## 15. Trusted profile direction

The trusted profile uses A for identity and narrative hierarchy and B for facts, sources and revisions.

### 15.1 Above the fold

The first profile viewport contains:

- stable archive identity;
- current locale primary name;
- secondary official name or original script where appropriate;
- conclusion status summary;
- current place with precision;
- Last verified;
- media or an explicit no-media state;
- direct source access;
- actions into lineage and footprint.

### 15.2 Layout

Desktop uses a reading column plus an evidence rail or evidence region.

The evidence region may be sticky only when:

- it does not hide footer or correction content;
- it remains keyboard reachable;
- zoom and short viewport tests pass;
- it stops before its containing section ends.

Mobile collapses into this order:

1. identity;
2. status and current place;
3. media / no-media;
4. key facts;
5. summary;
6. family and footprint actions;
7. timeline;
8. sources;
9. revisions and corrections.

### 15.3 Facts

Key facts use B-style aligned fields with:

- value;
- conclusion status;
- freshness;
- precision;
- Last verified;
- source action.

Do not combine all metadata into one badge.

### 15.4 Story

Profile narrative may be warm and readable, but it cannot introduce unsupported personality, emotion or motives.

### 15.5 Revisions

Revision history is a structured evidence region, not a decorative timeline.

## 16. Lineage direction

Lineage uses C for the graph and B for relationship evidence.

### 16.1 Graph role

The graph supports:

- understanding relation topology;
- changing focus;
- seeing current depth;
- following a relation.

It does not independently establish truth.

### 16.2 Structured relation view

The relation list or matrix remains visible or one direct action away.

Each relation includes:

- subject;
- relationship role;
- object;
- conclusion status;
- source count or source action;
- applicable precision or ambiguity note;
- ordinary links.

### 16.3 Responsive behavior

Desktop may present graph and relation evidence side by side.

Mobile presents:

- focus and scope controls;
- compact graph overview or selected path;
- structured relationship list immediately after it;
- no forced horizontal canvas as the only interface.

### 16.4 Failure behavior

Graph failure leaves focus, scope and the complete relation list intact.

## 17. Map and footprint direction

Map uses C for spatial interaction and B for place, snapshot and coverage evidence.

### 17.1 Map role

The map supports spatial comparison and orientation.

It does not own:

- place identity;
- current residence truth;
- event completion;
- source support;
- total counts.

### 17.2 Structured view

The map is paired with a place or footprint list containing:

- place name;
- interval or event date;
- place precision;
- conclusion status;
- snapshot date;
- source action;
- profile or place link.

### 17.3 Desktop composition

Desktop may use:

- map canvas plus evidence drawer;
- synchronized list and selected marker;
- visible attribution;
- URL-backed viewport and mode.

### 17.4 Mobile composition

Mobile prioritizes task completion over preserving a desktop split.

Allowed patterns include:

- map above structured list;
- list-first with an optional map expansion;
- map with a stable bottom sheet that can be fully expanded.

The list cannot be hidden behind a gesture-only interaction.

### 17.5 Failure behavior

Map-provider or rendering failure preserves:

- mode;
- filters;
- focus entity;
- snapshot date;
- coverage;
- full structured place list.

## 18. Institutions and places

Institution and Place pages use the Product register.

They combine:

- A-style identity and reading hierarchy;
- B-style facts, sources and revision evidence;
- C-style spatial entry only when location or relationship exploration is the task.

Institution and Place remain distinct domain concepts even when their page composition is related.

## 19. Navigation between surfaces

Cross-surface transitions use explicit task labels:

- View trusted profile;
- Explore family;
- View footprint;
- Open place;
- View supporting source;
- Review revision history.

Do not use generic labels such as “Discover,” “Learn more” or “Explore” when the destination can be named.

The URL remains the source of truth for public task state including:

- locale;
- search query;
- filters;
- current mode;
- focus entity;
- relation depth;
- map viewport where appropriate;
- selected place or relation when shareable.

## 20. Evidence and state placement

### 20.1 Conclusion status

Place conclusion status adjacent to the fact or relation it qualifies.

### 20.2 Freshness

Place freshness and Last verified adjacent to time-sensitive facts or in a clearly associated evidence group.

### 20.3 Delivery status

Place live, cached, partial or unavailable at page or result-region level.

### 20.4 Precision

Precision is part of the value presentation, not hidden in source details.

Examples:

- China · country-level precision;
- 2023 · year precision;
- approximately 12 records in this published scope.

### 20.5 Corrections

A major correction appears before the affected content, not only in revision history.

## 21. Loading, empty, error and degraded states

All states inherit A's calm foundation and use B's clarity.

C-style spatial composition must disappear when it would obscure the state.

### 21.1 Loading

- Preserve shell, title and task context.
- Use structure-matched skeletons only where predictable.
- Do not render fake names, numbers or media.
- Stop continuous motion under reduced motion.

### 21.2 Empty

- State the successful query scope.
- Explain that no published matches were found.
- Preserve query and filters.
- Offer clear adjustment actions.

### 21.3 Error

- Name the affected action or module.
- Preserve successfully loaded content.
- Provide retry and structured alternative where relevant.

### 21.4 Cached

- Name the published release.
- State what cannot refresh.
- Keep evidence semantics unchanged.

### 21.5 Partial

- Name missing scope.
- Limit counts to the visible set.
- Avoid global ranking or totals.

### 21.6 No media

- Preserve identity and facts.
- Explain that no media is cleared for public use.
- Do not substitute another panda or generic decorative image.

## 22. Bilingual pressure

Every design decision is tested in Chinese and English.

### 22.1 Layout rules

- Navigation labels have bounded expansion plans.
- Status labels do not rely on fixed English widths.
- Names may occupy two lines without colliding with actions.
- Source titles may wrap naturally.
- Buttons remain one line at supported desktop widths; copy is shortened before font size is reduced below accessible norms.
- Tables do not assume Chinese label length.

### 22.2 Identity

The primary and secondary name hierarchy follows the accepted locale and original-name rules.

Do not silently substitute one locale field for another.

### 22.3 Semantic parity

Both locales preserve:

- conclusion strength;
- freshness;
- precision;
- coverage;
- source access;
- correction significance;
- CTA destination.

## 23. Responsive system

Responsive behavior is task-driven, not a uniform scale-down.

### 23.1 Wide desktop

Use the wide container for:

- synchronized map and list;
- lineage graph and relation evidence;
- Atlas filters and results;
- profile reading column and evidence rail.

### 23.2 Standard desktop and tablet landscape

Reduce secondary decoration before reducing evidence readability.

### 23.3 Tablet portrait

- collapse secondary rails below or into disclosures;
- keep current task and state visible;
- avoid three-column information architecture;
- preserve ordinary links.

### 23.4 Mobile

- single primary reading flow;
- no page-level horizontal overflow;
- minimum comfortable targets;
- filters and evidence details through labeled disclosures;
- visualization is optional to task completion;
- bottom sheets do not trap critical content or focus.

### 23.5 Zoom

At 200% and 400% zoom, layout must reflow without hiding facts, status, source actions or recovery controls. Exact sign-off evidence belongs to [Define frontend quality gates and visual verification](https://github.com/SwayingWindmill/PandaAtlas/issues/38).

## 24. Focus and keyboard behavior

Every interactive element has a visible focus style derived from Foundation tokens.

Requirements include:

- skip to main content;
- predictable navigation order;
- focus return for menu, filter sheet and disclosures;
- no keyboard-only hidden map or graph actions;
- ordinary links for entity transitions;
- no arrow-key hijacking while typing;
- Escape behavior for temporary layers;
- no focus loss when loading, filtering or changing visualization focus.

## 25. Motion

Motion follows the accepted CSS-first policy.

### 25.1 A-style motion

Allowed:

- restrained editorial entrance;
- disclosure expansion;
- navigation state transition;
- list insertion or filter feedback.

### 25.2 B-style motion

Evidence-dense regions use minimal motion. Changes should be communicated primarily through stable layout and explicit state.

### 25.3 C-style motion

Spatial mode may use motion to explain:

- focus change;
- route continuity;
- map movement;
- relation expansion;
- drawer connection to a selected node.

It may not use perpetual floating nodes as a production default.

### 25.4 Reduced motion

Reduced motion replaces spatial travel with direct state changes while preserving selection and context.

## 26. Icons

Lucide remains the sole generic icon family through the controlled icon registry.

Rules:

- icons support text labels;
- ambiguous actions do not use icon-only controls;
- custom domain SVG is limited to registered map or lineage symbols;
- no emoji as interface iconography;
- icon size and stroke follow semantic control tokens.

## 27. Media

The selected direction does not change the media fail-closed policy.

Media placement must work equally well when the public state is:

- licensed documentary media;
- public-domain media;
- illustrative media;
- source-link-only;
- no-licensed-media;
- withdrawn or expired.

A visually rich composition must not depend on having a hero photograph.

## 28. Component and ownership mapping

### 28.1 Foundation

Owns:

- palette tokens;
- typography tokens;
- spacing and container tokens;
- focus;
- semantic status color;
- motion durations and easing;
- elevation and shape primitives.

### 28.2 UI primitives

Owns generic interaction mechanics:

- Button;
- Input;
- Select;
- Disclosure;
- Dialog or sheet;
- Tabs where appropriate;
- Badge mechanics;
- Separator;
- tooltip only when necessary.

### 28.3 Shared patterns

Candidate shared patterns include:

- GlobalNav;
- GlobalSearchEntry;
- LocaleSwitch;
- DeliveryStateBanner;
- ConclusionStatus;
- LastVerified;
- FactEvidenceRow;
- SourceDisclosure;
- NoLicensedMedia;
- EmptyResult;
- ErrorRecovery;
- StructuredEquivalentNotice.

A pattern becomes shared only after two real callers.

### 28.4 Feature modules

Atlas owns:

- query and filter composition;
- result-row composition;
- coverage summary.

Profile owns:

- identity hero;
- profile fact arrangement;
- timeline and revision placement.

Lineage owns:

- graph geometry;
- relation selection;
- relation registry;
- structured relation view.

Map owns:

- provider adapter;
- map geometry;
- viewport state;
- place drawer;
- structured place view;
- attribution.

Feature modules may consume shared evidence patterns but cannot redefine status semantics.

## 29. Register and mode selection rules

Use this decision tree:

1. Is the primary task reading or orientation?
   - Use Editorial register with A foundation.
2. Is the primary task finding, comparing or verifying public records?
   - Use Product register with A foundation.
3. Does a region require row-to-row evidence comparison or explicit traceability?
   - Apply B evidence-dense patterns to that region.
4. Is spatial or relational reasoning the central task?
   - Apply C spatial feature mode within the Product register.
5. Would the task remain incomplete without the visualization?
   - Redesign until the structured equivalent is complete.

## 30. Anti-patterns

The following are rejected:

- three independent visual themes corresponding to A, B and C;
- a dark spatial theme that makes map and lineage look like a different product;
- a global audit-console aesthetic;
- a Home page built as a relation graph;
- dense tables as the default mobile public interface;
- profile facts hidden behind editorial prose;
- evidence metadata reduced to colored badges;
- maps or graphs without complete structured equivalents;
- a hero image requirement that pressures the team to use unlicensed media;
- multiple generic card grids;
- decorative numeric claims;
- mystery icon actions;
- static success-only mockups;
- copying prototype CSS or components into production without rewrite and tests.

## 31. First implementation slice

The accepted first vertical slice remains:

> Localized Product Shell + global navigation + global search entry + trusted profile above the fold.

It should demonstrate the hybrid as follows:

### A foundation

- localized Product Shell;
- warm neutral page foundation;
- Product Sans plus limited profile display Serif;
- consistent navigation and responsive collapse;
- no-media-safe identity composition.

### B evidence patterns

- current place with precision;
- conclusion status;
- Last verified;
- source access;
- release / delivery state where required.

### C entry points

- explicit “Explore family” and “View footprint” actions;
- no embedded graph or map in this first slice unless needed to validate a shared seam.

This slice is intentionally narrow. It validates the system before rebuilding Atlas, lineage or map.

## 32. Subsequent vertical slices

Recommended order:

1. Product Shell and trusted profile above the fold.
2. Profile facts, sources, revisions and no-media state.
3. Atlas search, filters and result list.
4. Lineage structured relation view.
5. Lineage visualization synchronized with the structured view.
6. Map structured place / footprint view.
7. Map visualization synchronized with the structured view.
8. Editorial Home and archive-method surfaces using the proven Foundation.

The final phased implementation handoff is owned by [Create the phased frontend implementation handoff](https://github.com/SwayingWindmill/PandaAtlas/issues/39).

## 33. Quality evidence boundary

This document defines what the design must express. It does not finalize numeric quality thresholds or the complete PR evidence matrix.

[Define frontend quality gates and visual verification](https://github.com/SwayingWindmill/PandaAtlas/issues/38) will decide:

- supported viewport and browser matrix;
- screenshot baselines;
- visual-regression policy;
- keyboard, screen-reader and zoom sign-off;
- performance budgets;
- staging requirements;
- human evidence requirements;
- exact default Release Gate checks.

Missing quality evidence must never be interpreted as a pass.

## 34. Prototype disposition

The prototype branch remains available as a historical primary source.

Production implementation must:

- re-create the accepted behavior in the real architecture;
- use real Public Content Envelope data;
- use shared tokens and owned patterns;
- include tests and error handling;
- remove prototype switchers and mock scenario controls;
- not ship prototype fixture counts or labels;
- not merge the throwaway route.

## 35. Acceptance scenarios

The following scenarios define whether implementation reflects the selected direction. Exact test tooling and sign-off evidence are deferred to the quality-gate ticket.

### AS-01 — One system

Given Home, Atlas, profile, lineage and map,
when a user moves between them,
then they recognize one PandaAtlas system rather than three prototype themes.

### AS-02 — Register distinction

Given Home and Atlas,
when both are rendered,
then Home may be more editorial while Atlas is more task-dense without changing trust, focus or status semantics.

### AS-03 — Evidence region

Given a trusted profile,
when key facts render,
then value, status, freshness, precision and source access remain visibly associated.

### AS-04 — No global ledger

Given the Home page,
when release context appears,
then the page does not become a full-width audit table or internal console.

### AS-05 — Spatial ownership

Given lineage or map,
when the visualization renders,
then its geometry is owned by the feature and does not redefine global navigation or Foundation tokens.

### AS-06 — Structured lineage

Given a lineage graph,
when the graph is unavailable,
then focus, scope, relationship status, sources and links remain complete in the structured relation view.

### AS-07 — Structured map

Given a map,
when the provider is unavailable,
then mode, filters, snapshot, place precision and links remain complete in the structured place view.

### AS-08 — Direct fact lookup

Given a mobile trusted profile,
when a user seeks current place and Last verified,
then they can find them before reading long narrative content.

### AS-09 — Editorial claim

Given a warm editorial paragraph,
when it contains a concrete date, relationship or place,
then the claim obeys the same source and precision rules as Product surfaces.

### AS-10 — No-media composition

Given no licensed media,
when a profile or result renders,
then layout remains intentional without substituting another panda or fabricated image.

### AS-11 — Atlas result

Given an Atlas result,
when media is unavailable,
then identity, current place, status and profile action remain readable and correctly prioritized.

### AS-12 — English pressure

Given English names, source titles and status copy,
when they expand beyond Chinese lengths,
then navigation, result rows and evidence regions reflow without overlap.

### AS-13 — Mobile filters

Given selected Atlas filters on mobile,
when the filter sheet closes,
then query, filter summary, result scope and focus are preserved.

### AS-14 — Tabular evidence

Given a truly comparative evidence table,
when viewed on mobile,
then any horizontal scrolling is bounded to the region and page-level overflow does not occur.

### AS-15 — Partial results

Given partial Atlas, lineage or map results,
when counts appear,
then they are limited to the visible coverage and cannot be read as global totals.

### AS-16 — Cached delivery

Given a cached published release,
when a surface renders,
then release identity and unavailable refresh capabilities are explicit without changing fact conclusion status.

### AS-17 — Focus

Given keyboard navigation,
when a user moves through shell, evidence, source and feature controls,
then visible focus is consistent across all registers and modes.

### AS-18 — Reduced motion

Given reduced motion,
when a lineage focus or map selection changes,
then selection updates directly without spatial travel while preserving context.

### AS-19 — Status consistency

Given the same provisional relationship in profile and lineage,
when both render,
then label, color, icon and explanatory meaning remain consistent.

### AS-20 — Place precision

Given a country-level current place,
when profile, Atlas and map render it,
then none of them imply a specific institution through copy, marker or visual placement.

### AS-21 — Source action

Given a fact with a public source,
when source access is available,
then a labeled, keyboard-accessible action reaches the supporting source record.

### AS-22 — Correction

Given a significant correction,
when a profile loads,
then the correction appears before the affected content and also remains in revision history.

### AS-23 — Home CTA

Given the Home hero,
when the primary CTA renders,
then it leads to global search or Atlas and accurately describes that destination.

### AS-24 — Cross-surface path

Given a trusted profile,
when a user chooses family or footprint,
then the destination preserves the focus entity through URL-backed state.

### AS-25 — Theme continuity

Given a transition from profile to map,
when spatial mode appears,
then the page may concentrate tone but does not switch into an unrelated product theme.

### AS-26 — Shared-pattern threshold

Given a second real caller for an evidence or state pattern,
when extraction is proposed,
then the shared pattern owns repeated semantics while feature composition remains local.

### AS-27 — Prototype isolation

Given a production build,
when routes and bundles are inspected,
then the prototype switcher, variant code and mock state controls are absent.

### AS-28 — Public data

Given production implementation,
when content renders,
then it consumes the Public Content Envelope rather than the prototype fixture objects.

### AS-29 — Media rights

Given a visually prominent media slot,
when no publishable asset exists,
then the no-media state is used even if an unreviewed repository image is available.

### AS-30 — Implementation boundary

Given the first vertical slice,
when complete,
then it proves Foundation, Product Shell, evidence patterns and cross-feature entry seams without rebuilding the entire site.

## 36. Final directive

The selected direction can be summarized as:

> **A establishes the place. B establishes the proof. C establishes the path.**

The user should always be able to:

- understand where they are;
- identify the current panda, relation or place;
- see what is known and how precisely;
- trace the evidence;
- continue into family or footprint;
- complete the same task without a graph, map, image or animation.
