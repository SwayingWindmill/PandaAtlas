import { cache } from "react";

export interface CachedPublicResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
}

// One public GET per URL per server render. React's cache lasts for the request,
// so layout, generateMetadata and the page share a response instead of each
// calling the API.
export function createCachedPublicGet(load: (url: string) => Promise<Response>) {
  return cache(async (url: string): Promise<CachedPublicResponse> => {
    const response = await load(url);
    return {
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
      body: await response.text(),
    };
  });
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
