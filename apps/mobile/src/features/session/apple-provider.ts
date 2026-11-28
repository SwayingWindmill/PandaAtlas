export type AuthProvider = "apple" | "email" | "other";

export interface AuthUserLike {
  app_metadata?: { provider?: unknown } | null;
  identities?: { provider?: unknown }[] | null;
}

export function resolveAuthProvider(user: AuthUserLike | null | undefined): AuthProvider {
  if (!user) return "other";
  if (
    user.app_metadata?.provider === "apple" ||
    user.identities?.some((identity) => identity.provider === "apple")
  ) {
    return "apple";
  }
  if (
    user.app_metadata?.provider === "email" ||
    user.identities?.some((identity) => identity.provider === "email")
  ) {
    return "email";
  }
  return "other";
}

export function isAppleCancelError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_REQUEST_CANCELED"
  );
}
