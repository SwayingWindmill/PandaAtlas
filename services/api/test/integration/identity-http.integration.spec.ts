import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { sql } from "kysely";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import type { DatabaseTransaction } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ACCOUNT_ID = "55555555-5555-4555-8555-555555555555";
const SESSION_ID = "66666666-6666-4666-8666-666666666666";

let app: NestFastifyApplication;
let jwksServer: Server;
let token: string;
let signTestToken: (accountId: string, sessionId: string, aal: "aal1" | "aal2") => Promise<string>;
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

  signTestToken = (accountId, sessionId, aal) => {
    const timestamp = Math.floor(Date.now() / 1_000);
    return new SignJWT({
      role: "authenticated",
      aal,
      session_id: sessionId,
      is_anonymous: false,
      amr: [{ method: aal === "aal2" ? "totp" : "otp", timestamp: timestamp - 10 }],
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

  it("only activates reviewer authority after the invitee verifies their own Supabase identity", async () => {
    const database = app.get(DatabaseService);
    const originalTransaction = database.transaction.bind(database);
    const rollback = new Error("roll back disposable reviewer HTTP test fixtures");
    try {
      await database.db.transaction().execute(async (tx: DatabaseTransaction) => {
        // Isolate this end-to-end HTTP fixture in a single rollback-only transaction.
        Object.defineProperty(database, "db", { configurable: true, get: () => tx });
        Reflect.set(database, "transaction", <T>(work: (transaction: DatabaseTransaction) => Promise<T>) => work(tx));
        const adminId = randomUUID();
        const adminSessionId = randomUUID();
        const reviewerSessionId = randomUUID();
        const adminToken = await signTestToken(adminId, adminSessionId, "aal2");
        const reviewerToken = await signTestToken(INVITED_ACCOUNT_ID, reviewerSessionId, "aal1");

        await sql`
          insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at)
          values (${adminId}::uuid,'authenticated','authenticated','admin-test@example.test',now(),now(),now()),
                 (${INVITED_ACCOUNT_ID}::uuid,'authenticated','authenticated','reviewer@example.test',null,now(),now())
        `.execute(tx);
        await sql`
          insert into auth.sessions (id,user_id,created_at,updated_at,aal)
          values (${adminSessionId}::uuid,${adminId}::uuid,now(),now(),'aal2'),
                 (${reviewerSessionId}::uuid,${INVITED_ACCOUNT_ID}::uuid,now(),now(),'aal1')
        `.execute(tx);
        await tx.insertInto("identity.accounts").values({ account_id: adminId, email: null }).execute();
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
        const grants = await tx.selectFrom("identity.role_assignments")
          .select(["role_key"]).where("account_id", "=", INVITED_ACCOUNT_ID).execute();
        expect(grants.map((grant) => grant.role_key).sort()).toEqual(["member", "reviewer"]);
        const audits = await tx.selectFrom("identity.authorization_audit_events")
          .select(["outcome"]).where("subject_account_id", "=", INVITED_ACCOUNT_ID).execute();
        expect(audits.filter((entry) => entry.outcome === "assigned")).toHaveLength(2);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      Reflect.deleteProperty(database, "db");
      Reflect.set(database, "transaction", originalTransaction);
    }
  });
});
