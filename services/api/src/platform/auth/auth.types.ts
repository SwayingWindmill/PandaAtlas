import type { AssuranceLevel } from "../request-context/request-context.service.js";

export interface VerifiedSupabaseIdentity {
  accountId: string;
  sessionId: string;
  aal: AssuranceLevel;
  issuedAt: Date;
  expiresAt: Date;
  authenticatedAt: Date | undefined;
  authenticationMethod: string | undefined;
}
