import { Injectable } from "@nestjs/common";
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from "jose";
import { AppConfig } from "../config/app-config.js";
import type { AssuranceLevel } from "../request-context/request-context.service.js";
import type { VerifiedSupabaseIdentity } from "./auth.types.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ALGORITHMS = ["ES256", "RS256"] as const;
const TRUSTED_INTERACTIVE_METHODS = new Set([
  "oauth",
  "password",
  "otp",
  "totp",
  "recovery",
  "invite",
  "sso/saml",
  "magiclink",
  "email/signup",
  "oauth_provider/authorization_code",
]);

export class AuthUnavailableError extends Error {}
export class InvalidSupabaseTokenError extends Error {}

function unixDate(value: unknown, claim: string): Date {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidSupabaseTokenError(`JWT claim ${claim} is invalid`);
  }
  return new Date(value * 1_000);
}

function authenticationReference(payload: JWTPayload): {
  authenticatedAt: Date | undefined;
  authenticationMethod: string | undefined;
} {
  const entries: unknown[] = Array.isArray(payload.amr) ? (payload.amr as unknown[]) : [];
  if (entries.length === 0) {
    return { authenticatedAt: undefined, authenticationMethod: undefined };
  }

  let latest: { authenticatedAt: Date; authenticationMethod: string } | undefined;
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const method = "method" in entry ? entry.method : undefined;
    const timestamp = "timestamp" in entry ? entry.timestamp : undefined;
    if (typeof method !== "string" || !TRUSTED_INTERACTIVE_METHODS.has(method)) {
      continue;
    }
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
      continue;
    }
    const authenticatedAt = new Date(timestamp * 1_000);
    if (latest === undefined || authenticatedAt > latest.authenticatedAt) {
      latest = { authenticatedAt, authenticationMethod: method };
    }
  }

  return latest ?? { authenticatedAt: undefined, authenticationMethod: undefined };
}

@Injectable()
export class SupabaseJwtVerifier {
  private readonly issuer: string | undefined;
  private readonly audience: string;
  private readonly jwks:
    | ReturnType<typeof createRemoteJWKSet>
    | undefined;

  public constructor(config: AppConfig) {
    this.issuer = config.supabaseJwtIssuer;
    this.audience = config.supabaseJwtAudience;
    const jwksUrl = config.supabaseJwksUrl;
    this.jwks =
      jwksUrl === undefined
        ? undefined
        : createRemoteJWKSet(jwksUrl, {
            timeoutDuration: config.authJwksTimeoutMs,
            cooldownDuration: 30_000,
            cacheMaxAge: 600_000,
          });
  }

  public async verify(token: string): Promise<VerifiedSupabaseIdentity> {
    if (this.issuer === undefined || this.jwks === undefined) {
      throw new AuthUnavailableError("Supabase authentication is not configured");
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: [...ALLOWED_ALGORITHMS],
        clockTolerance: 30,
      }));
    } catch (error) {
      if (error instanceof errors.JWKSTimeout || error instanceof TypeError) {
        throw new AuthUnavailableError("Supabase signing keys are unavailable");
      }
      throw new InvalidSupabaseTokenError("Bearer token could not be verified");
    }

    if (payload.role !== "authenticated" || payload.is_anonymous !== false) {
      throw new InvalidSupabaseTokenError("Bearer token is not an authenticated user session");
    }
    if (typeof payload.sub !== "string" || !UUID_PATTERN.test(payload.sub)) {
      throw new InvalidSupabaseTokenError("JWT subject must be a UUID");
    }
    const sessionId = payload.session_id;
    if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
      throw new InvalidSupabaseTokenError("JWT session_id must be a UUID");
    }
    if (payload.aal !== "aal1" && payload.aal !== "aal2") {
      throw new InvalidSupabaseTokenError("JWT aal claim is invalid");
    }

    const issuedAt = unixDate(payload.iat, "iat");
    const expiresAt = unixDate(payload.exp, "exp");
    if (issuedAt.getTime() > Date.now() + 60_000) {
      throw new InvalidSupabaseTokenError("JWT iat claim is in the future");
    }

    const reference = authenticationReference(payload);
    return {
      accountId: payload.sub,
      sessionId,
      aal: payload.aal as AssuranceLevel,
      issuedAt,
      expiresAt,
      authenticatedAt: reference.authenticatedAt,
      authenticationMethod: reference.authenticationMethod,
    };
  }
}
