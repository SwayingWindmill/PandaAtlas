---
version: 2
slug: "app-locale-prototype-fan-v08-page-tsx"
primary_target: "app/[locale]/prototype/fan-v08/page.tsx"
related_targets: ["app/[locale]/prototype/fan-v08/prototype.module.css","app/[locale]/prototype/fan-v08/visual-fixtures.ts","app/[locale]/prototype/fan-v08/layout.tsx","app/[locale]/prototype/fan-v08/motion-parts.tsx"]
---

# Fan V8 Home

## Scope and mode

Visitor mode: **Experience** with a supporting discovery/utility layer.

This surface is the fan-first public Home prototype. It should make the visitor feel that they have entered a panda world before asking them to search or inspect data.

## Audience and job

An ordinary panda fan who may know one panda by name or may simply want to browse. Their immediate job is to recognize a panda, feel curious about it, and find an obvious path to more pandas.

## Action

Primary: open the featured panda profile.

Secondary: continue through family, places, moments, panorama, search and My Pandas.

## Proof and content

- one full-viewport correct panda photograph;
- a small number of meaningful life moments;
- family continuation when published relationships support it;
- place/journey continuation when published residency data supports it;
- a large multi-panda panorama;
- active-release published count;
- search/browse utility after emotional engagement;
- return value through moments/updates/My Pandas.

Prototype-only historical image fixtures are explicitly labeled and may not become production data sources.

## Constraints

- Do not turn the first viewport into a standard split hero, search landing page or card shell.
- The panda image remains the visual subject; navigation and metadata recede.
- Family and journey scenes are conditional in production and disappear cleanly when unsupported.
- Do not restore V0.7 animation/map/carousel dependencies merely for visual parity.
- Mobile must preserve the emotional first viewport without covering the panda's face.
- No invented facts, current locations, relationship certainty or media rights.
- Do not bring back repeated eyebrow/kicker labels, avatar stacks, fake map grids, glass-pill navigation, rounded search cards or generic feature-card rhythm. Those treatments made the surface read as a designed prototype rather than a mature editorial product.

## Chosen direction

**One panda opens the world, with quiet editorial confidence.** Large truthful photography, warm-paper reading scenes, deep forest fields, sparse antique-gold highlights, precise hairlines and deliberately oversized whitespace create the rhythm. The interface should feel authored and calm rather than decorated.

V8.1 raises the craft bar by:

- using a full-width restrained photographic navigation instead of a floating capsule;
- removing repeated kicker labels so headlines carry their own hierarchy;
- turning life moments into a spacious editorial ledger rather than a decorated timeline widget;
- presenting family members as portrait records connected by a hairline instead of circular social-avatar chips;
- replacing the faux map/grid with a chronological journey plate that tells the location story without pretending to be cartography;
- treating search as a quiet utility line after discovery rather than another rounded component;
- making My Pandas a photographic closing scene instead of a conventional card;
- keeping display sizes at or below the durable 6rem ceiling and increasing supporting text to mature reading sizes.

The memorable movement remains: one featured panda → a few life moments → a cinematic family scene → a clear journey through places → a broad panda panorama → a reason to return.

## Typography commitment

The V8 prototype now owns a scoped, real font-delivery layer through `next/font` rather than relying on uninstalled family names:

- English display and UI: Manrope;
- Chinese display: Noto Serif SC, used to give large editorial headlines a more authored photographic-publication character;
- Chinese body: Noto Sans SC;
- font delivery stays scoped to the prototype until the direction is approved for the public site.

## Motion commitment

Motion is intentionally sparse and uses the MIT-licensed `motion` package rather than a global smooth-scroll stack:

- hero photography performs one restrained settle on entry;
- hero copy arrives as part of the same focal sequence rather than as a generic repeated section reveal;
- the family photograph opens with a subtle scale settle when the family relationship enters the story;
- the journey line draws once when the route becomes visible, directly expressing movement between published places;
- Panorama keeps native CSS scroll snap and direct manipulation;
- no Lenis, GSAP ScrollSmoother or global scroll hijacking;
- `prefers-reduced-motion` is respected through Motion's user preference hook and existing CSS fallbacks.

## Unresolved decisions

- Final production hero-selection rotation strategy.
- Whether the full-width dark photographic navigation becomes the shared public navigation treatment or remains Home-specific.
- Whether the Chinese display serif pairing should graduate from the prototype into the shared public design system.
- Whether the production Home journey preview should remain a chronological plate or later gain a real lightweight geographic preview when PublicRead supports it cleanly.
