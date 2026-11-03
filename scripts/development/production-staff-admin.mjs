import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_KEYS = ["administrator", "member"];
const SOURCES = { bootstrap: "production_first_admin", recover: "production_admin_recovery" };

// Caller owns BEGIN/COMMIT/ROLLBACK. Both dry-run and apply execute this same path.
export async function grantProductionAdministrator(client, { accountId, operation }) {
  if (operation !== "bootstrap" && operation !== "recover") {
    throw new Error("Unsupported production administrator operation");
  }
  const source = SOURCES[operation];

  await client.query("select pg_advisory_xact_lock(24102, 429)");
  const subject = await client.query(
    `select id, email_confirmed_at, banned_until, deleted_at, is_anonymous, role
     from auth.users where id=$1`, [accountId],
  );
  const user = subject.rows[0];
  if (!user || !user.email_confirmed_at || user.deleted_at || user.is_anonymous ||
      (user.banned_until && new Date(user.banned_until) > new Date()) || user.role !== "authenticated") {
    throw new Error("Production bootstrap requires a verified, active Supabase Auth subject UUID");
  }

  const account = await client.query("select state from identity.accounts where account_id=$1", [accountId]);
  if (account.rowCount && account.rows[0].state !== "active") {
    throw new Error("The proposed administrator's application account is not active");
  }

  const historical = await client.query(
    `select a.account_id, a.assignment_id, r.revocation_id, a.expires_at,
            account.state as account_state
     from identity.role_assignments a
     left join identity.role_assignment_revocations r on r.assignment_id=a.assignment_id
     join identity.accounts account on account.account_id=a.account_id
     where a.role_key='administrator'`,
  );
  const activeAdmins = historical.rows.filter((row) => !row.revocation_id &&
    row.account_state === "active" && (!row.expires_at || new Date(row.expires_at) > new Date()));
  if (operation === "bootstrap" && historical.rowCount) {
    throw new Error("Administrator bootstrap is permanently closed; use --operation recover");
  }
  if (operation === "recover" && !historical.rowCount) {
    throw new Error("No prior administrator exists; recovery cannot replace first bootstrap");
  }
  if (activeAdmins.length) {
    throw new Error("An active administrator already exists");
  }

  await client.query("insert into identity.accounts(account_id,email) values($1,null) on conflict(account_id) do nothing", [accountId]);
  const correlationId = randomUUID();
  const reason = operation === "bootstrap" ? "Owner-run first administrator" : "Owner-run administrator recovery";
  const grantedRoles = [];
  for (const roleKey of ROLE_KEYS) {
    if (roleKey === "member") {
      const member = await client.query(
        `select 1 from identity.role_assignments a
         left join identity.role_assignment_revocations r on r.assignment_id=a.assignment_id
         where a.account_id=$1 and a.role_key='member' and r.assignment_id is null
           and (a.expires_at is null or a.expires_at>now())`, [accountId],
      );
      if (member.rowCount) continue;
    }
    const grant = await client.query(
      `insert into identity.role_assignments
        (account_id,role_key,assigned_by_account_id,reason,source,correlation_id,idempotency_key)
       values ($1,$2,null,$3,$4,$5,$6) returning assignment_id`,
      [accountId, roleKey, reason, source, correlationId, `production-admin:${correlationId}:${roleKey}`],
    );
    const assignmentId = grant.rows[0].assignment_id;
    await client.query(
      `insert into identity.authorization_audit_events
         (event_type,subject_account_id,assignment_id,role_key,outcome,reason,details,correlation_id)
       values ('identity.role-assigned',$1,$2,$3,'assigned',$4,$5::jsonb,$6)`,
      [accountId, assignmentId, roleKey, reason,
        JSON.stringify({ source }), correlationId],
    );
    await client.query(
      `insert into integration.outbox_events
         (event_type,source_context,aggregate_type,aggregate_id,idempotency_key,correlation_id,occurred_at,payload)
       values ('identity.role-assigned','identity','identity.account',$1,$2,$3,now(),$4::jsonb)`,
      [accountId, `production-admin:${correlationId}:${accountId}:${roleKey}`, correlationId,
        JSON.stringify({ accountId, roleKey, assignmentId, source })],
    );
    grantedRoles.push(roleKey);
  }
  return { accountId, roles: grantedRoles };
}

async function main(argv) {
  if (argv.length === 1 && argv[0] === "--help") {
    console.log("Owner-run production administrator setup (dry-run by default):\n  node scripts/development/production-staff-admin.mjs --operation bootstrap|recover --account-id <UUID> [--apply]");
    return;
  }
  const allowed = new Set(["--operation", "--account-id", "--apply"]);
  const flags = new Map();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!allowed.has(flag) || flags.has(flag)) throw new Error("Unexpected or repeated argument");
    flags.set(flag, flag === "--apply" ? true : argv[++i]);
  }
  const operation = flags.get("--operation");
  const accountId = flags.get("--account-id");
  if ((operation !== "bootstrap" && operation !== "recover") || !UUID.test(accountId ?? "")) {
    throw new Error("--operation bootstrap|recover and a Supabase Auth subject UUID are required");
  }
  const connectionString = process.env.PANDAATLAS_IAM_OPERATOR_DATABASE_URL;
  const ca = process.env.PANDAATLAS_IAM_DATABASE_SSL_CA_CERT;
  if (!connectionString || !ca) {
    throw new Error("PANDAATLAS_IAM_OPERATOR_DATABASE_URL and PANDAATLAS_IAM_DATABASE_SSL_CA_CERT are required");
  }
  // The dry-run names the target so a wrong database shows before anything is written.
  console.log(`Database host: ${new URL(connectionString).hostname}`);

  const client = new pg.Client({ connectionString, ssl: { ca, rejectUnauthorized: true } });
  await client.connect();
  try {
    await client.query("begin");
    const outcome = await grantProductionAdministrator(client, { accountId, operation });
    if (flags.get("--apply")) {
      await client.query("commit");
      console.log(`Committed; roles: ${outcome.roles.join(", ")}`);
    } else {
      await client.query("rollback");
      console.log(`Dry-run passed, nothing written; roles: ${outcome.roles.join(", ")}`);
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : "Production administrator setup failed");
    process.exitCode = 1;
  });
}
