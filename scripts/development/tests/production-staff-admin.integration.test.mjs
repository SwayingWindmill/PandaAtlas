import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { grantProductionAdministrator } from "../production-staff-admin.mjs";

const connectionString = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const observer = new pg.Client({ connectionString });
await observer.connect();
const current = await observer.query("select count(*)::int as total from identity.role_assignments where role_key='administrator'");
await observer.end();
// Local machines may already have an approved administrator. Fresh CI Supabase
// exercises the one-time success paths without mutating any persistent staff.
const fresh = current.rows[0].total === 0 ? test : test.skip;

async function fixture(work, { verified = true } = {}) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const accountId = randomUUID();
  await client.query("begin");
  try {
    await client.query(
      `insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at)
       values ($1,'authenticated','authenticated',$2,$3,now(),now())`,
      [accountId, `production-admin-fixture-${accountId}@example.test`, verified ? new Date() : null],
    );
    await work(client, accountId);
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

async function auditCounts(client, accountId) {
  const grants = await client.query(
    "select role_key,source from identity.role_assignments where account_id=$1 order by role_key", [accountId],
  );
  const audits = await client.query(
    "select role_key from identity.authorization_audit_events where subject_account_id=$1 and event_type='identity.role-assigned' order by role_key", [accountId],
  );
  const outbox = await client.query(
    "select event_type from integration.outbox_events where aggregate_id=$1 and event_type='identity.role-assigned'", [accountId],
  );
  return { grants: grants.rows, audits: audits.rows, outbox: outbox.rows };
}

fresh("the first administrator is minimal, atomic and permanently one-time", async () => {
  await fixture(async (client, accountId) => {
    const first = await grantProductionAdministrator(client, { accountId, operation: "bootstrap" });
    assert.deepEqual(first, { accountId, roles: ["administrator", "member"] });
    const persisted = await auditCounts(client, accountId);
    assert.deepEqual(persisted.grants.map((r) => r.role_key), ["administrator", "member"]);
    assert.ok(persisted.grants.every((r) => r.source === "production_first_admin"));
    assert.deepEqual(persisted.audits.map((r) => r.role_key), ["administrator", "member"]);
    assert.equal(persisted.outbox.length, 2);
    await assert.rejects(() => grantProductionAdministrator(client, { accountId, operation: "bootstrap" }), /permanently closed/);
  });
});

fresh("recovery grants a new assignment, never resurrecting a revoked administrator", async () => {
  await fixture(async (client, accountId) => {
    await client.query("insert into identity.accounts(account_id,email) values ($1,null)", [accountId]);
    const old = await client.query(
      `insert into identity.role_assignments(account_id,role_key,reason,source,correlation_id,idempotency_key)
       values ($1,'administrator','prior bootstrap','production_first_admin',$2,$3) returning assignment_id`,
      [accountId, randomUUID(), `prior:${accountId}`],
    );
    await client.query(
      `insert into identity.role_assignment_revocations(assignment_id,reason,correlation_id,idempotency_key)
       values($1,'revoked by owner',$2,$3)`, [old.rows[0].assignment_id, randomUUID(), `prior-revoke:${accountId}`],
    );
    const recovered = await grantProductionAdministrator(client, { accountId, operation: "recover" });
    assert.deepEqual(recovered.roles, ["administrator", "member"]);
    await assert.rejects(() => grantProductionAdministrator(client, { accountId, operation: "recover" }), /active administrator/);
    const persisted = await auditCounts(client, accountId);
    assert.equal(persisted.grants.filter((r) => r.role_key === "administrator").length, 2);
    assert.equal(persisted.grants.filter((r) => r.source === "production_admin_recovery").length, 2);
    assert.equal(persisted.audits.length, 2);
    assert.equal(persisted.outbox.length, 2);
  });
});

test("production procedure rejects unverified Auth subjects before touching authority", async () => {
  await fixture(async (client, accountId) => {
    await assert.rejects(() => grantProductionAdministrator(client, { accountId, operation: "bootstrap" }), /verified/);
    const writes = await auditCounts(client, accountId);
    assert.equal(writes.grants.length, 0);
    assert.equal(writes.audits.length, 0);
    assert.equal(writes.outbox.length, 0);
  }, { verified: false });
});

test("recovery never grants a competing administrator while a real administrator is active", async () => {
  await fixture(async (client, accountId) => {
    await assert.rejects(() => grantProductionAdministrator(client, { accountId, operation: "recover" }), /administrator|recovery/i);
    const writes = await auditCounts(client, accountId);
    assert.equal(writes.grants.length, 0);
  });
});
