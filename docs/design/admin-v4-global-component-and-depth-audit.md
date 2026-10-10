# Admin V4 — UI primitive, module depth and deletion-test audit (#485)

## Scope and method

Run the reproducible scanner from apps/web: node scripts/audit-admin-ui.mjs. It traverses features/admin TSX with the TypeScript AST and reports JSX depth, element count, ternary expressions, useState calls and direct native button/input/select/textarea/details tags. Manual review additionally covered 11 app/admin route wrappers, the shared UI table renderer, navigation and all domain components.

The scanner is a **source inventory, not a quality threshold**. Nesting introduced by maintained Table, AlertDialog, Resizable and Collapsible compositions can be semantically appropriate. High JSX depth does not justify moving every nested element to a new one-line React component. The tool does not certify that every imported dependency is an unchanged registry component.

### Baseline and resulting inventory

| Measure | Starting PR #484 | After #485 |
| --- | ---: | ---: |
| Admin TSX modules under features/admin | 17 | 16 |
| Native input | 5 | 4 |
| Native select | 5 | 3 |
| Native textarea | 7 | 6 |
| Native button | 5 | 1 |
| Native details | 7 | 2 |
| **All five native control tags** | **29** | **16** |

The remaining **16 native control occurrences are all inside Moderation**, which is explicitly still unrefactored. These tags are not 16 user-authored React components.

| Module | Baseline LOC | Baseline max JSX depth | Branches / useState | Risk |
| --- | ---: | ---: | --- | --- |
| Review | 516 | 17 | 39 / 15 | Four modes and multiple actions in one module; state, permissions and view mixed |
| Publication | 500 | 12 | 39 / 4 | Version policy, diff, approval and view combined; maintained registry compositions may increase syntactic depth |
| Moderation | 470 | 11 | 30 / 17 | **Top remaining debt**, sanction, restoration and appeal are coupled; 16 native controls |
| Staff roles | 389 | 12 | 31 / 10 | Standard controls already adopted; multiple privileged business flows |
| Curation | 280 | 15 | 9 / 2 | Most hierarchy expresses real provenance/disclosure levels, not pointless wrappers |
| Audit | 134 | 8 | 4 / 1 | Small domain screen; one shallow helper deleted |

### Source-first evaluation

- Official shadcn/ui NativeSelect, Button, Input, Textarea, Collapsible, Empty, Skeleton, Table and Resizable cover the actual input, detail and navigation needs. Official Data Table guidance treats headless table state as domain-specific, permitting extraction of repeated table markup.
- ReUI advanced Data Grid and Dice UI Data Table provide sophisticated filtering, but bring different query ownership and newer TanStack Table APIs. Current project has TanStack v8.21.3 and explicitly supported server paging/URL filters. No reason to replace those contracts for this slice.
- Kibo UI remains an appropriate table/nav inspiration, but does not provide the signed publication consequences and audit evidence policy. Importing competing widgets just for cosmetic variety would increase complexity.

Registry references: https://ui.shadcn.com/docs/components/base/native-select ; https://ui.shadcn.com/docs/components/base/data-table ; https://ui.shadcn.com/docs/components/radix/collapsible ; https://reui.io ; https://diceui.com ; https://www.kibo-ui.com .

## Deletion test of existing custom modules

1. **Deleted audit-evidence-columns.tsx**, a one-consumer 21-line column wrapper. It did not hide complexity at a valuable seam; inline the audit record column in the only user.
2. **Retained components/ui/table/data-table.tsx**, a shared approximately 40-line TanStack renderer with multiple independent Admin callers. Deleting it would recreate header/body/empty mapping at every call site. It is app composition over mature Table and TanStack, not a custom table engine.
3. **Retained domain shell pieces** such as command menu and role-sensitive staff/account page navigation. The command palette uses shadcn CommandDialog and handles app route permissions; replacing it with another homemade palette is unjustified. The two 20/24-line page-link navigations have repeated styling but still encode different routes/gates: future comparison with official Tabs/NavigationMenu should preserve link semantics, browser history and visible permissions.
4. **Retained business pages**. A domain page that maps typed API objects to text and safe privileged operations is application composition, not prohibited creation of another generic UI primitive. Their large hook/controller surfaces are a genuine follow-up debt, not something to hide behind 20 pass-through presentational wrappers.

## Actual work completed

- Publication: official forms, disclosure, Empty, Skeleton, semantic changed-resource Table, dense two-column version queue, keyboard Resizable and explicit list retry. Preserved release lifecycle rules, typed confirmations, resource IDs and URL state.
- Publication safety: actual error-state rendering revealed that a direct release detail could load while the current-release collection failed. Privileged lifecycle actions now require a successful release-list query; the detail stays read-only with an explicit warning until the current version can be verified. An automated test covers this state.
- Audit: official control/disclosure/feedback, denser single-column record selector and keyboard Resizable, 100-record bounded scrolling and explicit retry. Did not invent actor identity or unsupported object links.
- Shell/Review stragglers: replaced original handcrafted button controls with official Button and account raw-permission details with official Collapsible.

### 1440px actual visual audit

All screenshots were captured in Chromium from explicit **synthetic** fixture data; no production accounts, release versions or audit evidence:

- .release-gate/admin-v4-485/publication-diff-1440.png
- .release-gate/admin-v4-485/publication-confirm-1440.png
- .release-gate/admin-v4-485/publication-error-1440.png
- .release-gate/admin-v4-485/audit-long-1440.png
- .release-gate/admin-v4-485/audit-detail-1440.png
- .release-gate/admin-v4-485/audit-error-1440.png

Visual findings: old fixed publication and audit columns were inconsistent with the shared V4 master/detail. Maintained Resizable fixes keyboard and width ownership; version and audit selectors avoid third-column horizontal clipping. Real empty/error/retry states were checked. No synthetic health score, trend or data source was invented.

### Follow-up priority

- **P0 Moderation**: 470 LOC, 17 state hooks, 16 remaining native controls, 30 ternaries. Replace with registry-native controls first and examine sanction/restore/appeal state controller seams; preserve confirmation, permission gates and independent appeal decision.
- **P1 Review flow**: 516 LOC, 17-level JSX tree, 15 state hooks. Keep four domain operations explicit but investigate deepening case-operation interface without inventing generic forms.
- **P1 Publication state policy**: separate only genuinely deep, testable version-eligibility or query policy. More div extraction by itself does not solve 500 lines.
- **P1 Account/staff nav duplication**: source-first NavigationMenu or Tabs comparison; no false unification of unrelated authorization.
- **P1 End-to-end visual parity**: owner acceptance still absent for entire Admin; no main merge or deployment implied.

This is phase 4 of #479, stacked on Draft PR #484. Open issues and draft PRs stay open until review.
