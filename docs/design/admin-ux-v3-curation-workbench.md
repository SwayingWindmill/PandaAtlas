# Admin UX V3 — Curation master/detail workbench (#457)

## Purpose and design authority

This is an **Operate-mode refinement of the existing Curation surface** on the integrated V3 preview. It is stacked on the Review V3 slice and is not a redesign of PandaAtlas authorization or public-facing pages. Upstream reference: Kiranism's Next.js shadcn dashboard patterns for URL-synced filterable TanStack tables, bounded content layouts, clear toolbar-to-record flow and real mutations. Shadcn's existing Button, Badge, AlertDialog and TanStack Table are reused. No alternative UI kits, custom primitive replacements, decorative KPIs or fake data have been introduced.

The prior screen showed a full-width table, with the selected change set below the table (requiring a long scan and scroll); the detail nested Card inside Card for its metadata and each fact. The new screen makes the selection and evidence available side by side on desktop. User-visible action and proof stay co-located; IDs and low-frequency structured payloads stay in disclosures.

## Contract

- The **left pane** is the current server-backed Curation queue with status filtering and pagination via nuqs URL state. A clicked row's actual `changeSet` stays deep-linkable, is indicated with `aria-pressed`, and can be closed. Changing page or state clears the prior selection rather than leaving unrelated detail visible.
- The **right pane** is a constant detail region: meaningful unselected state, genuine loading/error states, title and processing status once selected, origin and panda identifier using only available DTO fields, and fact/owner-change evidence laid out as compact rows. Unknown labels remain explicitly technical rather than invented.
- The DTO does **not** supply the current archive value. The notice accurately states that the proposal cannot prove replacement. This is not a visual "diff" unless and until both sides exist.
- **Draft:** an authorized staff member can validate after reviewing evidence. **Validated:** an authorized independent reviewer can submit an approval reason. Self-approval remains impossible. Approval immediately applies to the *internal* archive only, and the existing AlertDialog confirms the impact. Backend IAM and typed V2 mutation contracts are unchanged.
- Data table and side-pane layouts use border, readable typography and restrained teal focus/selection states, not nested colored cards. A 1440px desktop view is the acceptance target, consistent with user preference to de-prioritize mobile.

## Checks and visual evidence

The public seam is `apps/web/tests/admin/curation-workspace.spec.ts`: API-backed list, click-to-select, detail, deep-linked filter/selection, validation, independent approval, confirmation and axe keyboard/a11y checks. Matt TDD red: no `策展待办` split-pane region in the original; green after the vertical slice. The post-action check closes the detail, verifies the empty selection state and removes `changeSet` from the URL.

Local synthetic fixture screenshots (ignored, do not represent production):

- `.release-gate/admin-ux-457/curation-before-1200.jpg` — 1440px original, downscaled for review, with table spanning the page and a long detail below.
- `.release-gate/admin-ux-457/curation-after-1440.png` — 1440px proposed master/detail workspace.
- `.release-gate/admin-ux-457/curation-approval-1440.png` — independently validated state and approval form.

This slice is part of #444. User visual acceptance across all Admin pages, including Publication, Staff and MFA, remains open even after green tests.
