import { isIgnorableQueryParam, isPublicCachePurge, PUBLIC_CACHE_PURGE_HEADER, publicPageCacheKey } from "./edge-cache.mjs";

// Workers Cache keys on the path and query string, and it sits in front of an
// entrypoint. The default entrypoint stays uncached so it can drop tracking
// parameters and choose the key; PublicPages is the cached entrypoint.
export function routeCachedPublicRequest(request, env, ctx, direct) {
  const pages = ctx?.exports?.PublicPages;
  if (isPublicCachePurge(ctx)) {
    const headers = new Headers(request.headers);
    headers.set(PUBLIC_CACHE_PURGE_HEADER, "1");
    const purgeRequest = new Request(request, { headers });
    return pages ? pages.fetch(purgeRequest) : direct.fetch(purgeRequest, env, ctx);
  }

  const cleaned = canonicalPublicRequest(request);
  if (!pages) return direct.fetch(cleaned, env, ctx);
  return pages.fetch(cleaned, { cf: { cacheKey: publicPageCacheKey(cleaned) } });
}

function canonicalPublicRequest(request) {
  const headers = new Headers(request.headers);
  const suppliedPurgeHeader = headers.has(PUBLIC_CACHE_PURGE_HEADER);
  if (suppliedPurgeHeader) headers.delete(PUBLIC_CACHE_PURGE_HEADER);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return suppliedPurgeHeader ? new Request(request, { headers }) : request;
  }

  const url = new URL(request.url);
  const search = normalizedSearch(url.searchParams);
  if (search === url.search.replace(/^\?/u, "") && !suppliedPurgeHeader) return request;
  url.search = search;
  return new Request(url, { method: request.method, headers });
}

function normalizedSearch(params) {
  const kept = new URLSearchParams(params);
  for (const key of [...kept.keys()]) {
    if (isIgnorableQueryParam(key)) kept.delete(key);
  }
  kept.sort();
  return kept.toString();
}
