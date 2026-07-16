import openNextWorker from "../.open-next/worker.js";

import { malformedPathResponse } from "./request-guard.mjs";

export {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "../.open-next/worker.js";

const pandaAtlasWorker = {
  ...openNextWorker,
  async fetch(request, env, ctx) {
    const rejected = malformedPathResponse(request);
    if (rejected) return rejected;

    return openNextWorker.fetch(request, env, ctx);
  },
};

export default pandaAtlasWorker;
