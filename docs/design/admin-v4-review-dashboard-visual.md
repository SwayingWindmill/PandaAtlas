# Admin V4 — Review workbench alignment (#495)

## Goal, references, boundary

Owner direction: a beautiful and usable **shadcn/ui + Vercel Dashboard-style** Admin, not nested decorative cards or homemade generic controls. This slice updates **Review queue → source evidence → verification → decision → curation handoff**. It builds upon the case-keyed state ownership from #489 and the restrained master/detail surface introduced for Curation in #493. Moderation and Staff remain later separate surfaces; #479 stays open.

Source-first fit review: official shadcn [Dashboard blocks](https://ui.shadcn.com/blocks?category=dashboard), [Resizable](https://ui.shadcn.com/docs/components/radix/resizable), [Tabs](https://ui.shadcn.com/docs/components/radix/tabs), Table/DataTable, ScrollArea, Collapsible, Input, NativeSelect, Checkbox and Textarea remain suited to the actual typed, server-paginated workflow. Vercel [Geist typography](https://vercel.com/geist/typography) provides a visual reference for scan-first neutral type. ReUI, Kibo UI and Dice UI have no better workflow primitive that would reduce nesting without duplicating tab/table/query state. No new library, custom UI wrapper, backend endpoint, or invented summary metric.

## User-visible changes

- The separate bordered/shadowed queue and case cards become **one** subtly bordered, resizable workbench with a neutral queue side and white case detail. This deletes one visually prominent card layer and allows the two regions to read as a coordinated task.
- Page header and status filter use the same smaller, consistent type and input density as Curation. Optional manual intake is now an inline disclosure separated by one rule, not a third floating card.
- Review case selection moves from conspicuous teal underlined text to a quiet neutral highlighted row, retaining `aria-current`. Overdue cases remain visibly marked red with real time values.
- Case title, assignee/target/revision metadata and action tabs form a single vertical reading sequence on white. Metadata uses semantic `dl/dt/dd` rather than arbitrary three-up cards; actual role and assignment facts stay visible.
- Facts and source records use divided rows, not nested bordered boxes. The browser still offers source provenance, raw IDs on demand, and real official links. Authorized verification, decision, recommendation actions stay behind the existing official Tabs and capability checks.
- A failed queue read without a selected case now explains why the right-hand detail is unavailable and points to the existing left-hand retry action, instead of leaving a blank half-screen. No new fetch or defensive fallback data was introduced.
- Case-local drafts remain isolated by the selected review ID; no input/status is copied across cases. Source-sensitive fields still clear on a source switch. Selected-row accessibility is now asserted in permanent Playwright tests.

The deepest JSX path dropped from **14 to 13**. Total JSX nodes rose from **206 to 212** because the explicit queue-failure detail state adds an icon-backed accessible Empty message; removing the previous purely decorative wrappers does not cancel that useful content. Those measures are context only: long form and source disclosure branches still compose maintained shadcn primitives and semantic containers; no artificial one-use component decomposition was introduced to game depth.

## Visual and behavioral verification

- Prior 1440px baseline: `.release-gate/admin-v4-489/review-populated-1440.png` and `review-decision-1440.png`.
- This slice captures real 1440x900 Chromium **synthetic data**, not production content, in ignored local `.release-gate/admin-v4-495/`: `review-populated-1440.png`, `review-decision-1440.png`, `review-verify-1440.png`, `review-readonly-1440.png`, `review-empty-1440.png`, `review-error-1440.png`.
- Populated pane geometry measured left x=294, width=394.6; right x=692.6, width=701.4 with no overlap. Re-review and screenshot axe WCAG A/AA and 2.1 A/AA checks passed in the isolated visual run. The error screenshot was recaptured after the failure-detail improvement and visually inspected, then the screenshot-only test was removed. The permanent queue-failure Playwright test also asserts that specific recovery state.
- Re-render comparison is structural, not an exact pixel diff, because synthetic fixture content differs from the older baseline. The source URL filtering, typed mutation APIs, claim and decision gates, error/readonly/empty paths, keyboard tabs and resizer remain protected by Admin suite tests.

No publication/deployment or main-branch merge is claimed. Keep stacked PR Draft until the owner reviews the desktop screen and prior stacked PRs.
