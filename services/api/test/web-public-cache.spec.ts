import { describe, expect, it } from "vitest";

import { webPublicCache } from "../src/jobs/web-public-cache.js";

describe("webPublicCache", () => {
  it("asks the Web Worker to purge its public page cache over the service binding", async () => {
    const requests: Request[] = [];
    const web = { fetch: (request: Request) => { requests.push(request); return Promise.resolve(new Response(null, { status: 204 })); } };

    await webPublicCache(web).purge();

    expect(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual(["POST /__public-cache/purge"]);
  });

  it("fails the purge when the Web Worker does not confirm it, so the queue retries", async () => {
    const web = { fetch: () => Promise.resolve(new Response("rate limited", { status: 502 })) };

    await expect(webPublicCache(web).purge()).rejects.toThrow("Web public cache purge failed with 502: rate limited");
  });
});
