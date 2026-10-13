// The staff console and its API exist only where the admin shell is explicitly enabled; the
// production Web Worker fixes it off (cloudflare.config.ts).
export function isAdminShellEnabled(): boolean {
  const value = process.env.ADMIN_SHELL_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}

// Matches the path the router resolves: it decodes once and collapses repeated slashes, so the raw
// request path alone would let /%61dmin or /api//admin through.
export function isAdminPath(rawPathname: string): boolean {
  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    pathname = rawPathname;
  }
  pathname = pathname.replace(/\/{2,}/gu, "/");
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
}
