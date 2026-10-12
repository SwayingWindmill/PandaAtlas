import vinextWorker from "vinext/server/app-router-entry";
import { isMediaRequest, serveMedia } from "./media.mjs";

const worker = {
  fetch(request, env, context) {
    if (!isMediaRequest(new URL(request.url))) return vinextWorker.fetch(request, env, context);
    return serveMedia(request, env, context, { cache: caches.default });
  },
};
export default worker;
