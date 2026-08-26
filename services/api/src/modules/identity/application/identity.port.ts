import type { AuthorizationSnapshot } from "./identity-access.types.js";

export const IDENTITY_PORT = Symbol("identity-port");

export interface FanProfile {
  accountId: string;
  nickname: string;
  bio: string;
}

export interface UpdateFanProfileInput {
  nickname: string;
  bio: string;
}

export interface IdentityPort {
  loadAuthorizationSnapshot(accountId: string): Promise<AuthorizationSnapshot | undefined>;
  isLiveSession(sessionId: string, accountId: string): Promise<boolean>;
  provisionAccount(accountId: string, correlationId: string): Promise<AuthorizationSnapshot>;
  getProfile(accountId: string): Promise<FanProfile>;
  replaceProfile(accountId: string, input: UpdateFanProfileInput): Promise<FanProfile>;
}
