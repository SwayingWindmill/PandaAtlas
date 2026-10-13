import vinextWorker from "vinext/server/app-router-entry";
import { withEdgeCachePolicy } from "./edge-cache.mjs";
import { isMediaRequest, serveMedia } from "./media.mjs";

const worker = {
  async fetch(request, env, context) {
    const response = isMediaRequest(new URL(request.url))
      ? await serveMedia(request, env)
      : await vinextWorker.fetch(request, env, context);
    return withEdgeCachePolicy(request, response);
  },
};
export default worker;
