# Admin V4 — Moderation registry controls and action-state ownership (#487)

## Scope

Phase 5 under #479, stacked on Draft PR #486. The original Moderation workspace mixed typed appeals queue, account projection, sanctions, restoration and appeal decisions in one 470-line view with 17 independent local state hooks and **16 direct native UI control tags**. The objective here is **not** to create more thin React wrappers: it is to remove bespoke controls, group domain state according to the real operator task, and make the same operations easier to find without weakening authorization.

## Source-first component decision

Checked maintained solutions independent of installation: shadcn/ui Button, Input, Textarea, NativeSelect, Collapsible, Resizable, ScrollArea, Empty, Skeleton and AlertDialog; ReUI's general advanced data-grid forms; Dice UI's Data Table; and Kibo UI's collection controls.

- **Official shadcn/ui** wins for the specific needs: standards-based forms and keyboard interactions, an explicit decision confirmation, a server-owned appeal queue, and a resizable desktop master/detail workspace. Registry components were already available after prior V4 phases, so no duplicate installation was necessary. Official references: https://ui.shadcn.com/docs/components/radix/native-select and https://ui.shadcn.com/docs/components/radix/collapsible .
- **Dice UI / ReUI grid** brings richer per-column filters and sort state, but none of these controls is demanded by the moderation business API. PandaAtlas currently uses typed server paging and TanStack Table 8 with URL state owned by nuqs. A second table-query engine or an upgrade to a new major would have expanded risk without helping the workflow. Source: https://diceui.com/docs/components/base/data-table .
- **Kibo UI** patterns may be useful for more advanced multi-record action surfaces but would not improve the simple one-case selection / associated account projection. Use accessible maintained Button and DataTable rather than importing a parallel kit for this screen.

No self-authored generic UI primitive was added. The domain view is application composition, not a new component library. All API mutations, IAM gates and idempotency keys remain service-owned.

## Changes

| Area | Before | After |
| --- | --- | --- |
| Global raw-control inventory | 16 remaining, all Moderation | **0 remaining under features/admin/**/*.tsx** for input/select/textarea/button/details |
| Form state | 17 independent useState values | **8**, grouped by real sanction, restoration and appeal draft plus pending confirmation |
| Confirmation | A boolean pointing to changing live form state | Frozen account and sanction draft captured at review submission; confirmation shows exactly what will be sent |
| Changing accounts | Old action text could persist while selecting another case/account | Reset each action draft, restoration selection and pending confirmation on switching accounts/appeals |
| Queue | Three cramped appeal columns and fixed CSS split | Two-column case/state with age inside state; official shadcn Resizable and bounded ScrollArea for long lists |
| Case/account information | Deep individual card stacks and plain blank placeholder | Compact semantic `dl` status row; official Empty and Skeleton; original factual appeal/record details unchanged |
| Error recovery | Plain error text for account/appeals | Direct retry via typed React Query refetch; retains URL status filter |
| Long operator page | No shortcut to the relevant lower action form | Official Button-as-link jumps to case decision or account sanction form, role-dependent |

Original permissions are not widened: the list remains scoped by moderation.appeal.read, account projection by moderation.sanction.read, and sanctions/restoration/decisions by their individual capabilities. A direct account lookup never authorizes action on an unrelated appeal.

## Actual 1440px browser review

Real desktop Chromium screenshots, with clearly synthetic data, captured and visually inspected under `.release-gate/admin-v4-487/`:

- `moderation-populated-1440.png`: 18 server-returned appeal rows; selected account projection, SLA state, processing history and appeal message.
- `moderation-confirm-1440.png`: destructive sanction confirmation, frozen account ID, action kind and optional end date.
- `moderation-readonly-1440.png`: evidence remains visible while mutation controls are withheld.
- `moderation-empty-1440.png`: real empty queue response with clear no-selection guidance.
- `moderation-error-1440.png`: read failure and explicit retry, no fake records.

The first capture confirmed no horizontal list clipping but showed the main action forms well below the fold. Added official Button-as-link fast paths to the relevant form and checked the final rendered state. Automated axe A/AA validation on the sanction confirmation also passed. Screenshot fixtures are not actual account records and do not assert real numbers of pending appeals.

## Remaining structural debt

Although per-form state is now coherent and no direct native interactive tags remain within Admin features, a **large Moderation TSX business module remains**. Splitting it into a separate controller/presentation seam should happen only when actual repeated work or tests warrant a deep interface; do not create 20 components with one-line JSX bodies purely to reduce LOC or nesting metrics. Review workspace (516 lines / initial max JSX depth 17), Publication policy/diff orchestration, and duplicated small staff/account route navigation still remain candidates under #479. This phase does **not** certify full Kiranism visual parity, nor does it imply any merge to main.
