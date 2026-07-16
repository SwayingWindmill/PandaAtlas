# PandaAtlas 前端质量门禁与视觉验证规范

> Status: Accepted release-policy decision for [Define frontend quality gates and visual verification](https://github.com/SwayingWindmill/PandaAtlas/issues/38).
>
> Decision owner: PandaAtlas product owner.
>
> Decision date: 2026-07-16.
>
> Scope: All public frontend slices, release candidates, staging deployments and formal Public Beta release decisions.

## 1. Executive decision

PandaAtlas adopts a three-layer frontend evidence model:

1. **Default PR Release Gate** proves deterministic correctness and clean-checkout reproducibility.
2. **Deployed Staging Gate** proves the immutable release artifact behaves correctly in the real delivery environment.
3. **Human release sign-off** proves semantic, visual, bilingual and assistive-technology usability that automation cannot establish.

A frontend release decision is valid only when every applicable layer is complete and bound to the same commit, build artifact, deployment and Public Release.

The governing rule is:

> **Automation proves reproducible assertions. Staging proves real deployment behavior. Humans prove meaning and usability. Missing applicable evidence is BLOCKED, never PASS.**

The release owner may record only:

- `GO`
- `NO_GO`
- `BLOCKED`

`BLOCKED` is not permission to release.

## 2. Related decisions and source material

This policy implements and does not replace:

- [Frontend system audit](../research/frontend-system-audit-2026-07-15.md)
- [Frontend design principles and standards](../design/frontend-design-principles-and-standards.md)
- [Core public journeys and information architecture](../design/core-public-journeys-and-information-architecture.md)
- [Frontend system boundary and token/component architecture](../architecture/frontend-system-boundary-and-token-component-architecture.md)
- [Public content, data-honesty, media and UI-state rules](../design/content-data-honesty-media-and-ui-state-rules.md)
- [Cross-surface design language direction](../design/cross-surface-design-language-direction.md)
- [WCAG 2.2 Level AA launch evidence baseline](./wcag-2.2-aa-evidence-baseline.md)
- [WCAG 2.2 AA human acceptance checklist](./wcag-2.2-aa-human-acceptance-checklist.md)
- [Release gate](./release-gate.md)
- [Beta hard-gate evidence inventory](./beta-hard-gate-evidence-inventory.md)
- [Versioned public projection](./versioned-public-projection.md)

When requirements conflict, precedence remains:

1. product facts, public safety and domain boundaries;
2. WCAG 2.2 A/AA and core task completion;
3. content truth, source traceability and media rights;
4. this quality-gate policy;
5. project implementation conventions;
6. external visual preferences.

## 3. Normative language

The terms `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT` and `MAY` are normative.

- `MUST` and `MUST NOT` define release conditions.
- `SHOULD` and `SHOULD NOT` define the expected implementation unless a documented reason applies.
- `MAY` identifies an allowed option.

A missing required record is not an implicit pass.

## 4. Current repository baseline

The existing repository already provides meaningful release infrastructure:

- `.github/workflows/release-gate.yml` checks out a clean repository and runs on Linux and Windows;
- Node, npm, Python and uv versions are pinned in CI;
- workspace dependencies are installed from lockfiles;
- the default gate runs lint, typecheck, production build, public contracts, release consistency, worker checks, API tests, Playwright accessibility checks and browser smoke;
- the workflow verifies that the gate does not modify tracked files;
- machine-readable release artifacts are uploaded;
- Playwright and axe cover selected Chinese and English profiles, distribution, lineage, mobile reflow, keyboard operation and reduced motion;
- the WCAG evidence baseline explicitly requires human screen-reader evidence and prohibits treating automation as a complete conformance claim;
- `beta-hard-gates` already checks selected source, release, public-field and privacy invariants.

The current system does not yet provide the complete policy defined here:

- the browser test matrix is Chromium-only;
- visual-regression baselines and approval workflow do not exist;
- route and shared-bundle budgets are not enforced;
- Lighthouse and deployed Core Web Vitals laboratory checks are absent;
- frontend Public Content Envelope, locale parity, media manifest and UI-state coverage are not complete release checks;
- current browser smoke can point the frontend at an unavailable API and therefore cannot prove real deployed Public Content Envelope behavior;
- the Staging Gate is not a separate required check bound to an immutable deployment;
- human evidence is stored in documents but is not yet expressed as a structured release manifest with machine-enforced completeness;
- missing human, language or real-device evidence can still be easy to overlook in ordinary PR review.

This policy converts those gaps into explicit implementation requirements.

## 5. Evidence status vocabulary

Every automated, staging or human evidence record MUST use one of four statuses:

- `PASS`: the check ran against the declared artifact and met its acceptance condition.
- `FAIL`: the check ran and found a release-blocking failure.
- `BLOCKED`: the check could not produce valid evidence because required scope, environment, deployment, data, device, evaluator or artifact was unavailable.
- `NOT_APPLICABLE_WITH_REASON`: the check is genuinely inapplicable, with a concrete reason approved by a reviewer.

The following are invalid substitutes:

- blank value;
- unchecked checkbox;
- `TODO`;
- `SKIPPED` without a structured reason;
- “not tested”;
- “looks fine”;
- “no issue reported”;
- tool exit success without retained result;
- environment failure reported as success.

## 6. Three-layer evidence model

### 6.1 Layer 1 — Default PR Release Gate

The default gate MUST run for every frontend-affecting pull request and protected-branch commit.

It MUST:

- require no privileged production secrets;
- run from a clean checkout;
- use pinned toolchains and frozen dependencies;
- run on Linux and Windows;
- use controlled fixtures and deterministic data;
- fail closed when a required tool or runtime is unavailable;
- emit machine-readable reports;
- upload failure artifacts;
- verify that no tracked file changes during the gate;
- block merge for `FAIL` and `BLOCKED`.

It proves the release candidate is reproducible and satisfies deterministic assertions. It does not prove the real deployed system, complete browser support or full WCAG 2.2 AA conformance.

### 6.2 Layer 2 — Deployed Staging Gate

Level 2, Level 3 and formal release-candidate changes MUST deploy an immutable Staging artifact.

The Staging record MUST bind:

- commit SHA;
- build artifact checksum;
- deployment ID;
- deployment URL;
- deployed timestamp;
- frontend configuration summary;
- API deployment identity;
- Public Release ID;
- Public Schema version;
- projection version or checksum where available.

The Staging Gate proves:

- real frontend/API integration;
- real delivery metadata;
- Cloudflare route, header, cache and redirect behavior;
- cross-engine browser behavior;
- real asset and media delivery;
- real network degradation behavior;
- deployed performance;
- actual source, map-provider and embed behavior.

A missing or mutable deployment is `BLOCKED`.

### 6.3 Layer 3 — Human release sign-off

Human sign-off covers questions that require judgement or real assistive technology.

It includes, where applicable:

- keyboard meaning and focus recovery;
- screen-reader output in Chinese and English;
- real zoom and reflow;
- text spacing;
- contrast and color independence;
- reduced-motion experience;
- real-device mobile behavior;
- map and lineage semantic equivalence;
- bilingual meaning and terminology;
- source support;
- media identity and rights;
- visual-direction consistency;
- expected screenshot-difference approval.

Human evidence MUST identify the evaluator and environment. An AI agent, DOM snapshot or scripted keyboard path MUST NOT stand in for a human operating and listening to a real screen reader.

## 7. Change-risk classification

Every frontend-affecting PR MUST declare a risk level.

The declared level cannot be lower than the machine-derived minimum without explicit reviewer approval.

### 7.1 Level 0 — Internal, no public-output change

Examples:

- internal refactor with unchanged rendered output;
- test-only change;
- build tooling change that does not alter public assets or delivery;
- private admin code with no shared public primitive impact.

Required evidence:

- Default PR Release Gate;
- specific tests for the internal change.

### 7.2 Level 1 — Local visual or copy change

Examples:

- local public CSS adjustment;
- icon or typography adjustment;
- reviewed copy change;
- screenshot baseline change without interaction or semantic change;
- non-structural locale text correction.

Required evidence:

- Default PR Release Gate;
- affected screenshot baselines;
- bilingual visual review when applicable.

### 7.3 Level 2 — Public interaction, state, layout or fact presentation

Examples:

- route, search, navigation, filter or form change;
- loading, empty, error, cached, partial or no-media change;
- DOM order, sticky or fixed behavior;
- dialog, drawer or sheet;
- fact, source, precision or Last verified presentation;
- media manifest or asset change;
- new Client Component boundary;
- meaningful bundle increase;
- map or lineage structured representation.

Required evidence:

- Default PR Release Gate;
- scoped immutable Staging Gate;
- targeted human review for affected areas.

### 7.4 Level 3 — System, core journey or formal release

Examples:

- Global Product Shell;
- core public journey;
- locale architecture;
- focus management or ARIA mechanism;
- primary map or lineage interaction;
- Public Content Envelope;
- delivery or fallback mechanism;
- media-rights policy;
- formal WCAG claim scope;
- formal release candidate.

Required evidence:

- complete Default PR Release Gate;
- complete Staging Gate matrix;
- complete applicable bilingual and accessibility sign-off;
- release-owner decision.

## 8. Automatic risk escalation

Changed paths and declared impact SHOULD automatically compute a minimum risk level.

### 8.1 Minimum Level 1 triggers

- public CSS or token changes;
- public font or icon changes;
- public copy changes;
- locale dictionary changes;
- screenshot baseline changes;
- shared public visual component changes.

### 8.2 Minimum Level 2 triggers

- public route, navigation, search, filter or form changes;
- state-component changes;
- DOM ordering, sticky, fixed, dialog, drawer or sheet changes;
- public fact, source, precision or freshness changes;
- media records or assets;
- new Client Component boundaries;
- map or lineage structured content;
- bundle regression above the defined review threshold.

### 8.3 Minimum Level 3 triggers

- Global Product Shell;
- Public Content Envelope or delivery semantics;
- focus or ARIA infrastructure;
- locale architecture;
- primary map or lineage interaction model;
- source or media-rights enforcement;
- formal release-candidate marker.

A reviewer MAY raise any risk level. Lowering a machine-derived level requires a named reviewer and concrete reason.

## 9. Official browser and operating-system support

The first Public Beta formally supports the current stable versions at release review time.

### 9.1 Desktop support

- Windows 11:
  - Microsoft Edge;
  - Google Chrome;
  - Firefox.
- macOS current and previous major version:
  - Safari;
  - Google Chrome.

### 9.2 Mobile support

- iOS current and previous major version:
  - Safari.
- Android current and previous two major versions:
  - Chrome.

The release evidence MUST record exact versions tested.

### 9.3 Outside the formal first-Beta matrix

The following are not formal first-Beta support targets:

- Internet Explorer;
- EdgeHTML;
- embedded Android WebView;
- social-app in-app browsers;
- Firefox for Android;
- Samsung Internet;
- desktop Linux as a public support promise.

PandaAtlas MUST NOT deliberately block these environments. Serious discovered defects remain valid defects, but absence of complete support evidence for them does not block the first Beta unless they expose a shared standards failure.

## 10. Browser automation matrix

### 10.1 Default PR Gate

The deterministic browser baseline is Playwright Chromium.

It MUST run in:

- Linux clean checkout;
- Windows clean checkout.

Windows MUST NOT rely on an unpinned system Edge build as the sole visual or behavioral baseline. A system Edge run MAY supplement the fixed Playwright Chromium run.

### 10.2 Staging Gate

The immutable Staging deployment MUST be exercised with:

- Chromium;
- Firefox;
- WebKit.

Each engine MUST cover the applicable:

- Chinese and English core journeys;
- keyboard automation;
- dynamic UI states;
- overflow and geometry assertions;
- automated accessibility checks;
- screenshots;
- real API and Public Release metadata;
- map and lineage structured paths.

WebKit is an engineering proxy for Safari. It does not replace real Safari sign-off.

### 10.3 Real-browser human matrix

Level 3 and formal release candidates MUST include:

- Windows 11 + Edge;
- macOS + Safari;
- iOS + Safari;
- Android + Chrome.

Chrome and Firefox desktop behavior may be primarily automated, but real-browser review is required for changes involving:

- font rendering;
- native form controls;
- sticky or fixed composition;
- dialogs, popovers, drawers or bottom sheets;
- focus and scrolling;
- map gestures;
- real zoom;
- media or third-party embeds.

## 11. Viewport support matrix

### 11.1 Default automated viewports

The baseline viewport set is:

- `320 × 800` — WCAG reflow baseline;
- `390 × 844` — common mobile task viewport;
- `768 × 1024` — tablet portrait;
- `1280 × 800` — standard desktop;
- `1440 × 900` — wide desktop.

Tests SHOULD distribute responsibility rather than multiply every test across every viewport:

- core journeys: `390 × 844` and `1280 × 800`;
- reflow and page overflow: `320 × 800`;
- tablet composition: `768 × 1024`;
- dual-pane map, lineage and profile layouts: `1440 × 900`;
- key screenshot states: `390 × 844` and `1440 × 900`.

### 11.2 Staging additions

Staging SHOULD add:

- `375 × 667` — short mobile;
- `1024 × 768` — tablet landscape or small desktop;
- `1920 × 1080` — large desktop.

### 11.3 Height requirements

Viewport height is a first-class support condition.

Required short-height cases include:

- `390 × 667`;
- `1280 × 720`;
- `1440 × 800`.

They target failures such as:

- sticky evidence rails hiding content;
- dialogs or drawers with unreachable actions;
- map controls overflowing the viewport;
- bottom sheets that cannot fully expand;
- fixed navigation consuming most of the screen;
- focused elements hidden beneath overlays.

### 11.4 Orientation and input modality

Mobile staging review MUST cover:

- portrait;
- landscape for map, lineage, menus and forms;
- coarse pointer;
- no-hover operation;
- touch-target geometry;
- single-pointer alternatives to drag;
- software-keyboard interaction with search and filters.

## 12. Zoom, text and user-preference matrix

Separate checks are required for:

- 200% text resize;
- 200% browser zoom;
- 400% zoom or equivalent 320 CSS pixel reflow;
- WCAG text-spacing overrides;
- system font enlargement;
- reduced motion;
- forced colors or high-contrast mode;
- changed browser default fonts.

A simulated font-size multiplier is useful automation but does not replace real browser zoom review.

## 13. Screenshot and visual-regression policy

PandaAtlas adopts fixed deterministic Chromium baselines, cross-engine reference screenshots and human semantic review.

### 13.1 Required baseline surfaces

The complete public system MUST eventually maintain baselines for:

- Home;
- Atlas search and results;
- trusted panda profile;
- Lineage;
- Map / footprint;
- Institution;
- Place;
- global navigation;
- mobile menu.

Each release slice MUST add or update baselines for affected representative surfaces.

### 13.2 Required baseline states

For applicable surfaces, the versioned screenshot inventory MUST include representative combinations of:

- live;
- initial loading;
- region or refresh loading;
- empty search;
- no published records;
- error;
- cached;
- partial or incomplete;
- no-media;
- long Chinese content;
- long English content;
- provisional or disputed fact;
- open menu, filter, drawer or dialog.

Map and lineage MUST additionally include:

- visualization available;
- visualization unavailable with structured equivalent intact;
- selected place or relation;
- visible attribution or evidence metadata.

### 13.3 Baseline viewports

Every core surface MUST have:

- `390 × 844` mobile baseline;
- `1440 × 900` desktop baseline.

Risk-driven additional baselines MAY include:

- `320 × 800`;
- `768 × 1024`;
- `1280 × 720`;
- `1920 × 1080`;
- mobile landscape for map, lineage and complex forms.

The screenshot inventory MUST be versioned so the matrix grows intentionally rather than combinatorially.

### 13.4 Deterministic baseline environment

Pixel-comparison baselines MUST use:

- Linux CI;
- pinned Playwright Chromium;
- pinned fonts;
- fixed device scale factor;
- fixed timezone;
- fixed locale;
- `prefers-reduced-motion: reduce`;
- fixed color scheme;
- disabled system animation;
- fixed Public Content Envelope fixtures;
- no uncontrolled external network resources;
- no random values, current-time output or analytics;
- fixed absolute dates from fixture data.

### 13.5 Masking policy

Permitted masking is narrow and documented.

Possible examples:

- a deployment identifier that is not product content;
- a browser cursor with no design meaning;
- an approved uncontrollable third-party frame.

The following MUST NOT be masked:

- identity names;
- facts;
- sources;
- Last verified;
- status labels;
- map attribution;
- error or degraded copy;
- result counts;
- media or no-media region;
- any content whose instability changes layout.

Unstable product content MUST be fixed at the fixture or dependency boundary instead of hidden.

### 13.6 Difference threshold

Visual regression SHOULD use a low tolerance for anti-aliasing noise and MUST NOT permit thresholds large enough to hide meaningful layout movement.

Critical regions SHOULD have focused screenshots or geometry assertions:

- global navigation;
- key facts;
- sources;
- state components;
- map attribution;
- correction notices;
- recovery actions.

The following are failures regardless of pixel threshold:

- text overlap;
- unintended truncation;
- hidden status or source content;
- page-level horizontal overflow;
- focused element obscured by fixed or sticky UI;
- missing structured equivalent;
- unreachable recovery action.

### 13.7 PR behavior

The Default PR Gate MUST:

1. generate actual screenshots;
2. compare them with approved baselines;
3. fail on unapproved differences;
4. upload expected, actual and diff files;
5. upload Playwright trace on failure;
6. report route, locale, state, viewport and fixture ID.

CI MUST NOT automatically accept new baselines.

### 13.8 Baseline updates

A baseline update requires:

- a written explanation of why the change is expected;
- affected surface, state and viewport list;
- before, after and diff artifacts;
- non-author reviewer approval;
- design or product-owner approval for Level 2 or Level 3 changes;
- domain review when facts, sources, media or state meaning changes.

The baseline update MUST be part of the same PR as the intended product change.

“Update snapshots because the test failed” is not a valid reason.

### 13.9 Cross-engine screenshots

Chromium, Firefox and WebKit Staging screenshots are reference evidence, not strict cross-engine pixel-equivalence targets.

They MUST demonstrate:

- equivalent information and function;
- no overlap, clipping or missing controls;
- acceptable native-control and font-rendering differences;
- stable sticky, scroll, dialog and map behavior.

## 14. Human visual review

Visual approval MUST judge more than similarity to the old baseline.

Reviewers MUST consider:

- A remains the shared warm archive foundation;
- B appears only where evidence density is useful;
- C appears only where spatial or relational reasoning is central;
- uncertainty, freshness, precision and delivery are visually legible;
- sources and Last verified are not visually subordinated;
- no-media appears intentional, not broken;
- cached, partial, error and unavailable are distinct;
- Chinese and English preserve hierarchy and meaning;
- density is not solved through tiny text, arbitrary cards or hidden evidence;
- decorative media does not create unsupported factual meaning.

A stable baseline can preserve a bad design. Human review remains required for intended visual change.

## 15. Automated WCAG policy

### 15.1 Proof boundary

Automated Playwright and axe checks can prove only the encoded assertions in rendered states.

They MAY detect:

- selected semantic and accessible-name failures;
- invalid or missing roles and properties;
- some contrast failures;
- missing language metadata;
- selected duplicate-ID and structural problems;
- keyboard-path regressions;
- geometry and overflow failures;
- reduced-motion violations.

They MUST NOT be described as proof of complete WCAG 2.2 AA conformance.

### 15.2 Required automated coverage

For affected core journeys and states, the Default Gate MUST cover:

- axe WCAG 2.2 A/AA tags;
- landmarks and heading structure;
- accessible name, role, value, relationship and state;
- page and language-part `lang` attributes;
- Tab and Shift+Tab;
- Enter and Space activation;
- Escape dismissal;
- required arrow-key behavior for composite widgets;
- no keyboard trap;
- visible focus;
- focus not fully obscured by fixed or sticky UI;
- dialog, drawer and filter-sheet focus entry and return;
- single-pointer and keyboard alternatives to drag;
- target-size geometry;
- loading, result, save, empty and error status-message behavior;
- 320 CSS pixel reflow;
- simulated 200% text resize;
- WCAG text-spacing override;
- reduced-motion behavior;
- forced-color semantic resilience;
- keyboard-reachable map and lineage structured representations.

### 15.3 Dynamic-state scanning

Automated accessibility scans MUST run after relevant dynamic states render, including as applicable:

- mobile menu open;
- filter sheet open;
- filters applied;
- empty result;
- error;
- cached;
- partial;
- no-media;
- selected map place;
- changed lineage focus;
- source disclosure open;
- correction notice visible.

Scanning only the initial page is insufficient.

### 15.4 axe incomplete items

Every axe `incomplete` result MUST:

- remain in the report;
- identify route, state and node;
- receive human classification;
- become `PASS`, `FAIL` or `NOT_APPLICABLE_WITH_REASON`;
- include evidence or explanation.

Rule suppression requires:

- rule ID;
- precise node scope;
- technical reason;
- replacement human check;
- owner;
- reviewer;
- expiry or review date.

A violation-free axe result with unresolved `incomplete` items is not complete evidence.

## 16. Automated keyboard paths

The Default Gate MUST encode the applicable golden keyboard paths:

- enter main content through skip navigation;
- open and close global navigation;
- use global search;
- use Atlas search and filters;
- open a result;
- open source evidence;
- enter family exploration;
- enter footprint exploration;
- switch map or lineage structured representations;
- change lineage focus;
- recover from error;
- clear filters from an empty state;
- close dialog, drawer and sheet.

Each path SHOULD assert:

- active element;
- visible focus;
- one activation per action;
- expected URL and task state;
- meaningful focus return;
- no focus loss to `body` after dynamic updates;
- no stale focus after unmount;
- no arrow-key hijacking in text inputs.

Automated keyboard success does not replace human keyboard review.

## 17. Human keyboard sign-off

Level 2 changes require affected-path review. Level 3 and formal release candidates require complete bilingual core-journey review.

The evaluator MUST verify:

- task-logical Tab order;
- persistent visible focus;
- no focus hidden beneath sticky or fixed regions;
- all pointer operations have keyboard alternatives;
- no precision drag is required as the only control;
- predictable Escape behavior;
- meaningful focus return;
- stable focus after loading and filtering;
- skip links work;
- map and lineage facts do not depend on visual position.

The record MUST list the path exercised, not merely “keyboard works”.

## 18. Real screen-reader matrix

### 18.1 Level 2 targeted review

Use the combination relevant to the affected mechanism:

- Windows 11 + Edge + Narrator for Chinese;
- Windows 11 + Firefox + NVDA for English;
- macOS + Safari + VoiceOver for Safari/platform-specific changes;
- iOS + Safari + VoiceOver for mobile navigation, sheet, touch or mobile core-task changes;
- Android + Chrome + TalkBack for Android-specific form or touch changes.

### 18.2 Level 3 and formal release minimum

The minimum complete matrix is:

1. Chinese complete journey with Windows 11 + Edge + Narrator.
2. English complete journey with Windows 11 + Firefox + NVDA.
3. Safari platform journey with macOS + Safari + VoiceOver.
4. Mobile journey with iOS + Safari + VoiceOver.

Android TalkBack is targeted rather than mandatory for every full release, but becomes required when the change affects Android-specific behavior or a discovered TalkBack defect.

### 18.3 Screen-reader review content

The evaluator MUST verify:

- page title and main landmark;
- heading navigation;
- link and button names;
- current, selected, expanded and pressed states;
- Chinese, English and original-language names;
- conclusion status, freshness, precision and Last verified;
- source titles and access state;
- loading, result count, empty, error, cached and partial announcements;
- dialog, drawer and sheet name, focus and dismissal;
- structured record context;
- map place and selected state;
- lineage relation direction and uncertainty;
- no-media is not announced as a broken image;
- correction notices;
- locale switch language and focus;
- ordinary links can complete tasks without visualization.

Evidence SHOULD record representative actual announcements and observed failures.

## 19. Zoom, reflow and text-spacing sign-off

### 19.1 200% text resize

Verify:

- text enlarges;
- no clipping or overlap;
- controls remain available;
- facts, states, sources and CTAs remain associated;
- dialogs, drawers and tables remain usable.

### 19.2 200% browser zoom

Verify real browser behavior for:

- layout reflow;
- sticky and fixed regions;
- focus visibility;
- dialog and sheet operation;
- map and lineage structured paths.

### 19.3 400% zoom / 320 CSS pixels

Verify:

- no page-level two-dimensional scrolling except genuinely two-dimensional regions;
- map controls and structured alternatives reflow;
- horizontal scrolling is bounded to approved comparative tables;
- recovery controls remain visible;
- fixed elements do not consume most of the viewport.

### 19.4 WCAG text-spacing override

Review with at least:

- line height `1.5` times font size;
- paragraph spacing `2` times font size;
- letter spacing `0.12` times font size;
- word spacing `0.16` times font size.

There MUST be no loss, clipping, overlap or hidden control.

## 20. Reduced motion and moving content

Automation MUST verify that non-essential motion stops under `prefers-reduced-motion: reduce`.

Human review MUST cover:

- page and drawer transitions;
- map pan and zoom;
- lineage focus transition;
- loading effects;
- hover and focus animation;
- unexpected movement in both locales.

Reduced motion SHOULD replace spatial travel with direct state changes while preserving selection and context.

Perpetual decorative motion is not a production default.

## 21. Map and lineage equivalence

### 21.1 Automated evidence

Automation SHOULD compare stable IDs between visualization and structured data.

It MUST assert:

- structured view is named and reachable;
- relation or place facts are present;
- status and precision are preserved;
- source actions are reachable;
- selected focus and filters are represented;
- visualization failure does not remove the structured task.

### 21.2 Human evidence

Without using the visualization, a human MUST be able to:

- identify the same entities, relations and places;
- understand current focus and scope;
- understand relation direction, generation and uncertainty;
- inspect status, precision and sources;
- follow ordinary links;
- complete the same decision-relevant task.

Any fact or action available only through position, line, color, hover, gesture or drag is a blocker.

## 22. Human-evidence freshness

Human evidence MAY be reused only when the reviewer records why it remains valid.

The following MUST match or be demonstrated irrelevant:

- release artifact;
- component and interaction mechanism;
- journey and state scope;
- browser and assistive-technology major versions;
- locale semantics.

The following changes invalidate affected evidence:

- DOM order;
- ARIA;
- focus management;
- navigation;
- dialog, drawer or sheet mechanics;
- map or lineage interaction;
- loading, error or live-region behavior;
- locale terminology;
- font, spacing, sticky or fixed behavior;
- browser or assistive-technology major version.

Formal release evidence SHOULD NOT cross a major frontend release cycle without renewed review.

## 23. Performance policy

PandaAtlas evaluates concrete metrics and task responsiveness, not a single score.

Primary metrics include:

- LCP;
- INP;
- CLS;
- TTFB;
- initial JavaScript;
- initial transfer size;
- long tasks;
- critical API latency;
- loading-state timing;
- map and lineage lazy loading.

Lighthouse score is diagnostic and supplementary.

## 24. Core Web Vitals targets

The target field thresholds are:

- LCP `≤ 2.5 s`;
- INP `≤ 200 ms`;
- CLS `≤ 0.1`.

When sufficient production traffic exists, use the 75th percentile over the prior 28 days at route or journey level.

When field data is insufficient:

- record that field data is insufficient;
- use repeatable Staging laboratory evidence;
- do not report the missing field metric as passing;
- enable field-data gating once a valid sample exists.

## 25. Static bundle budgets

Budgets refer to compressed production-delivery size where the build tooling can produce it consistently.

### 25.1 Shared first-load JavaScript

- target and initial absolute cap: `≤ 110 KiB`;
- an increase greater than `5 KiB` or `5%`, whichever is larger, requires PR explanation;
- new dependencies require purpose, compressed cost, Client seam and exit strategy.

### 25.2 Route first-load JavaScript

| Route type | Initial cap |
| --- | ---: |
| Home, Institution, Place | 140 KiB |
| Atlas, trusted profile | 170 KiB |
| Lineage, Map | 220 KiB |

Map and lineage provider code MUST:

- load dynamically;
- remain outside Home, Atlas and normal profile initial bundles;
- not block the structured equivalent;
- not download until the feature requires it.

### 25.3 Asynchronous feature chunks

- ordinary interaction chunk target: `≤ 80 KiB gzip`;
- heavy map or lineage chunk target: `≤ 180 KiB gzip`;
- chunks above `100 KiB` require a bundle analysis;
- duplicate vendor packaging is prohibited;
- complete datasets, fixtures, source manifests and unnecessary locale data MUST NOT enter the client bundle.

A temporary budget exception requires an approved, expiring performance waiver.

## 26. Initial transfer budgets

Cold-cache initial transfer budgets, excluding later map tiles, are:

| Surface | Initial transfer cap |
| --- | ---: |
| Home | 500 KiB |
| Atlas / Profile | 650 KiB |
| Lineage / Map structured first view | 750 KiB |

The calculation includes:

- HTML;
- CSS;
- JavaScript;
- fonts;
- first-view media;
- initial JSON.

User-initiated video, map tiles and optional embeds are measured separately and MUST NOT preload unnecessarily.

## 27. Media performance budgets

### 27.1 Images

- mobile LCP image target: `≤ 200 KiB`;
- desktop LCP image target: `≤ 400 KiB`;
- dimensions or stable aspect ratio are required;
- responsive source selection is required;
- mobile MUST NOT receive the desktop original unnecessarily;
- no-media MUST NOT download unrelated decorative substitutes.

### 27.2 Fonts

- first-view font transfer target: `≤ 150 KiB`;
- subsets MUST reflect the actual Chinese and English strategy;
- an additional family for a small amount of text SHOULD be avoided;
- font loading MUST not create unacceptable CLS;
- fallbacks MUST preserve readable hierarchy.

### 27.3 Maps, video and embeds

- map resources load only for the current viewport and mode;
- video MUST NOT preload a complete file by default;
- third-party embeds are click-to-load;
- unavailable, privacy-blocked or unlicensed media enters an explicit state.

## 28. PR performance checks

The Default Gate MUST enforce deterministic checks for:

- production build output;
- route and shared-bundle budgets;
- duplicate dependencies;
- unexpectedly large or unused assets;
- responsive image metadata;
- font count and size;
- Client boundary growth;
- map, lineage and embed lazy loading;
- main-thread long tasks in deterministic core interactions;
- prompt loading-state rendering.

Suggested interaction assertions:

- local input or activation feedback within `100 ms`;
- local filter, tab or disclosure completion within `200 ms`;
- explicit pending state for operations beyond `500 ms`;
- recoverable error, partial or unavailable state after `10 s`, not an infinite spinner.

Single CI wall-clock measurements SHOULD NOT block unless the environment is controlled enough to be stable.

## 29. Staging performance gate

Level 2, Level 3 and formal release candidates MUST measure the immutable Staging deployment.

### 29.1 Method

- fixed Chromium;
- standard Lighthouse mobile throttling;
- at least three consecutive runs;
- median result;
- cold and warm cache recorded separately;
- fixed locale, route, release and state;
- analytics and unrelated third-party scripts disabled.

### 29.2 Required routes

At minimum:

- Chinese Home;
- English Home;
- Chinese Atlas;
- English Atlas;
- Chinese trusted profile;
- English trusted profile;
- Lineage structured first view;
- Map structured first view.

### 29.3 Laboratory targets

- mobile Lighthouse Performance score `≥ 80` as a supplementary threshold;
- desktop Lighthouse Performance score `≥ 90` as a supplementary threshold;
- LCP `≤ 2.5 s`;
- CLS `≤ 0.1`;
- TBT `≤ 200 ms`;
- Speed Index `≤ 3.4 s`;
- TTFB target `≤ 800 ms`;
- longest main-thread task `≤ 200 ms`;
- critical first-view request chain no deeper than four requests;
- no unrelated third party blocks the first view.

Large unexplained variance is `BLOCKED` until environmental or product non-determinism is understood.

## 30. Critical API budgets

Staging end-to-end targets are:

| Operation | p95 target |
| --- | ---: |
| Profile public projection | 800 ms |
| Atlas initial query | 1,000 ms |
| Filter or pagination | 800 ms |
| Lineage structured data | 1,000 ms |
| Map viewport query | 1,200 ms |

When a request exceeds target:

- the correct loading state remains required;
- demo fixtures MUST NOT substitute;
- cached or partial delivery MUST be explicit;
- repeated over-budget behavior becomes a tracked performance defect.

## 31. Slow network, offline and recovery

Staging MUST exercise:

- Fast 3G or equivalent constrained network;
- high latency;
- request timeout;
- network interruption and recovery;
- browser offline;
- API available while map provider fails;
- partial API failure;
- valid published cache;
- cold first visit.

Acceptance conditions include:

- navigation and loaded facts remain usable;
- loading does not continue indefinitely;
- cached content names its release and date;
- offline does not claim freshness;
- retry does not duplicate user operations;
- recovery preserves query, filters, focus and scroll where appropriate;
- map, media or embed failure does not block core facts.

## 32. Performance regression policy

Without an approved reason, a PR MUST NOT:

- degrade a Core Web Vital laboratory metric by more than 10%;
- exceed bundle regression thresholds;
- add an unexplained blocking request;
- add an unexplained font or third-party domain;
- broaden a Server Component into a large Client boundary;
- move map or lineage code into the shared bundle;
- delay or hide facts, status or sources to improve a score.

An approved regression record requires:

- user value gained;
- before and after metrics;
- alternatives considered;
- owner;
- recovery plan;
- expiry date.

## 33. Public Content Envelope gate

Every public fixture, release projection and applicable API response MUST include:

- `data`;
- `release`;
- `delivery`;
- `locale`;
- `coverage`;
- `sources`.

The gate MUST reject:

- missing required envelope sections;
- unknown delivery states;
- production `demo`;
- unconfigured preview in a public environment;
- withdrawn release references;
- success inferred only from HTTP 200;
- empty inferred only from `data.length === 0`.

## 34. Fact-metadata gate

Critical public facts MUST preserve:

- `value`;
- `conclusionStatus`;
- `freshness`;
- `precision`;
- `sourceIds`;
- `lastVerifiedAt` when applicable.

The gate MUST enforce:

- controlled enums;
- confirmed facts have at least one publishable reviewed source;
- provisional and disputed facts remain marked;
- superseded values do not occupy current-fact positions;
- temporal facts have freshness and verification metadata;
- public precision does not exceed evidence precision;
- partial delivery declares coverage;
- cached delivery binds an immutable release;
- unavailable delivery does not contain arbitrary replacement data.

The frontend MUST NOT invent missing metadata defaults.

## 35. Silent-fallback gate

### 35.1 Static checks

The gate SHOULD identify new patterns such as:

- API failure returning local entity fixtures;
- `catch` returning a success-shaped demo payload;
- unmarked `name_en ?? name_zh` fallback;
- unsourced popularity or metric values;
- generic panda media substituted into a named identity;
- error displayed with live semantics;
- vague public `fallback` state.

Allowed exceptions MUST be exact, owned and expiring.

### 35.2 Runtime fault injection

Browser tests MUST intentionally fail:

- API;
- map provider;
- media delivery;
- source lookup.

They MUST verify:

- explicit unavailable, error, partial or cached state;
- no alternate entity or fixture appears;
- delivery status is visible;
- valid already-loaded content remains;
- failure does not change fact meaning or entity identity.

A failed API endpoint that silently activates fixtures is not a valid Staging test.

## 36. Aggregate and computed-value gate

Exact public aggregates MUST carry:

- collection definition;
- release or as-of date;
- scope;
- completeness;
- unknown or hidden handling;
- calculation method;
- product-computation label where applicable.

The gate MUST reject:

- global totals derived from partial collections;
- undefined worldwide totals;
- numbers without scope;
- internal rank or score presented as a natural fact;
- unaudited views, favorites, users, social reach or growth values;
- popularity claims without an audited metric.

Product calculations MUST identify their scope through controlled language such as “in the current published PandaAtlas archive” or “under the current filters”.

## 37. Source gate

The Default Gate MUST verify:

- fact-level source linkage for critical facts;
- referenced source IDs exist;
- publisher, title, URL, language and access state are present;
- publication date and Last verified remain distinct;
- supported fact or module scope is represented;
- source actions have meaningful accessible names;
- vague “internet source” labels are absent;
- unavailable or restricted sources are not described as publicly inspectable.

The Staging Gate MUST verify:

- external URLs resolve or produce the declared access state;
- redirects and archives are handled explicitly;
- locale URLs do not substitute different content;
- page source lists match response source IDs;
- source-link-only media remains a link, not a displayed proxy.

Human review MUST judge whether the source actually supports the conclusion and whether conflicts remain visible.

## 38. Bilingual parity gate

The Default Gate MUST compare structured Chinese and English projections.

It MUST enforce parity for:

- entity IDs;
- fact IDs;
- source IDs;
- release identity;
- conclusion status;
- freshness;
- precision;
- delivery;
- media state;
- dates and numbers;
- relationship meaning;
- correction presence;
- CTA destination.

It MUST reject:

- draft or unreviewed translation in production;
- machine-generated translation marked as reviewed;
- silent cross-language fallback;
- different evidence strength between locales;
- missing translation hidden by a substituted field;
- canonical identity changes caused by alias matching.

Structured parity does not prove translation quality. Human language review remains required.

## 39. Bilingual human review

Level 2 and Level 3 changes MUST involve the applicable proficient language reviewer.

Review MUST cover:

- controlled glossary use;
- unchanged certainty and precision;
- official and original-name hierarchy;
- labeled translated source titles;
- equal CTA outcome;
- equal severity of error, cached, partial and no-media states;
- long-text layout;
- editorial warmth without invented facts or personality.

Missing a qualified reviewer is `BLOCKED`.

## 40. Media-manifest gate

Every public local or remote media asset MUST have a media record containing at least:

- stable media ID;
- media type;
- original source;
- publisher;
- creator;
- depicted subject;
- identity confidence;
- capture or creation date and precision;
- license state;
- license URL or authorization record;
- allowed uses;
- derivative permissions;
- attribution requirements;
- restrictions;
- review date;
- expiry where applicable;
- publication status;
- checksum;
- derivative relation.

Production rendering is limited to:

- `licensed`;
- `public-domain`.

The following MUST NOT enter page media, CSS background, Open Graph, structured data or preload:

- `pending-review`;
- `expired`;
- `withdrawn`;
- `unknown`;
- `no-licensed-media`;
- `source-link-only`.

`source-link-only` can produce only a source link.

## 41. Media identity and derivative checks

Automation MUST verify:

- identity-slot subject ID matches the page entity;
- ambiguous group media is not used as a single avatar;
- illustrative media is labeled and excluded from documentary identity slots;
- decorative media has empty alt while retaining a license record;
- derivatives record original ID, transformation and checksum;
- prohibited crop or modification does not occur;
- withdrawn media is absent from assets, CDN manifests, OG and structured data;
- no-media does not request an unrelated panda image.

Human review MUST judge:

- actual depicted identity;
- contextual meaning of crop;
- risk of illustrative media being read as evidence;
- license applicability to the exact use;
- required attribution;
- map screenshot or embed rights.

When media review is missing, publication fails closed.

## 42. Map-provider and embed gate

Configuration evidence MUST identify:

- base-map provider;
- overlay-data provider;
- style license;
- attribution;
- snapshot date;
- caching, screenshot and export terms;
- privacy and cookie behavior;
- click-to-load behavior;
- structured alternative.

Staging MUST verify:

- attribution remains visible;
- provider failure leaves the structured task complete;
- restricted third parties do not load before consent or user action;
- CSP and network requests match the declaration;
- exports retain attribution or are disabled;
- geometry does not imply more precision than the data;
- country-level facts do not render as institution-level markers.

## 43. UI-state coverage registry

Every public surface MUST declare applicable states in a versioned registry.

The state vocabulary includes:

- initial loading;
- refresh loading;
- region loading;
- live;
- empty search;
- no published records;
- error;
- offline;
- cached;
- degraded;
- partial or incomplete;
- no-media;
- no-map;
- no-lineage-graph;
- not found;
- withdrawn;
- missing locale;
- preview;
- demo in non-production only.

An undeclared state is not implicitly inapplicable. `NOT_APPLICABLE_WITH_REASON` requires owner and reviewer approval.

## 44. Default UI-state checks

For affected surfaces, automation MUST verify as applicable:

- title, cause, scope and recovery action exist;
- loading does not fabricate facts;
- skeleton is hidden from assistive technology;
- empty and error remain distinct;
- no-records copy does not claim real-world absence;
- partial does not present a full total;
- cached names release and date;
- offline does not claim latest data;
- no-media does not request a substitute identity image;
- no-map and no-lineage preserve structured tasks;
- retry is bounded;
- recovery preserves query, filters, focus and scroll where appropriate;
- state is not conveyed by color alone;
- live-region behavior is correct;
- no infinite spinner exists.

## 45. Staging fault-injection matrix

The immutable Staging deployment MUST be capable of exercising:

- complete API failure;
- module failure;
- API timeout;
- valid cached release;
- stale or review-due data;
- map-provider failure;
- media 404;
- source redirected, changed or unavailable;
- missing locale content;
- offline and recovery;
- withdrawn release.

The fault-injection mechanism MUST not activate demo fixtures or fake a successful live response.

## 46. Combined content and visual review

Human reviewers MUST inspect together:

- rendered value;
- conclusion status;
- freshness;
- precision;
- Last verified;
- source;
- delivery;
- media state;
- locale;
- screenshot;
- underlying Public Content Envelope.

This review targets mismatches such as:

- correct metadata but visually hidden uncertainty;
- present source data but an undiscoverable source action;
- partial state hidden below the fold;
- technically valid no-media that looks like a broken page;
- English copy that increases certainty;
- a marker or illustration implying greater precision;
- layout completeness achieved through fabricated content.

## 47. Frontend Release Evidence Manifest

Every frontend-affecting PR MUST produce a versioned structured manifest.

A YAML-shaped example is:

```yaml
schema_version: "1"
commit: "<sha>"
risk_level: 2
surfaces:
  - trusted-profile
locales:
  - zh-CN
  - en
states:
  - live
  - no-media
automated:
  status: PASS
  checks: []
staging:
  required: true
  status: PASS
  deployment_id: "<immutable-id>"
  deployment_url: "<url>"
  public_release_id: "<release>"
human:
  status: PASS
  reviews: []
waivers: []
reviewers: []
release_decision: null
```

Each check record MUST include:

- check ID;
- required flag;
- status;
- environment;
- artifact URL or path;
- commit;
- execution time;
- tool and version;
- owner;
- reviewer where required;
- defect link for failure;
- reason for not applicable.

A missing field required by the manifest schema is `BLOCKED`.

## 48. PR declaration requirements

The PR author MUST declare:

- change summary;
- risk level;
- affected surfaces;
- affected locales;
- affected UI states;
- DOM, focus, ARIA or keyboard impact;
- public fact, source, precision or freshness impact;
- media, map, embed or license impact;
- bundle, Client boundary or dependency impact;
- whether Staging is required;
- required human roles;
- linked issue and acceptance scenarios.

“Tests pass” is not a sufficient declaration.

## 49. Default Gate orchestration

The Default Gate SHOULD expose independent required check groups:

1. **Repository reproducibility**
   - clean checkout;
   - pinned tools;
   - frozen installs;
   - generated-file consistency;
   - no tracked-file mutation;
   - Linux and Windows.
2. **Static correctness**
   - lint;
   - typecheck;
   - production build;
   - architecture boundaries;
   - bundle and asset budgets.
3. **Public contracts**
   - golden dataset;
   - Public API;
   - Public Content Envelope;
   - locale parity;
   - source, precision and release consistency.
4. **Media and content truth**
   - media manifest;
   - no demo or silent fallback;
   - aggregate scope;
   - forbidden metrics;
   - withdrawal.
5. **Browser journeys**
   - Chromium smoke;
   - URL-backed state;
   - dynamic-state coverage;
   - responsive and overflow.
6. **Automated accessibility**
   - axe;
   - keyboard and focus;
   - reflow;
   - text spacing;
   - reduced motion;
   - structured alternatives.
7. **Visual regression**
   - approved baseline;
   - geometry assertions;
   - expected, actual and diff artifacts.

The existing release script MAY remain the orchestration engine, but GitHub SHOULD display meaningful separate check results rather than one opaque green or red status.

## 50. Gate-result semantics

The aggregate result is:

- `FAIL` when any required check is `FAIL`;
- `BLOCKED` when no check failed but any required check is `BLOCKED`;
- `PASS` only when every required check is `PASS` or approved `NOT_APPLICABLE_WITH_REASON`.

A GitHub `BLOCKED` result MUST still prevent merge.

Infrastructure errors MAY retry once when clearly classified. Product assertion failures MUST NOT retry automatically until green while hiding the initial failure.

When a retry succeeds, the manifest MUST retain:

- initial result;
- retry reason;
- retry result;
- infrastructure classification.

## 51. Staging evidence record

For every required Staging run, the manifest MUST contain:

- commit SHA;
- build checksum;
- deployment ID;
- deployment URL;
- Public Release ID;
- Public Schema version;
- configuration summary;
- start and finish time;
- browser matrix;
- report artifacts.

A PR comment containing screenshots does not replace a required Staging check.

Level 2 MAY run a scoped Staging matrix. Level 3 MUST run the complete matrix.

## 52. Human sign-off record

Every human record MUST identify:

- evaluator;
- reviewer role or competency;
- date;
- commit;
- deployment;
- device;
- OS;
- browser;
- assistive technology where applicable;
- route and locale;
- viewport or zoom;
- UI state;
- action path;
- actual observation;
- status;
- screenshot, recording or defect link.

Human evidence MUST NOT exist only in chat, oral confirmation or an unstructured “approved” comment.

The PR author SHOULD NOT be the sole human reviewer.

For a small team where separation is impossible:

- self-review MUST be disclosed;
- Level 3 still requires at least one non-author reviewer;
- media rights, source support and formal WCAG claims MUST NOT rely only on the author.

## 53. Reviewer roles

The manifest SHOULD request reviewer roles according to changed scope:

- design or product;
- accessibility;
- Chinese language;
- English language;
- data and content;
- media rights;
- architecture;
- release owner.

One person MAY fulfill multiple roles, but each role they sign MUST be explicit.

## 54. PR summary requirements

The human-readable PR summary MUST show:

- declared and machine-derived risk level;
- escalation reasons;
- affected surfaces, locales and states;
- Default Gate summary;
- Staging URL and deployment ID;
- screenshot before, after and diff;
- bundle before and after;
- axe violation and incomplete counts;
- human sign-off status;
- unresolved defects;
- active waivers;
- aggregate `PASS`, `FAIL` or `BLOCKED`.

Long machine logs belong in artifacts, not pasted into the PR body.

## 55. Clean-checkout reproducibility

A valid gate MUST NOT depend on:

- untracked files;
- local `.env` values;
- globally installed project packages;
- leftover development servers;
- previous `.next`, Playwright, Python environment or test results;
- undeclared fonts;
- machine-local fixture data.

It MUST verify:

- dependency installation from lockfiles;
- generated contracts and aliases can be reproduced;
- test fixtures are versioned;
- screenshot fonts are available;
- tools are pinned;
- tracked files remain unchanged after the gate.

A local pass with a clean-CI failure is a failure.

## 56. Flaky-test policy

A flaky test MUST NOT be silently removed, skipped or retried until green.

When flakiness is detected:

- create a defect;
- preserve initial failure evidence;
- record retry behavior;
- identify owner;
- set a repair deadline;
- document the coverage risk.

Flaky tests covering the following cannot become non-blocking:

- content truth;
- accessibility;
- core journeys;
- release consistency;
- privacy;
- media rights;
- structured map or lineage alternatives.

Other tests MAY be temporarily quarantined only when:

- a separate non-green check remains visible;
- an expiry date exists;
- replacement evidence is recorded;
- the overall report does not claim complete success.

## 57. Waiver policy

### 57.1 Potentially waivable areas

A limited waiver MAY apply to:

- a Medium visual difference that does not affect task or meaning;
- a small non-critical performance-budget overage;
- a defect in a browser outside the formal support matrix;
- an unavailable non-core enhancement;
- a best-practice or AAA observation that is not an A/AA failure.

### 57.2 Required waiver fields

Every waiver MUST include:

- check or defect ID;
- user impact;
- risk;
- mitigation;
- owner;
- approver;
- creation date;
- deadline;
- repair issue;
- applicable commit or release;
- reason it does not affect truth, safety, core task or WCAG A/AA.

An expired waiver becomes `FAIL`.

### 57.3 Non-waivable areas

The following cannot be waived:

- sensitive or internal data exposure;
- production demo fixtures;
- confirmed facts without publishable source support;
- public precision greater than evidence precision;
- bilingual fact-semantic mismatch;
- unlicensed or identity-unknown documentary media;
- withdrawn content remaining public;
- blocked core task;
- known WCAG 2.2 A/AA failure;
- map or lineage without a complete structured task;
- error or unavailable represented as live;
- missing applicable screen-reader evidence while claiming WCAG success;
- release, schema or deployment identity mismatch;
- non-reproducible clean checkout;
- Staging evidence from a different commit.

## 58. Formal release decision

The release owner may record `GO` only when:

- every applicable Default Gate is `PASS`;
- every applicable Staging Gate is `PASS`;
- every applicable human sign-off is `PASS`;
- all waivers are valid and in an allowed category;
- every evidence item binds to the same release artifact;
- no unresolved Blocker or High defect remains;
- no known WCAG A/AA failure remains.

Record `NO_GO` when evidence demonstrates a release-blocking failure.

Record `BLOCKED` when valid evidence cannot be produced.

## 59. Evidence retention

### 59.1 Per pull request

Retain:

- Frontend Release Evidence Manifest;
- Default Gate reports;
- failure screenshots, diffs and traces;
- bundle report;
- complete axe results including incomplete items;
- Staging deployment identity;
- human sign-off links;
- waivers.

### 59.2 Formal release

Create an immutable evidence package containing:

- commit;
- build checksum;
- deployment IDs;
- Public Release ID;
- schema versions;
- browser, performance, visual and accessibility results;
- human signatures;
- defects and retest evidence;
- final decision.

Formal evidence MUST NOT rely solely on expiring chat attachments or private local files.

## 60. Implementation migration plan

This policy is a specification, not an instruction to rewrite every gate in one PR.

The implementation SHOULD proceed in narrow slices.

### Phase 1 — Evidence vocabulary and manifest

1. Define the versioned Frontend Release Evidence Manifest schema.
2. Add status validation for `PASS`, `FAIL`, `BLOCKED` and `NOT_APPLICABLE_WITH_REASON`.
3. Add PR risk declaration and automatic path-based escalation.
4. Preserve the existing release gate while emitting manifest records.
5. Make missing required records block the aggregate result.

### Phase 2 — Split visible check groups

1. Expose reproducibility, static correctness, public contracts, truth/media, browser, accessibility and visual groups.
2. Keep current Linux and Windows execution.
3. Retain existing release reports.
4. Distinguish infrastructure block from product failure.

### Phase 3 — State and truth coverage

1. Implement Public Content Envelope contract checks.
2. Add locale parity snapshots.
3. Add no-demo and silent-fallback checks.
4. Add versioned UI-state coverage registry.
5. Add media-manifest enforcement.
6. Add aggregate-scope checks.

### Phase 4 — Visual regression

1. Define screenshot inventory schema.
2. Pin CI fonts, timezone and fixture release.
3. Add Chromium baseline generation and comparison.
4. Add geometry and page-overflow assertions.
5. Add explicit baseline-update tooling and review metadata.

### Phase 5 — Accessibility depth

1. Expand axe to dynamic states.
2. Store and review every incomplete item.
3. Add keyboard golden paths and focus geometry.
4. Add text-spacing and forced-color checks.
5. Structure human sign-off records and invalidate stale evidence.

### Phase 6 — Performance budgets

1. Parse build output into route/shared bundle records.
2. Add deterministic asset and font budgets.
3. Add lazy-loading and Client-boundary checks.
4. Add Staging Lighthouse and API latency collection.
5. Add slow-network and recovery scenarios.

### Phase 7 — Immutable Staging Gate

1. Deploy by exact commit and retain deployment ID.
2. Bind Public Release and schema metadata.
3. Run Chromium, Firefox and WebKit.
4. Add fault-injection controls that do not activate fixtures.
5. Publish Staging result as a required check.

### Phase 8 — Formal release package

1. Bind automated, Staging and human records.
2. Validate reviewer roles and waiver expiry.
3. Generate immutable release evidence bundle.
4. Require release-owner `GO`, `NO_GO` or `BLOCKED`.

## 61. Required first implementation slice

The first quality-gate implementation slice SHOULD accompany the first frontend vertical slice:

> Localized Product Shell + global navigation + global search entry + trusted profile above the fold.

That slice MUST demonstrate:

- risk declaration;
- clean Linux and Windows gate;
- Chinese and English route coverage;
- live, loading, error and no-media states;
- Public Content Envelope fixture;
- source, precision and Last verified assertions;
- mobile and desktop screenshots;
- 320 CSS pixel reflow;
- keyboard navigation and focus recovery;
- axe results with incomplete-item handling;
- route/shared bundle report;
- immutable Staging deployment;
- targeted human keyboard, language and screen-reader records.

It SHOULD NOT wait for the entire site to be rebuilt before proving the evidence pipeline.

## 62. Acceptance scenarios

### AS-01 — Default-gate block

Given a required Chromium journey cannot start because the browser runtime is unavailable,
when the PR gate completes,
then the check is `BLOCKED`, the PR cannot merge and the report names the environment failure.

### AS-02 — Clean checkout

Given an untracked local fixture makes a page work,
when the clean Linux and Windows gates run,
then the build or test fails rather than using the local file.

### AS-03 — Same artifact

Given human sign-off references deployment A and the release candidate is deployment B,
when the manifest is validated,
then the aggregate status is `BLOCKED`.

### AS-04 — Risk escalation

Given a PR changes focus management in a shared dialog,
when risk is computed,
then the minimum risk level is Level 3 even if the author declares Level 1.

### AS-05 — Visual difference

Given a profile fact rail moves by a meaningful amount,
when visual regression runs,
then the PR fails and uploads expected, actual and diff images.

### AS-06 — Baseline approval

Given an intended profile redesign,
when baselines change,
then the same PR contains before/after/diff evidence and a non-author review.

### AS-07 — Hidden regression

Given the global pixel difference is below threshold but a source action is clipped,
when geometry checks run,
then the gate fails.

### AS-08 — Axe incomplete

Given axe reports zero violations and three incomplete contrast results,
when the evidence manifest is validated,
then accessibility remains `BLOCKED` until each incomplete result is reviewed.

### AS-09 — Human screen reader

Given all automated checks pass but English NVDA evidence is missing for a Level 3 release,
when release status is calculated,
then the result is `BLOCKED`.

### AS-10 — Dynamic accessibility

Given an error drawer has an inaccessible close control,
when dynamic-state axe and keyboard tests run,
then the Default Gate fails even if the initial page scan passes.

### AS-11 — Keyboard focus recovery

Given a filter sheet closes after applying filters,
when keyboard automation and human review run,
then focus returns to a meaningful trigger or result summary rather than `body`.

### AS-12 — Real zoom

Given simulated text resize passes but a sticky header hides controls at 400% zoom,
when human zoom review runs,
then the release fails.

### AS-13 — Structured lineage

Given the lineage canvas fails,
when the page renders,
then the full relation list, status, source and navigation remain available.

### AS-14 — Structured map

Given the map provider is unavailable,
when Staging fault injection runs,
then filters, selected focus, snapshot, place precision and place links remain usable.

### AS-15 — Shared-bundle regression

Given a map library enters the shared bundle and pushes it above 110 KiB,
when the production build is analyzed,
then the gate fails.

### AS-16 — Lazy visualization

Given a user opens a profile without entering map or lineage,
when network requests are inspected,
then map and lineage provider chunks are not downloaded.

### AS-17 — Slow API

Given Atlas query latency exceeds 500 ms,
when the user submits a search,
then a meaningful pending state appears without replacing the archive with fixtures.

### AS-18 — Timeout

Given an operation exceeds ten seconds,
when the timeout policy triggers,
then the UI enters a recoverable error, partial or unavailable state instead of an infinite spinner.

### AS-19 — Cached release

Given live API delivery fails but a valid immutable published release exists,
when cached delivery renders,
then release identity and date are visible and fact conclusion status is unchanged.

### AS-20 — No cache

Given live API delivery fails and no valid cache exists,
when the page renders,
then it becomes unavailable or error and does not load demo data.

### AS-21 — Confirmed without source

Given a confirmed current place has no publishable source ID,
when the truth gate runs,
then the Default Gate fails.

### AS-22 — Precision mismatch

Given the source supports only country-level location but the response contains an institution,
when fact metadata is validated,
then publication fails.

### AS-23 — Partial total

Given Atlas returns a truncated partial set,
when a total renders,
then it is scoped to the visible coverage and cannot appear as a global count.

### AS-24 — Locale parity

Given Chinese displays provisional while English displays confirmed for the same fact,
when parity snapshots compare,
then the Default Gate fails.

### AS-25 — Missing translation

Given English editorial content is unreviewed,
when production projection builds,
then the field is marked unavailable or excluded rather than silently replaced with Chinese.

### AS-26 — Unlicensed media

Given a repository image has no approved media record,
when the production build runs,
then it cannot appear in page media, CSS background, OG or structured data.

### AS-27 — Withdrawn media

Given media permission is withdrawn,
when the next release is built,
then the asset and derivatives are absent from public delivery and a neutral no-media state remains.

### AS-28 — Source URL state

Given a source URL now redirects,
when Staging validates it,
then the source is labeled redirected and the page does not claim direct accessibility without review.

### AS-29 — Preview isolation

Given a preview payload exists,
when the production route, sitemap and structured data are scanned,
then the preview is absent.

### AS-30 — Demo isolation

Given a demo fixture is used in local tests,
when the production bundle and runtime are inspected,
then no production route can resolve it.

### AS-31 — No-media request

Given a profile has `no-licensed-media`,
when the page loads,
then no unrelated panda image request is made.

### AS-32 — Map attribution

Given a map is visible,
when desktop, mobile and export states are reviewed,
then required attribution remains present or export is disabled.

### AS-33 — Staging mutation

Given the Staging deployment URL points to a mutable alias that changes after testing,
when evidence is validated,
then the Staging result is `BLOCKED` until an immutable deployment ID is recorded.

### AS-34 — Browser matrix

Given Chromium passes but WebKit clips the mobile menu recovery action,
when the Level 3 Staging matrix runs,
then the release fails.

### AS-35 — Unsupported browser

Given a minor visual issue exists only in an unsupported in-app browser,
when release risk is reviewed,
then it may be recorded without blocking if no shared standards failure exists.

### AS-36 — Waiver expiry

Given an approved performance waiver reaches its deadline,
when the release manifest is evaluated,
then the waiver becomes invalid and the check fails.

### AS-37 — Non-waivable failure

Given an unlicensed identity image is the only remaining defect,
when the release owner reviews the candidate,
then no waiver is allowed and the decision is `NO_GO`.

### AS-38 — Flaky truth test

Given a source-linkage test intermittently fails,
when it reruns green,
then the initial failure remains visible and the test cannot be made non-blocking.

### AS-39 — Human observation record

Given a reviewer writes only “screen reader works”,
when the manifest is validated,
then the evidence is incomplete because environment, path and observed output are missing.

### AS-40 — Formal GO

Given all required automated, Staging and human records pass for the same artifact and no non-waivable defect remains,
when the release owner signs,
then and only then may the release decision be `GO`.

## 63. Non-goals

This policy does not:

- claim that the current frontend already satisfies every requirement;
- replace WCAG-EM or criterion-by-criterion conformance evaluation;
- require every PR to run the complete Level 3 matrix;
- require strict cross-browser pixel identity;
- require all quality infrastructure to be implemented in one change;
- authorize production fixture fallback;
- permit a screenshot pass to replace semantic review;
- redefine backend domain, publication or database ownership;
- make prototype code production-ready.

## 64. Decision log

The product owner confirmed:

1. the three-layer evidence model and four change-risk levels;
2. the browser, operating-system, viewport and real-device support matrix;
3. the screenshot coverage, baseline-update and visual-approval policy;
4. the automated WCAG, real screen-reader, zoom, reflow and human-sign-off policy;
5. the bundle, transfer, Core Web Vitals, API, slow-network and device performance budgets;
6. the content truth, source, bilingual, media and UI-state gates;
7. the PR evidence manifest, automatic risk escalation, gate orchestration, sign-off and waiver policy.

## 65. Follow-up implementation handoff

[Create the phased frontend implementation handoff](https://github.com/SwayingWindmill/PandaAtlas/issues/39) owns the conversion of this policy and the preceding design decisions into ordered implementation slices.

That handoff MUST:

- assign the appropriate risk level to every slice;
- name required Default, Staging and human evidence;
- include quality-gate infrastructure in the first vertical slice rather than deferring it to the end;
- preserve rollback boundaries and immutable evidence identity;
- avoid reopening browser, accessibility, performance, truth or waiver decisions already made here.

## 66. Final directive

A PandaAtlas frontend slice is not ready because it compiled, looked correct in one browser or passed axe on one initial page.

It is ready only when:

- the clean repository reproduces it;
- the public contracts preserve truth;
- deterministic browser and visual checks pass;
- the immutable Staging deployment behaves correctly;
- supported engines and devices preserve the task;
- real assistive technology can complete the task;
- bilingual meaning remains equal;
- media identity and rights are valid;
- performance keeps facts and actions timely;
- all evidence belongs to the same release artifact;
- the release owner can make an informed `GO` decision.
