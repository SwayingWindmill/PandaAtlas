# PandaAtlas Admin — registry-first component policy (#475)

## Owner decision

For every new or redesigned UI control, **actively search and compare maintained upstream components first**, starting with shadcn/ui, ReUI, Kibo UI, Dice UI and other suitable registries. Do this **regardless of what is already installed**. Select the best match for product behavior, intended visual quality, keyboard/accessibility support, maintenance and framework compatibility. An existing installed component can be reused only if it wins this evaluation; installation convenience is not a design argument. Consider adapting usage of a mature component or composing upstream primitives before proposing any custom UI primitive. A bespoke implementation is not authorized merely because a screenshot looks different. Every exception must explain the specific unmet behavior, candidate sources, compatibility constraints, substitutions attempted and accessibility/performance implications in the PR.

Pages still require domain-specific query state, typed API integration, and composition. Those are not permission to copy a component's internal interaction or build a second design system.

This rule is also recorded in root `AGENTS.md` for future coding agents.

## Current repository inventory and decisions

| Function | Current approach | Decision |
| --- | --- | --- |
| Search workspaces | shadcn Command + Dialog, installed in #473 | Reuse, do not reinvent. |
| Status filter (Review/Curation) | Previously hand-styled HTML select | **Replaced in #475** with official `shadcn native-select` registry component. Native keyboard selection and existing URL state are preserved. |
| Tabular queue/list | `apps/web/components/ui/table/data-table.tsx`: locally authored adapter around TanStack Table v8 and shadcn Table | **Migration candidate**, not evidence that bespoke data-table primitives should continue. Assess Kibo Table and other v8-compatible component APIs against real server-paginated Review/Curation/Audit semantics. |
| Large advanced data grid | ReUI Grid (currently TanStack Table v9) | Do **not** drop into this v8 repository. Migrating all existing table consumers is a separate feature/compatibility decision. |
| Sidebar | Locally adapted Kiranism/shadcn-like sidebar | **Migration candidate** for canonical shadcn Sidebar, subject to permission-scoped navigation, collapse cookie, shortcut and full Admin browser regression. |
| Details and disclosure | Native `<details>` across Admin | Use canonical shadcn Collapsible/Accordion when redesigning each relevant operator workflow; retain native behavior where it remains the best accessible simple disclosure. |
| Confirmations | shadcn AlertDialog | Reuse; do not author a new confirmation modal. |

### Compatibility sources checked

- Official shadcn Native Select: `https://ui.shadcn.com/docs/components/radix/native-select` (native select behavior).
- ReUI Data Grid: `https://reui.io/docs/components/base/data-grid` (requires TanStack Table v9); PandaAtlas web currently uses `@tanstack/react-table@^8.21.3`.
- Kibo Table: `https://www.kibo-ui.com/components/table`, available as a registry-sourced alternative for a future bounded table migration.
- Dice UI Data Table: `https://diceui.com/docs/components/base/data-table`, evaluated as another potential registry. No blind install until its API/state ownership and peer dependencies are checked for the actual data workload.

## Actual 1440px visual review

Windows-local Chrome/Edge 1440×900 fixture screenshots were captured and opened:

- `.release-gate/admin-ux-475/reviews-state-control-1440.png` — Review queue and evidence pane. The official select is aligned with the heading/toolbar, and no status or content overflow is visible at 1440px.
- `.release-gate/admin-ux-475/curation-state-control-1440.png` — Curation queue and one selected change. The official select fits the queue toolbar, with state/read-only separation preserved.

Both images use explicitly **synthetic** case and curation data, not actual operator records. This is a small component substitution, **not** a broad Kiranism redesign, and does not certify dense datasets, keyboard handling in every dropdown browser, or all Admin routes as visually accepted.

## Acceptance boundary

The existing Playwright seam covers Review/Curation state filtering, readable fact evidence, selected-record behavior, source review and approval constraints. A temporary visual fixture additionally verified that both status selects render the official `native-select` data slot, retain URL filter behavior, and work at 1440px. The temporary test was removed after capture rather than committed as a test of internal component implementation.

Remaining Admin wide work under #444: prioritize replacement of bespoke generic UI on real operator surfaces, **not** import-more-components as a goal in itself. No new UI primitives are authored in #475.
