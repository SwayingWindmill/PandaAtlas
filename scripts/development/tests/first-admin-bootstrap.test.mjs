import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import nodeTest from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { bootstrapFirstAdministrator } from "../first-admin-bootstrap.mjs";

const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const check = new pg.Client({ connectionString: databaseUrl });
await check.connect();
const { rows: administratorRows } = await check.query(
  `select count(*)::int as count from identity.role_assignments a
   left join identity.role_assignment_revocations r on r.assignment_id=a.assignment_id
   where a.role_key='administrator' and r.assignment_id is null
     and (a.expires_at is null or a.expires_at>now())`,
);
await check.end();
// CI runs against a fresh disposable Supabase. An already-bootstrapped
// workstation is not a valid first-admin fixture; leave its grants untouched.
const test = administratorRows[0].count === 0 ? nodeTest : nodeTest.skip;

async function withDisposableIdentity(run, { verified = true } = {}) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("begin");
  const id = randomUUID();
  await client.query(
    `insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
     values ($1, 'authenticated', 'authenticated', $2, $3, now(), now())`,
    [id, `bootstrap-test-${id}@example.test`, verified ? new Date() : null],
  );
  try {
    await run({ client, id });
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

test("a verified Supabase user can be explicitly bootstrapped exactly once with auditable administrator rights", async () => {
  await withDisposableIdentity(async ({ client, id }) => {
    const first = await bootstrapFirstAdministrator(client, id, { workspaceAccess: false });
    assert.equal(first.created, true);
    assert.deepEqual(first.roles, ["administrator", "member"]);

    const second = await bootstrapFirstAdministrator(client, id, { workspaceAccess: false });
    assert.equal(second.created, false);

    const granted = await client.query(
      "select role_key from identity.role_assignments where account_id=$1 order by role_key", [id],
    );
    assert.deepEqual(granted.rows.map(x => x.role_key), ["administrator", "member"]);

    const audit = await client.query(
      "select role_key from identity.authorization_audit_events where subject_account_id=$1 and outcome='assigned' order by role_key", [id],
    );
    assert.deepEqual(audit.rows.map(x => x.role_key), ["administrator", "member"]);
    const events = await client.query(
      "select count(*)::int as count from integration.outbox_events where aggregate_id=$1 and event_type='identity.role-assigned'", [id],
    );
    assert.equal(events.rows[0].count, 2);
  });
});

test("an unverified Supabase identity never becomes staff", async () => {
  await withDisposableIdentity(async ({ client, id }) => {
    await assert.rejects(() => bootstrapFirstAdministrator(client, id, { workspaceAccess: false }), /verified/);
    const granted = await client.query("select count(*)::int as count from identity.role_assignments where account_id=$1", [id]);
    assert.equal(granted.rows[0].count, 0);
  }, { verified: false });
});

test("full local workspace mode uses explicitly named business roles and stays idempotent", async () => {
  await withDisposableIdentity(async ({ client, id }) => {
    const result = await bootstrapFirstAdministrator(client, id, { workspaceAccess: true });
    assert.equal(result.created, true);
    assert.deepEqual(result.roles, ["administrator", "member", "moderator", "senior_archive_editor"]);
    const granted = await client.query(
      `select distinct rc.capability_key from identity.role_assignments a
       join identity.role_capabilities rc on rc.role_key=a.role_key where a.account_id=$1`,
      [id],
    );
    const capabilities = new Set(granted.rows.map(x => x.capability_key));
    for (const capability of ["admin.shell.access","review.case.read","moderation.sanction.read",
      "curation.change.approve","publication.release.activate","audit.read"]) {
      assert.equal(capabilities.has(capability), true, capability);
    }
    const repeated = await bootstrapFirstAdministrator(client, id, { workspaceAccess: true });
    assert.equal(repeated.created, false);
  });
});

test("existing administrator blocks first-admin grant to another account", async () => {
  await withDisposableIdentity(async ({ client, id }) => {
    const other = randomUUID();
    await client.query(
      `insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at)
       values ($1,'authenticated','authenticated',$2,now(),now(),now())`,
      [other, `already-admin-${other}@example.test`],
    );
    await client.query("insert into identity.accounts(account_id,email) values ($1,null)", [other]);
    await client.query(
      `insert into identity.role_assignments(account_id,role_key,reason,source,correlation_id,idempotency_key)
       values ($1,'administrator','existing administrator','operator',$2,$3)`,
      [other, randomUUID(), `test:${other}`],
    );
    await assert.rejects(() => bootstrapFirstAdministrator(client, id), /Another administrator/);
    const account = await client.query("select account_id from identity.accounts where account_id=$1", [id]);
    assert.equal(account.rowCount, 0);
  });
});

test("a revoked bootstrap grant cannot be silently restored by rerunning setup", async () => {
  await withDisposableIdentity(async ({ client, id }) => {
    await bootstrapFirstAdministrator(client, id);
    const original = await client.query(
      "select assignment_id from identity.role_assignments where account_id=$1 and role_key='administrator'", [id],
    );
    await client.query(
      `insert into identity.role_assignment_revocations
       (assignment_id,reason,correlation_id,idempotency_key)
       values ($1,'revoked for recovery test',$2,$3)`,
      [original.rows[0].assignment_id, randomUUID(), `test-revoke:${id}`],
    );
    await assert.rejects(() => bootstrapFirstAdministrator(client, id), /manual recovery/);
    const grants = await client.query(
      "select count(*)::int as count from identity.role_assignments where account_id=$1 and role_key='administrator'", [id],
    );
    assert.equal(grants.rows[0].count, 1);
  });
});

test("bootstrap does not adopt an existing unaudited administrator assignment", async () => {
  await withDisposableIdentity(async ({ client, id }) => {
    await client.query("insert into identity.accounts(account_id,email) values ($1,null)", [id]);
    await client.query(
      `insert into identity.role_assignments(account_id,role_key,reason,source,correlation_id,idempotency_key)
       values ($1,'administrator','existing test admin','operator',$2,$3)`,
      [id, randomUUID(), `previous:${id}`],
    );
    await assert.rejects(() => bootstrapFirstAdministrator(client, id), /without first-admin bootstrap provenance/);
    const audit = await client.query(
      "select count(*)::int as count from identity.authorization_audit_events where subject_account_id=$1", [id],
    );
    assert.equal(audit.rows[0].count, 0);
  });
});

nodeTest("the CLI refuses production and malformed operator invocations before database access", () => {
  const script = fileURLToPath(new URL("../first-admin-bootstrap.mjs", import.meta.url));
  const production = spawnSync(process.execPath, [script, "--account-id", randomUUID()], {
    encoding: "utf8", env: { ...process.env, APP_ENV: "production" },
  });
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /local-development-only/);
  const badInput = spawnSync(process.execPath, [script, "--account-id", "not-a-uuid"], {
    encoding: "utf8",
  });
  assert.notEqual(badInput.status, 0);
  assert.match(badInput.stderr, /verified Supabase UUID/);
});
