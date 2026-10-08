# Production staff administrator bootstrap and recovery (IAM-05)

Production Identity still uses **Supabase Auth UUIDs** and the existing private PostgreSQL `identity` authority. There is no default admin email, environment-variable-based role grant, browser bootstrap route, or permanent recovery login. The local `npm run bootstrap:admin` command from #422 **must never be used in production**.

This is a deliberately manual, one-time **deployment-owner ceremony**, not part of the Cloudflare Worker deployment or its request runtime. No production authority has been granted by implementing this runbook.

## 1. Establish the trust boundary once

The deployment owner and the database operator are distinct participants:

- **Owner** holds a persistent Ed25519 private signing key offline, outside the repository, CI secrets, Cloudflare, and Supabase. The corresponding public PEM is installed in the trusted operator environment as `PANDAATLAS_IAM_OWNER_PUBLIC_KEY`. The owner must separately verify the business request and immutable Supabase Auth subject UUID before signing. An emailed UUID or a login alone is not approval.
- **Operator** runs `scripts/development/production-staff-admin.mjs` in an isolated trusted operator shell with a time-limited privileged PostgreSQL connection. The operator has the pinned managed Supabase project ref, the trusted owner's *public* key and verified Supabase CA. The database credential must read `auth.users` and write the private `identity` tables plus `integration.outbox_events`; the ordinary Cloudflare NestJS runtime/database login is **not** elevated.
- **Public API and browser** remain unchanged. IAM-05 does not add any runtime endpoint, grant-signup hook, JWT role override, or persistent superuser secret to deployed workers.

Use the normal Supabase email verification flow to register the intended operator. The database operator reads the confirmed `auth.users.id` UUID using a privileged **read-only** query and independently checks `email_confirmed_at`, anonymous/deleted/banned status, and correct identity. Do not select a subject by email string.

Generate an Ed25519 signing key pair **once, offline on the owner's machine**, using a trusted local key generator (for example OpenSSL `genpkey -algorithm ED25519 -out owner-private.pem` and `pkey -in owner-private.pem -pubout -out owner-public.pem`). Store the private key in the owner's secure credential store; deliver only the public PEM to the authorized operator. Do not check in either file or publish approvals in Issues, logs, or CI artifacts.

## 2. Owner issues a short-lived, one-purpose approval

After independent, out-of-band owner authorization and change-ticket creation, run **on the owner's machine**:

```powershell
node scripts/development/sign-production-admin-approval.mjs `
  --operation bootstrap `
  --account-id <verified-supabase-uuid> `
  --approval-id IAM05-OWNER-20261008-01 `
  --approved-by deployment-owner `
  --private-key C:\secure\owner-private.pem `
  --output C:\secure\approved-bootstrap.json
```

The signer produces a **signed JSON request valid for one hour**. The owner sends only this file to the operator using an approved channel. Its Ed25519 signature binds the exact action, UUID, unique approval ID, approver and expiry. The private key never leaves owner control.

If all administrator authority has been lost or revoked, run the *same signer* with `--operation recover` and a **new approval ID** after incident review. Old approvals and revoked grants are not recovery tokens.

## 3. Operator reviews and dry-runs

The operator obtains a one-time high-privilege Supabase **managed** connection from the production database credential store. A direct `db.<project-ref>.supabase.co` endpoint or project-qualified Supavisor session endpoint is supported. Confirm the project reference and TLS CA through an independent deployment inventory. Never use the local `localhost:54322` database, the application-level `zhipanda_app` runtime connection, or a production password copied into command arguments.

Set these environment variables in the trusted operator session **from its managed secret store** (do not print their values):

| Variable | Meaning |
|---|---|
| `APP_ENV` | `production` |
| `PANDAATLAS_IAM_SUPABASE_PROJECT_REF` | Exact approved Supabase project ref |
| `PANDAATLAS_IAM_OWNER_PUBLIC_KEY` | Owner's already-pinned Ed25519 public PEM |
| `PANDAATLAS_IAM_OPERATOR_DATABASE_URL` | Privileged, short-lived managed PostgreSQL connection string |
| `PANDAATLAS_IAM_DATABASE_SSL_CA_CERT` | Verified trusted Supabase root CA PEM |

From Windows native Node.js (not WSL), use **dry-run first**:

```powershell
node scripts/development/production-staff-admin.mjs `
  --environment production `
  --operation bootstrap `
  --account-id <verified-supabase-uuid> `
  --approval-file C:\secure\approved-bootstrap.json
```

Dry-run checks the signature, verified Auth identity, managed destination, current administrator grants and approval history; executes the **same Identity account/role/audit/Outbox transaction** as apply and rolls it back. No persistent admin grant is created. Refusal is a stop condition, not a prompt to weaken the CLI or edit `identity.role_assignments` by hand.

After owner sign-off of the dry-run result and an explicit release decision, **the operator alone** adds `--apply` to the same invocation. This is the only write mode. It commits the minimum `administrator` role and `member` role when absent, including append-only authorization audit and integration Outbox facts within one transaction. It logs only an outcome and role names; never database passwords or signing keys.

## 4. Verify without changing approval authority

Using the same trusted read-only database connection, verify:

- Exactly one live administrator authorization exists for the intended UUID. `identity.role_assignments.source` is `production_first_admin` (or `production_admin_recovery` for recovery); approval correlation and source appear in the immutable authorization audit events.
- Each new grant has its own matching `identity.role-assigned` Outbox fact. Any retry with the *same* approved request produces no duplicate grants, audits or Outbox records.
- The selected verified staff member can log in through ordinary Supabase email OTP, enter `/admin`, enroll/verify Supabase TOTP, and upgrade the **real session** to AAL2 before sensitive Identity commands. Do not bypass MFA with JWT claims.

Never test a genuine production revocation merely to demonstrate recovery. Use local/CI transaction tests and a controlled staging exercise.

## 5. Recovery and incident response

Bootstrap is **permanently closed** once *any* administrator grant has existed, even if later revoked. Repeated execution for the same still-active approval is a no-op; repeating one whose administrator grant was revoked is refused. If no administrator has *ever* existed, use bootstrap, not recovery.

When the administrator is revoked, unavailable, or an incident leaves **zero active administrators**:

1. Investigate role history, revocations, account state, incident timeline and Supabase MFA/identity ownership **out of band**. Freeze ordinary staff permission changes.
2. Have the deployment owner authorize a verified active Auth subject UUID, sign **`recover` with a new approval ID**, and record the ticket. Existing suspended/deleted identities must be handled by their owning authority first.
3. The operator repeats the production environment checks, **dry-run**, owner release decision and explicit `--apply`, this time with `--operation recover` and the newly signed recovery file.
4. The transaction creates a **new** administrator assignment with source `production_admin_recovery`; it never deletes a revocation or reactivates a previous grant. Audit and Outbox remain append-only. The same AAL2 login procedure follows.

Recovery **refuses** to run while another active administrator exists: use normal delegated IAM role management in that case. If there is no previous administrator history, recovery also refuses. A procedure that fails must stop for investigation; do not install a permanent recovery secret or emergency web endpoint.

## 6. Verification and scope

`npm run ops -- run api.integration` includes Ed25519 approval/CLI-boundary tests and real PostgreSQL transactional first-admin/recovery tests. Success-path tests run only on **fresh disposable Supabase** (CI), where no administrator has ever existed; an already-bootstrapped developer database skips those two tests and still exercises the negative cases. All fixtures roll back.

No production connection or role assignment is part of the IAM-05 coding task. Real production administration requires **separate deployment-owner approval** beyond merging this PR. Full IAM lifecycle verification remains IAM-06 #430.
