import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { describe, expect, it, vi } from "vitest";
import { AppleAuthorizationCodeInvalidError } from "../src/modules/identity/application/apple-token-revocation.port.js";
import {
  type AppleRevocationTokenStore,
  AppleTokenRevocationService,
  buildAppleClientSecret,
  decryptAppleRefreshToken,
  encryptAppleRefreshToken,
} from "../src/modules/identity/infrastructure/apple-token-revocation.service.js";
import type { AppleRevocationConfig } from "../src/platform/config/app-config.js";

function createFakeTokenStore(initial = new Map<string, string>()): {
  rows: Map<string, string>;
  store: AppleRevocationTokenStore;
} {
  const rows = new Map(initial);
  const store: AppleRevocationTokenStore = {
    upsert: (accountId, ciphertext) => {
      rows.set(accountId, ciphertext);
      return Promise.resolve();
    },
    findCiphertext: (accountId) => Promise.resolve(rows.get(accountId)),
    remove: (accountId) => {
      rows.delete(accountId);
      return Promise.resolve();
    },
  };
  return { rows, store };
}

async function createAppleConfig(): Promise<AppleRevocationConfig & { publicKey: CryptoKey }> {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  return {
    clientId: "com.zhipanda.app",
    teamId: "TEAM123456",
    keyId: "KEY123456",
    privateKey: await exportPKCS8(privateKey),
    encryptionKey: new Uint8Array(32).fill(9),
    tokenEndpoint: "https://appleid.apple.com/auth/token",
    revokeEndpoint: "https://appleid.apple.com/auth/revoke",
    publicKey,
  };
}

function bodySearchParams(call: Parameters<typeof fetch>[1] | undefined): URLSearchParams {
  return new URLSearchParams(typeof call?.body === "string" ? call.body : "");
}

describe("Apple token revocation", () => {
  it("encrypts refresh tokens per account with AES-256-GCM AAD binding", async () => {
    const key = new Uint8Array(32).fill(5);
    const ciphertext = await encryptAppleRefreshToken("apple-refresh-secret", "account-1", key);

    expect(ciphertext.startsWith("v1.")).toBe(true);
    expect(ciphertext).not.toContain("apple-refresh-secret");
    await expect(decryptAppleRefreshToken(ciphertext, "account-1", key)).resolves.toBe("apple-refresh-secret");
    await expect(decryptAppleRefreshToken(ciphertext, "account-2", key)).rejects.toThrow();
  });

  it("signs an ES256 client_secret verifiable by Apple's audience and claims", async () => {
    const apple = await createAppleConfig();
    const jwt = await buildAppleClientSecret(apple);
    const verified = await jwtVerify(jwt, apple.publicKey, {
      issuer: apple.teamId,
      audience: "https://appleid.apple.com",
      subject: apple.clientId,
    });
    expect(verified.protectedHeader.kid).toBe(apple.keyId);
    expect(verified.protectedHeader.alg).toBe("ES256");
  });

  it("returns stored=false without network calls when Apple revocation is unconfigured", async () => {
    const fetchSpy = vi.fn();
    const { rows, store } = createFakeTokenStore();
    const service = new AppleTokenRevocationService({ appleRevocation: undefined }, store, fetchSpy);

    await expect(service.storeFromAuthorizationCode("acc-1", "auth-code")).resolves.toEqual({ stored: false });
    await expect(service.revokeIfPresent("acc-1")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it("exchanges authorization code, stores ciphertext, and revokes before deleting row", async () => {
    const apple = await createAppleConfig();
    const { rows, store } = createFakeTokenStore();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ refresh_token: "rt-123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const service = new AppleTokenRevocationService({ appleRevocation: apple }, store, fetchMock);

    await expect(service.storeFromAuthorizationCode("acc-1", "code-xyz")).resolves.toEqual({ stored: true });
    expect(rows.has("acc-1")).toBe(true);
    expect(rows.get("acc-1")).not.toContain("rt-123");

    const tokenCallBody = bodySearchParams(fetchMock.mock.calls[0]![1]);
    expect(fetchMock.mock.calls[0]![0]).toBe(apple.tokenEndpoint);
    expect(tokenCallBody.get("grant_type")).toBe("authorization_code");
    expect(tokenCallBody.get("code")).toBe("code-xyz");
    expect(tokenCallBody.get("client_id")).toBe("com.zhipanda.app");

    await expect(service.revokeIfPresent("acc-1")).resolves.toBeUndefined();
    const revokeCallBody = bodySearchParams(fetchMock.mock.calls[1]![1]);
    expect(fetchMock.mock.calls[1]![0]).toBe(apple.revokeEndpoint);
    expect(revokeCallBody.get("token")).toBe("rt-123");
    expect(revokeCallBody.get("token_type_hint")).toBe("refresh_token");
    expect(rows.has("acc-1")).toBe(false);
  });

  it("maps Apple HTTP 400 invalid_grant to AppleAuthorizationCodeInvalidError and keeps invalid_client as server error", async () => {
    const apple = await createAppleConfig();
    const { store } = createFakeTokenStore();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"error":"invalid_grant"}', { status: 400 }))
      .mockResolvedValueOnce(new Response('{"error":"invalid_client"}', { status: 400 }));
    const service = new AppleTokenRevocationService({ appleRevocation: apple }, store, fetchMock);

    await expect(service.storeFromAuthorizationCode("acc-1", "bad-code")).rejects.toBeInstanceOf(
      AppleAuthorizationCodeInvalidError,
    );
    await expect(service.storeFromAuthorizationCode("acc-1", "valid-code")).rejects.toThrow(
      "Apple token exchange rejected server credentials (invalid_client)",
    );
  });

  it("retains encrypted row if Apple revoke fails and fails closed if unconfigured", async () => {
    const apple = await createAppleConfig();
    const ciphertext = await encryptAppleRefreshToken("rt-keep", "acc-2", apple.encryptionKey);
    const { rows, store } = createFakeTokenStore(new Map([["acc-2", ciphertext]]));
    const failingFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("upstream error", { status: 502 }));

    const configuredService = new AppleTokenRevocationService({ appleRevocation: apple }, store, failingFetch);
    await expect(configuredService.revokeIfPresent("acc-2")).rejects.toThrow("Apple token revocation failed with HTTP 502");
    expect(rows.has("acc-2")).toBe(true);

    const unconfiguredService = new AppleTokenRevocationService({ appleRevocation: undefined }, store, failingFetch);
    await expect(unconfiguredService.revokeIfPresent("acc-2")).rejects.toThrow("Apple token revocation is not configured");
  });
});
