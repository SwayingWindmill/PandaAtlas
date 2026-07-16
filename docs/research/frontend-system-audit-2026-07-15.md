# PandaAtlas frontend system and evidence-gap audit

- **Audit date:** 2026-07-15
- **Wayfinder ticket:** [Audit the current frontend system and evidence gaps](https://github.com/SwayingWindmill/PandaAtlas/issues/32)
- **Parent map:** [Wayfinder: PandaAtlas 前端系统性改进](https://github.com/SwayingWindmill/PandaAtlas/issues/31)
- **Scope:** `apps/web`, its public-route data adapters, browser/accessibility tests, and frontend-related Release Gate evidence
- **Purpose:** establish the current system and its evidence gaps before choosing a redesign direction

## Executive decision

PandaAtlas already contains a credible frontend nucleus: the localized trusted-profile route presents reviewed conclusions, sources, verification dates, media-license states, revisions, bilingual metadata, and structured text alternatives; the distribution workspace performs viewport-aware requests, exposes truncation and fallback messages, and has a map-failure text path; the repository has meaningful Playwright, axe, clean-build, and release-evidence foundations.

The public frontend is nevertheless **not one coherent trusted system yet**. It currently exposes three competing presentation contracts:

1. a source-backed trusted archive contract on `/{locale}/atlas/{slug}`;
2. a legacy editorial profile contract on `/atlas/{slug}` that synthesizes stories, traits, media, and recommendations;
3. a silent local fallback/demo contract in API adapters, atlas cards, and lineage data.

Those contracts are visually similar enough that a visitor cannot reliably distinguish reviewed fact, editorial copy, fallback fixture, inferred value, or invented presentation metadata. Existing smoke tests also preserve both the trusted and legacy paths. Therefore, a broad visual rewrite would increase risk unless the route, data-honesty, fallback, media, and ownership boundaries are settled first.

**Recommended disposition:** preserve the trusted-profile semantics and the strongest map/accessibility evidence, but treat the legacy/generative presentation path, silent fallback behavior, and fragmented style ownership as migration liabilities. The next tickets should define principles and canonical journeys before a cross-surface prototype.

## Standards applied

This audit uses the current official [Impeccable skill](https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.md) as the primary system-audit lens. Its relevant requirements are to inspect product context and existing design systems before changing code, distinguish brand surfaces from product surfaces, verify responsive/accessibility/performance behavior, avoid default card scaffolding, and test complete production states.

The current official [taste-skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md) is used only as a contextual anti-slop pre-flight for the public homepage and editorial surfaces. Its own scope says it is for landing pages, portfolios, and redesigns rather than dashboards, data tables, or multi-step product UI, so its visual rules are not applied mechanically to the atlas workspace, map, or lineage explorer.

Product truth, privacy, wildlife-location safety, media rights, WCAG requirements, and existing PandaAtlas domain semantics take precedence over either external style guide.

## Current system inventory

### Public routes and presentation contracts

| Route | Current role | Register and data contract | Main evidence | Main concern |
| --- | --- | --- | --- | --- |
| `/` | Marketing/editorial home | Brand page; hard-coded content and metrics | Production build; generic browser coverage only | Internal design commentary, unsupported metrics/social proof, no-op CTAs, no provenance |
| `/atlas` | Search, filter, card browsing | Hybrid product/editorial surface; API list plus local curated presentation metadata | Search and card smoke tests | URL state is not shareable; ranking/tags/images can be invented; API fallback is silent |
| `/atlas/[slug]` | Legacy detail | Editorial profile generated from API fields plus local presets | `critical-public-journeys.spec.ts` explicitly expects this route | Competes with trusted route and presents unsupported stories, traits, media, images, and locations |
| `/zh/atlas/[slug]`, `/en/atlas/[slug]` | Trusted public profile | Source-backed archive surface with reviewed conclusions and revision metadata | Strong bilingual, keyboard, no-JS, mobile, zoom, axe tests | Only detail is bilingual; some empty-state coverage remains incomplete |
| `/lineage` | Interactive relationship explorer | Product visualization with API lineage or silent static fallback | Basic visibility, mobile axe and reduced-motion checks | Uses final parent IDs rather than reviewed-edge semantics; fallback is unlabeled; no first-class linear equivalent |
| `/global-distribution` | Map workbench | Product workspace using API/fallback GeoJSON and local institution constants | Viewport query test, map shell/browser checks, axe checks | Text alternative appears mainly on map failure; keyboard/pointer asymmetry; attribution and URL-state gaps |
| `/map` | Legacy alias | Redirect to `/global-distribution` | Redirect behavior | Old map components remain in the tree and obscure ownership |
| `/admin/imports` | Local professional utility | Separate operational surface | Admin proxy and build checks | Not part of this public-system redesign except shared foundations |

### Component and style ownership

The frontend has useful feature folders, but ownership is not enforced by architecture:

- [`app/globals.css`](../../apps/web/app/globals.css) is approximately 1,370 lines and mixes global tokens, homepage animation/layout, legacy map styles, atlas styles, and lineage styles.
- [`components/lineage/lineage-explorer.tsx`](../../apps/web/components/lineage/lineage-explorer.tsx) is approximately 1,517 lines and owns domain conversion, graph algorithms, layout, pointer/zoom behavior, comparison, rendering, drawer content, and accessibility labels.
- [`components/atlas/map-stage.tsx`](../../apps/web/components/atlas/map-stage.tsx) is approximately 771 lines and owns MapLibre bootstrap, style JSON, camera behavior, data-layer synchronization, hover/click behavior, error fallback, overlays, and summary composition.
- [`components/atlas/global-distribution-shell.tsx`](../../apps/web/components/atlas/global-distribution-shell.tsx) is approximately 466 lines and coordinates many independent state variables and effects.
- [`components/atlas/atlas-browser.tsx`](../../apps/web/components/atlas/atlas-browser.tsx) is approximately 478 lines and owns filtering, sorting, pagination, labels, result summary, and UI markup.
- The six `components/ui` primitives exist, but many public pages and feature components bypass them with long Tailwind strings and raw color/radius/shadow values. The shared `Button` is used mainly in map/admin components rather than across the public site.
- Root tokens cover only a small color/font set. Map, lineage, home, and atlas introduce many hard-coded hex/RGBA values and independent radius/shadow conventions.
- Dark-theme variables apply only under `.trusted-profile-theme`; the rest of the public product is light-only.
- The configured display-font names are CSS fallbacks; the root layout does not load or self-host the named font.

This is not merely a code-size concern. It prevents a reviewer from answering which layer owns color, spacing, state treatment, route shells, interaction behavior, and domain copy.

## Evidence strengths worth preserving

### Trusted-profile semantics

[`TrustedPandaProfile`](../../apps/web/components/atlas/trusted-panda-profile.tsx) demonstrates the correct direction for a trustworthy archive:

- fact conclusions link to public source metadata and show `last_verified_at`;
- event dates and source publication dates are separated;
- parent/child links derive from lineage results rather than decorative copy;
- country-level footprint precision is explicit and accompanied by ordered text;
- no-media and source-link-only license states are explicit;
- data version, Public Schema version, and revision summary are visible;
- Chinese and English canonical routes and `hreflang` metadata exist;
- the profile remains readable without JavaScript.

### Distribution resilience

The distribution workspace has several mature behaviors:

- viewport and zoom are transformed into bounded queries with a 250 ms update delay;
- API fallback, truncation, loading, retry, and empty states are present;
- map code is dynamically imported rather than added to every route's initial bundle;
- map load failure reveals a selectable text list;
- data status/source and snapshot age are displayed in the workspace.

### Existing verification foundation

The current branch passes:

- `npm run lint:web`;
- `npm run typecheck:web`;
- `npm run build:web`;
- `npm run test:map-viewport -w web`.

The production build succeeds and reports approximately 103 kB shared first-load JavaScript, with route totals of about 128 kB for atlas/lineage and 143 kB for global distribution. These are measurements, not established budgets.

The accessibility suite contains 14 tests covering initial axe scans, 320 px width, language declaration, keyboard favorite activation, simulated 200% text resize, expanded mobile map controls, and reduced motion. The retained deployed-staging record reports 14 accessibility tests and 22 browser tests passing, while explicitly retaining 11 axe `color-contrast` incomplete results and marking human acceptance **PENDING / No-Go for a WCAG 2.2 AA claim**. See [`staging-accessibility-evidence-2026-07-15.md`](../release/staging-accessibility-evidence-2026-07-15.md) and [`wcag-2.2-aa-evidence-baseline.md`](../release/wcag-2.2-aa-evidence-baseline.md).

A local rerun during this audit was environment-blocked because the configured Playwright Chromium headless executable is not installed. This is not a product-test failure, but it proves the browser prerequisite is not self-healing in this checkout.

## Prioritized findings

Priority meaning in this report:

- **P0:** must be decided or contained before a broad frontend redesign can safely begin;
- **P1:** system-level issue that should shape IA, architecture, prototype, or quality gates;
- **P2:** important refinement or cleanup that can follow the canonical system decisions.

### P0 — Public truth is split across trusted, generated, and silent-fallback contracts

#### P0.1 Legacy profiles synthesize claims and media without provenance

[`panda-profile.ts`](../../apps/web/lib/panda-profile.ts) contains local presentation presets for summaries, temperament, weight, and location. `displayLocation()` prefers the preset over the API value. Generic galleries reuse images assigned to other panda slugs and relabel them as the current individual. Fixed media duration, story quotations, timeline events, traits, food preferences, habits, and personality claims are generated without source links.

The legacy route [`app/atlas/[slug]/page.tsx`](../../apps/web/app/atlas/[slug]/page.tsx) presents these values as a polished public profile without a reviewed/fallback label, verification date, source state, or media-license state. Only selected identities redirect to the trusted localized route.

**Impact:** the UI can make an invented or unrelated asset look more authoritative precisely because the page is visually polished. This contradicts the product's core value more severely than a missing feature would.

**Required decision input:** canonicalize all public profile entry points around the trusted contract; define what editorial narrative may exist and the provenance required; prohibit identity relabeling of fallback media.

#### P0.2 Atlas discovery invents ranking and presentation metadata

[`atlas-presenters.ts`](../../apps/web/lib/atlas-presenters.ts) defines local `popularity` scores, featured flags, badges, tags, summaries, and image assignments. The “热门优先” sort uses those local numbers as if they were a meaningful ranking. Several images are reused across different identities, and fallback cards use a generic panda hero.

**Impact:** search and discovery imply editorial or behavioral evidence that the released dataset does not provide. The list can route some identities to trusted pages and others to legacy pages, so the card itself does not reveal which contract will follow.

**Required decision input:** distinguish source-backed fields, editorial curation, computed product state, and preview/fallback data in both types and UI. Remove or explicitly label popularity until a documented metric exists.

#### P0.3 API fallback is mostly silent outside the map-refresh path

[`api-client.ts`](../../apps/web/lib/api-client.ts) catches public-list, detail, lineage, snapshots, habitats, and overview failures and substitutes local fixtures. Only `getDistributionWithSource()` returns a source discriminator that the UI uses to warn the visitor. `listAtlasPandas()`, `getPandaDetail()`, `getPandaLineage()`, `getHabitats()`, and `getOverviewStats()` return fallback-shaped data without source metadata.

The fallback fixtures themselves include unsourced behavioral copy, identities, relationships, locations, and images. The lineage explorer also independently falls back to `LINEAGE_PANDAS` when its input is empty.

**Impact:** API degradation can silently change the meaning, scope, or truth status of the interface while preserving a successful appearance. Tests that intentionally point the API base at an unreachable port exercise this fallback as the normal browser baseline.

**Required decision input:** define a typed data-origin/status contract for every public read; decide which trusted generated release is an acceptable offline source versus which demo fixtures must never appear in production; render degraded state visibly.

### P0 — Tests preserve conflicting public journeys

[`critical-public-journeys.spec.ts`](../../apps/web/tests/smoke/critical-public-journeys.spec.ts) explicitly expects an atlas card to lead to `/atlas/{slug}` and then asserts the legacy `panda-profile-page`. Separate one-panda and seven-panda suites assert the localized trusted routes.

**Impact:** the test suite can pass while the product maintains two incompatible definitions of a successful profile journey. A migration that removes the untrusted path would initially look like a regression.

**Required decision input:** issue 34 must define one canonical public journey and redirect/deprecation policy; issue 38 must align tests to that journey.

### P1 — Bilingual behavior is a profile feature, not a product architecture

Only localized profile detail has Chinese/English routes and content. Home, atlas discovery, map, lineage, navigation, filters, empty/error states, and metadata are Chinese-only. Middleware marks every non-`/en/` route as `zh-CN`, but there is no localized route tree or shared message ownership for the rest of the product. The existing accessibility evidence correctly records that English distribution and lineage journeys are unavailable.

**Impact:** the product cannot fulfill “complete Chinese and English core journeys”; route structure, IA, copy ownership, SEO, tests, and state persistence will all be affected by any later localization retrofit.

**Required decision input:** issue 34 must decide locale routing and equivalent journeys; issue 35 must decide copy/message ownership.

### P1 — Map and lineage alternatives are not first-class equivalent journeys

The map exposes a result list primarily after MapLibre fails. In the normal successful state, sidebar/mobile controls provide filters, counts, metrics, legend, and selected-item context, but not an always-reachable ordered list of visible objects. Map points are pointer-driven; keyboard users cannot traverse them directly.

The lineage explorer uses focusable visual nodes and a selected-item drawer, but it does not expose an always-present ordered representation of all currently visible relationships. Panning is pointer-driven, and keyboard traversal of a large spatial node set is not equivalent to a semantic relationship list. The explorer reconstructs relations from node `father_id`/`mother_id` fields rather than directly consuming reviewed edge/status/source semantics.

**Impact:** the text paths do not yet expose the same facts, state, selection, and actions as the visual paths. Passing an initial axe scan does not prove equivalent purpose or complete keyboard operation.

**Required decision input:** issue 34 must make map and lineage text journeys primary IA; issue 36 must define uncertainty/source semantics; issue 37 must prototype both visual and linear forms together.

### P1 — Interaction state is not shareable or recoverable

Atlas search, filters, sort, pagination, map mode, map filters, selected snapshot, selected item, and lineage view/compare/depth state are held only in client component state. Except for the lineage `focus` parameter, meaningful state is not encoded in URLs.

**Impact:** users cannot share, bookmark, restore, or use browser history for the exact exploration state. Tests cannot address stable state URLs, and bilingual switching cannot preserve equivalent context.

**Required decision input:** issue 34 should define the canonical URL state contract and history behavior.

### P1 — Mobile navigation disappears

The shared `SiteHeader` hides its primary navigation below the `lg` breakpoint and does not provide a mobile menu or alternate navigation. The logo remains, but the principal routes are no longer directly reachable through the global header.

**Impact:** individual mobile pages may reflow correctly while the complete journey is broken. Existing 320 px tests begin at direct URLs and do not test mobile global navigation.

**Required decision input:** issue 34 must specify mobile navigation and cross-surface continuity; issue 38 must test it as a complete process.

### P1 — Route-level failure and loading ownership is absent

There are no project-owned `loading.tsx`, `error.tsx`, or `not-found.tsx` files under the app routes. Data clients frequently convert failures into successful fallback payloads, so route components cannot distinguish network failure, trusted cached release, demo fixture, empty record, or genuine 404 consistently. Component-level loading/error states exist in the map and admin UI, but not as a public-system contract.

**Impact:** users receive inconsistent or misleading recovery paths, and tests overrepresent the successful rendered state.

**Required decision input:** issue 36 must define state taxonomy and copy; issue 35 must define route-shell/state ownership.

### P1 — Media and map attribution evidence is incomplete

`apps/web/public` contains numerous panda and editorial images, but no colocated manifest or metadata was found for source, subject identity, license, attribution, transformation, expiry, or allowed use. Several code paths relabel reused images as different pandas.

MapLibre's default tile URL uses a CARTO raster endpoint while `attributionControl` is set to `false`; no visible replacement attribution was found in the map surface.

**Impact:** the trusted-profile media-empty-state policy can be bypassed by home/atlas/legacy assets, and a technically functional map can still violate provider attribution requirements.

**Required decision input:** issue 36 must define a repository-enforced media manifest and basemap attribution policy; issue 38 must verify them.

### P1 — Style system ownership is fragmented

The root token set is too small to explain the actual UI. Feature code repeatedly embeds literal colors, radii, shadows, z-indexes, spacing, and typography. Homepage, atlas, trusted profile, map, and lineage each act as a partial design system. Large components combine domain transformation, presentation policy, and low-level interaction.

**Impact:** visual changes require broad manual editing, contrast fixes cannot propagate reliably, and “consistent design” can mean repeating the same card/shadow rather than sharing semantic rules.

**Required decision input:** issue 35 should define semantic token roles, register-aware shells, primitive/composite boundaries, CSS decomposition, and architecture checks. A flag-day component-library replacement is not justified by this audit.

### P1 — Performance has measurements but no contract

The production build is healthy, and MapLibre is dynamically imported. However:

- there is no checked performance budget or Lighthouse/Web Vitals gate;
- atlas requests up to 100 records and performs filtering, ranking, pagination, and search entirely in the client;
- lineage renders a 5,600 × 4,200 transformed world and can expose many focusable nodes;
- large orchestration components increase hydration and regression risk;
- image policy is not tied to identity/license or route loading priority beyond the hero;
- no low-end mobile, slow-network, memory, or interaction-latency evidence was found.

**Required decision input:** issue 38 should define route budgets and real-device/staging evidence; issue 35 should isolate client-interactive leaves and data/presentation seams.

### P1 — Reduced-motion evidence does not cover imperative map motion

Global CSS suppresses CSS animation and transition durations under `prefers-reduced-motion`, and the automated suite checks computed CSS durations. MapLibre camera calls still use timed `fitBounds`/`flyTo`, including `essential: true`, and are not governed by the CSS media query.

**Impact:** the current test can pass while interaction-triggered map motion remains. Similar review is needed for lineage transform behavior and scroll movement.

**Required decision input:** issue 35 should define a shared motion preference service; issue 38 should test imperative animations, not only computed CSS.

### P1 — Visible copy contains implementation commentary and unsupported calls to action

The homepage and legacy profile expose copy about Stitch layouts, “this version”, page structure, card decisions, and future implementation. The homepage shows unsourced counts and social metrics (`1,864+`, `67`, `600+`, `4.2M`, `120k`). “加入保护行动” links to its own section rather than a real action, and “阅读专题” links back to the current content block.

**Impact:** the interface speaks like a design review rather than a public archive, overstates authority, and presents actions that do not complete a task.

**Required decision input:** issue 36 should define one copy register, claim/source requirements, and CTA destination rules; issue 33 should define brand tone.

### P2 — Anti-slop problems are symptoms of weak system ownership

The public surfaces repeatedly use rounded cards, nested cards, pill controls, shadows, small tracked section labels, equal metric blocks, and similar reveal animations. The legacy profile uses a thick left-border quote treatment. These patterns match the external guides' common AI-template warnings, but removing them individually would not solve the underlying problem.

**Required decision input:** issue 33 should establish a physical scene and design principles; issue 37 should compare concrete cross-surface directions after truth/IA rules are settled.

### P2 — Dead or transitional map code remains

`components/map/panda-atlas-explorer.tsx` and related legacy map code appear unreferenced by current routes, while `/map` redirects to the new workspace. Their continued presence makes it harder to determine the supported component architecture and can mislead future agents.

**Required decision input:** issue 35 should define deprecation/removal boundaries after confirming no runtime/import dependency remains.

### P2 — Accessibility evidence is meaningful but incomplete and partly environment-dependent

The existing baseline correctly refuses to treat automation as a conformance claim. Current gaps include:

- Chromium/Edge-focused browser evidence rather than a declared multi-browser/AT support matrix;
- no completed human keyboard, Chinese/English real-screen-reader, contrast, map-equivalence, lineage-equivalence, and visual sessions;
- 11 retained color-contrast incomplete results;
- initial-state scans do not cover every loading, empty, error, fallback, drawer, selected, hover/focus, and degraded state;
- mobile global navigation and URL-state journeys are not covered;
- local checkout does not currently include the Playwright browser executable required to rerun the suite without an installation step.

**Required decision input:** issue 38 should incorporate the existing WCAG evidence policy rather than replacing it, then add complete state and environment matrices.

## Evidence-gap matrix

| Area | Existing evidence | Gap status |
| --- | --- | --- |
| Build and static correctness | Lint, typecheck, production build pass | **Strong baseline** |
| Route bundles | Next build sizes recorded | **Measured, no budget** |
| Public journey smoke | 22-test staging record and focused suites | **Partial; conflicting legacy/trusted journeys** |
| Accessibility automation | 14 tests; axe, mobile, zoom, reduced CSS motion | **Partial; state/browser/imperative-motion gaps** |
| Human accessibility | Detailed policy and checklist | **Missing execution; explicit No-Go** |
| Visual regression | Screenshots may be attached manually | **No baseline/diff gate found** |
| Performance | Dynamic MapLibre import and production build | **No budget or field/device evidence** |
| Data-origin honesty | Map refresh distinguishes API/fallback | **Mostly missing elsewhere** |
| Content truth | Trusted profile provenance | **Legacy/home/atlas/fallback not governed** |
| Media rights | Trusted media empty/source-link states | **No public asset manifest or cross-route enforcement** |
| Bilingual equivalence | Trusted profiles and metadata | **Missing home/atlas/map/lineage journeys** |
| Responsive | 320 px checks on four direct routes | **Partial; navigation and full state matrix absent** |
| Map/lineage nonvisual equivalence | Map failure list; profile footprint/family text; evidence policy | **Not first-class or human-validated** |
| Loading/empty/error/degraded | Map has several states; atlas filter empty state | **No route-wide taxonomy; silent fallbacks** |
| URL/history behavior | Canonical profile routes and lineage focus | **Most exploration state absent** |

## Inputs to the remaining Wayfinder tickets

### For “Define PandaAtlas frontend design principles and standards precedence”

- Decide a trust-first preserve/overhaul posture: preserve trusted semantics and evidence, not current presentation patterns by default.
- Define controlled brand and product registers rather than forcing homepage, archive profile, map, and lineage into one layout family.
- Establish a physical-use scene, color strategy, typography source/loading policy, motion range, and density range.
- Explicitly prohibit presentation metadata that masquerades as released facts.

### For “Map the core public journeys and information architecture”

- Choose one canonical localized profile route and redirect/deprecate the legacy route.
- Define localized home/atlas/map/lineage journeys and equivalent state preservation.
- Make search/filter/map/lineage state URL-addressable where it affects task meaning.
- Define mobile global navigation.
- Treat map and lineage linear representations as primary routes/components, not failure-only fallbacks.

### For “Design the frontend system boundary and token/component architecture”

- Separate released domain data, editorial content, fallback origin, and view-model transformation.
- Define semantic tokens and register-aware shells; migrate `globals.css` incrementally.
- Split graph algorithms, map adapters, orchestration, presentation, and copy ownership.
- Decide architecture checks for raw colors, route-shell ownership, dead code, and component import boundaries.
- Add dependencies only where an accepted requirement cannot be met with the current stack.

### For “Define content, data-honesty, media, and UI-state rules”

- Define source/origin labels for API, immutable trusted fallback, stale cache, preview, illustrative, and unavailable states.
- Define what editorial claims require citations and which computed values require method/date metadata.
- Prohibit cross-identity media reuse and create a media/provenance manifest.
- Define CTA, empty, loading, error, offline, partial, stale, no-media, no-map, and fallback copy.
- Define basemap/provider attribution and license checks.

### For “Prototype the cross-surface PandaAtlas design language”

- Prototype the canonical journey only after the above decisions.
- Include home, atlas discovery, trusted profile, map with visible list, and lineage with ordered relationships.
- Show bilingual pressure, URL-restorable state, mobile navigation, fallback/stale states, keyboard focus, and reduced imperative motion.
- Compare directions; do not convert the existing visual system into a production prototype by default.

### For “Define frontend quality gates and visual verification”

- Preserve current lint/typecheck/build, browser, golden-dataset, and WCAG evidence.
- Add content-truth, fallback-origin, media-manifest, basemap-attribution, URL-state, visual-regression, and route-performance gates.
- Require state-by-state coverage rather than one successful initial render.
- Declare browser/OS/AT support and retain explicit human sign-off as unresolved until performed.
- Make the browser runtime prerequisite reproducible from a clean checkout or report it as environment-blocked rather than failed product evidence.

## Final answer to the ticket question

The current PandaAtlas frontend is a capable but transitional system. Its strongest production-ready asset is the localized trusted-profile contract and the evidence discipline around public releases. Its largest risks are not aesthetic: they are competing routes, silent fallback semantics, generated content and media presented as real, incomplete bilingual/nonvisual journeys, and ownership boundaries that allow each feature to become its own design system.

The next safe step is therefore **not** a broad visual overhaul. It is to resolve the design-principle and canonical-journey tickets using this audit as evidence, then define architecture/content-state rules before prototyping. No additional Wayfinder ticket is required at this point because the existing tickets 33–39 already cover every surfaced decision area.
