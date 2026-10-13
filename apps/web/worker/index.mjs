import vinextWorker from "vinext/server/app-router-entry";
import { isPublicCachePurge, purgePublicCache, withEdgeCachePolicy } from "./edge-cache.mjs";
import { isMediaRequest, serveMedia } from "./media.mjs";
import { withSecurityHeaders } from "./security-headers.mjs";

async function route(request, env, context) {
  if (isPublicCachePurge(context)) return purgePublicCache(request, context);
  const response = isMediaRequest(new URL(request.url))
    ? await serveMedia(request, env)
    : await vinextWorker.fetch(request, env, context);
  return withEdgeCachePolicy(request, response);
}

const worker = {
  async fetch(request, env, context) {
    return withSecurityHeaders(await route(request, env, context));
  },
};
export default worker;
