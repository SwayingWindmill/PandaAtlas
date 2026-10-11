# Admin V4 — actual nesting reduction and release policy ownership (#491)

## Why this slice

The Admin V4 component audit is repeatable with `cd apps/web && node scripts/audit-admin-ui.mjs`. On the stacked #490 head, the Publication workspace had 519 source lines, **184 JSX elements, 14 maximum JSX levels, 38 conditional expressions and four useState calls**. The 16 Admin TSX modules had **zero** directly authored native `input/select/textarea/button/details` tags. This did not mean the visual layout was simple: multiple bordered surfaces and repeated inset wrappers separated related release facts.

We did not set JSX depth as a pass/fail metric. The deepest old chain includes official shadcn Table, TableBody, TableRow and TableCell; those are necessary semantic composition, not app-authored nested cards. The meaningful deletion test is whether removing a node removes visual or interface complexity without relocating it into a new homemade wrapper.

## Source-first decision

- **shadcn/ui** Table, DataTable (TanStack v8), Resizable, Collapsible, Badge, Input, Textarea, AlertDialog and Empty remain appropriate for desktop release inspection, with real server-paginated data and keyboard behavior.
- **ReUI / Dice UI** offer sophisticated grids but would duplicate collection and pagination ownership already handled by existing typed React Query, nuqs and TanStack v8. A grid replacement cannot fix nested comparison blocks.
- **Kibo UI** does not replace PandaAtlas-specific release lifecycle eligibility, confirmation effects or version diff semantics. Adding another presentational registry would increase the surface, not delete depth.

No new UI primitives were created or installed. The one new TypeScript module is **pure publication policy**, not a reusable visual component.

## What was actually deleted

1. The current release strip loses its own rounded, bordered card inside the overall workspace. A simple divider separates the current public version from the release selector.
2. The candidate content counts use semantic `dl/dt/dd` with one separator instead of an inset gray bordered card, preserving all eight authoritative counts.
3. Redundant three-column summary boxes for added/changed/removed become a single line of real counts, preserving the important removed-resource warning separately.
4. Change-kind records are now a divided list, not another bordered card. The supported shadcn Table is placed directly inside the resource detail section, without an enclosing shadow/border container.
5. The release operation and transition-history blocks use existing section separators to restore a plain reading sequence, instead of nested card treatment. All action confirmations remain protected by the official AlertDialog.
6. Version **eligibility** moves from an in-render memoized conditional chain to `availablePublicationActions`, a pure function with an explicit current-release-read success parameter. This deepens the business seam and keeps permission and version ordering checks separately verifiable; it is not a pass-through React wrapper.

Final scanner result: **498 source lines, 173 JSX elements, 13 maximum JSX levels, 37 conditional expressions, four useState calls**. The reduction is 11 genuine JSX nodes and one nesting level; the remaining 13-level path still includes maintained table composition. A shallow cut that hides all JSX in many one-use React files would be counterproductive.

## Non-negotiable behavior

The source of truth stays with the typed NestJS publication endpoints and React Query. URL page, lifecycle and release selection, change pagination, current-release fallback, schema-compatible rollback, different emergency/normal capabilities, confirmation payload, audit trail and recent-MFA recovery links are unchanged. A direct version inspection **cannot** offer a privileged operation while the collection/current public version is unverified. This invariant now has three small independent policy tests.

## Verification and limits

Compared the earlier `.release-gate/admin-v4-485/publication-diff-1440.png` visual baseline with real 1440x900 Chromium captures from **explicitly synthetic** release records:

- `.release-gate/admin-v4-491/publication-populated-1440.png`
- `.release-gate/admin-v4-491/publication-confirm-1440.png`
- `.release-gate/admin-v4-491/publication-readonly-1440.png` (manage capability only; no activation or emergency action)
- `.release-gate/admin-v4-491/publication-empty-1440.png`
- `.release-gate/admin-v4-491/publication-error-1440.png`

The five screenshots were captured successfully and visual structure examined; the populated page passed automated axe WCAG2 A/AA and WCAG2.1 A/AA. The temporary screenshot-only browser test was removed, leaving ordinary black-box browser tests and three permanent Node tests for the release policy. The synthetic datasets in the baseline and current capture are not identical, so the comparison is of layout treatment, not a precise pixel regression.

The rest of Admin remains large: Review 524 lines/14 levels/206 JSX elements, Moderation 507 lines/12 levels/174 elements, Staff roles 389 lines/12 levels/143 elements, Curation 280 lines/15 levels/136 elements. Some depth comes from real form/table/collapsible semantics; follow-up should focus on redundant DOM and overlapping user tasks, not a target of zero nesting. **#479 remains open**; no user visual signoff or main branch merge is implied.
