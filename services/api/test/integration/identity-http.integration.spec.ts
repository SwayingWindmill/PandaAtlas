import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { sql } from "kysely";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ACCOUNT_ID = "55555555-5555-4555-8555-555555555555";
const SESSION_ID = "66666666-6666-4666-8666-666666666666";

let app: NestFastifyApplication;
let jwksServer: Server;
let token: string;

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
      capabilities: ["account.session.read"],
    });
    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({
      accountId: ACCOUNT_ID,
      aal: "aal1",
      capabilities: ["account.session.read"],
    });
  });
});
