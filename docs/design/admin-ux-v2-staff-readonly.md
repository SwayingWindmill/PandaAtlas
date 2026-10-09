# Admin UX/UI V2 — staff invitation and role-inspection slice (#447)

Independently reviewable follow-up to the Audit slice. This branch starts from `main`, not from unmerged #443/#448/#449/#451/#452.

## Interaction decisions (Impeccable Operate)

- Role grants, account suspension, and invitations are genuinely sensitive IAM commands and remain restricted by the existing server permissions. No authorization, database or OTP contract changed.
- `identity.staff.read` is already an available dedicated read capability (migration 0055). The Staff Invitations and Role Management routes now accept it for listing/inspecting records without exposing send/grant/revoke/suspend controls. A user with only this capability sees their existing records, not a form they cannot submit. The backend remains the final authority.
- Invitation status is framed as the recipient's next step: `pending` means waiting for email verification; `accepted` means active. Unknown states are explicitly labeled as unverified, not falsely called pending. A manager sees the sending form with a short, factual description of what happens next.
- Role Management now groups granted capabilities into recognizable business domains and gives readable descriptions for known codes. Unknown capabilities are labeled, not guessed. The original codes remain available in a native disclosure, as does the target account UUID. Individual role assignments, history and explicit grant/revoke reasons are still visible and unchanged.
- The pages keep the actual Kiranism-direction Admin shell inherited from `main`, and existing shadcn Button/Input and native disclosure semantics. No new UI kit was added solely for styling. The attempted shadcn CLI Badge fetch did not finish; ReUI/Kibo UI/Dice UI are not required to solve the specific user tasks.

## Verification and remaining work

- Local 1440×900 screenshot with synthetic read-only user data, examined for composition and density: `.release-gate/admin-ux-447/invitations-1440.jpg` and `roles-1440.jpg` (ignored artifacts). The first pass revealed an overprominent UUID beside account status; corrected by moving it to a disclosure and reconfirming the read-only browser flow.
- Existing authorized-role and invitation assertions and axe keyboard checks remain in `identity-admin-shell.spec.ts`. Added regression verifies read-only directory and invitations load, while invite/grant/suspend actions remain absent. No production records changed.
- Impeccable 4.5.1 `detect --json features/admin/staff` returned zero findings in this scope. Follow #444 for holistic shell acceptance. Capabilities and MFA screens are still outstanding under #447; this is not full issue closure.
