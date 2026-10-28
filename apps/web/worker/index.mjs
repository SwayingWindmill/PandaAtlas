import { WorkerEntrypoint } from "cloudflare:workers";
import vinextWorker from "vinext/server/app-router-entry";
import { createWorker } from "./create-worker.mjs";
import { routeCachedPublicRequest } from "./public-cache-gateway.mjs";

const pages = createWorker(vinextWorker);

// Cached entrypoint. Workers Cache sits in front of it; the gateway chooses the key.
export class PublicPages extends WorkerEntrypoint {
  fetch(request) {
    return pages.fetch(request, this.env, this.ctx);
  }
}

const gateway = {
  fetch(request, env, ctx) {
    return routeCachedPublicRequest(request, env, ctx, pages);
  },
};

export default gateway;
