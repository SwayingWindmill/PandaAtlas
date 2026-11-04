# Production first administrator and recovery

Production Identity uses **Supabase Auth UUIDs** and the private PostgreSQL `identity` schema. There is no default admin email, environment-variable role grant, browser bootstrap route or permanent recovery login. The local `npm run bootstrap:admin` command is for local development only.

The project owner grants the first administrator once, from their own machine, with `scripts/development/production-staff-admin.mjs`. Nothing here runs in the Cloudflare Worker or adds a runtime endpoint.

**Not needed today.** Production does not serve the staff console: `ADMIN_SHELL_ENABLED` is fixed to `false`, and `/admin` answers 404 for everyone, signed in or not ([runtime status](../deployment/runtime-status.md)). Content is published through batch operations instead. Grant the first administrator only when the console is enabled in production; until then the role has nothing to open.

## 1. Find the account

Sign up the intended administrator through the normal Supabase email flow. In the Supabase dashboard (Authentication → Users), copy that user's UUID and check the email is confirmed. Select by UUID, never by email string.

## 2. Dry-run, then apply

Set two variables in the shell (do not print them):

| Variable | Meaning |
|---|---|
| `PANDAATLAS_IAM_OPERATOR_DATABASE_URL` | Production Postgres connection string with rights to read `auth.users` and write `identity` and `integration.outbox_events` (Supabase dashboard → Connect) |
| `PANDAATLAS_IAM_DATABASE_SSL_CA_CERT` | Supabase root CA PEM (Database settings → SSL configuration) |

Dry-run first; it prints the database host, runs the whole transaction and rolls it back:

```powershell
node scripts/development/production-staff-admin.mjs --operation bootstrap --account-id <uuid>
```

If the host and roles look right, run the same command with `--apply`. One transaction grants the `administrator` role (and `member` when absent), with an authorization audit event and an `identity.role-assigned` Outbox fact for each grant.

The script refuses when the Auth user is unconfirmed, deleted, banned or anonymous, or when the application account is not active. A refusal is a stop: fix the cause rather than editing `identity.role_assignments` by hand.

## 3. Check

- `identity.role_assignments` has one live `administrator` row for the UUID, with source `production_first_admin`.
- Once the console is served, the administrator signs in with email OTP, opens `/admin`, enrolls Supabase TOTP and reaches AAL2 before sensitive commands.

## 4. Recovery

Bootstrap closes permanently once any administrator grant has existed, even a revoked one. If an incident leaves **no active administrator**, investigate first, then run the same dry-run and `--apply` with `--operation recover` for a verified UUID. Recovery creates a new assignment with source `production_admin_recovery`; it never reactivates a revoked grant. It refuses while an active administrator exists, and when no administrator has ever existed (use bootstrap).

## 5. Tests

`npm run ops -- run api.integration` runs the CLI tests and the real PostgreSQL transaction tests. The success paths run only on a fresh Supabase (CI) where no administrator has existed; a developer database that already has one skips them and still runs the refusal cases. All fixtures roll back.
