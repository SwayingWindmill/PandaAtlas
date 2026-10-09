# Admin UX/UI V2 — operator overview, visual and task review

**Status:** First slice in Issue [#442](https://github.com/SwayingWindmill/PandaAtlas/issues/442). This is **not** an approval of the remaining Admin pages.

## Decision context

Previous backend migration acceptance proved authorization, typed API calls and automated accessibility at selected seams. It did **not** demonstrate that the operator console was understandable or well composed. The live 1440px desktop review identified an overview dominated by raw account UUID, AAL level, a count of accessible workspaces and a large grid repeating sidebar navigation. A staff member could not answer "which record needs my attention?" from the landing view.

Matt Pocock's repository-local `implement` / `tdd` / `code-review` process owns engineering work; the user-global [`jakubkrehel/skills`](https://github.com/jakubkrehel/skills) set owns the interface review. `better-interface` consolidates the six domain rules; PR-level interface regressions are evaluated separately using `interface-review`. The project's data-honesty, IAM and published design constraints take precedence over styling preferences.

## First vertical slice

- **Primary action**: for staff with `review.case.read`, open the actual new Review queue (`state=new`). The count is the real `ReviewCasePageDto.total`, not "today's new cases" or a calculated estimate.
- **Secondary action**: for staff with `curation.change.read`, open the verified Curation change sets awaiting independent approval (`state=validated`). The count is the real Curation page `total`. A curator may inspect without having independent-approval permissions.
- **Other destinations**: show remaining authorized workspaces as compact, clearly linked rows. Don't duplicate featured Review/Curation destinations in another large grid.
- **Identity/security**: no UUID/AAL card in the work hierarchy. AAL2 reminders appear only when needed, and the account security and detailed capability pages remain available.
- **Honest states**: a loading indicator is not `0`; an unavailable API is not `0`; an empty queue explains there is nothing awaiting action. Don't fetch unauthorized queues.
- **No new backend contracts**: reuse the existing authenticated feature BFFs and TanStack Query. NestJS remains the final capability/operation authority.

## Six-domain interface audit (scope: `/admin` only)

| Owner | What changed / what to inspect |
|---|---|
| `better-accessibility` | Real headings/landmarks, accessible links and focus, existing keyboard sidebar, axe WCAG checks. |
| `better-layout` | Prioritize work before secondary destinations; one primary action on the dark priority region, restrained spacing-based group hierarchy rather than eight identical cards. |
| `better-writing` | Verb-led links, Chinese field-neutral language, clear permission/empty/loading/error states, no claim that metrics mean "today". |
| `better-typography` | Hierarchy for task title and tabular count; no raw UUID crowding first reading path. |
| `better-colors` | High-contrast dark focus area, subdued neutral supporting surfaces and semantic amber only for AAL2 action requirements. |
| `better-ui` | Minimal surface layers, subtle borders only where needed, no ornamental motion on queue links or mouse movement. |

## Evidence and boundaries

The Windows workstation records visual inspection materials at `.release-gate/admin-visual-review/overview-viewport.jpg` (previous homepage) and `.release-gate/admin-ux-v2/after-1440.jpg` (current proposed homepage). Both are local browser captures with a bounded synthetic staff session; they are **not** screenshots of live production data, and local screenshots are not checked in. See Issue #442 and its linked delivery PR for the actual code and tests.

This review does not claim the Review, Curation, Publication, Audit or Staff inner pages now pass a visual acceptance check. Those require their own user-task walkthrough and domain-specific design, not wholesale Tailwind restyling. Before merging this first slice, recheck desktop screenshots, keyboard navigation, authorization boundaries and the existing full Admin browser suite. Visual signoff is separate from CI success.
