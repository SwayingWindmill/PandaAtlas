import { isPublicCachePurge, purgePublicCache, withEdgeCachePolicy } from "./edge-cache.mjs";
import { isMediaRequest, serveMedia } from "./media.mjs";
import { withSecurityHeaders } from "./security-headers.mjs";

// The Web Worker around the vinext app: cache purges, allowlisted media, then app renders. Every
// response leaves through the security-header policy.
export function createWorker(app) {
  async function respond(request, env, context) {
    if (isPublicCachePurge(context)) return purgePublicCache(request, context);
    const response = isMediaRequest(new URL(request.url))
      ? await serveMedia(request, env)
      : await app.fetch(request, env, context);
    return withEdgeCachePolicy(request, response);
  }

  return {
    async fetch(request, env, context) {
      return withSecurityHeaders(await respond(request, env, context));
    },
  };
}
