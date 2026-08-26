import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppConfig } from "../src/platform/config/app-config.js";
import {
  AuthUnavailableError,
  InvalidSupabaseTokenError,
  SupabaseJwtVerifier,
} from "../src/platform/auth/supabase-jwt.verifier.js";

const ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
let server: Server;
let issuer: string;
let privateKey: CryptoKey;
let verifier: SupabaseJwtVerifier;

async function signToken(
  overrides: Record<string, unknown> = {},
  tokenIssuer = issuer,
): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({
    role: "authenticated",
    aal: "aal2",
    session_id: SESSION_ID,
    is_anonymous: false,
    amr: [
      { method: "password", timestamp: now - 30 },
      { method: "token_refresh", timestamp: now },
    ],
    ...overrides,
  })
    .setProtectedHeader({ alg: "ES256", kid: "test-es256" })
    .setIssuer(tokenIssuer)
    .setAudience("authenticated")
    .setSubject(ACCOUNT_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("ES256");
  privateKey = keyPair.privateKey;
  const jwk = await exportJWK(keyPair.publicKey);
  Object.assign(jwk, { kid: "test-es256", alg: "ES256", use: "sig" });

  server = createServer((request, response) => {
    if (request.url === "/auth/v1/.well-known/jwks.json") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("JWKS test server did not bind a TCP port");
  }
  issuer = `http://127.0.0.1:${address.port}/auth/v1`;
  const config = {
    supabaseJwtIssuer: issuer,
    supabaseJwtAudience: "authenticated",
    supabaseJwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
    authJwksTimeoutMs: 1_000,
  } as AppConfig;
  verifier = new SupabaseJwtVerifier(config);
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );
});

describe("Supabase JWT verification", () => {
  it("verifies ES256 identity and derives recent auth from interactive AMR", async () => {
    const identity = await verifier.verify(await signToken());

    expect(identity).toMatchObject({
      accountId: ACCOUNT_ID,
      sessionId: SESSION_ID,
      aal: "aal2",
      authenticationMethod: "password",
    });
    expect(identity.authenticatedAt).toBeInstanceOf(Date);
    expect(Date.now() - identity.authenticatedAt!.getTime()).toBeGreaterThanOrEqual(25_000);
  });

  it("does not treat untrusted AMR methods as recent authentication", async () => {
    const identity = await verifier.verify(
      await signToken({ amr: [{ method: "unknown_future_method", timestamp: Math.floor(Date.now() / 1_000) }] }),
    );

    expect(identity.authenticatedAt).toBeUndefined();
    expect(identity.authenticationMethod).toBeUndefined();
  });

  it("classifies an unreachable JWKS endpoint as authentication unavailable", async () => {
    const offlineServer = createServer();
    await new Promise<void>((resolve) => offlineServer.listen(0, "127.0.0.1", resolve));
    const address = offlineServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("Offline JWKS probe did not bind a TCP port");
    }
    const unavailableIssuer = `http://127.0.0.1:${address.port}/auth/v1`;
    await new Promise<void>((resolve, reject) =>
      offlineServer.close((error) => (error === undefined ? resolve() : reject(error))),
    );
    const unavailableVerifier = new SupabaseJwtVerifier({
      supabaseJwtIssuer: unavailableIssuer,
      supabaseJwtAudience: "authenticated",
      supabaseJwksUrl: new URL(`${unavailableIssuer}/.well-known/jwks.json`),
      authJwksTimeoutMs: 200,
    } as AppConfig);

    await expect(
      unavailableVerifier.verify(await signToken({}, unavailableIssuer)),
    ).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it("rejects symmetric HS256 bearer tokens", async () => {
    const now = Math.floor(Date.now() / 1_000);
    const token = await new SignJWT({
      role: "authenticated",
      aal: "aal1",
      session_id: SESSION_ID,
      is_anonymous: false,
    })
      .setProtectedHeader({ alg: "HS256", kid: "legacy-secret" })
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setSubject(ACCOUNT_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(new TextEncoder().encode("not-a-production-secret-but-long-enough-for-a-test"));

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(InvalidSupabaseTokenError);
  });
});
