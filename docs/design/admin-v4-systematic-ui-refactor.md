# PandaAtlas Admin V4 — Systematic Frontend Reconstruction

## Decision, reference, and boundaries

Issue #479 implements the **first cohesive foundation** of a multi-phase Admin V4, stacked on Draft PR #478. The operator rejected incremental polish, badges, copy tweaks and piecemeal dependency imports. Kiranism's maintained, production-grade [dashboard starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) is the reference for sidebar, header, dense data tasks, contextual operations, empty states and consistent page hierarchy. Exact domain copy, role gates, real API contracts and risk approval semantics remain PandaAtlas's own.

**Component selection is source-first, not installed-first.** Evaluated official shadcn Sidebar, Breadcrumb, Dropdown Menu, Sheet, Tooltip, Separator, Card and Button against prior locally authored equivalents; officially installed shadcn via CLI. ReUI's rich Data Grid currently targets TanStack Table v9 while PandaAtlas uses v8, and Kibo/Dice table choices do not supply the missing shell/navigation behavior. No self-authored UI primitives were created in this phase. Application code composes official pieces around real IAM and typed queries.

### Architecture of the first cut

| Layer | Before | V4 |
| --- | --- | --- |
| Sidebar primitive | Locally authored Kiranism-like sidebar with custom state, breakpoints, collapse cookie, menu wrappers | **Official shadcn Sidebar** with icon collapse, tooltip, Sheet for narrow view, built-in keyboard shortcut and cookie persistence |
| Navigation | Hand-styled list and manual account footer | Official SidebarMenu and DropdownMenu; routes filtered through one existing capability-scoped navigation model; no broader rights granted |
| Header | Manual breadcrumb and dispersed controls | Official Breadcrumb, Separator, Button and standardized command field; context on the left, actions/search on the right |
| Controls | Legacy bare Button/Input implementation | Official registry Button and Input with semantic variant API and theme roles |
| Theme | Mixed slate, hard-coded backgrounds, custom sidebar colors | Scoped `.pa-admin-shell` semantic tokens + Kiranism-like neutral canvas and restrained emerald brand. Semantic variable defaults are defined for shadcn primitives without removing existing public-site `--pa-*` tokens |
| Overview | Flat task rows plus nested workspace list | **Official shadcn Cards** for *real* new-review and validated-curation totals; contextual links, recent audit activity, and concise authorized workspaces |
| Other routes | Differing widths, fixed heading/panel styles | Shared V4 Sidebar / header / canvas immediately; domain-level refactors tracked separately below |

Root migration applies to all Admin routes but does **not** pretend to have standardized every legacy domain component or migrated its form validation.

## Actual 1440px visual review

Screenshots from real Chromium rendering on this branch, with explicit synthetic fixtures, were captured and individually opened:

- `.release-gate/admin-v4-479/overview-1440.png`: task summary, authorized workspaces and actual-shaped audit activity; no fabricated health score, time-series or daily delta.
- `.release-gate/admin-v4-479/overview-collapsed-1440.png`: waited for real sidebar width below 90px, not merely the `collapsed` attribute. Main content actually expands and icons stay usable.
- `.release-gate/admin-v4-479/reviews-populated-1440.png`: queue and source evidence with populated fixture data, official shell and no content clipping at 1440px.
- `.release-gate/admin-v4-479/staff-empty-1440.png`: honest empty-accounts state with working filter surface and same header/sidebar.

Fixtures do not represent production accounts, review cases, unpublished content or real audit timestamps. This evidence is **a first-pass desktop appearance audit**, not owner approval of Kiranism parity.

### Six-domain findings and decisions

1. **Accessibility:** Official Sidebar + Dropdown brings consistent keyboard/ARIA semantics and focusable account actions. Browser assertion covers collapse, persist across reload, Ctrl+B, narrow navigation and axe of home screen. Official menu item permissions use the existing authoritative route gate.
2. **Layout:** The 16rem sidebar and inset main canvas establish shared edges across business pages, while the overview scales into a two-card true workload summary and activity/workspaces split. Domain pages still have inconsistent local spacing.
3. **Writing:** No invented daily trends or fake workload snapshots. Queue counts reflect `state=new` and `state=validated`; errors remain errors and zeros stay zeros. Source details are displayed only where available.
4. **Typography:** Clear page title, section title, main count and caption levels. Density remains too sparse in real audit and staff pages for the final design goal; follow-up migration required.
5. **Color:** Emerald marks primary actions and selected navigation; blues/gray convey neutral metadata, with labels rather than color-only status. The palette stays scoped to Admin and does not overwrite PandaAtlas's public editorial brand.
6. **UI:** Official inset shell, account dropdown, breadcrumb, tooltips and focus behavior. No decorative chart, random statistics or new homemade widget.

## Migration map — mandatory next slices

This **is not a final completion claim**. The systemic target includes *all* routes; the bounded first cut does not.

| Priority | Routes | Next actions (only mature registry components) | Design acceptance |
| --- | --- | --- | --- |
| P0 | `/admin/reviews`, `/admin/curation` | Select Kibo/Dice/ReUI Table after evaluating exact TanStack versions and server filter semantics; replace handwritten inputs, checkbox sets and `details` with shadcn Form, Input, Checkbox, Collapsible as fit; eliminate duplicated field styling | Real/dense queue, 0/error/loading, long evidence, independent approver; keyboard, axe, 1440px |
| P0 | `/admin/publication`, `/admin/audit/evidence` | Consistent shadcn/DataTable toolbar, data density and read-only detail with disclosure; keep exact-version inspection, audit provenance and activation confirm | Release diff, failed fetch, rollback, 100-row audit, 1440px |
| P0 | `/admin/staff/roles`, `/admin/staff/invitations` | Shared list toolbar, well-formed shadcn Input/Select/Tabs/Dropdown, reduced action noise and user-first role names, no hidden permissions | Manager + reader with many accounts, invitations in all states |
| P1 | `/admin/moderation`, `/admin/capabilities`, `/admin/security/mfa` | Unified detail panes, confirmations, progress and errors using registry components | Role-scoped and MFA flow, keyboard recovery, 1440px |
| P1 | Global | Remove obsolete homemade components and redundant CSS only after last import is migrated; check public Website Button/Input regressions | Admin full Playwright plus public smoke, no visual regressions |

Each slice must **re-search mature sources before selecting**. Do not optimize for what is installed or bend a UX requirement to avoid dependency work. A measured user-facing improvement, not imported component count, is the acceptance criterion.

## Test boundary and merge policy

Use Windows-native toolchain. Full Admin Playwright, scoped/then full types/lint, design and runtime guards, Impeccable + change-scoped visual review. Keep Draft PR stacked on #478, no merge to `main` until independently accepted. A green automated test does not certify final visual quality.
