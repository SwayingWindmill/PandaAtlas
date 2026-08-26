export type AssuranceLevel = "aal1" | "aal2";

export interface CapabilityPolicy {
  key: string;
  requiresRecentAuth: boolean;
  minimumAal: AssuranceLevel;
  requiresLiveSession: boolean;
}

export interface AuthorizationSnapshot {
  accountId: string;
  accountState: "active" | "suspended" | "deleting" | "deleted";
  capabilities: ReadonlyMap<string, CapabilityPolicy>;
}

export interface ActorContext {
  accountId: string;
  sessionId: string;
  aal: AssuranceLevel;
  authenticatedAt: Date | undefined;
  authenticationMethod: string | undefined;
  capabilities: ReadonlySet<string>;
}
