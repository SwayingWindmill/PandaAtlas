import { readFile } from "node:fs/promises";
import { createPublicKey, randomUUID, verify } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPROVAL_ID = /^[A-Za-z0-9-]{8,80}$/;
const ROLE_KEYS = ["administrator", "member"];
const SOURCES = { bootstrap: "production_first_admin", recover: "production_admin_recovery" };

// Owner signs JSON.stringify(request) with a separately held Ed25519 private key.
// The corresponding trusted public key is provisioned only in the operator environment.
export function approveProductionAdminRequest(approval, publicKeyPem, operation, accountId) {
  const request = approval?.request;
  if (!request || request.version !== 1 || request.operation !== operation ||
      request.accountId !== accountId || !UUID.test(accountId) ||
      !APPROVAL_ID.test(request.approvalId ?? "") ||
      typeof request.approvedBy !== "string" || !request.approvedBy.trim() ||
      typeof request.expiresAt !== "string") {
    throw new Error("The owner approval does not match the requested operation and subject");
  }
  const expiresAt = Date.parse(request.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("The owner approval has expired");
  }
  if (expiresAt - Date.now() > 24 * 60 * 60 * 1000) {
    throw new Error("The owner approval must expire within 24 hours");
  }
  if (typeof approval.signature !== "string") throw new Error("The owner approval signature is required");
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519" ||
      !verify(null, Buffer.from(JSON.stringify(request)), key, Buffer.from(approval.signature, "base64"))) {
    throw new Error("The owner approval signature is invalid");
  }
  return request;
}

export function assertManagedDatabaseUrl(connectionString, projectRef) {
  const parsed = new URL(connectionString);
  const direct = parsed.hostname === `db.${projectRef}.supabase.co` && parsed.username === "postgres";
  const pooler = parsed.hostname.endsWith(".pooler.supabase.com") && parsed.username === `postgres.${projectRef}`;
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? "") ||
      (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") ||
      parsed.pathname !== "/postgres" || !parsed.password ||
      !(direct || pooler)) {
    throw new Error("Refusing a database outside the approved managed Supabase project");
  }
}

// Caller owns BEGIN/COMMIT/ROLLBACK. Both dry-run and apply execute this same path.
export async function runProductionAdminCeremony(client, approval) {
  const { accountId, operation, approvalId, approvedBy } = approval;
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

  const approvalPrefix = `production-admin:${approvalId}:`;
  const historicApproval = await client.query(
    `select a.account_id, a.role_key, a.source, a.expires_at, r.revocation_id
     from identity.role_assignments a
     left join identity.role_assignment_revocations r on r.assignment_id=a.assignment_id
     where a.idempotency_key like $1`, [`${approvalPrefix}%`],
  );
  if (historicApproval.rowCount) {
    const grants = historicApproval.rows;
    if (grants.some((row) => row.account_id !== accountId || row.source !== source || row.revocation_id ||
        (row.expires_at && new Date(row.expires_at) <= new Date())) ||
        !grants.some((row) => row.role_key === "administrator")) {
      throw new Error("This approval was used for a different or revoked administrator grant; a new owner approval is required");
    }
    return { status: "already_applied", accountId, roles: grants.map((row) => row.role_key).sort() };
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
    throw new Error("Administrator bootstrap is permanently closed; use separately approved recovery");
  }
  if (operation === "recover" && !historical.rowCount) {
    throw new Error("No prior administrator exists; recovery cannot replace first bootstrap");
  }
  if (activeAdmins.length) {
    throw new Error("An active administrator already exists; use normal staff governance");
  }

  await client.query("insert into identity.accounts(account_id,email) values($1,null) on conflict(account_id) do nothing", [accountId]);
  const correlationId = randomUUID();
  const reason = `Signed owner authorization ${approvalId} (${approvedBy})`;
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
      [accountId, roleKey, reason, source, correlationId, `${approvalPrefix}${roleKey}`],
    );
    const assignmentId = grant.rows[0].assignment_id;
    await client.query(
      `insert into identity.authorization_audit_events
         (event_type,subject_account_id,assignment_id,role_key,outcome,reason,details,correlation_id)
       values ('identity.role-assigned',$1,$2,$3,'assigned',$4,$5::jsonb,$6)`,
      [accountId, assignmentId, roleKey, reason,
        JSON.stringify({ source, approvalId, approvedBy }), correlationId],
    );
    await client.query(
      `insert into integration.outbox_events
         (event_type,source_context,aggregate_type,aggregate_id,idempotency_key,correlation_id,occurred_at,payload)
       values ('identity.role-assigned','identity','identity.account',$1,$2,$3,now(),$4::jsonb)`,
      [accountId, `${approvalPrefix}${accountId}:${roleKey}`, correlationId,
        JSON.stringify({ accountId, roleKey, assignmentId, source, approvalId })],
    );
    grantedRoles.push(roleKey);
  }
  return { status: "approved", accountId, roles: grantedRoles };
}

async function main(argv) {
  if (argv.length === 1 && argv[0] === "--help") {
    console.log("Production owner ceremony (dry-run by default):\n  node scripts/development/production-staff-admin.mjs --environment production --operation bootstrap|recover --account-id <UUID> --approval-file <signed.json> [--apply]");
    return;
  }
  const allowed = new Set(["--environment", "--operation", "--account-id", "--approval-file", "--apply"]);
  const flags = new Map();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!allowed.has(flag) || flags.has(flag)) throw new Error("Unexpected or repeated operator argument");
    flags.set(flag, flag === "--apply" ? true : argv[++i]);
  }
  const operation = flags.get("--operation");
  const accountId = flags.get("--account-id");
  if (flags.get("--environment") !== "production" || (operation !== "bootstrap" && operation !== "recover") ||
      !UUID.test(accountId ?? "") || !flags.get("--approval-file")) {
    throw new Error("Explicit production environment, operation, verified subject UUID and owner approval file are required");
  }
  if (process.env.APP_ENV !== "production") {
    throw new Error("Trusted production operator context requires APP_ENV=production");
  }
  const signedApproval = JSON.parse(await readFile(flags.get("--approval-file"), "utf8"));
  const approval = approveProductionAdminRequest(signedApproval, process.env.PANDAATLAS_IAM_OWNER_PUBLIC_KEY, operation, accountId);
  const connectionString = process.env.PANDAATLAS_IAM_OPERATOR_DATABASE_URL;
  assertManagedDatabaseUrl(connectionString, process.env.PANDAATLAS_IAM_SUPABASE_PROJECT_REF);
  const ca = process.env.PANDAATLAS_IAM_DATABASE_SSL_CA_CERT;
  if (!ca) throw new Error("The trusted operator must provide the managed database SSL CA");

  const client = new pg.Client({ connectionString, ssl: { ca, rejectUnauthorized: true } });
  await client.connect();
  try {
    await client.query("begin");
    const outcome = await runProductionAdminCeremony(client, approval);
    if (flags.get("--apply")) {
      await client.query("commit");
      console.log(`Production administrator ceremony committed: ${outcome.status}; roles: ${outcome.roles.join(", ")}`);
    } else {
      await client.query("rollback");
      console.log(`Dry-run passed without persistence: ${outcome.status}; roles: ${outcome.roles.join(", ")}`);
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
    console.error(error instanceof Error ? error.message : "Production administrator ceremony failed");
    process.exitCode = 1;
  });
}
