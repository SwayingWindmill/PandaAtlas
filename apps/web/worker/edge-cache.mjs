// Response caching policy for Workers Cache (https://developers.cloudflare.com/workers/cache/).
// Public pages render identically for every visitor, so successful renders are cached at the edge
// and served without running the Worker. A genuine not-found for one of those pages is cached
// briefly too, so a guessed slug does not re-render. Every other response is explicitly
// uncacheable, so Cloudflare's heuristic freshness never caches a redirect, error or private response.
const PUBLIC_PAGE = /^\/(?:zh|en)(?:\/(?:pandas|families|moments|map|places|games)(?:\/[^/]+)*)?$/u;
const PUBLIC_FILES = new Set(["/sitemap.xml"]);
const PAGE_CONTENT = /^text\/(?:html|x-component)\b/u;

// Edge-only freshness. A delivery change purges this cache, so the TTL can be long;
// the Worker version is part of the cache key, so each deploy starts cold.
export const PUBLIC_EDGE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
// Ten minutes, with no stale-while-revalidate: long enough that a crawler repeating one
// guessed slug does not re-query, and short enough that a newly published page appears
// on its own once this window ends. A delivery-change purge deletes the entry sooner.
export const PUBLIC_NOT_FOUND_EDGE_CACHE_CONTROL = "public, max-age=600";
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

function isAnonymousRead(request, response) {
  return (request.method === "GET" || request.method === "HEAD")
    && !request.headers.has("Authorization")
    && !response.headers.has("Set-Cookie");
}

function isPublicPageDocument(request, response) {
  const { pathname } = new URL(request.url);
  return PUBLIC_PAGE.test(pathname) && PAGE_CONTENT.test(response.headers.get("Content-Type") ?? "");
}

// "public" is a successful render. "not-found" is a genuine 404 for a public page document.
// Errors, other statuses, private routes and personalized responses are "uncacheable".
function cacheDisposition(request, response) {
  if (!isAnonymousRead(request, response)) return "uncacheable";
  const { pathname } = new URL(request.url);
  if (response.status === 200 && (PUBLIC_FILES.has(pathname) || isPublicPageDocument(request, response))) return "public";
  if (response.status === 404 && isPublicPageDocument(request, response)) return "not-found";
  return "uncacheable";
}

export function withEdgeCachePolicy(request, response) {
  // A 5xx must not keep a public cache header. Workers Cache stores a response that
  // explicitly opts in, including statuses it would otherwise skip.
  if (response.status >= 500) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", UNCACHEABLE);
    headers.delete("Cloudflare-CDN-Cache-Control");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  const disposition = cacheDisposition(request, response);
  if (disposition === "uncacheable" && response.headers.has("Cache-Control")) return response;
  const headers = new Headers(response.headers);
  if (disposition === "public" || disposition === "not-found") {
    headers.set("Cache-Control", BROWSER_CACHE_CONTROL);
    headers.set(
      "Cloudflare-CDN-Cache-Control",
      disposition === "public" ? PUBLIC_EDGE_CACHE_CONTROL : PUBLIC_NOT_FOUND_EDGE_CACHE_CONTROL,
    );
  } else {
    headers.set("Cache-Control", UNCACHEABLE);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// The API purges after any delivery change, over a service binding whose ctx.props carry
// publicCachePurge. Only someone who can deploy the API can set those props, so internet requests
// can never reach this. The uncached gateway checks those props and forwards the purge to
// PublicPages, which owns the page cache. purgeEverything deletes every cached response of that
// entrypoint, including the short-lived public not-found entries, so a newly published page is
// visible on the next request after the purge.
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
