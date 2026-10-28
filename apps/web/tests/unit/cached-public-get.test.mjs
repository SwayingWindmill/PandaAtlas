import assert from "node:assert/strict";
import test from "node:test";
import * as ReactServer from "react";

import { createCachedPublicGet, responseFromCache } from "../../lib/server/cached-public-get.ts";

// React's request cache is the react-server build, and it memoizes only while a
// server renderer has installed its dispatcher. This stands in for that request.
function withRequestCache(run) {
  const internals = ReactServer.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const stores = new Map();
  const previous = internals.A;
  internals.A = {
    getCacheForType(create) {
      let store = stores.get(create);
      if (store === undefined) {
        store = create();
        stores.set(create, store);
      }
      return store;
    },
  };
  return Promise.resolve(run()).finally(() => {
    internals.A = previous;
  });
}

test("a public GET is read once per server request and URL", async () => {
  await withRequestCache(async () => {
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
