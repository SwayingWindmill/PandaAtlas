# Task Plan: Rebuild Panda Atlas Distribution Workspace

## Goal
Rebuild the global distribution page into the fixed-stage Panda Atlas workspace described by the user: top nav, left atlas rail, center map stage, right detail drawer, and bottom time/change panel, while using the referenced Stitch screen only as secondary layout inspiration.

## Current Phase
Phase 5

## Phases
### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [ ] Define technical approach
- [ ] Confirm which existing atlas components can be reused versus replaced
- [ ] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [ ] Execute the plan step by step
- [ ] Replace or refactor atlas workspace components
- [ ] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
- [ ] Verify all requirements met
- [ ] Document test results in progress.md
- [ ] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** complete

## Key Questions
1. Which existing atlas components can be reused without preserving the current visual/layout problems?
2. How closely can the new workspace follow the user's IA while remaining compatible with current map/data helpers?
3. Can the new Stitch screen be fetched directly, or should the redesign proceed from the user's spec plus the older locally cached reference?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use the user's written design scheme as the primary source of truth | The user supplied a complete IA, interaction model, and visual direction. |
| Treat Stitch as optional reference instead of blocking dependency | The public Stitch route is reachable, but direct screen export URLs are not yet discovered from the shell response. |
| Rebuild the `global-distribution` workspace rather than relying on the legacy `panda-atlas-explorer` | The live route now points at the atlas component tree under `apps/web/components/atlas`. |
| Keep server-side data loading intact and rebuild only the atlas client workspace | This avoids breaking API/fallback behavior while allowing a full UI and interaction rewrite. |
| Give mobile the map first and rail second within the same fixed workspace | The map must remain the dominant stage even when the desktop left rail cannot stay side-by-side. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `rg` unavailable in environment | 1 | Switched to PowerShell search commands. |
| Stitch public project page returns only the app shell without screen export data | 1 | Proceed with the user's written spec and continue probing for export URLs in parallel if useful. |

## Notes
- Re-read this plan before major decisions.
- Prioritize fixing the current blank/underpowered map stage and the mojibake text across atlas-facing files.
- Verification completed with `npm run typecheck:web`, `npm run lint:web`, and `npm run build -w web`.
- A second visual pass flattened the remaining card-heavy surfaces so the workspace reads closer to the Stitch rail + stage composition.
