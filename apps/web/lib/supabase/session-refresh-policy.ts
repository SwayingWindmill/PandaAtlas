const PRIVATE_LOCALIZED_PATH_PATTERN = /^\/(?:zh|en)\/(?:me|contribute)(?:\/|$)/u;

export function requiresSupabaseSessionRefresh(pathname: string): boolean {
  const normalized = pathname.replace(/\/+/g, "/");
  if (normalized === "/api/site-search" || normalized === "/api/site-search/") return false;
  return (
    normalized === "/api" ||
    normalized.startsWith("/api/") ||
    normalized === "/auth" ||
    normalized.startsWith("/auth/") ||
    normalized === "/admin" ||
    normalized.startsWith("/admin/") ||
    PRIVATE_LOCALIZED_PATH_PATTERN.test(normalized)
  );
}
