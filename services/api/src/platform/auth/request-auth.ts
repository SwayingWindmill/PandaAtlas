import type { FastifyRequest } from "fastify";
import type { VerifiedSupabaseIdentity } from "./auth.types.js";

const VERIFIED_IDENTITY = Symbol("verified-supabase-identity");

export type AuthenticatedRequest = FastifyRequest & {
  [VERIFIED_IDENTITY]?: VerifiedSupabaseIdentity;
};

export function setVerifiedIdentity(
  request: FastifyRequest,
  identity: VerifiedSupabaseIdentity,
): void {
  (request as AuthenticatedRequest)[VERIFIED_IDENTITY] = identity;
}

export function getVerifiedIdentity(request: FastifyRequest): VerifiedSupabaseIdentity | undefined {
  return (request as AuthenticatedRequest)[VERIFIED_IDENTITY];
}
