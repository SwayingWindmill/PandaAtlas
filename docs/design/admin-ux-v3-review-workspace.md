# Admin UX V3 — Review Operate slice (#444)

## Problem and design authority

The previous Review workbench put a large technical-ID intake form before the work queue, nested card-per-fact evidence and three simultaneously expanded workflow forms below the case detail. Its 1440px browser screenshot made the actual case workflow difficult to scan. This narrow refinement follows Impeccable 4.5.1 **Operate** and the existing Kiranism-direction Admin shell; it does **not** certify the entire Admin redesign.

## Decisions

- Preserve the existing authenticated V2 Review list and selected-case surface, real sources, role capabilities, mutation payloads, queue filters, and paging state. No new API calls or simulated evidence.
- The contributor-submission-ID intake workflow remains available in a low-frequency disclosure, rather than consuming a whole first-screen toolbar.
- A claimable case shows **领取案件** alongside its status and title, not after the evidence list. The fact list is a simple dense scan of label, value, certainty and source count; source title, publisher and primary document link stay readable. Full case, account and object IDs remain secondary and expandable.
- The separate source-verification, decision and curation-transfer forms become three **native HTML disclosures** inside one task-action region. All are collapsed by default to avoid presenting irrelevant or inaccessible inputs as simultaneous demands. The currently selected evidence remains above these actions. Inputs preserve local drafts when a disclosure closes; switching cases resets drafts according to the existing case-ID effect.
- An attempt to obtain official shadcn Tabs via `npx shadcn@latest add tabs -y` did not complete. Do **not** invent a parallel tab abstraction, copy unverified third-party code or add an unnecessary package. Existing shadcn Button/Badge plus native browser details provide a standards-based, keyboard-accessible fallback. Mature Tabs may be substituted later only if they improve observed task completion.
- The desktop is the product target: user explicitly deprioritized mobile. Screenshots are 1440px and use Playwright fixtures, **not production data**.

## Bounded visual and workflow evidence

Source fixture: `apps/web/tests/admin/review-moderation-workspace.spec.ts`, including staff read/claim/decision permissions, external source link, review ownership and axe assertions. A dedicated red test established that both forms were improperly exposed on initial render; new behavior was then implemented and tested green.

Local ignored evidence, taken with the same synthetic fixture:

- `.release-gate/admin-ux-455/review-before-1200.jpg` — original 1440px full-page desktop capture, downscaled to 1200px for visual inspection, showing three long stacked forms and nested panels.
- `.release-gate/admin-ux-455/review-after-1440.png` — redesigned initial 1440px desktop, task overview and collapsed operations.
- `.release-gate/admin-ux-455/review-action-viewport-1440.png` — fixed-viewport inspection while Source Verification and Decision are expanded. The first *full-page* expanded capture was invalid because the sticky shell stitched during scrolling; it must not be presented as visual evidence.

Remaining #444 concerns: Kiranism-level full-console information architecture and homogeneous layouts in Curation, Publication, Staff, MFA and Capabilities. Approval must remain separate from green automated tests.
