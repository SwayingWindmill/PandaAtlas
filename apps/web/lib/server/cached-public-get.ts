import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";

export interface CachedPublicResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
}

// React's server cache is per request, but only while a server renderer is active.
// The store below covers the same URL twice in one plain call, including node:test.
const reads = new AsyncLocalStorage<Map<string, Promise<CachedPublicResponse>>>();

async function readPublicBody(url: string, load: (url: string) => Promise<Response>): Promise<CachedPublicResponse> {
  const response = await load(url);
  return {
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers.entries()],
    body: await response.text(),
  };
}

// One public GET per URL per server render. React's cache lasts for the request,
// so layout, generateMetadata and the page share a response instead of each
// calling the API. withPublicGetCache is the same scope for callers outside that renderer.
export function createCachedPublicGet(load: (url: string) => Promise<Response>) {
  const read = cache((url: string) => readPublicBody(url, load));
  return (url: string) => {
    const store = reads.getStore();
    const existing = store?.get(url);
    if (existing) return existing;
    const pending = read(url);
    store?.set(url, pending);
    return pending;
  };
}

export function withPublicGetCache<T>(run: () => T): T {
  return reads.run(new Map(), run);
}

export function responseFromCache(cached: CachedPublicResponse): Response {
  const headers = new Headers(cached.headers);
  // The body was decoded by fetch. Drop encoding headers so the rebuilt
  // response is not described as still compressed.
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}
