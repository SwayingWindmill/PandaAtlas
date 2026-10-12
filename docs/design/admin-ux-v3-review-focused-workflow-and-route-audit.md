# Admin UX V3 — Review focused actions and cross-route capture (#469)

## Product and scope

Stacked Draft UI slice under #444, following #467. Not a release or owner visual sign-off.

At 1440px, Review had evidence in one large card and three independently expandable operation forms in a second card underneath it. The new page retains the selected case identity, true state, responsible account, original evidence and sources, then lets the operator switch among **查看证据 / 核验来源 / 审核决定 / 策展交接**. The switch exposes only modes supported by the actual session capabilities. Only one view is visible at a time; the forms preserve typed drafts across mode switches and reset on case change. Verified source IDs, contributor-facing explanations, case assignment and independent Review mutations retain their original server contracts and authorization.

The decision form is now two columns on desktop: result and selected facts on the left; contributor explanation, optional internal reason and save action on the right. Long fact lists have keyboard-reachable scrolling with visible instructions. Native pressed-state buttons, focus styles and existing shadcn controls are reused. No new dependencies, mock production records, inferred approvals or client authorization changes.

## Verification

- Matt TDD at the existing Playwright Admin seam: missing mode switch initially failed; implementation passed afterward. Browser coverage tests one-visible-form behavior, keyboard/axe on evidence and action, draft preservation between modes, reset on case change, assigned-case role restrictions and original typed mutation flows.
- **Full Admin Playwright: 45/45 pass**, serial, using the Windows-native local dev server on port 3400. A first targeted run had an unrelated Edge worker exit (3221226505); the isolated rerun passed without app changes.
- TypeScript, scoped ESLint, frontend design-policy and admin-runtime checks passed.
- Current 1440x900 synthetic-fixture Edge evidence in .release-gate/admin-ux-469/: **reviews-1440.png**, **reviews-verify-1440.png**, **reviews-decision-1440.png**, **reviews-recommend-1440.png**. All were captured after the structural change. Compared to previous .release-gate/admin-ux-455 review screenshot, the operation is no longer below stacked multi-step forms.

## Same-revision 1440px Admin route sweep

All listed routes were captured in the **same branch revision** at 1440x900, but the sweep used an explicit synthetic IAM session and only bounded local endpoint fixtures. Do not confuse route render coverage with representative business-state visual acceptance.

| Route | Local screenshot under .release-gate/admin-ux-469/ | Actual proof |
| --- | --- | --- |
| /admin | overview-1440.png | Current shell and title; queue API synthetic/unavailable |
| /admin/reviews | reviews-1440.png and reviews-{verify,decision,recommend}-1440.png | Actual changed Review workflow, synthetic facts and source links |
| /admin/moderation | moderation-1440.png | Shell/loading or empty selection; no populated appeals |
| /admin/curation | curation-1440.png | Shell/loading or unavailable-data state; no real change set |
| /admin/publication | publication-1440.png | Authorized shell, loading version collection; no release-diff data |
| /admin/audit/evidence | audit-1440.png | Shell/unavailable-data state, not a dense audit collection |
| /admin/staff/roles | staff-1440.png | Synthetic one-worker directory, not full role lifecycle |
| /admin/staff/invitations | invitations-1440.png | Synthetic invited/pending and accepted rows |
| /admin/capabilities | capabilities-1440.png | Self-permissions navigation with synthetic session |
| /admin/security/mfa | mfa-1440.png | MFA error/recovery state, not completed enrollment |

## Six-domain / Operate visual assessment and remaining contract

- **Improved:** case identity/status/owner, active action and navigation fit within the first 1440px viewport. Each operation has one focused form, native keyboard activation and visible active/focus state. Unknown evidence stays unknown; source/provenance remain accessible in evidence view.
- **Medium still open:** limited synthetic Review fixtures expose an unsupported fact key and an English certainty code. This is inherited from existing label fallbacks, not a new Review workflow label. Domain-backed label mapping should be evaluated independently. Source evidence is accessed by switching views instead of staying simultaneously pinned while editing; longer evidence scenarios need a real-operator test.
- **High still open under #444:** populated same-revision operator-path screenshots for Moderation, Curation, Publication and MFA, including long cases, successful actions, empty/error/read-only states and real field-level version differences. These cannot be established from a shell/loading screenshot or from green Playwright checks.
- **Medium still open:** cross-page content density, breadcrumb wording and operator navigation with real audit data and long staff records.

Reviewed in-thread using Matt Standards/Spec and Jakub's six-domain UI standards; no independent owner/design sign-off. Keep Draft and do not merge to main until #444 is accepted.
