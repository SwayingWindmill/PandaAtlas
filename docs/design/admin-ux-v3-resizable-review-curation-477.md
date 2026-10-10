# Admin UX V3 — registry-based Review / Curation workspace (#477)

## Decision and scope

Under parent #444 and stacked on Draft PR #476. The existing fixed Review/Curation split was difficult to adapt to long queues versus long evidence. Review's homemade four-button case mode selector also lacked standard tab semantics/arrow navigation. This pass replaces **these controls**, not the typed domain workflows or all Admin tables, with **official shadcn registry components**.

The owner rule in `AGENTS.md` is mandatory: actively compare shadcn/ui, ReUI, Kibo UI, Dice UI and alternatives **before considering installed dependencies**. Do not implement homemade UI when a maintained component or appropriate upstream composition exists.

## Upstream option evaluation

| Candidate | Finding | Decision |
| --- | --- | --- |
| shadcn/ui [Resizable](https://ui.shadcn.com/docs/components/base/resizable) | Maintained wrapper over `react-resizable-panels`, provides accessible labeled separator, pointer and keyboard resizing, independent domain state | **Chosen** for both queue/detail workspaces; installed by official shadcn CLI |
| shadcn/ui [Tabs](https://ui.shadcn.com/docs/components/base/tabs) | Maintained Radix-based tab list, true tab/tabpanel semantics, arrow-key movement and controlled selection | **Chosen** for the Review evidence / verify / decision / recommendation selector |
| ReUI [Data Grid](https://reui.io/docs/changelog) | Latest grid targets TanStack Table v9 while this app owns v8.x server-backed queue adapters; data-grid replacement does not solve the split-pane use case | Deferred to **explicit table-version migration**, not selected on existing-install basis |
| Dice UI [Data Table](https://diceui.com/docs/components/base/data-table) | Full toolbar and query-state/nuqs integration, useful for data table replacement but would duplicate current server-side queue filter/pagination ownership unless explicitly migrated | Candidate for separate Review/Curation/Audit table migration |
| Kibo UI [Table](https://www.kibo-ui.com/components/table) | Sortable/composable table is suitable for table-only workflows, not a resizable master/detail workspace | Candidate to assess on the actual data-grid task, not as a substitute for missing pane behavior |

No custom resizable, tab, or drag-handler primitive was created. Registry artifacts are `apps/web/components/ui/resizable.tsx` and `tabs.tsx`, used as installed.

## Implementation and compatibility

- Review and Curation use `ResizablePanelGroup`, `ResizablePanel` and `ResizableHandle` with desktop-appropriate minimum/maximum sizes, visible full-height divider and explicit accessible handle label. Operators can resize with mouse or keyboard without changing the selected record or submitting a mutation.
- Review's previous manually styled `aria-pressed` buttons become `TabsList`/`TabsTrigger`/`TabsContent` with actual tab/tabpanel semantics, arrow navigation and capability-scoped available tabs. The domain form draft continues to live in the parent component: switching modes preserves text; switching to a different case resets it.
- The Vite/Vinext dev runtime initially prebundled `react-resizable-panels` against a mismatched React module and emitted an `Invalid hook call`, despite npm resolving one React 19 version. `optimizeDeps.exclude` for that upstream package prevents this dev-only optimized duplicate and restores real browser behavior; the upstream package itself is unchanged. No speculative compatibility layer or runtime fallback was added.
- Existing server pagination, URL filters, ownership/role checks, case mutations and independent Curation approval are untouched.

## Visual audit: 1440px desktop browser, synthetic fixture

The following local screenshots were captured in Edge from the actual modified branch at 1440×900 and **opened for inspection**:

| Screenshot in `.release-gate/admin-ux-477/` | Observation |
| --- | --- |
| `review-evidence-1440.png` | Evidence/details remain in the first viewport. Queue stays legible, source URL link remains accessible; drag rail is full height after feedback-driven correction. |
| `review-verify-1440.png` | One source-verification form, with selected tab and source-specific fields. Other modes do not stack on top of it. |
| `review-decision-1440.png` | Desktop two-column review decision; tabbed UI and action hierarchy have visible focus/selection states. |
| `curation-before-resize-1440.png` | Case list and approved-candidate detail in parallel, with explicit human-readable risk warning and a visible draggable divider. |
| `curation-after-resize-1440.png` | After keyboard resizing, queue width increases and detailed evidence remains readable. Layout does not discard loaded data. |

Screenshots use *explicitly synthetic* source and change-set facts. They do not prove production long-list usability, independent designer approval or Kiranism parity. Only desktop 1440px was visually inspected in this slice; previously green browser tests also exercise error, no-content and read-only paths, but those paths do not have new visual captures here.

### Six-domain / Operate review

Accessibility: upstream panels and tabs provide keyboard interactions; role/label are confirmed through Playwright. No icon-only unlabeled control was introduced. Layout: master/detail width adjustment is discoverable and content remains constrained inside its panel. Copy: real server facts and truthful source limitations retained. Typography: existing small record IDs and labels remain readable in the captured fixtures, but high-density long records await separate tests. Color: the selected tab has both state/underline and color; drag rail uses neutral/teal hover. UI: visible divider improved after screenshot review, with no heavy transition or decorative cards.

**Open:** reusable table/view-toolbar migration is still the next highest-value work; evaluate Dice UI/Kibo/ReUI in a separate bounded server-backed task. The legacy bespoke `DataTable` adapter is **not** newly endorsed by this PR. The old Review intake disclosure/verification form still uses some handwritten native element styling, which should be replaced with appropriate registry components during its own form refactor. Owner-level whole-Admin visual acceptance remains open in #444.
