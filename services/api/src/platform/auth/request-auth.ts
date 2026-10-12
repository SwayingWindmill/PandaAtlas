import type { IncomingMessage as HttpRequest } from "node:http";
import type { VerifiedSupabaseIdentity } from "./auth.types.js";

const VERIFIED_IDENTITY = Symbol("verified-supabase-identity");

export type AuthenticatedRequest = HttpRequest & {
  [VERIFIED_IDENTITY]?: VerifiedSupabaseIdentity;
};

export function setVerifiedIdentity(
  request: HttpRequest,
  identity: VerifiedSupabaseIdentity,
): void {
  (request as AuthenticatedRequest)[VERIFIED_IDENTITY] = identity;
}

export function getVerifiedIdentity(request: HttpRequest): VerifiedSupabaseIdentity | undefined {
  return (request as AuthenticatedRequest)[VERIFIED_IDENTITY];
}
