---
version: 1
slug: "app-locale-prototype-fan-v08-page-tsx"
primary_target: "app/[locale]/prototype/fan-v08/page.tsx"
related_targets: ["app/[locale]/prototype/fan-v08/prototype.module.css","app/[locale]/prototype/fan-v08/visual-fixtures.ts"]
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

## Chosen direction

**One panda opens the world.** Deep forest overlays, warm-paper reading scenes, sparse warm-gold highlights and large photography create the rhythm. The memorable moment is the transition from the single hero panda into a cinematic family scene, then out into the larger panda panorama.

## Unresolved decisions

- Final production hero-selection rotation strategy.
- Whether the floating photographic navigation becomes the shared public navigation treatment or remains Home-specific.
- Final font delivery strategy for Manrope/Noto Sans SC so the declared system is actually loaded rather than falling through silently.
- Whether the Home map preview is a lightweight static/structured preview or a lazy interactive island.
