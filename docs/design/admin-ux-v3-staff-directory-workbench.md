# Admin UX V3 — Staff management directory and detail (#465)

## Scope

Draft stacked on Admin V3 workbench PR #464; part of #444. After consolidating governance navigation, `/admin/staff/roles` still displayed an unfilterable vertical list and a long multi-card detail mixing effective capabilities, changes, and histories. This change makes that existing operator task more legible without modifying NestJS IAM, its APIs, permissions or staff data.

## Task-first flow

- The left staff directory has one search field (email, account ID, role key or its existing Chinese label), a native state filter for all/active/suspended, and an accurate `matching / total` count. There are distinct initial-loading, API-error, no-staff, and no-filter-match states. Changing a search or filter clears a stale selected staff record and any pending change confirmation.
- Staff rows remain native buttons with `aria-pressed` and explicit selected/focus states. Real role labels, emails and account states come from the existing directory response; no made-up availability, roles or permissions.
- The right detail preserves current identity, status, current roles and server-provided effective permissions. Permission groups are now compact rows rather than nested cards. The original capability identifiers remain available in a disclosure for technical audit.
- Account state and role authorization histories are secondary native disclosures with truthful record counts, while ordinary role/state changes retain their existing reason, confirmation, self-mutation guard and authority constraints. Only server-authorized actions appear.
- No new component kit or adapter has been introduced. The existing shadcn Input, Button and Badge plus native `select` and `details` are sufficient for this slice.

## Validation and evidence

- Browser/public UI seam: `apps/web/tests/admin/identity-admin-shell.spec.ts`. Matt TDD red at the unavailable `搜索工作人员` searchbox, green after implementation. Test fixtures include three staff, active/suspended states, text search, combined filters, no results, selection and axe WCAG 2.0/2.1 A/AA. Existing role grant/revoke and suspend/reinstate tests now open the relevant native audit-history disclosure when inspecting historical entries.
- 1440px synthetic-fixture screenshot `.release-gate/admin-ux-465/staff-directory-1440.png` reviewed at screenshot scale after filtering active workers. Synthetic accounts are **not production staff**. Layout, row count, focus hierarchy, and primary vs historical content are checked visually; no screenshot is shipped as product data.
- Impeccable Operate, Matt Standards/Spec and Jakub six-domain change-scoped interface review. These checks are performed in-thread when independent subagent orchestration is not available, not represented as independent sign-off.

Full Admin owner acceptance of Kiranism look and interaction remains pending in #444. Keep Draft; no merge into `main` without owner visual approval.
