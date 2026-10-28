// Response caching policy for Workers Cache (https://developers.cloudflare.com/workers/cache/).
// Public pages render identically for every visitor, so successful renders are cached at the edge
// and served without running the Worker. Every other response is explicitly uncacheable, so
// Cloudflare's heuristic freshness never caches a redirect, error or private response.
const PUBLIC_PAGE = /^\/(?:zh|en)(?:\/(?:pandas|families|moments|map|places|games)(?:\/[^/]+)*)?$/u;
const PUBLIC_FILES = new Set(["/sitemap.xml"]);
const PAGE_CONTENT = /^text\/(?:html|x-component)\b/u;

// Edge-only freshness. A delivery change purges this cache, so the TTL can be long;
// the Worker version is part of the cache key, so each deploy starts cold.
export const PUBLIC_EDGE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
const BROWSER_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const UNCACHEABLE = "private, no-store";

// Set by the uncached gateway after it has checked the API binding's purge props.
// PublicPages is not routed from the internet, so a client header cannot purge.
export const PUBLIC_CACHE_PURGE_HEADER = "x-zhipanda-cache-purge";

// Query parameters that never change a public page. They stay out of the cache key
// so a probe or a campaign link reuses the canonical render.
const IGNORABLE_QUERY_PARAM = /^(?:probe|utm_[a-z0-9_]+|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|twclid|ttclid|li_fat_id|igshid|mc_[a-z0-9_]+|yclid|gad_source|gad_campaignid|_ga|_gl|_gac|_gid)$/iu;
const CACHE_VARY_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url"];

export function isIgnorableQueryParam(name) {
  return IGNORABLE_QUERY_PARAM.test(name);
}

export function publicPageCacheKey(request) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (isIgnorableQueryParam(key)) params.delete(key);
  }
  params.sort();
  const search = params.toString();
  const parts = [`${url.pathname}${search ? `?${search}` : ""}`];
  for (const name of CACHE_VARY_HEADERS) {
    const value = request.headers.get(name);
    if (value) parts.push(`${name}=${value}`);
  }
  return parts.join(" ");
}

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

// The API purges after any delivery change, over a service binding whose ctx.props carry
// publicCachePurge. Only someone who can deploy the API can set those props, so internet requests
// can never reach this. The uncached gateway checks those props and forwards the purge to
// PublicPages, which owns the page cache.
export function isPublicCachePurge(context) {
  return context.props?.publicCachePurge === true;
}

export async function purgePublicCache(request, context) {
  if (request.method !== "POST" || new URL(request.url).pathname !== "/__public-cache/purge") {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": UNCACHEABLE } });
  }
  const result = await context.cache.purge({ purgeEverything: true });
  if (result.success) return new Response(null, { status: 204, headers: { "Cache-Control": UNCACHEABLE } });
  return Response.json({ errors: result.errors }, { status: 502, headers: { "Cache-Control": UNCACHEABLE } });
}
