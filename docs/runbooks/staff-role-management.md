# Staff role management — PandaAtlas IAM-03

This slice changes **human staff role assignments**, not Supabase identities or public member rights. Supabase Auth verifies the caller; NestJS performs authorization against private PostgreSQL `identity` records. It does not alter the review, curation, or publication approval commands.

## Operator journey

1. Sign in to the Chinese admin console as an authorized role manager. Viewing the restricted staff directory and role history requires `identity.staff.read` and an active Supabase session, but not a fresh AAL2 verification. For **changes**, complete TOTP MFA for **AAL2** and ensure interactive authentication is within the 15-minute recent-authentication window.
2. Navigate to **治理 → 工作人员 → 查看工作人员及岗位权限**, or open `/admin/staff/roles` directly. The directory shows staff accounts and their current roles. Select an identity to view its role assignments, active capabilities, and assignment history, including revoked or expired records.
3. Select one of the delegable human roles and choose **准备授予**. Review the subject and role, enter an explicit reason, then **确认授予**. Privileges are effective only if the subject's verified Auth identity and application account are active.
4. To revoke an active delegable role, select **撤销**, supply a reason, and confirm. The next protected request queries PostgreSQL anew. No JWT claim or frontend navigation state can preserve revoked rights.
5. Verify from a separate staff session: authorized Review access succeeds after the reviewer grant and is rejected after revocation. Do not use the administrator's own session to prove the reviewer restriction.

## Governance and conflict boundaries

- Both mutation commands require `identity.role.manage`, whose PostgreSQL policy requires AAL2, recent interactive authentication and a live Supabase session. Staff directory, assignment history and catalog GETs use separate `identity.staff.read` authorization (AAL1, live session, no 15-minute step-up). The UI is only a presentation of server policy.
- A manager cannot change their own roles. The `administrator` bootstrap/recovery role and `community_scanner` service role are not delegable here. `member` is not a staff role. Administrative recovery is deliberately postponed to IAM-05.
- A verified identity may not simultaneously hold effective Review decision rights and final Curation approval/Publication activation rights, even through distinct role assignments. This is an account-level role constraint in addition to existing independent-actor four-eyes checks within business workflows.
- Grants and revocations are append-only with reason, actor, subject, correlation, idempotency key, authorization audit and integration Outbox facts in one database transaction. A replay of the same command key returns the same result without creating new audit or event facts. Reusing a key with changed intent is rejected. Revoking a grant or letting it expire cannot be undone by replaying its old grant request.
- Concurrency on one staff account is serialized by its PostgreSQL account row. Role catalog choices are read from existing `identity.roles` and `identity.role_capabilities`, not from client-supplied capability claims.
- Directory and role detail endpoints are restricted to role managers. The historical reasons and actor/subject identifiers must not be exposed to public client routes.

## Verification and delivery

- NestJS HTTP integration tests use signed test identities and real local Supabase PostgreSQL. They validate role manager denial for ordinary accounts, self-grant rejection, MFA/recent/live requirements, permission change on the **next request with the same bearer JWT**, idempotent retry, business-duty conflicts, expiry, audit and Outbox.
- Chinese admin Playwright tests exercise directory/detail, confirmation and refusal of access from a reviewer session. These are narrow IAM-03 tests; the complete staff identity lifecycle is deferred to **IAM-06 #430**.
- The local Supabase environment can be started with `npm run infra:start`. IAM-03's grant/revoke slice is migration-free; the later additive `0055_staff_directory_read_capability.sql` migration separates staff inspection from recent-authentication step-up without any database reset or production secret change.
