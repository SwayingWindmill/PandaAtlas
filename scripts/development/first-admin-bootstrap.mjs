import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { repoRoot } from "./catalog.mjs";
import { resolveDevelopmentInvocation } from "./operations.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE_ROLES = ["administrator", "member"];
const WORKSPACE_ROLES = ["moderator", "senior_archive_editor"];
const BOOTSTRAP_SOURCE = "local_first_admin";

// SQL runs in one transaction, including the append-only audit/outbox facts.
// It is deliberately not an HTTP command or an application credential bypass.
export async function bootstrapFirstAdministrator(client, accountId, { workspaceAccess = false } = {}) {
  if (!UUID.test(accountId)) throw new Error("A Supabase account UUID is required");
  await client.query("select pg_advisory_xact_lock(24102, 422)");

  const identity = await client.query(
    `select id, email_confirmed_at, banned_until, deleted_at, is_anonymous, role
     from auth.users where id=$1`,
    [accountId],
  );
  const user = identity.rows[0];
  if (!user || !user.email_confirmed_at || user.is_anonymous || user.deleted_at ||
      (user.banned_until && new Date(user.banned_until) > new Date()) || user.role !== "authenticated") {
    throw new Error("A live, verified Supabase account UUID is required");
  }

  // A once-revoked bootstrap is *not* an opportunity to silently mint another
  // superuser. Recovery needs a separate trusted operator decision.
  const previousBootstrap = await client.query(
    `select account_id from identity.role_assignments
     where source=$1 and role_key='administrator'`,
    [BOOTSTRAP_SOURCE],
  );
  if (previousBootstrap.rows.some(({ account_id }) => account_id !== accountId)) {
    throw new Error("First administrator already bootstrapped; use the recovery procedure");
  }
  const activeAdministrators = await client.query(
    `select distinct assignment.account_id
     from identity.role_assignments assignment
     left join identity.role_assignment_revocations revocation
       on revocation.assignment_id=assignment.assignment_id
     where assignment.role_key='administrator' and revocation.assignment_id is null
       and (assignment.expires_at is null or assignment.expires_at>now())`,
  );
  if (activeAdministrators.rows.some(({ account_id }) => account_id !== accountId)) {
    throw new Error("Another administrator already exists; first-admin bootstrap is closed");
  }
  if (activeAdministrators.rowCount && !previousBootstrap.rowCount) {
    throw new Error("An administrator already exists without first-admin bootstrap provenance");
  }
  const account = await client.query("select state from identity.accounts where account_id=$1", [accountId]);
  if (account.rowCount && account.rows[0].state !== "active") {
    throw new Error("PandaAtlas account is not active");
  }
  if (previousBootstrap.rowCount && !activeAdministrators.rowCount) {
    throw new Error("Previous administrator grant is no longer active; manual recovery required");
  }

  await client.query(
    "insert into identity.accounts(account_id, email) values ($1, null) on conflict(account_id) do nothing",
    [accountId],
  );
  const roles = [...BASE_ROLES, ...(workspaceAccess ? WORKSPACE_ROLES : [])].sort();
  let created = false;
  for (const roleKey of roles) {
    const existing = await client.query(
      `select assignment.assignment_id from identity.role_assignments assignment
       left join identity.role_assignment_revocations revocation
         on revocation.assignment_id=assignment.assignment_id
       where assignment.account_id=$1 and assignment.role_key=$2 and revocation.assignment_id is null
         and (assignment.expires_at is null or assignment.expires_at>now())`,
      [accountId, roleKey],
    );
    if (existing.rowCount) continue;
    const correlationId = randomUUID();
    const reason = "Explicit local first-administrator setup (issue #422)";
    const grant = await client.query(
      `insert into identity.role_assignments
       (account_id,role_key,assigned_by_account_id,reason,source,correlation_id,idempotency_key)
       values ($1,$2,null,$3,$4,$5,$6) returning assignment_id`,
      [accountId, roleKey, reason, BOOTSTRAP_SOURCE, correlationId, `first-admin:${roleKey}`],
    );
    await client.query(
      `insert into identity.authorization_audit_events
       (event_type,subject_account_id,assignment_id,role_key,outcome,reason,details,correlation_id)
       values ('identity.role-assigned',$1,$2,$3,'assigned',$4,$5::jsonb,$6)`,
      [accountId, grant.rows[0].assignment_id, roleKey, reason,
        JSON.stringify({ source: BOOTSTRAP_SOURCE, local: true }), correlationId],
    );
    await client.query(
      `insert into integration.outbox_events
       (event_type,source_context,aggregate_type,aggregate_id,idempotency_key,
        correlation_id,occurred_at,payload)
       values ('identity.role-assigned','identity','identity.account',$1,$2,$3,now(),$4::jsonb)`,
      [accountId, `first-admin:${accountId}:${roleKey}`, correlationId,
        JSON.stringify({ accountId, roleKey, assignmentId: grant.rows[0].assignment_id })],
    );
    created = true;
  }
  return { created, roles };
}

async function localSupabaseStatus() {
  const invocation = resolveDevelopmentInvocation("npx", [
    "--yes", "supabase@2.110.0", "status", "--workdir", "infra", "-o", "json",
  ]);
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd: repoRoot, env: process.env, shell: invocation.shell, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => { output += chunk; });
    child.once("error", reject);
    child.once("exit", code => {
      if (code !== 0) return reject(new Error("Local Supabase is not ready. Start it with npm run dev:admin"));
      try { resolve(JSON.parse(output.slice(output.indexOf("{")))); }
      catch { reject(new Error("Could not read local Supabase status")); }
    });
  });
}

async function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: npm run bootstrap:admin -- --account-id <Supabase UUID> [--workspace-access]");
    return;
  }
  const index = args.indexOf("--account-id");
  if (index < 0 || !UUID.test(args[index + 1] ?? "") ||
      args.some((arg, i) => arg !== "--account-id" && arg !== "--workspace-access" &&
        !(i === index + 1))) {
    throw new Error("Expected --account-id <verified Supabase UUID> [--workspace-access]");
  }
  if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("The first-admin operator command is local-development-only");
  }
  const status = await localSupabaseStatus();
  const database = new URL(status.DB_URL ?? "");
  if (status.API_URL !== "http://127.0.0.1:54321" ||
      database.hostname !== "127.0.0.1" || database.port !== "54322" ||
      database.pathname !== "/postgres") {
    throw new Error("Refusing to grant roles outside the pinned local Supabase instance");
  }

  const client = new pg.Client({ connectionString: status.DB_URL });
  await client.connect();
  try {
    await client.query("begin");
    const result = await bootstrapFirstAdministrator(client, args[index + 1], {
      workspaceAccess: args.includes("--workspace-access"),
    });
    await client.query("commit");
    console.log(result.created
      ? `Local first administrator ready. Granted roles: ${result.roles.join(", ")}.`
      : "Existing first administrator grants already verified; no changes made.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : "First-administrator setup failed");
    process.exitCode = 1;
  });
}
