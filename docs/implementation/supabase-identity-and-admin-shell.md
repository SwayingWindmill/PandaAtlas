# Supabase identity, PostgreSQL capabilities, and bounded admin shell

Issue: #178

Parent delivery map: #172

## Purpose

This slice establishes the authenticated request boundary shared by user-facing engagement commands and staff administration. Supabase Auth proves the user session. FastAPI and PostgreSQL remain authoritative for account state, roles, capabilities, sensitive-command reauthentication, audit, and all business writes.

The browser never receives direct write access to `identity`, `integration`, PGMQ, Archive governance tables, or other business tables.

## Feature flags and cutover order

Both flags default to disabled:

- `IDENTITY_AUTH_ENABLED`: FastAPI accepts Supabase user JWTs and loads PostgreSQL account/capability state.
- `ADMIN_SHELL_ENABLED`: FastAPI exposes the bounded `/api/v1/admin/session` surface and Next.js exposes `/admin` when its matching web flag is enabled.

Recommended cutover:

1. Apply migration `0010_identity_accounts_roles_and_capabilities.sql`.
2. Run `npm run infra:preflight` and confirm `identity` remains private.
3. Configure asymmetric JWT issuer/JWKS values and bootstrap operator email.
4. Enable `IDENTITY_AUTH_ENABLED` on FastAPI only.
5. Verify `/api/v1/identity/session` with a real Supabase session.
6. Enable `ADMIN_SHELL_ENABLED` on FastAPI and the web deployment.
7. Verify the admin shell before adding any domain command workbench.

Disabling either flag is an immediate rollback switch. The additive identity schema, audit facts, and role history remain in place.

## Local configuration

FastAPI container defaults are present in `docker-compose.yml`. For the local Supabase stack, the token issuer and JWKS fetch URL differ because the API container reaches the host through `host.docker.internal`:

```text
IDENTITY_AUTH_ENABLED=true
ADMIN_SHELL_ENABLED=true
SUPABASE_JWT_ISSUER=http://127.0.0.1:54321/auth/v1
SUPABASE_JWKS_URL=http://host.docker.internal:54321/auth/v1/.well-known/jwks.json
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWT_ALGORITHMS=ES256,RS256
IDENTITY_RECENT_AUTH_SECONDS=900
IDENTITY_BOOTSTRAP_ADMIN_EMAILS=operator@example.test
```

Next.js requires:

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
API_BASE_URL=http://127.0.0.1:8000
ADMIN_SHELL_ENABLED=true
```

Do not expose the Supabase secret key or FastAPI administrative credentials through `NEXT_PUBLIC_*` variables.

## Authentication contract

FastAPI accepts only asymmetric Supabase JWTs. Validation requires:

- an allowed `ES256` or `RS256` algorithm;
- a non-empty `kid` resolved through the configured JWKS endpoint;
- exact issuer and audience;
- valid signature, expiry, and issued-at claims;
- `role=authenticated`;
- `is_anonymous=false`;
- UUID subject, email, session ID, and valid AAL.

A JWKS/signature failure causes one fresh JWKS client attempt to support signing-key rotation. HS algorithms are rejected at configuration time.

Recent authentication is calculated from Supabase AMR entries. `token_refresh` is ignored; the newest non-refresh method, such as `otp`, is the authentication reference. Sensitive commands require that reference to be within 900 seconds.

## PostgreSQL ownership

Private schema `identity` owns:

- `accounts`: local account state and most recent verified session/authentication references;
- `roles` and `capabilities`: explicit application vocabulary;
- `role_capabilities`: role bundles without implicit inheritance;
- `role_assignments`: append-only, optionally expiring grants;
- `role_assignment_revocations`: append-only immediate revocations;
- `account_state_events`: append-only state transitions;
- `authorization_audit_events`: append-only authorization and sensitive identity-command facts.

`anon` and `authenticated` have no schema usage. FastAPI connects through the server database role and re-queries effective assignments on every protected request. JWT claims never grant application roles.

The `administrator` role contains only:

- `account.session.read`
- `admin.shell.access`
- `identity.account.manage`
- `identity.role.manage`

It does not inherit Review, Archive publication, Moderation, Privacy Operator, or audit-export capabilities. Role managers cannot assign any role to themselves; administrator bootstrap is the only automated exception and is controlled by deployment configuration. The system-managed `member` role cannot be revoked through the application command API.

## HTTP commands and responses

Read surfaces:

- `GET /api/v1/identity/session`
- `GET /api/v1/admin/session`

Identity commands:

- `POST /api/v1/admin/role-assignments`
- `POST /api/v1/admin/role-assignments/{assignment_id}/revoke`
- `POST /api/v1/admin/accounts/{account_id}/state`

Role and account-state commands require recent authentication and explicit capability. They are idempotent: an identical subject/path/idempotency key replays the original result before business-conflict evaluation. Reusing a key for a different subject or result returns conflict.

Status semantics:

- `401`: no valid Supabase identity;
- `403`: authenticated identity lacks capability, is inactive, or requires recent authentication;
- safe `404`: hidden administrative surface or capability where disclosure would reveal a protected resource;
- `409`: command conflicts with current state or idempotency-key reuse;
- `503`: JWKS configuration, PostgreSQL, or fail-closed authorization audit is unavailable.

Suspended, deleting, and deleted accounts fail before domain commands. State transitions are constrained: active accounts may suspend or begin deletion, suspended accounts may restore or begin deletion, deleting accounts may only become deleted, and deleted is terminal. Idempotent state-command replay returns the original transition result even if later state has changed.

The pre-existing `/admin/imports` local operator console is not part of the React-admin shell. While `IDENTITY_AUTH_ENABLED=false`, it may continue using the legacy local proxy. Once identity authentication is enabled, its static-token proxy fails closed until a later domain workbench replaces it with a Supabase-session command adapter.

## Events and audit

Role assignment, role revocation, and account-state changes write `integration.outbox_events` in the same PostgreSQL transaction as authoritative state. Current event names:

- `identity.role-assigned`
- `identity.role-revoked`
- `identity.account-state-changed`

Authorization decisions for denied access and allowed recent-auth commands are written to `identity.authorization_audit_events`. Sensitive commands fail closed when this audit cannot be recorded.

No token, OTP, raw authorization header, secret, or signed URL belongs in identity audit or Outbox payloads.

## Next.js and React-admin boundary

`@supabase/ssr` manages browser/server clients and middleware cookie refresh. Server routes validate the Cookie session with `getClaims()` before retrieving an access token and forwarding it to FastAPI. The token is never returned to browser JavaScript by the proxy.

React-admin is limited to the client-only `/admin` shell:

- loaded with `next/dynamic` and `ssr: false`;
- no React Router Framework Mode, RSC, Server Actions, or router server APIs;
- no generic CRUD business writes;
- high-contrast theme and explicit semantic `<h1>`;
- noindex/noarchive metadata;
- static import guard prevents React-admin, RA, or Material UI imports outside the isolated shell.

Pinned temporary dependency exception:

- `react-admin` 5.15.1
- `react-router` 7.18.1
- `react-router-dom` 7.18.1

`npm run guard:admin-runtime -w web` fails if versions drift or forbidden routing/runtime patterns appear. Any move toward React Router Framework Mode, RSC, or server actions invalidates the exception.

## Metrics and alerts

Implementations consuming these facts should expose at least:

- JWT validation failures by reason without token content;
- JWKS refresh/failure count;
- account-state denials;
- capability denials by capability key;
- recent-auth denials;
- role grants, revocations, and automatic expiries;
- identity database and authorization-audit failures;
- admin-session 401/403/404/5xx counts;
- abnormal restricted-data access attempts.

Alert on repeated privileged-access denials, audit write failure, JWKS unavailability, role-cache use after revocation, and inactive-account command attempts.

## Rollback

To stop the new path:

1. Disable the web `ADMIN_SHELL_ENABLED` flag.
2. Disable FastAPI `ADMIN_SHELL_ENABLED`.
3. Disable `IDENTITY_AUTH_ENABLED` only if legacy local operator routes are still required.
4. Do not drop `identity` tables, role history, audit events, Outbox facts, or the migration.
5. Investigate and forward-fix; re-enable after session, capability, and audit checks pass.

The legacy local Admin Token and Workflow Actor paths remain available only while `IDENTITY_AUTH_ENABLED=false`. They are a transition mechanism, not a production authorization model.
