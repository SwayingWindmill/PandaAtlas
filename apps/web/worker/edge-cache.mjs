// Response caching policy for Workers Cache (https://developers.cloudflare.com/workers/cache/).
// Public pages render identically for every visitor, so successful renders are cached at the edge
// and served without running the Worker. Every other response is explicitly uncacheable, so
// Cloudflare's heuristic freshness never caches a redirect, error or private response.
const PUBLIC_PAGE = /^\/(?:zh|en)(?:\/(?:pandas|families|moments|map|places|games)(?:\/[^/]+)*)?$/u;
const PUBLIC_FILES = new Set(["/robots.txt", "/sitemap.xml"]);
const PAGE_CONTENT = /^text\/(?:html|x-component)\b/u;

// Edge-only freshness; the Worker version is part of the cache key, so each deploy starts cold.
export const PUBLIC_EDGE_CACHE_CONTROL = "public, max-age=600, stale-while-revalidate=86400";
const BROWSER_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const UNCACHEABLE = "private, no-store";

function isPublicResponse(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.has("Authorization") || response.status !== 200 || response.headers.has("Set-Cookie")) return false;
  const { pathname } = new URL(request.url);
  if (PUBLIC_FILES.has(pathname)) return true;
  return PUBLIC_PAGE.test(pathname) && PAGE_CONTENT.test(response.headers.get("Content-Type") ?? "");
}

export function withEdgeCachePolicy(request, response) {
  const cacheable = isPublicResponse(request, response);
  if (!cacheable && response.headers.has("Cache-Control")) return response;
  const headers = new Headers(response.headers);
  if (cacheable) {
    headers.set("Cache-Control", BROWSER_CACHE_CONTROL);
    headers.set("Cloudflare-CDN-Cache-Control", PUBLIC_EDGE_CACHE_CONTROL);
  } else {
    headers.set("Cache-Control", UNCACHEABLE);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
