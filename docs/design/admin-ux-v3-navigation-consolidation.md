# Admin V3 — Governance navigation consolidation (#461)

## Audit decision

The former `治理` sidebar exposed five destinations: `审计`, `权限`, `工作人员`, `角色管理`, `账号安全`. Two are personal-account activities, while staff invitations and role management are stages of the same staffing process. Five links gave every task the same prominence regardless of frequency or ownership.

The V3 sidebar now has **two governance destinations**: `审计` and `人员管理`. The latter defaults to staff directory and role controls, with a visible `邀请记录` secondary navigation. The top-right `我的账号` leads to a personal workspace with `我的权限` and (when permitted) `双重验证` subnavigation. Breadcrumbs show the nested relationship. All real routes remain functional, including `/admin/staff/invitations`, `/admin/staff/roles`, `/admin/capabilities`, and `/admin/security/mfa`: they are distinct authorized operations and deep links, **not duplicate sidebar entries**.

## Boundaries that must not be collapsed

| Area | Decision | Reason |
| --- | --- | --- |
| Staff directory, role history, invitation | One staff navigation/workspace | Same staff lifecycle; secondary views still respect `identity.staff.read`, `identity.role.manage`, `identity.account.manage` separately |
| Own effective permissions, TOTP challenge/enrollment | One personal-account navigation/workspace | Both belong to the signed-in person's settings; MFA still requires `admin.shell.access` and retains the direct `/admin/security/mfa?next=` recovery route |
| Audit | Separate | Independent immutable evidence/forensic reading scope with `audit.read` |
| Review vs Moderation | Keep separate | Contribution/evidence adjudication vs account appeals and sanctions |
| Curation vs Publication | Keep separate | Internal archive change approval vs publicly published version activation and emergency changes |

## Behavior and verification

- `visibleAdminNavigationItems()` deliberately omits hidden sub-pages. `adminNavigationItemForPath()` still resolves the full list, so the shell **still enforces individual deep-route permissions**. A role-only staff manager sees personnel management but not the invitations subview; directly visiting the invitation route remains denied. Selecting invitations keeps the parent sidebar item active.
- The staff subnav is made of ordinary keyboard-reachable Next links with `aria-current=page`. This matches the incumbent shadcn/Kiranism direction without inventing another tab primitive or installing a UI dependency.
- The signed-in account's permissions are grouped into readable job descriptions. Known capability labels are reused in the staff-role detail through one shared presentation mapping; unknown codes are not guessed and remain available under `查看权限代码`. The displayed list is descriptive only; **all real authorization still happens on the server**.
- TDD ran against the existing public Playwright Admin browser seam: the missing consolidated sidebar item and missing human-readable permission names each failed first, then passed. Targeted browser identity scenarios cover routing, signed-in account, staff role changes/invites, MFA, keyboard navigation and axe WCAG 2.0/2.1 A/AA on the staff and personal-account surfaces. Source changes preserve all backend endpoints and return flows.
- Local 1440px fixture screenshot evidence (not production data): `.release-gate/admin-ux-461/staff-roles-1440.png`, `staff-invitations-1440.png`, `account-1440.png`. These were inspected together for density, main task prominence and navigation coherence. A second manual screenshot round is not necessary absent new visual regressions.

This is a **narrow consolidation**, not a wholesale change to the PandaAtlas design language. Full Admin Kiranism visual acceptance remains open under #444; code and test success cannot substitute for owner acceptance. Draft branch stacks on Publication PR #460, and must not be merged into `main` as final UX approval.
