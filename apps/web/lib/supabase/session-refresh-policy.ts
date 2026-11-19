const PRIVATE_LOCALIZED_PATH_PATTERN = /^\/(?:zh|en)\/(?:me|contribute)(?:\/|$)/u;

export function requiresSupabaseSessionRefresh(pathname: string): boolean {
  if (pathname === "/api/site-search") return false;
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    PRIVATE_LOCALIZED_PATH_PATTERN.test(pathname)
  );
}
