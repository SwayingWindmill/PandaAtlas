import type { PublicCachePort } from "../modules/publication/application/public-cache.port.js";

interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

// The PUBLIC_WEB service binding carries the props that let the Web Worker accept this request;
// the purge itself runs inside the Web Worker, which owns the cache.
export function webPublicCache(web: ServiceBinding): PublicCachePort {
  return {
    async purge() {
      const response = await web.fetch(new Request("https://zhipanda.com/__public-cache/purge", { method: "POST" }));
      if (!response.ok) {
        throw new Error(`Web public cache purge failed with ${response.status}: ${await response.text()}`);
      }
    },
  };
}
