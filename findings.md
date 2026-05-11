# Findings & Decisions

## Requirements
- Refactor the map page in `apps/web` rather than creating an unrelated new page.
- The page is a core first-level module named "全球熊猫分布图谱 / Panda Atlas".
- The user wants a left control/information rail plus a dominant right map stage on desktop.
- The design proposal is the primary source; the Stitch screen is reference material only.
- The page must support four semantic modes: global overview, China wild, China captive, overseas captive.
- The UI should feel like a calm, editorial, natural-history cartographic product rather than a dashboard or GIS tool.
- The page must support summary state, selected-object state, search/filter controls, legends, source/update metadata, and a history/change entry.
- Mobile should collapse the desktop split layout into a stacked flow with the map still prominent.

## Research Findings
- Planning files were not present yet in the repo; this task now uses project-root planning files.
- The current map route is `apps/web/app/map/page.tsx` and renders a single `MapShell` component.
- `apps/web/components/map/map-shell.tsx` supports only one layer plus snapshot switching; it does not support the requested atlas modes, semantic legends, selected-object card, or the domestic/overseas institution split.
- The existing data client provides distribution, habitat, snapshot, and overview stats data. Fallback map data is very sparse, so a richer atlas experience will require curated frontend entities for institutions, regional highlights, and object details.
- `apps/web/app/globals.css` already establishes a warm off-white background and deep green accent that fit the requested natural-history tone.
- The Stitch reference confirms the target layout: sticky top nav, left information rail, quiet map stage, map legend in-canvas, utility controls on the right, and a floating stats bar at the bottom.
- The final implementation keeps existing server-side data loading for `/map` but moves the page UI into a new client explorer component that merges live/fallback distribution data with curated institution metadata for richer atlas storytelling.
- The current user-facing route is `apps/web/app/(site)/global-distribution/page.tsx`, which renders `apps/web/components/atlas/global-distribution-shell.tsx`.
- The atlas route already has a componentized structure (`top-nav`, `atlas-sidebar`, `map-stage`, `entity-detail-drawer`, `timeline-section`), so a full rebuild can happen inside this boundary without changing routing.
- Many atlas-facing files contain mojibake Chinese copy, which makes the UI look broken even before layout issues are considered.
- The latest screenshot of the current page shows the left rail occupying the visual focus while the map stage looks nearly empty; this does not meet the user's requirement that the map be the dominant stable stage.
- The public Stitch project route `https://stitch.withgoogle.com/project/13894568176164007897` is reachable, but the initial HTML is only the JS app shell and does not expose the requested screen export URLs directly.
- The cleanest implementation path is to keep the current route/data boundary and replace the atlas workspace internals: top nav, sidebar, map stage overlays, object drawer, and timeline layer.
- A fixed-height workspace with mobile-first row stacking works better than a normal document flow because it preserves the map as the primary stage while still keeping the sidebar accessible.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Refactor `apps/web/app/map/page.tsx` and replace the current shell with a richer atlas component | `/map` is the existing route boundary for this feature. |
| Use the user's written design scheme as the main source, with Stitch only as structural reference | The user explicitly prioritized the design proposal. |
| Keep existing API calls for live/fallback wild-distribution data, and add curated frontend atlas entities for domestic and overseas institutions | Current backend/fallback data alone cannot express the requested four-mode atlas narrative. |
| Move atlas copy/configuration into `apps/web/lib/panda-atlas.ts` | Keeps the design system data, legends, change log, and extension cards separate from map rendering logic. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `rg` is unavailable in this PowerShell environment (`Access is denied`) | Switched to `Get-ChildItem` and `Select-String` for discovery. |
| Reading the Stitch HTML in parallel raced the download once | Re-read the file after the download completed. |

## Resources
- Stitch project ID: `13894568176164007897`
- Stitch screen ID: `9b31dd208cdd45efb89a03dd406f23db`
- Skill references: `C:/Users/hao10/.codex/skills/frontend-design/SKILL.md`, `C:/Users/hao10/.codex/skills/planning-with-files/SKILL.md`

## Visual/Browser Findings
- Stitch reference visual summary:
  - Compact sticky white header with "全球分布" highlighted.
  - Left rail around 420px wide containing tabs, search, filter pills, summary card, current-object panel, recent changes, and stable metadata footer.
  - Map center stays clean; emphasis is on sparse semantic pins, a small legend, right-side map controls, and a bottom floating stats capsule.
  - Semantic colors align with the user's brief: green for wild distribution, orange for domestic captive, blue for overseas institutions.
- Existing map page summary:
  - It already uses an atlas component tree, but the current composition still underplays the map and spreads time/change content into the page flow instead of a bottom sheet.
  - Several existing Chinese strings render as mojibake, so the refactor must replace page-facing copy with clean UTF-8 text.
  - The existing screenshot indicates the map stage is too quiet and can read as broken/blank because the semantic overlays are not strong enough.
  - The redesign should collapse the lower history section into an in-workspace bottom panel to match the user's interaction model.
- Final implementation summary:
  - `/global-distribution` now renders as a fixed-height atlas workspace with a sticky top nav, a sectional left rail, a dominant center map stage, an overlay right detail drawer, and a bottom history/change panel.
  - The map stage now includes semantic network lines, refined mode/date overlays, stronger point and region styling, and a bottom summary bar that keeps wild/domestic/overseas readings visible at a glance.
  - The left rail now matches the requested Atlas reading structure: intro, mode switcher, search/filter controls, selected-object hint, mode summary, history/change entry points, legend, snapshots, and source metadata.
  - The right drawer and bottom panel are now true overlays, so object reading and time reading no longer push the map out of the primary frame.
  - The latest pass removed the remaining card language from the workspace: the outer workbench card is gone, the left rail uses section dividers instead of stacked panels, the map overlay/summary strip are now line-based, and the bottom sheet/detail drawer actions read as editorial rows instead of dashboard widgets.
  - The latest layout pass also removed the page gutters: the `/global-distribution` workspace now spans the full viewport width, the left rail is flush to the viewport edge, and the map stage is no longer wrapped in a rounded card container.
  - The newest simplification pass removes the history/change layer entirely, makes the atlas page a non-scrolling fixed workspace again, and rebuilds the left rail with the softer rounded-card language used on the homepage while keeping the map side full-bleed.
