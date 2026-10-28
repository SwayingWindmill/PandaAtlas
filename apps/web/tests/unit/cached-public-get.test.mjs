import assert from "node:assert/strict";
import test from "node:test";

import { createCachedPublicGet, responseFromCache, withPublicGetCache } from "../../lib/server/cached-public-get.ts";

test("a public GET is read once per server request and URL", async () => {
  await withPublicGetCache(async () => {
    const urls = [];
    const read = createCachedPublicGet(async (url) => {
      urls.push(url);
      return new Response(`body:${url}`, {
        status: 200,
        headers: { "content-type": "application/json", "content-encoding": "gzip", "content-length": "99" },
      });
    });

    const first = await read("https://api.zhipanda.com/api/v2/pandas");
    const second = await read("https://api.zhipanda.com/api/v2/pandas");
    await read("https://api.zhipanda.com/api/v2/places");

    assert.deepEqual(urls, [
      "https://api.zhipanda.com/api/v2/pandas",
      "https://api.zhipanda.com/api/v2/places",
    ]);
    assert.equal(first.body, second.body);
    const response = responseFromCache(first);
    assert.equal(await response.text(), "body:https://api.zhipanda.com/api/v2/pandas");
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(response.headers.get("content-encoding"), null);
    assert.equal(response.headers.get("content-length"), null);
  });
});
