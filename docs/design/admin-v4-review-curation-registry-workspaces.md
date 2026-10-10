# Admin V4 — Review and Curation registry workspaces (#483)

## Boundary

This is phase 3 of Admin V4 (#479), stacked on staff Draft PR #482. Replace independently styled input/checkbox/disclosure/loading controls in two important operator flows without changing API orchestration or copying an unrelated dashboard literally. Existing NestJS endpoints, React Query, capability-scoped mutation, reviewer ownership, independent Curation approver, required reasons and confirmation are preserved.

## Source-first evaluation

- ReUI Data Grid: https://reui.io/docs/components/base/data-grid — current 2026 implementation requires TanStack Table **v9** and its useTable feature model. PandaAtlas currently has @tanstack/react-table **v8.21.3** in multiple production Admin surfaces. A single-table migration would break existing server pagination/query contracts; postpone migration to a dedicated repository-wide effort.
- Dice UI Data Table: https://diceui.com/docs/components/base/data-table — rich advanced sort/filter/column controls, but its hook and toolbar own URL query state. Our Review/Curation APIs already own 25/10-row page state and status filters through nuqs; there is no established business sort schema to map to the new hook in this slice.
- Kibo UI Table: https://www.kibo-ui.com/components/table — strong table formatting examples but does not solve evidence forms, source review or independent approval.
- Official shadcn/ui: https://ui.shadcn.com/docs/components/base/data-table — its guide explicitly treats domain tables as distinct while recommending maintained Table primitives. Select official Input, NativeSelect, Textarea, Checkbox, Collapsible, Empty, Skeleton and ScrollArea (via CLI) for controls. Retain existing registry Resizable, Tabs, AlertDialog and Table for the typed data flow.

Decision is based on the required UX and compatible versions, not the local installed set. Newly invented UI primitives: **zero**.

## Changes

| Area | Before | After |
| --- | --- | --- |
| Review intake | HTML details plus handmade input | Official Collapsible and Input |
| Verify source | Hand-styled select, input and textarea | Official NativeSelect, Input, Textarea |
| Decide evidence | Native checkbox and custom overflow list | Official Checkbox and ScrollArea; keyboard Space selection |
| Review provenance | Multiple HTML details | Official Collapsible with institution link intact |
| Curation provenance | Mixed HTML details and custom info fragments | Official Collapsible for complete IDs and raw source fields |
| Approval | Hand-styled textarea | Official Textarea; original TanStack Form and AlertDialog retained |
| Both screens | Inconsistent shell width, plain loading, blank detail | 1480px Admin canvas, official Skeleton and Empty |
| Curation queue | Three columns horizontally clipped the left edge after selecting an item | Two-column record/status table, selectable record Button and explicit 查看变更 affordance |

Server-read failures in both queues and detail panes now offer an explicit retry action through the existing React Query refetch method, rather than leaving the operator with an alert and no recovery path.

Server-owned pagination/state, read-only role gates, self-approval prohibition, identity of the reviewer, publication boundary and API contracts remain unchanged.

## Real 1440px browser review

Actual desktop Chromium screenshots from explicit synthetic fixture data are under .release-gate/admin-v4-483, not real accounts or unpublished content:

- review-long-1440.png: 18 case rows and 12 assertion details.
- review-verify-1440.png: source verification and required canonical source input pair.
- review-decide-1440.png: selectable facts, contributor explanation, internal reason.
- review-readonly-1440.png: case evidence with mutation controls withheld.
- review-empty-1440.png: zero server-record queue and no selected case.
- curation-queue-1440.png: 10 rows and clear empty detail guidance.
- curation-detail-1440.png: fact, owner changes and provenance disclosure.
- curation-confirm-1440.png: independent approval confirmation and reason.

The first Curation screenshot revealed a horizontally cropped list when the rightmost action gained focus. Fixed this by removing the action column and placing an explicit record-opening Button inside the first column, with the full reason in its accessible name. Captured new populated/selected screenshots confirming no clipping. The official EmptyTitle defaults to a div; placed an H2 inside it to retain semantic heading navigation.

## Six-domain audit

- Accessibility: all new controls use upstream focus and label handling; Space toggles the assertion checkbox; source disclosure and scroll remain keyboard operable. Keep axe verification of populated, empty, read-only and modal states.
- Layout: consistent desktop page margin and heading, distinct master/detail boundaries, scroll only for long queues.
- Writing: real state/counts, institutional source evidence, explicit internal approval vs public publishing; no invented statistics.
- Typography: primary page heading, compact queue titles and subordinate captions, machine IDs visible on demand.
- Color: semantic labels beyond color and focused selected records; existing scoped Admin contrast remains.
- UI: registry-owned controls; no parallel checkbox, select, disclosure or form primitive authored here.

## Not yet complete

This is not full Admin parity with Kiranism. Publication and Audit grids, plus moderation and other business flows, remain under #479. Draft PR only, no main merge or production deploy without owner visual acceptance.
