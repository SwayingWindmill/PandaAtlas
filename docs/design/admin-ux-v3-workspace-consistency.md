# Admin V3 — Operator workbench consistency (#463)

## Scope and visual direction

This refinement stacks on governance navigation Draft #462. It follows the incumbent Kiranism-direction Admin surface and Impeccable Operate constraints without replacing app architecture or installing another component toolkit. The relevant repository references are `AGENTS.md`, the existing shadcn/TanStack components, Matt's tracked TDD and code-review Skills, and Jakub's interface domain Skills.

The problem was observable inconsistency: Audit still used a full-width table followed by a distant detail panel, while Review and Moderation had stone-colored filters, large secondary headings and pager controls unlike Curation/Publication. The shared TanStack DataTable used another border/header palette across every workflow.

## Change contract

- Standardize the existing shadcn/TanStack DataTable's neutral slate table header, row boundary, selected-row affordance, body spacing, and the empty state. No separate table implementation, mock data or bespoke selector.
- Audit presents a fixed desktop master/detail flow. The left queue retains the only supported `limit` URL state, with **event summary**, impacted object, domain, and time in a single readable first column plus inspect action. The right pane consistently exists, starts with an instructive empty state, and shows the real selected event plus technical details only upon disclosure. `aria-pressed` communicates selection; row actions include the concrete event and timestamp in their accessible names so they are distinguishable in a screen-reader button list. Selection and close are native buttons. Raw event metadata, SHA-256 caution, and type-supported deep links remain intact.
- Review and Moderation keep their existing permission-gated APIs, filters, queue states, pagination and mutations. Harmonize desktop headings, select affordance, queue spacing, counts and pager button scale. Moderation appeal selection now exposes `aria-pressed` and a visible keyboard focus. The low-frequency direct account UUID lookup is available via a native, keyboard-reachable disclosure instead of occupying the first screen permanently. High-risk moderation restrictions and confirmation are unchanged.
- Current Curation and Publication already use the newer 2xl/compact header and paired-pane design, so they are intentionally not churned solely for cosmetic line changes. Shared table styling reaches them and the staff directory from one point.

## Bounded rendered review

Visual fixture: `.release-gate/admin-ux-463/audit-1440.png` (ignored local test image; synthetic test data, **not production**). The first audit screenshot caught real clipping: a 4-column table could not fit the left work queue. Replacing the audit queue with two purpose-built columns removed the horizontal overflow without removing provenance from the right pane. The refined screenshot was inspected at the same 1440px viewport. No before/after claims are made based on a loading-only or incomparable capture.

Browser seam: `apps/web/tests/admin/audit-evidence-collection.spec.ts` checks the side-by-side layout and pressed selection, data/tracing disclaimer, deep link, `limit` URL state and axe. The old full-width table could not satisfy the side-by-side region assertion; initial attempt at red verification was interrupted by a local Web service restart, so it is **not** cited as a valid red assertion. A later focused assertion failed when the object label became a combined accessible text line, then passed after its expected label was correctly updated. Implementation scope and this limitation are stated transparently.

## Boundaries

No backend permission changes, new dependencies, invented activity counts, or hidden evidence. The rendered review is desktop 1440px; 320px/200% zoom and actual screen-reader narration have not been independently verified. Green tests do not mean global Kiranism visual signoff, and this work remains a Draft layered on #462 under parent #444.
