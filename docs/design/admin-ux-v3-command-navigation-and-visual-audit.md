# Admin UX V3 — Kiranism-oriented command navigation and overview hierarchy (#473)

## Scope

This is a bounded refinement on top of Draft PR #472 under #444. The user correctly observed that the earlier Admin V3 passes improved functionality more than the overall visual coherence. This pass intentionally addresses **shared navigation** and the daily **/admin** entry page, rather than claiming to redesign every existing business page.

## Mature component adoption

The official `shadcn@4.21.4 add command dialog` CLI installed the Command primitive (cmdk) and Dialog (Radix UI). The app uses these imported components directly, not a hand-rolled searchable modal. The generated English dialog's close labels were localized for the Chinese Admin. No ReUI, Kibo UI or Dice UI components were imported on this pass: the existing queue does not need a gantt, kanban or advanced editable grid, and adding one just to inflate the dependency list would worsen usability. ReUI's data grid/filter patterns are candidate upgrades for the concrete Review, Curation and Audit collections once their interaction contracts are separately checked.

The Admin header now has a real searchable command launcher and **Ctrl/Cmd+K** shortcut, capability-filtered from the same canonical navigation list as the sidebar (including authorized secondary routes). Search by Chinese function name and description, arrow-key/Enter selection, Escape and a meaningful empty state work without exposing unauthorized destinations. The shadcn Command empty state is paired with an accessible, disabled option so the listbox remains valid when filtering produces zero choices. The search entry is reachable from every authorized desktop Admin route.

The overview's task list now uses **single whole-row links** for the actual queue destinations, eliminating separate tiny buttons and duplicate targets. Real queue counts remain primary only where server responses are available, with loading/error/zero text intact. Recent audited activity remains the source for recent events, not mocked live history. Workspace links stay secondary. Bigger headings, consistent row height/spacing, calmer borders and restrained teal accents improve first-viewport scanning without adding meaningless metric cards or fake trend charts.

## Visual evidence (synthetic fixture)

Actual Edge 1440×900 captured against the branch's rendered implementation:

- `.release-gate/admin-ux-473/overview-1440.png`: authorized sidebar, command search field, queue totals 8/3 from synthetic fixture, recent activity and compact secondary workspaces.
- `.release-gate/admin-ux-473/command-1440.png`: dialog with groups, keyboard cues, results and visual focus treatment.

These are local ignored **fixture screenshots**, not production data. They were opened and compared to earlier Admin overview screenshot and the live Kiranism reference. The structure and task discoverability are improved, but the overall dashboard is still intentionally less analytic than Kiranism because PandaAtlas currently has no grounded high-level analytic time-series API.

## Remaining component migration candidates / owner acceptance

1. **High:** Review and Curation need a consistent table toolbar using real server-backed status/search filters, loading/empty/permission states, and a clearly focused detail/action panel. Consider ReUI data-grid only where it genuinely supplies interaction not already present in TanStack Table.
2. **High:** Moderation and Audit need authentic operator-state screenshots with dense and long records. The shell screenshot cannot prove those pages' visual design.
3. **Medium:** Publication's real resource ID inspection needs human-meaningful, evidence-backed field diffs before a fully informed activation; do not pretend digest changes equal field changes.
4. **Medium:** Standardize dropdowns, popovers, tooltip/keyboard hints and confirmation surfaces with shadcn primitives **page by page**, not all at once. Evaluate Kibo / Dice registries when a particular workflow needs their specific behavior.

Impeccable 4.5.1 Operate/craft-floor and Matt Standards/Spec guided this pass. Browser TDD verifies role gating, search, keyboard navigation and axe. No owner sign-off or live production-like visual comparison is implied.
