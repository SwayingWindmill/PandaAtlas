# Admin V4 — Staff directory, roles, and invitations (#499)

## Owner's product target

The owner wants a **beautiful, practical Admin in shadcn/ui and Vercel Dashboard style**, not a codebase that merely reduces a JSX nesting counter. This pass covers `/admin/staff/roles` and a small consistency pass for `/admin/staff/invitations`. The Staff permission model and typed backend remain authoritative.

## Source-first fit and deletion test

- The [shadcn dashboard blocks](https://ui.shadcn.com/blocks?category=dashboard), [Resizable](https://ui.shadcn.com/docs/components/radix/resizable), Table, Collapsible, Button, NativeSelect, Input, Badge, and Empty already represent all necessary controls. The Vercel [Geist typographic approach](https://vercel.com/geist/typography) informs compact, legible headings and neutral information hierarchy.
- ReUI, Dice UI, and Kibo UI do not currently supply a domain-specific safer Staff role-grant/assignment primitive that is more appropriate than the maintained controls. Replacing the directory table with a new third-party grid would duplicate state and add another visual vocabulary without reducing UI complexity.
- **No new UI abstraction, generic React wrapper, registry fork, dependency, endpoint, or role permission was added.**
- The important deletion test is *actual visible structure*: remove nested floating panels and repeated borders while preserving semantic Table, role lists, authoritative permission descriptions and dangerous confirmations. Deep native semantics may still require nesting.

## Changes on screen and in interaction

1. The separate Staff directory and account/detail cards are now a **single border-bound resizable workbench** with neutral directory tint, white detail, one resize divider, and matching queue/detail geometry to Review, Curation and Moderation.
2. The directory uses a compact two-column Table, a neutral selected row, a readable status and fewer inset borders. Search and status filtering remain independent and automatically clear the previous account selection.
3. Current roles use divided rows. Effective permissions remain grouped by actual capability ownership, with the optional original-code disclosure; nested bordered cards around roles and permission lists were deleted.
4. Account status actions, role authorization forms, audit/state-history disclosures and confirmations are **ordered sections in one detail reading flow**, instead of several floating shadow panels. Amber confirmation regions remain deliberately distinct because changing a role or suspending Staff has immediate authorization implications.
5. Directory and selected-account detail failures now expose **explicit re-fetch buttons**. For these operator-triggered reads, React Query automatic retry is disabled so an actual failure becomes visible and recoverable immediately. When the directory fails and nothing is selected, the right-hand Empty view now describes the same failure and left retry action, rather than suggesting the list is simply empty.
6. Small companion pass on Staff invitations: same heading size/padding, less prominent invitation section and less decorative table shell, without changes to invitation submission, MFA recovery, permission checks or status semantics.
7. A WCAG AA color-contrast regression on the selected row was found in browser tests and fixed: neutral selected row with higher-contrast auxiliary role labels. This is a measured contrast correction, not a decorative change.

All existing role grant/revoke/self-grant safety, account suspension/reinstatement restrictions, reason requirements, idempotency keys, histories, account selection logic, typed API usage and route permissions remain. No authorization assumptions are made from a locally rendered button.

## Evidence and audit context

- Prior 1440px baseline is `.release-gate/admin-v4-481/staff-populated-1440.png`.
- Real Chromium 1440×900 captures of explicitly **synthetic Staff records** are in local ignored `.release-gate/admin-v4-499/`: `staff-populated-1440.png`, `staff-role-confirm-1440.png`, `staff-state-confirm-1440.png`, `staff-readonly-1440.png`, `staff-empty-1440.png`, `staff-error-1440.png`. A11y was checked on populated and read-only contexts; the screenshot-only test is not retained as a production fixture.
- Workbench pane coordinates: directory x=294 width=427.4px; account detail x=725.4 width=668.6px, no overlap. Different synthetic fixture values between old and new screenshots mean this is a structural visual comparison, **not a pixel-perfect diff**.
- Permanent Playwright coverage now asserts directory/detail error retries and restricted read permissions, in addition to existing role grant/revoke and staff state-confirmation tests.
- AST counts: Staff roles baseline 389 source lines/143 JSX elements/12 max nesting; current 395 lines/147 elements/12 max nesting, including added explicit failure recovery controls and copy. Invites remain 264 lines/69 elements/8 max nesting. **Reduced card-in-card design is the outcome**, not a misleading claim that the Admin is nesting-free.

Staff visual work is part of #479, not the end of the system-wide audit. The remaining cross-route typography/spacing, density, and stale custom-control review must be assessed on the actual desktop UI before merging the stacked Draft PR chain. No main branch merge or deployment is implied.
