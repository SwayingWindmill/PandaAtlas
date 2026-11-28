import { importPKCS8, SignJWT } from "jose";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { AppConfig, AppleRevocationConfig } from "../../../platform/config/app-config.js";
import {
  AppleAuthorizationCodeInvalidError,
  type AppleTokenRevocationPort,
} from "../application/apple-token-revocation.port.js";

const APPLE_REQUEST_TIMEOUT_MS = 10_000;
const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;

export interface AppleRevocationTokenStore {
  upsert(accountId: string, ciphertext: string, updatedAt: Date): Promise<void>;
  findCiphertext(accountId: string): Promise<string | undefined>;
  remove(accountId: string): Promise<void>;
}

export class PostgresAppleRevocationTokenStore implements AppleRevocationTokenStore {
  public constructor(private readonly database: DatabaseService) {}

  public async upsert(accountId: string, ciphertext: string, updatedAt: Date): Promise<void> {
    await this.database.db
      .insertInto("identity.apple_revocation_tokens")
      .values({
        account_id: accountId,
        refresh_token_ciphertext: ciphertext,
        updated_at: updatedAt,
      })
      .onConflict((conflict) =>
        conflict.column("account_id").doUpdateSet({
          refresh_token_ciphertext: ciphertext,
          updated_at: updatedAt,
        }),
      )
      .execute();
  }

  public async findCiphertext(accountId: string): Promise<string | undefined> {
    const stored = await this.database.db
      .selectFrom("identity.apple_revocation_tokens")
      .select("refresh_token_ciphertext")
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    return stored?.refresh_token_ciphertext;
  }

  public async remove(accountId: string): Promise<void> {
    await this.database.db
      .deleteFrom("identity.apple_revocation_tokens")
      .where("account_id", "=", accountId)
      .execute();
  }
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(encoded: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(encoded, "base64url"));
}

export async function encryptAppleRefreshToken(
  token: string,
  accountId: string,
  keyBytes: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await globalThis.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const encoded = new TextEncoder().encode(token);
  const additionalData = new TextEncoder().encode(accountId);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    encoded,
  );
  return `${ENVELOPE_VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptAppleRefreshToken(
  ciphertextEnvelope: string,
  accountId: string,
  keyBytes: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const parts = ciphertextEnvelope.split(".");
  if (parts.length !== 3 || parts[0] !== ENVELOPE_VERSION) {
    throw new Error("Unsupported Apple token ciphertext envelope");
  }
  const iv = fromBase64Url(parts[1]!);
  const ciphertext = fromBase64Url(parts[2]!);
  if (iv.length !== IV_BYTES) {
    throw new Error("Invalid Apple token IV length");
  }
  const key = await globalThis.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const additionalData = new TextEncoder().encode(accountId);
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

export async function buildAppleClientSecret(
  appleConfig: Pick<AppleRevocationConfig, "clientId" | "teamId" | "keyId" | "privateKey">,
): Promise<string> {
  const privateKey = await importPKCS8(appleConfig.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: appleConfig.keyId })
    .setIssuer(appleConfig.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience("https://appleid.apple.com")
    .setSubject(appleConfig.clientId)
    .sign(privateKey);
}

export class AppleTokenRevocationService implements AppleTokenRevocationPort {
  public constructor(
    private readonly config: Pick<AppConfig, "appleRevocation">,
    private readonly store: AppleRevocationTokenStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  public async storeFromAuthorizationCode(
    accountId: string,
    authorizationCode: string,
  ): Promise<{ stored: boolean }> {
    const apple = this.config.appleRevocation;
    if (apple === undefined) {
      return { stored: false };
    }

    const clientSecret = await buildAppleClientSecret(apple);
    const body = new URLSearchParams({
      client_id: apple.clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
    });

    const response = await this.fetchImpl(apple.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(APPLE_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new AppleAuthorizationCodeInvalidError("Apple rejected the authorization code");
      }
      throw new Error(`Apple token exchange failed with HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    const refreshToken =
      typeof payload === "object" && payload !== null && "refresh_token" in payload
        ? payload.refresh_token
        : undefined;
    if (typeof refreshToken !== "string" || refreshToken.trim() === "") {
      throw new Error("Apple token response omitted refresh_token");
    }

    const ciphertext = await encryptAppleRefreshToken(refreshToken, accountId, apple.encryptionKey);
    await this.store.upsert(accountId, ciphertext, new Date());

    return { stored: true };
  }

  public async revokeIfPresent(accountId: string): Promise<void> {
    const storedCiphertext = await this.store.findCiphertext(accountId);
    if (storedCiphertext === undefined) {
      return;
    }

    const apple = this.config.appleRevocation;
    if (apple === undefined) {
      throw new Error("Apple token revocation is not configured");
    }

    const refreshToken = await decryptAppleRefreshToken(storedCiphertext, accountId, apple.encryptionKey);
    const clientSecret = await buildAppleClientSecret(apple);
    const body = new URLSearchParams({
      client_id: apple.clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: "refresh_token",
    });

    const response = await this.fetchImpl(apple.revokeEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(APPLE_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Apple token revocation failed with HTTP ${response.status}`);
    }

    await this.store.remove(accountId);
  }
}
