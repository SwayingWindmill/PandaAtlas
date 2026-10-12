# Admin V4 — Staff directory and invitations, registry-first migration (#481)

## Goal and boundary

Staff management previously displayed a hand-styled, vertically stacked button-card directory, fixed-width detail region, independent status controls, and invitation records in a manually composed grid. This slice uses maintained components for the common operator workflow. It is **phase 2 of V4 #479** and follows Draft PR #480. No change to NestJS identity API, staff authorization, role catalog, mutation reasons, confirmations or MFA policy.

## Mature component decision

Selection was not based on what was installed. Evaluated the official shadcn Table, NativeSelect, Resizable, Collapsible and Empty APIs against server-owned staff/role records, read-only and manager permissions, keyboard operation and adjustable density. These maintained components meet the scope without introducing a parallel widget.

ReUI Data Grid is more appropriate for server-backed sort/selection/column state across Admin, but its current TanStack major-version requirements must first be reconciled with PandaAtlas's v8 table consumers. Dice UI Data Table offers richer per-column controls but changes ownership of filtering/pagination/query state. Kibo UI Table targets sortable collection workflows. None is required for the **directory + selected staff detail** interaction; importing one purely for aesthetics would add complexity. Rich tables remain a distinct task.

| UI area | Old approach | New maintained component |
| --- | --- | --- |
| Staff directory | Separate clickable card per person | shadcn Table, selected row plus semantic Button to open details; bounded long-list scrolling |
| Status and role filters | Individually styled native select | shadcn NativeSelect with original labels, search and filter semantics |
| Staff directory vs. detail | Fixed CSS grid | shadcn ResizablePanelGroup/Panel/Handle, pointer- and keyboard-adjustable split |
| Role/account history | Manual details/summary styling | shadcn Collapsible, accessible triggers, collapsed-by-default history |
| Invitation records | Hand-built CSS grid/list | shadcn Table with headers, Beijing-time dates and status badges |
| No staff / no selection / no invitations | Plain paragraphs, unused whitespace | shadcn Empty composition, concise next actions, no fake data |

No bespoke UI primitive has been added. These are page-specific compositions of maintained components, and data continues to come from existing typed endpoints.

## Actual 1440px desktop visual audit

Captured in a real browser from this branch with **explicitly synthetic local staff/invitation fixtures**, under .release-gate/admin-v4-481/:

- staff-populated-1440.png — 18-row directory with bounded scrolling, a selected account, roles/permission details and status controls; identity and selection are visible together.
- staff-resized-1440.png — keyboard-resized directory is wider while details stay readable.
- invitations-populated-1440.png — real table elements for email, localized time and status, plus invitation form.
- invitations-readonly-1440.png — same table without an unauthorized invitation form.
- staff-empty-1440.png — true empty data state, with no invented staff accounts.

The first visual pass revealed a large undirected blank area on the right before selecting a person. The official shadcn Empty component was introduced in response, and the final empty and populated screenshots were recaptured and inspected. Its original muted text had only a 4.41:1 contrast ratio against the Admin canvas, so the Admin semantic muted-foreground token was darkened. The final empty-state Playwright axe check passed WCAG 2 A/AA and 2.1 A/AA rules. All screenshots are fixture data, not genuine production accounts.

## Six-domain review

Accessibility: semantic table headers, keyboard-adjustable separator, accessible row buttons, labeled selection controls, Collapsible history actions; Playwright/axe cover empty and populated states. Layout: 1440px master/detail with bounded scrolling; full-width invitation table. Writing: counts/statuses are actual API shapes, no invented account names; suspend consequences and invite MFA messaging unchanged. Typography: identity primary, role secondary, status compact. Color: selected state highlighted with a label; suspended/pending states have text. UI: registry controls with original privileged confirmations.

## Remaining system-wide work

This is **not the entire Admin V4 refactor**. Priorities in #479 still include Review/Curation's dense toolbar and forms, Publication's diff details, Audit's table and error states, and representative real-data visual acceptance. General styling does not prove Kiranism parity. No main merge or production deployment.
