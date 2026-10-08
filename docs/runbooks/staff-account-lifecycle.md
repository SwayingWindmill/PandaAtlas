# Staff account suspension and reinstatement — IAM-04

## Operator procedure

1. Sign in to the Chinese staff console using an account with `identity.account.manage`. Complete AAL2 TOTP and recent authentication (15-minute window). A live Supabase session is required.
2. Open **治理 → 角色管理**, choose the target staff member, inspect the active/suspended state and current authority. The `工作人员访问状态` section offers `停用工作人员` for active accounts and `恢复工作人员` only for staff-owned suspensions.
3. Confirm the exact target and enter a specific reason. A new idempotency UUID is created for the intended transition; retrying the same intent reuses the key. The database records actor, subject, reason, source and correlation, plus an immutable state event, authorization audit event, and integration Outbox event in one transaction.
4. From the worker's separate already-authenticated browser session, verify Review is immediately denied after suspension. Reinstatement restores the worker's previously active roles, but cannot resurrect revoked or expired grants. Inspect the account-state timeline from the operator view.

## Authority boundaries

- A worker cannot change their own state. Suspension of the last active administrator is disallowed; administrator suspension is serialized in the database to prevent concurrent lockout. IAM-05 owns controlled production recovery.
- `staff:` marks suspension owned by this staff lifecycle. Moderation-owned (`moderation:`), privacy and other externally owned states cannot be reinstated through the staff workflow.
- Identity API guards read PostgreSQL account state for **every protected request**, independent of the unmodified Supabase JWT. Suspension does not delete credentials, previously assigned roles, or audit history.
- Account managers may inspect the staff directory/details and manage state without holding role-management rights; role mutation and role catalog remain restricted to `identity.role.manage`.
- A fresh same-key retry returns the existing state without duplicate facts. Reusing a key for another actor, subject, reason, action, or after a newer transition is rejected.

## Verification

The IAM-04 HTTP/PostgreSQL test uses disposable identities and verifies direct authorization denial, MFA/recent/live session policy, immediate suspension, reinstatement without role resurrection, idempotency, audit/Outbox facts, and cross-authority ownership. Chinese Playwright UI coverage verifies the confirm/action and account state history. Comprehensive IAM lifecycle and production recovery testing remain deferred to IAM-06 #430 and IAM-05 #429 respectively.
