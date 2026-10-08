# Local first administrator (issue #422)

PandaAtlas keeps authentication in Supabase and all application roles in the private PostgreSQL `identity` schema. A valid email OTP alone does **not** grant admin access. This runbook is for the **pinned, local Supabase project only**. The operator command refuses production environment flags, nonlocal Supabase APIs and database origins.

## Initial setup

1. Start the local stack from Windows in `E:\Code\PandaAtlas`: `npm run dev:admin`. Confirm `npm run status:admin` reports Supabase, NestJS, Web ready.
2. Register the future operator using the normal `http://127.0.0.1:3400/auth/login?next=%2Fadmin` email OTP flow. Read the OTP at `http://127.0.0.1:54324` (Mailpit); local mail is **not** sent to the real email provider.
3. From the **local** Supabase Auth user record, find the verified user's immutable **UUID**. Do not use an email address as a capability or bootstrap selector. For example, query the local `auth.users` table read-only using a trusted operator database session. Confirm `email_confirmed_at` is populated.
4. From a trusted local operator terminal, execute:

   ```powershell
   npm run bootstrap:admin -- --account-id <verified-supabase-user-uuid>
   ```

   For an isolated **developer workstation** that needs to inspect Review, Moderation, Curation, Publication and Audit, the operator may instead explicitly opt into:

   ```powershell
   npm run bootstrap:admin -- --account-id <verified-supabase-user-uuid> --workspace-access
   ```

   Ordinary bootstrap grants `member` and `administrator`. Local workspace access adds the existing `moderator` and `senior_archive_editor` roles. These capabilities do **not** bypass recent authentication, AAL2, independent approval, ownership or business-domain rules.
5. Login again with a **fresh OTP**. Verify `/admin` renders the Chinese shell; `/api/admin/session` and NestJS `GET /api/v2/me` should return `admin.shell.access`. For the ordinary role, `identity.role.manage` is present, but its high-risk commands require AAL2/recent reauthentication.

## Safety and verification

- This is a **trusted operator CLI**, not an HTTP endpoint, email-match bootstrap, JWT role claim or a permanently enabled signup backdoor.
- The CLI serializes setup in one PostgreSQL transaction, refuses unverified/banned/deleted Supabase subjects, suspended PandaAtlas accounts and unexpected existing administrators. Repeating a successful grant for the same subject and role set is idempotent.
- The role assignment, authorization audit and integration outbox event must all commit together. A failure rolls the transaction back.
- A previously revoked first-admin grant is not silently reissued. The first admin is not permitted to create or approve their own sensitive data operations merely by having the role.
- Check transaction-level tests **before** bootstrapping a persistent workstation admin: `node --test scripts/development/tests/first-admin-bootstrap.test.mjs`. These particular tests require a **fresh local instance with no existing first administrator**, and roll back all test actors. Run this suite on disposable CI Supabase, not against an already bootstrapped developer database.
- Stop the entire stack using `npm run stop:admin`.

## Recovery

If the first administrator loses access or the grant is explicitly revoked, **do not** set `IDENTITY_BOOTSTRAP_ADMIN_EMAILS`, reuse old V1 tokens, change JWT claims or reopen this bootstrap. Freeze further bootstrap attempts. A trusted database operator must verify the incident and intended **Supabase subject UUID**, review existing append-only role and revocation/audit history, obtain out-of-band owner approval and apply a separately reviewed, logged recovery action using the same Identity authorization/audit/outbox transaction semantics. The one-time bootstrap deliberately refuses recovery or silent grant resurrection; no unattended recovery credentials are embedded in the application.

Production IAM invitations, delegation, full role-management UI, privileged recovery service and MFA enrollment belong to subsequent IAM tickets.
