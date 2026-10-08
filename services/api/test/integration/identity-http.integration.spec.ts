import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { sql } from "kysely";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import type { DatabaseTransaction } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ACCOUNT_ID = "55555555-5555-4555-8555-555555555555";
const SESSION_ID = "66666666-6666-4666-8666-666666666666";

let app: NestFastifyApplication;
let jwksServer: Server;
let token: string;
let signTestToken: (accountId: string, sessionId: string, aal: "aal1" | "aal2", authenticationAgeSeconds?: number) => Promise<string>;
const INVITED_ACCOUNT_ID = randomUUID();

beforeAll(async () => {
  const keyPair = await generateKeyPair("ES256");
  const jwk = await exportJWK(keyPair.publicKey);
  Object.assign(jwk, { kid: "identity-http", alg: "ES256", use: "sig" });

  jwksServer = createServer((request, response) => {
    if (request.url === "/auth/v1/.well-known/jwks.json") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (request.url?.startsWith("/auth/v1/invite") && request.method === "POST") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: INVITED_ACCOUNT_ID, email: "reviewer@example.test" }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
  const address = jwksServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("JWKS integration server did not bind a TCP port");
  }
  const supabaseUrl = `http://127.0.0.1:${address.port}`;
  const issuer = `${supabaseUrl}/auth/v1`;

  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SECRET_KEY = "test-server-only-key";

  signTestToken = (accountId, sessionId, aal, authenticationAgeSeconds = 10) => {
    const timestamp = Math.floor(Date.now() / 1_000);
    return new SignJWT({
      role: "authenticated",
      aal,
      session_id: sessionId,
      is_anonymous: false,
      amr: [{ method: aal === "aal2" ? "totp" : "otp", timestamp: timestamp - authenticationAgeSeconds }],
    })
      .setProtectedHeader({ alg: "ES256", kid: "identity-http" })
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setSubject(accountId)
      .setIssuedAt(timestamp)
      .setExpirationTime(timestamp + 300)
      .sign(keyPair.privateKey);
  };

  app = await createApplication();
  const database = app.get(DatabaseService);
  await sql`
    insert into auth.users (id, aud, role, created_at, updated_at)
    values (${ACCOUNT_ID}::uuid, 'authenticated', 'authenticated', now(), now())
    on conflict (id) do nothing
  `.execute(database.db);
  await sql`
    insert into auth.sessions (id, user_id, created_at, updated_at, aal)
    values (${SESSION_ID}::uuid, ${ACCOUNT_ID}::uuid, now(), now(), 'aal1')
    on conflict (id) do update set user_id = excluded.user_id, aal = excluded.aal
  `.execute(database.db);

  const now = Math.floor(Date.now() / 1_000);
  token = await new SignJWT({
    role: "authenticated",
    aal: "aal1",
    session_id: SESSION_ID,
    is_anonymous: false,
    amr: [{ method: "password", timestamp: now - 10 }],
  })
    .setProtectedHeader({ alg: "ES256", kid: "identity-http" })
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setSubject(ACCOUNT_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(keyPair.privateKey);
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve, reject) =>
    jwksServer.close((error) => (error === undefined ? resolve() : reject(error))),
  );
});

describe("Identity HTTP security path", () => {
  it("provisions an authenticated Supabase user and then serves the protected account view", async () => {
    const headers = { authorization: `Bearer ${token}` };
    const provision = await app.inject({
      method: "POST",
      url: "/api/v2/me/account",
      headers,
    });
    const current = await app.inject({
      method: "GET",
      url: "/api/v2/me",
      headers,
    });

    expect(provision.statusCode).toBe(201);
    expect(provision.json()).toMatchObject({
      accountId: ACCOUNT_ID,
      state: "active",
      capabilities: [
        "account.profile.manage",
        "account.profile.read",
        "account.session.read",
        "contribution.manage",
        "contribution.read",
        "engagement.manage",
        "engagement.read",
        "game.attempt.manage",
        "game.attempt.read",
        "moderation.appeal.submit",
        "notification.manage",
        "notification.read",
        "privacy.request.manage",
      ],
    });
    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({
      accountId: ACCOUNT_ID,
      aal: "aal1",
      capabilities: [
        "account.profile.manage",
        "account.profile.read",
        "account.session.read",
        "contribution.manage",
        "contribution.read",
        "engagement.manage",
        "engagement.read",
        "game.attempt.manage",
        "game.attempt.read",
        "moderation.appeal.submit",
        "notification.manage",
        "notification.read",
        "privacy.request.manage",
      ],
    });
  });

  it("does not let an ordinary member invite an archive reviewer", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v2/staff/invitations",
      headers: { authorization: `Bearer ${token}` },
      payload: { email: "invited-reviewer@example.test" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("does not disclose staff invitations to an ordinary member", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v2/staff/invitations",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("does not disclose the staff role directory to an ordinary member", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v2/staff/accounts",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("changes reviewer rights immediately with audited, idempotent grant and revoke commands", async () => {
    const database = app.get(DatabaseService);
    const originalTransaction = database.transaction.bind(database);
    const rollback = new Error("roll back disposable staff roles HTTP fixture");
    try {
      await database.db.transaction().execute(async (tx: DatabaseTransaction) => {
        Object.defineProperty(database, "db", { configurable: true, get: () => tx });
        Reflect.set(database, "transaction", <T>(work: (transaction: DatabaseTransaction) => Promise<T>) => work(tx));
        const managerId = randomUUID();
        const staffId = randomUUID();
        const managerSessionId = randomUUID();
        const staffSessionId = randomUUID();
        const managerToken = await signTestToken(managerId, managerSessionId, "aal2");
        const weakManagerToken = await signTestToken(managerId, managerSessionId, "aal1");
        const expiredManagerToken = await signTestToken(managerId, managerSessionId, "aal2", 960);
        const invalidSessionToken = await signTestToken(managerId, randomUUID(), "aal2");
        const staffToken = await signTestToken(staffId, staffSessionId, "aal1");
        const grantKey = randomUUID();
        const revokeKey = randomUUID();
        const grantReason = "Assigned to independently verify panda source records";
        const revokeReason = "Reviewer duties moved to another staff member";
        await sql`
          insert into auth.users (id, aud, role, email_confirmed_at, created_at, updated_at)
          values (${managerId}::uuid, 'authenticated', 'authenticated', now(), now(), now()),
                 (${staffId}::uuid, 'authenticated', 'authenticated', now(), now(), now())
        `.execute(tx);
        await sql`
          insert into auth.sessions (id, user_id, created_at, updated_at, aal)
          values (${managerSessionId}::uuid, ${managerId}::uuid, now(), now(), 'aal2'),
                 (${staffSessionId}::uuid, ${staffId}::uuid, now(), now(), 'aal1')
        `.execute(tx);
        for (const accountId of [managerId, staffId]) {
          await tx.insertInto("identity.accounts").values({ account_id: accountId, email: null }).execute();
        }
        await tx.insertInto("identity.role_assignments").values({
          account_id: managerId, role_key: "administrator", reason: "Authorized test staff manager",
          correlation_id: randomUUID(), idempotency_key: randomUUID(),
        }).execute();
        await tx.insertInto("identity.role_assignments").values({
          account_id: staffId, role_key: "member", reason: "Verified user fixture",
          correlation_id: randomUUID(), idempotency_key: randomUUID(),
        }).execute();
        const managerHeaders = { authorization: `Bearer ${managerToken}` };
        const staffHeaders = { authorization: `Bearer ${staffToken}` };
        const target = `/api/v2/staff/accounts/${staffId}`;
        const reviewUrl = "/api/v2/review/cases?limit=1";

        expect((await app.inject({ method: "GET", url: reviewUrl, headers: staffHeaders })).statusCode).toBe(403);
        expect((await app.inject({ method: "GET", url: target, headers: staffHeaders })).statusCode).toBe(403);
        expect((await app.inject({ method: "GET", url: "/api/v2/staff/accounts", headers: managerHeaders })).statusCode).toBe(200);
        expect((await app.inject({ method: "GET", url: target, headers: managerHeaders })).statusCode).toBe(200);
        // Listing staff and inspecting history must survive the 15-minute step-up window.
        // Only actual authority mutations still require recent AAL2 authentication.
        expect((await app.inject({ method: "GET", url: target, headers: { authorization: `Bearer ${weakManagerToken}` } })).statusCode).toBe(200);
        expect((await app.inject({ method: "GET", url: target, headers: { authorization: `Bearer ${expiredManagerToken}` } })).statusCode).toBe(200);
        expect((await app.inject({ method: "GET", url: "/api/v2/staff/accounts", headers: { authorization: `Bearer ${expiredManagerToken}` } })).statusCode).toBe(200);
        expect((await app.inject({ method: "GET", url: "/api/v2/staff/accounts/catalog", headers: { authorization: `Bearer ${expiredManagerToken}` } })).statusCode).toBe(200);
        expect((await app.inject({ method: "GET", url: "/api/v2/staff/invitations", headers: { authorization: `Bearer ${expiredManagerToken}` } })).statusCode).toBe(200);
        expect((await app.inject({ method: "GET", url: target, headers: { authorization: `Bearer ${invalidSessionToken}` } })).statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: "/api/v2/staff/invitations", headers: { authorization: `Bearer ${expiredManagerToken}` }, payload: { email: "uninvited@example.test" } })).statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: `${target}/roles`,
          headers: { authorization: `Bearer ${expiredManagerToken}` },
          payload: { roleKey: "reviewer", reason: grantReason, idempotencyKey: grantKey },
        })).statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: `${target}/roles`,
          headers: { authorization: `Bearer ${invalidSessionToken}` },
          payload: { roleKey: "reviewer", reason: grantReason, idempotencyKey: grantKey },
        })).statusCode).toBe(403);

        const payload = { roleKey: "reviewer", reason: grantReason, idempotencyKey: grantKey };
        const selfGrant = await app.inject({ method: "POST", url: `/api/v2/staff/accounts/${managerId}/roles`, headers: managerHeaders, payload });
        expect(selfGrant.statusCode).toBe(403);
        const forbidden = await app.inject({ method: "POST", url: `${target}/roles`, headers: staffHeaders, payload });
        expect(forbidden.statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders,
          payload: { ...payload, reason: " " },
        })).statusCode).toBe(400);
        expect((await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders,
          payload: { ...payload, roleKey: "administrator" },
        })).statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders,
          payload: { ...payload, roleKey: "community_scanner" },
        })).statusCode).toBe(403);
        await sql`update auth.users set email_confirmed_at=null where id=${staffId}::uuid`.execute(tx);
        const unverifiedGrant = await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders, payload });
        expect(unverifiedGrant.statusCode).toBe(409);
        expect(unverifiedGrant.json()).toMatchObject({ code: "identity.emailUnverified" });
        await sql`update auth.users set email_confirmed_at=now() where id=${staffId}::uuid`.execute(tx);
        const grant = await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders, payload });
        expect(grant.statusCode, grant.body).toBe(201);
        const { assignmentId } = grant.json<{ assignmentId: string }>();
        const replay = await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders, payload });
        expect(replay.statusCode).toBe(201);
        expect(replay.json()).toEqual(grant.json());
        expect((await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders,
          payload: { ...payload, reason: "Changed request", idempotencyKey: grantKey } })).statusCode).toBe(409);

        expect((await app.inject({ method: "GET", url: reviewUrl, headers: staffHeaders })).statusCode).toBe(200);
        const detail = await app.inject({ method: "GET", url: target, headers: managerHeaders });
        expect(detail.json<{ capabilities: string[] }>().capabilities).toContain("review.case.read");
        expect(detail.json<{ assignments: Array<{ assignmentId: string; status: string }> }>().assignments)
          .toContainEqual(expect.objectContaining({ assignmentId, status: "active" }));
        const conflict = await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders,
          payload: { ...payload, roleKey: "senior_archive_editor", idempotencyKey: randomUUID() },
        });
        expect(conflict.statusCode).toBe(409);
        expect(conflict.json()).toMatchObject({ code: "identity.dutiesConflict" });

        const revokeUrl = `${target}/roles/${assignmentId}/revoke`;
        const revokePayload = { reason: revokeReason, idempotencyKey: revokeKey };
        await sql`update auth.users set email_confirmed_at=null where id=${staffId}::uuid`.execute(tx);
        const revoked = await app.inject({ method: "POST", url: revokeUrl, headers: managerHeaders, payload: revokePayload });
        expect(revoked.statusCode, revoked.body).toBe(201);
        expect(revoked.json()).toMatchObject({ assignmentId, status: "revoked" });
        expect((await app.inject({ method: "POST", url: revokeUrl, headers: managerHeaders, payload: revokePayload })).json()).toEqual(revoked.json());
        expect((await app.inject({ method: "GET", url: reviewUrl, headers: staffHeaders })).statusCode).toBe(403);
        expect((await app.inject({ method: "GET", url: target, headers: managerHeaders })).json<{ capabilities: string[] }>().capabilities)
          .not.toContain("review.case.read");
        expect((await app.inject({ method: "POST", url: `${target}/roles`, headers: managerHeaders, payload })).statusCode).toBe(409);

        await tx.insertInto("identity.role_assignments").values({
          account_id: staffId, role_key: "senior_archive_editor",
          reason: "Expired historical duty", assigned_at: new Date(Date.now() - 86_400_000),
          expires_at: new Date(Date.now() - 3_600_000),
          correlation_id: randomUUID(), idempotency_key: randomUUID(),
        }).execute();
        const afterExpiry = await app.inject({ method: "GET", url: target, headers: managerHeaders });
        expect(afterExpiry.json<{ assignments: Array<{ roleKey: string; status: string }> }>().assignments)
          .toContainEqual(expect.objectContaining({ roleKey: "senior_archive_editor", status: "expired" }));
        expect(afterExpiry.json<{ capabilities: string[] }>().capabilities).not.toContain("publication.release.activate");

        const audits = await tx.selectFrom("identity.authorization_audit_events")
          .select(["event_type", "reason"]).where("subject_account_id", "=", staffId)
          .where("event_type", "in", ["identity.role-assigned", "identity.role-revoked"]).execute();
        expect(audits.map((a) => a.event_type).sort()).toEqual(["identity.role-assigned", "identity.role-revoked"]);
        expect(audits.map((a) => a.reason).sort()).toEqual([grantReason, revokeReason].sort());
        const events = await sql<{ event_type: string }>`
          select event_type from integration.outbox_events where aggregate_id=${staffId}
            and event_type in ('identity.role-assigned', 'identity.role-revoked')
        `.execute(tx);
        expect(events.rows.map((e) => e.event_type).sort()).toEqual(["identity.role-assigned", "identity.role-revoked"]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      Reflect.deleteProperty(database, "db");
      Reflect.set(database, "transaction", originalTransaction);
    }
  });

  it("suspends staff immediately and restores only the remaining grants with audited transitions", async () => {
    const database = app.get(DatabaseService);
    const originalTransaction = database.transaction.bind(database);
    const rollback = new Error("roll back disposable account lifecycle fixture");
    try {
      await database.db.transaction().execute(async (tx: DatabaseTransaction) => {
        Object.defineProperty(database, "db", { configurable: true, get: () => tx });
        Reflect.set(database, "transaction", <T>(work: (transaction: DatabaseTransaction) => Promise<T>) => work(tx));
        const managerId = randomUUID();
        const workerId = randomUUID();
        const managerSession = randomUUID();
        const workerSession = randomUUID();
        const managerHeaders = { authorization: `Bearer ${await signTestToken(managerId, managerSession, "aal2")}` };
        const workerHeaders = { authorization: `Bearer ${await signTestToken(workerId, workerSession, "aal1")}` };
        const weakHeaders = { authorization: `Bearer ${await signTestToken(managerId, managerSession, "aal1")}` };
        const staleHeaders = { authorization: `Bearer ${await signTestToken(managerId, managerSession, "aal2", 1000)}` };
        const deadSessionHeaders = { authorization: `Bearer ${await signTestToken(managerId, randomUUID(), "aal2")}` };
        const suspendedReason = "Temporary restriction during source-review investigation";
        const restoredReason = "Investigation complete and access approved";
        const suspendKey = randomUUID();
        const restoreKey = randomUUID();
        await sql`insert into auth.users (id,aud,role,email_confirmed_at,created_at,updated_at)
          values (${managerId}::uuid,'authenticated','authenticated',now(),now(),now()),
                 (${workerId}::uuid,'authenticated','authenticated',now(),now(),now())`.execute(tx);
        await sql`insert into auth.sessions (id,user_id,created_at,updated_at,aal)
          values (${managerSession}::uuid,${managerId}::uuid,now(),now(),'aal2'),
                 (${workerSession}::uuid,${workerId}::uuid,now(),now(),'aal1')`.execute(tx);
        for (const accountId of [managerId, workerId]) {
          await tx.insertInto("identity.accounts").values({ account_id: accountId, email: null }).execute();
        }
        await tx.insertInto("identity.role_assignments").values([
          { account_id: managerId, role_key: "administrator", reason: "Staff management fixture", correlation_id: randomUUID(), idempotency_key: randomUUID() },
          { account_id: workerId, role_key: "reviewer", reason: "Evidence review", correlation_id: randomUUID(), idempotency_key: randomUUID() },
          { account_id: workerId, role_key: "audit_reader", reason: "Audit verification", correlation_id: randomUUID(), idempotency_key: randomUUID() },
        ]).execute();
        const statusUrl = `/api/v2/staff/accounts/${workerId}/state`;
        const reviewUrl = "/api/v2/review/cases?limit=1";
        const suspendPayload = { action: "suspend", reason: suspendedReason, idempotencyKey: suspendKey };
        expect((await app.inject({ method: "GET", url: reviewUrl, headers: workerHeaders })).statusCode).toBe(200);
        expect((await app.inject({ method: "POST", url: statusUrl, headers: workerHeaders, payload: suspendPayload })).statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: statusUrl, headers: weakHeaders, payload: suspendPayload })).statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: statusUrl, headers: staleHeaders, payload: suspendPayload })).statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: statusUrl, headers: deadSessionHeaders, payload: suspendPayload })).statusCode).toBe(403);
        expect((await app.inject({ method: "POST", url: `/api/v2/staff/accounts/${managerId}/state`, headers: managerHeaders, payload: suspendPayload })).statusCode).toBe(403);

        const suspended = await app.inject({ method: "POST", url: statusUrl, headers: managerHeaders, payload: suspendPayload });
        expect(suspended.statusCode, suspended.body).toBe(201);
        expect(suspended.json()).toMatchObject({ accountId: workerId, state: "suspended" });
        expect((await app.inject({ method: "POST", url: statusUrl, headers: managerHeaders, payload: suspendPayload })).json()).toEqual(suspended.json());
        expect((await app.inject({ method: "GET", url: reviewUrl, headers: workerHeaders })).statusCode).toBe(403);
        const inspected = await app.inject({ method: "GET", url: `/api/v2/staff/accounts/${workerId}`, headers: managerHeaders });
        expect(inspected.json()).toMatchObject({ state: "suspended", stateReason: `staff:${suspendedReason}`, capabilities: [] });
        expect((await app.inject({ method: "POST", url: statusUrl, headers: managerHeaders,
          payload: { action: "reinstate", reason: "Other action", idempotencyKey: suspendKey },
        })).statusCode).toBe(409);

        const auditGrant = await tx.selectFrom("identity.role_assignments")
          .select("assignment_id").where("account_id", "=", workerId).where("role_key", "=", "audit_reader").executeTakeFirstOrThrow();
        await tx.insertInto("identity.role_assignment_revocations").values({
          assignment_id: auditGrant.assignment_id, reason: "Audit job ended", correlation_id: randomUUID(),
          idempotency_key: randomUUID(), revoked_by_account_id: managerId,
        }).execute();
        const restored = await app.inject({ method: "POST", url: statusUrl, headers: managerHeaders,
          payload: { action: "reinstate", reason: restoredReason, idempotencyKey: restoreKey },
        });
        expect(restored.statusCode, restored.body).toBe(201);
        expect(restored.json()).toMatchObject({ state: "active", accountId: workerId });
        expect((await app.inject({ method: "GET", url: reviewUrl, headers: workerHeaders })).statusCode).toBe(200);
        const after = await app.inject({ method: "GET", url: `/api/v2/staff/accounts/${workerId}`, headers: managerHeaders });
        expect(after.json<{ capabilities: string[] }>().capabilities).toContain("review.case.read");
        expect(after.json<{ capabilities: string[] }>().capabilities).not.toContain("audit.read");
        expect(after.json<{ stateHistory: Array<{ reason: string }> }>().stateHistory.map((item) => item.reason).sort())
          .toEqual([restoredReason, suspendedReason].sort());
        const facts = await tx.selectFrom("identity.account_state_events")
          .select("next_state").where("account_id", "=", workerId).execute();
        expect(facts.map((f) => f.next_state)).toEqual(["suspended", "active"]);
        const audits = await tx.selectFrom("identity.authorization_audit_events")
          .select(["event_type", "reason", "actor_account_id"]).where("subject_account_id", "=", workerId)
          .where("event_type", "in", ["identity.account-suspended", "identity.account-reinstated"]).execute();
        expect(audits.map((event) => event.event_type).sort()).toEqual(["identity.account-reinstated", "identity.account-suspended"]);
        expect(audits.every((event) => event.actor_account_id === managerId)).toBe(true);
        const outbox = await sql<{ event_type: string }>`select event_type from integration.outbox_events
          where aggregate_id=${workerId} and event_type in ('identity.account-suspended','identity.account-reinstated')`.execute(tx);
        expect(outbox.rows.map((row) => row.event_type).sort()).toEqual(["identity.account-reinstated", "identity.account-suspended"]);

        await tx.updateTable("identity.accounts")
          .set({ state: "suspended", state_reason: "moderation:case-123" }).where("account_id", "=", workerId).execute();
        const crossAuthority = await app.inject({ method: "POST", url: statusUrl, headers: managerHeaders,
          payload: { action: "reinstate", reason: restoredReason, idempotencyKey: randomUUID() },
        });
        expect(crossAuthority.statusCode).toBe(409);
        expect(crossAuthority.json()).toMatchObject({ code: "identity.suspensionOwnedElsewhere" });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      Reflect.deleteProperty(database, "db");
      Reflect.set(database, "transaction", originalTransaction);
    }
  });

  it("does not activate review authority without an invitation bound to the signed-in UUID", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v2/me/staff-invitation/accept",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    const current = await app.inject({
      method: "GET",
      url: "/api/v2/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(current.json<{ capabilities: string[] }>().capabilities).not.toContain("review.case.read");
  });

  it("completes the invited reviewer lifecycle across authorization, Review, suspension and audit evidence", async () => {
    const database = app.get(DatabaseService);
    const originalTransaction = database.transaction.bind(database);
    const rollback = new Error("roll back disposable reviewer HTTP test fixtures");
    // CI's disposable Supabase verifies the events *after COMMIT* using a new connection.
    // Developer databases always exercise this same journey inside a rolled-back transaction.
    const committedEvidence = process.env.IAM06_COMMIT_EVIDENCE === "1";
    try {
      await database.db.transaction().execute(async (tx: DatabaseTransaction) => {
        // Isolate this end-to-end HTTP fixture in a single rollback-only transaction.
        Object.defineProperty(database, "db", { configurable: true, get: () => tx });
        Reflect.set(database, "transaction", <T>(work: (transaction: DatabaseTransaction) => Promise<T>) => work(tx));
        const adminId = randomUUID();
        const adminSessionId = randomUUID();
        const contributorId = randomUUID();
        const contributorSessionId = randomUUID();
        const reviewerSessionId = randomUUID();
        const adminToken = await signTestToken(adminId, adminSessionId, "aal2");
        const staleAdminToken = await signTestToken(adminId, adminSessionId, "aal2", 960);
        const contributorToken = await signTestToken(contributorId, contributorSessionId, "aal1");
        const reviewerToken = await signTestToken(INVITED_ACCOUNT_ID, reviewerSessionId, "aal1");
        const staleReviewerToken = await signTestToken(INVITED_ACCOUNT_ID, randomUUID(), "aal1");

        await sql`
          insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at)
          values (${adminId}::uuid,'authenticated','authenticated','admin-test@example.test',now(),now(),now()),
                 (${contributorId}::uuid,'authenticated','authenticated','contributor@example.test',now(),now(),now()),
                 (${INVITED_ACCOUNT_ID}::uuid,'authenticated','authenticated','reviewer@example.test',null,now(),now())
        `.execute(tx);
        await sql`
          insert into auth.sessions (id,user_id,created_at,updated_at,aal)
          values (${adminSessionId}::uuid,${adminId}::uuid,now(),now(),'aal2'),
                 (${contributorSessionId}::uuid,${contributorId}::uuid,now(),now(),'aal1'),
                 (${reviewerSessionId}::uuid,${INVITED_ACCOUNT_ID}::uuid,now(),now(),'aal1')
        `.execute(tx);
        await tx.insertInto("identity.accounts").values({ account_id: adminId, email: null }).execute();
        await tx.insertInto("identity.accounts").values({ account_id: contributorId, email: null }).execute();
        await tx.insertInto("identity.role_assignments").values({
          account_id: contributorId, role_key: "member", reason: "Independent contributor fixture",
          correlation_id: randomUUID(), idempotency_key: randomUUID(),
        }).execute();
        await tx.insertInto("identity.role_assignments").values({
          account_id: adminId,
          role_key: "administrator",
          reason: "Disposable authorized HTTP test actor",
          correlation_id: randomUUID(),
          idempotency_key: randomUUID(),
        }).execute();

        const invite = await app.inject({
          method: "POST",
          url: "/api/v2/staff/invitations",
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { email: "reviewer@example.test" },
        });
        expect(invite.statusCode).toBe(201);
        expect(invite.json()).toMatchObject({ email: "reviewer@example.test", status: "pending" });
        const repeatedInvite = await app.inject({
          method: "POST",
          url: "/api/v2/staff/invitations",
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { email: "reviewer@example.test" },
        });
        expect(repeatedInvite.statusCode).toBe(409);

        const unverified = await app.inject({
          method: "POST",
          url: "/api/v2/me/staff-invitation/accept",
          headers: { authorization: `Bearer ${reviewerToken}` },
        });
        expect(unverified.statusCode).toBe(403);
        await sql`update auth.users set email_confirmed_at=now() where id=${INVITED_ACCOUNT_ID}::uuid`.execute(tx);

        const stale = await app.inject({
          method: "POST",
          url: "/api/v2/me/staff-invitation/accept",
          headers: { authorization: `Bearer ${staleReviewerToken}` },
        });
        expect(stale.statusCode).toBe(403);
        const accepted = await app.inject({
          method: "POST",
          url: "/api/v2/me/staff-invitation/accept",
          headers: { authorization: `Bearer ${reviewerToken}` },
        });
        expect(accepted.statusCode).toBe(201);
        expect(accepted.json()).toMatchObject({ accountId: INVITED_ACCOUNT_ID, status: "accepted" });

        const reviewerHeaders = { authorization: `Bearer ${reviewerToken}` };
        const me = await app.inject({ method: "GET", url: "/api/v2/me", headers: reviewerHeaders });
        expect(me.statusCode).toBe(200);
        const currentCapabilities = me.json<{ capabilities: string[] }>().capabilities;
        expect(currentCapabilities).toContain("review.case.read");
        expect(currentCapabilities).not.toContain("identity.role.manage");
        expect(currentCapabilities).not.toContain("publication.release.activate");
        const reviewQueue = await app.inject({
          method: "GET", url: "/api/v2/review/cases?limit=1", headers: reviewerHeaders,
        });
        expect(reviewQueue.statusCode).toBe(200);
        const suffix = randomUUID();
        const sourceId = `iam06:${suffix}`;
        const sourceUrl = `https://example.test/iam06/${suffix}`;
        const evidence = app.get<EvidencePort>(EVIDENCE_PORT);
        const pandas = app.get<PandaPort>(PANDA_PORT);
        await evidence.createSource({
          sourceId, publisher: "IAM-06 test", title: "Reviewer evidence",
          url: sourceUrl, publishedOn: "2026-10-08", lastVerifiedOn: "2026-10-08",
          languageTag: "en", accessState: "accessible", evidenceTier: "institutional",
        });
        const panda = await pandas.createPanda({
          canonicalSlug: `iam06-${suffix}`,
          primaryName: { languageTag: "en", value: `IAM-06 Panda ${suffix}`, sourceIds: [sourceId] },
        });
        const contribution = await app.inject({
          method: "POST", url: "/api/v2/contributions", headers: { authorization: `Bearer ${contributorToken}` },
          payload: {
            submissionType: "correction", targetPandaId: panda.pandaId,
            publicVersionSeen: "iam06-test", assertions: [{
              assertionKey: "sex-correction", fieldKey: "profile.sex", value: "female",
              certainty: "confirmed", lastVerifiedOn: "2026-10-08", sourceKeys: ["source"],
            }], sources: [{ sourceKey: "source", sourceKind: "url", title: "Review source", locator: sourceUrl }],
          },
        });
        expect(contribution.statusCode, contribution.body).toBe(201);
        const submissionId = contribution.json<{ submissionId: string }>().submissionId;
        const opened = await app.inject({
          method: "POST", url: "/api/v2/review/cases", headers: reviewerHeaders,
          payload: { submissionId },
        });
        expect(opened.statusCode, opened.body).toBe(201);
        const reviewCaseId = opened.json<{ reviewCaseId: string }>().reviewCaseId;
        const claimed = await app.inject({
          method: "POST", url: `/api/v2/review/cases/${reviewCaseId}/claim`, headers: reviewerHeaders,
        });
        expect(claimed.statusCode, claimed.body).toBe(200);
        expect(claimed.json()).toMatchObject({ reviewCaseId, primaryAssigneeId: INVITED_ACCOUNT_ID });
        const publicationQueue = await app.inject({
          method: "GET", url: "/api/v2/publication/releases", headers: reviewerHeaders,
        });
        expect(publicationQueue.statusCode).toBe(403);
        const forbiddenInvite = await app.inject({
          method: "POST", url: "/api/v2/staff/invitations",
          headers: reviewerHeaders, payload: { email: "another@example.test" },
        });
        expect(forbiddenInvite.statusCode).toBe(403);

        const replay = await app.inject({
          method: "POST", url: "/api/v2/me/staff-invitation/accept", headers: reviewerHeaders,
        });
        expect(replay.statusCode).toBe(201);

        const adminHeaders = { authorization: `Bearer ${adminToken}` };
        const staffUrl = `/api/v2/staff/accounts/${INVITED_ACCOUNT_ID}`;
        const reviewUrl = "/api/v2/review/cases?limit=1";
        const readWithStaleAuth = await app.inject({
          method: "GET", url: staffUrl, headers: { authorization: `Bearer ${staleAdminToken}` },
        });
        expect(readWithStaleAuth.statusCode).toBe(200);
        const staleMutation = await app.inject({
          method: "POST", url: `${staffUrl}/roles`, headers: { authorization: `Bearer ${staleAdminToken}` },
          payload: { roleKey: "audit_reader", reason: "Temporary evidence review", idempotencyKey: randomUUID() },
        });
        expect(staleMutation.statusCode).toBe(403);
        expect(staleMutation.json()).toMatchObject({ code: "auth.recentAuthRequired" });

        const granted = await app.inject({
          method: "POST", url: `${staffUrl}/roles`, headers: adminHeaders,
          payload: { roleKey: "audit_reader", reason: "Temporary evidence review", idempotencyKey: randomUUID() },
        });
        expect(granted.statusCode, granted.body).toBe(201);
        const assignmentId = granted.json<{ assignmentId: string }>().assignmentId;
        expect((await app.inject({ method: "GET", url: "/api/v2/me", headers: reviewerHeaders }))
          .json<{ capabilities: string[] }>().capabilities).toContain("audit.read");

        const revoked = await app.inject({
          method: "POST", url: `${staffUrl}/roles/${assignmentId}/revoke`, headers: adminHeaders,
          payload: { reason: "Temporary evidence review completed", idempotencyKey: randomUUID() },
        });
        expect(revoked.statusCode, revoked.body).toBe(201);
        expect((await app.inject({ method: "GET", url: "/api/v2/me", headers: reviewerHeaders }))
          .json<{ capabilities: string[] }>().capabilities).not.toContain("audit.read");

        const suspended = await app.inject({
          method: "POST", url: `${staffUrl}/state`, headers: adminHeaders,
          payload: { action: "suspend", reason: "IAM-06 cross-slice access exercise", idempotencyKey: randomUUID() },
        });
        expect(suspended.statusCode, suspended.body).toBe(201);
        expect((await app.inject({ method: "GET", url: reviewUrl, headers: reviewerHeaders })).statusCode).toBe(403);
        expect((await app.inject({ method: "GET", url: "/api/v2/publication/releases", headers: reviewerHeaders })).statusCode).toBe(403);
        const reinstated = await app.inject({
          method: "POST", url: `${staffUrl}/state`, headers: adminHeaders,
          payload: { action: "reinstate", reason: "IAM-06 exercise completed", idempotencyKey: randomUUID() },
        });
        expect(reinstated.statusCode, reinstated.body).toBe(201);
        expect((await app.inject({ method: "GET", url: reviewUrl, headers: reviewerHeaders })).statusCode).toBe(200);
        const restoredCaps = (await app.inject({ method: "GET", url: "/api/v2/me", headers: reviewerHeaders }))
          .json<{ capabilities: string[] }>().capabilities;
        expect(restoredCaps).toContain("review.case.read");
        expect(restoredCaps).not.toContain("audit.read");
        expect(restoredCaps).not.toContain("publication.release.activate");

        const states = await tx.selectFrom("identity.account_state_events")
          .select(["next_state", "correlation_id"]).where("account_id", "=", INVITED_ACCOUNT_ID).execute();
        expect(states.map((event) => event.next_state).sort()).toEqual(["active", "suspended"]);
        const stateAudits = await tx.selectFrom("identity.authorization_audit_events")
          .select(["event_type", "correlation_id"])
          .where("subject_account_id", "=", INVITED_ACCOUNT_ID)
          .where("event_type", "in", ["identity.account-suspended", "identity.account-reinstated"]).execute();
        const stateOutbox = await sql<{ event_type: string; correlation_id: string }>`
          select event_type, correlation_id from integration.outbox_events
          where aggregate_id=${INVITED_ACCOUNT_ID}
            and event_type in ('identity.account-suspended','identity.account-reinstated')
        `.execute(tx);
        expect(stateAudits.map((entry) => entry.event_type).sort())
          .toEqual(["identity.account-reinstated", "identity.account-suspended"]);
        expect(stateOutbox.rows.map((entry) => entry.event_type).sort())
          .toEqual(["identity.account-reinstated", "identity.account-suspended"]);
        expect(new Set(states.map((entry) => entry.correlation_id)))
          .toEqual(new Set(stateAudits.map((entry) => entry.correlation_id)));
        expect(new Set(states.map((entry) => entry.correlation_id)))
          .toEqual(new Set(stateOutbox.rows.map((entry) => entry.correlation_id)));
        const grants = await tx.selectFrom("identity.role_assignments")
          .select(["role_key"]).where("account_id", "=", INVITED_ACCOUNT_ID).execute();
        // Revocations are append-only; the historical audit_reader grant stays visible.
        expect(grants.map((grant) => grant.role_key).sort()).toEqual(["audit_reader", "member", "reviewer"]);
        const audits = await tx.selectFrom("identity.authorization_audit_events")
          .select(["outcome"]).where("subject_account_id", "=", INVITED_ACCOUNT_ID).execute();
        expect(audits.filter((entry) => entry.outcome === "assigned")).toHaveLength(3);

        if (!committedEvidence) throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      Reflect.deleteProperty(database, "db");
      Reflect.set(database, "transaction", originalTransaction);
    }
    if (committedEvidence) {
      // A separate, post-COMMIT connection must observe the same events.
      // This runs only against disposable Supabase in GitHub Actions.
      const confirmed = await database.db.selectFrom("identity.account_state_events")
        .select(["next_state", "correlation_id"]).where("account_id", "=", INVITED_ACCOUNT_ID).execute();
      expect(confirmed.map((entry) => entry.next_state).sort()).toEqual(["active", "suspended"]);
      const independentAudit = await database.db.selectFrom("identity.authorization_audit_events")
        .select("correlation_id").where("subject_account_id", "=", INVITED_ACCOUNT_ID)
        .where("event_type", "in", ["identity.account-suspended", "identity.account-reinstated"]).execute();
      expect(new Set(independentAudit.map((entry) => entry.correlation_id)))
        .toEqual(new Set(confirmed.map((entry) => entry.correlation_id)));
      const independentOutbox = await sql<{ correlation_id: string }>`
        select correlation_id from integration.outbox_events where aggregate_id=${INVITED_ACCOUNT_ID}
          and event_type in ('identity.account-suspended','identity.account-reinstated')
      `.execute(database.db);
      expect(new Set(independentOutbox.rows.map((entry) => entry.correlation_id)))
        .toEqual(new Set(confirmed.map((entry) => entry.correlation_id)));
      const independentCase = await database.db.selectFrom("review_moderation.review_cases")
        .select("review_case_id").where("primary_assignee_id", "=", INVITED_ACCOUNT_ID).execute();
      expect(independentCase).toHaveLength(1);
      const finalAccount = await database.db.selectFrom("identity.accounts")
        .select("state").where("account_id", "=", INVITED_ACCOUNT_ID).executeTakeFirstOrThrow();
      expect(finalAccount.state).toBe("active");
      console.log("IAM-06 committed evidence: 2 account state events, 2 correlated audit events, 2 correlated Outbox events, an assigned Review case, and restored active status verified after COMMIT");
    }
  });
});
