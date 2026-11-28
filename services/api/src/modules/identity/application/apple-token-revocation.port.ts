export class AppleAuthorizationCodeInvalidError extends Error {}

export interface AppleTokenRevocationPort {
  storeFromAuthorizationCode(accountId: string, authorizationCode: string): Promise<{ stored: boolean }>;
  revokeIfPresent(accountId: string): Promise<void>;
}

export const APPLE_TOKEN_REVOCATION_PORT = Symbol("APPLE_TOKEN_REVOCATION_PORT");
