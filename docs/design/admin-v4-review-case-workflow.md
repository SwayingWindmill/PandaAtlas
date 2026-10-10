# Admin V4 — Review queue and case-local workflow (#489)

## Operator problem

The Review workspace previously used one large React function for queue navigation, evidence, source verification, decision and curation recommendation. Thirteen case-related drafts were reset by one `useEffect`, but the source and decision **outcome choices were omitted**. Opening a second case could silently carry those privileged choices over from the previous case. The first-column selected case was also not visually identified. The three-column queue compressed the wait duration into a narrow third column.

## Structural decision

The existing review page now has two **domain** modules in one file:

- `ReviewQueueWorkspace` owns server pagination and URL filters, row selection and intake. Its queued data is still fetched through the existing typed React Query / nuqs / TanStack Table contracts.
- Keyed `ReviewCaseDetail` owns the selected case's query, four case mutations, permission checks, evidence, verification, decision and recommendation drafts. Its only interface is case ID, queue-read success and intake busy state. Switching cases unmounts old action state entirely rather than relying on a long incomplete effect. The shared React Query cache and the existing mutation/query options remain the data seam.

The domain split passes the deletion test: deleting it would force unrelated queue pagination and case operation lifetimes back into a single module. There is **no new generic input, tab, table, resizer, badge or disclosure primitive**. The JSX remains long because each form encodes domain fields; replacing those with pass-through React components would not simplify the interface.

## Maintained UI selection

Source-first comparison from #487 still applies, rechecked for this change's concrete needs: official shadcn/ui Resizable, Tabs, DataTable (TanStack v8), Button, Input, NativeSelect, Textarea, Checkbox, ScrollArea and Collapsible compose the workflow; ReUI and Dice UI advanced grids do not simplify the server-paginated, URL-controlled queue and would duplicate collection state; Kibo UI offers no more suitable review-decision operation primitive. Existing shadcn registry components win **because of fit**, not because installed. No installation or bespoke generic control is warranted. Sources: https://ui.shadcn.com/docs/components/radix/tabs, https://ui.shadcn.com/docs/components/radix/resizable, https://diceui.com/docs/components/base/data-table.

## Interaction changes

- Selecting another case now resets all draft inputs, **including verification outcome and decision outcome**; mutation status is case-local too.
- Filter/page changes clear the old selection, so the queue and visible details use the same current collection context. Intake may still intentionally open the newly created case by its returned ID.
- The queue combines state with wait/overdue detail into one column, preserving factual age and urgency without cramped headers. The selected case is marked with `aria-current` and a distinct background, not color alone.
- Source selection clears source-specific verification details, avoiding reuse of a URL, canonical source ID or rationale for a different piece of evidence.
- Forms keep official controls but remove redundant inset padding inside the Tabs content area. No extra card layers were added.
- The case-detail ability flags, actions, claim ownership check, typed mutations, API contracts and original server-backed data are unchanged.

## Verification contract

The regression test explicitly changes source and decision outcomes before switching cases, then asserts both return to their defaults. The bounded desktop Chromium capture used 18 visibly synthetic queue records and seven assertions, with 1440x900 screenshots retained locally at `.release-gate/admin-v4-489/review-populated-1440.png` and `review-decision-1440.png`. Browser measurements: queue left pane x=293, width=389.5px, detail pane x=702.5, width=692.5px, with no pane overlap. Screenshot-only test removed after capture. Screenshots and geometry are not a substitute for human visual approval.

Validation: Web TypeScript passed, scoped ESLint passed, design policy passed, full Admin Playwright **55/55** passed, screenshot capture Playwright **1/1** passed. Existing Admin tests cover axe and read-only/empty/error states; those states were not separately captured for this slice. Do not claim deployment or main-branch merge on the strength of a local pass.
