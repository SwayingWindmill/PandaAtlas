# ZhiPanda Fan V7 recovered prototype

This directory preserves the complete historical `fan-v07` prototype for design review.

## Recovery source

- Historical commit: `35b4530e` (`chore:wip-preserve-local-main-20260828`)
- Original route: `/{locale}/prototype/fan-v07`
- Original source path: `apps/web/app/[locale]/prototype/fan-v07/`
- Companion design document: `docs/design/zhipanda-public-experience-v0.7.md`

## Why it is archived instead of restored as a live Next.js route

The V7 route was built against an earlier Web dependency and view-model boundary. Restoring it directly into the current app route tree introduces obsolete runtime dependencies and contracts (`motion`, `gsap`, `deck.gl`, `family-chart`, older map/lineage view models, etc.) and breaks the current Web typecheck.

To preserve the prototype without weakening the current NestJS/V2-era Web architecture, the exact historical source is kept under `source/` and is intentionally excluded from the current application build.

## What is preserved

The recovered source includes the complete V7 experience, including:

- full-viewport immersive panda hero;
- hero identity and atlas-count overlays;
- panda timeline/thread scene;
- near-full-screen family scene;
- panda footprint + map scene;
- large horizontal panda panorama;
- discovery/search rail;
- updates and My Pandas return-visit section;
- V7 Panda, Families, Lineage, Map, Moments, Search, Games and My Pandas prototype pages;
- historical V7 map preview asset.

Key homepage files:

- `source/page.tsx`
- `source/immersive-hero.tsx`
- `source/hero-stage.tsx`
- `source/panda-panorama.tsx`
- `source/home-map.tsx`
- `source/prototype.module.css`

## Review intent

Use this recovered V7 as a design reference for the next public-experience iteration. Do not copy old fixtures, old data contracts, or retired dependencies into production. The intended next step is to preserve the V7 visual and interaction language while reconnecting it to the current V2 PublicRead, Search, Families, Map, Moments and My Pandas capabilities.
