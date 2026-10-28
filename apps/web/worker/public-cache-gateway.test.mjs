import assert from "node:assert/strict";
import test from "node:test";

import { routeCachedPublicRequest } from "./public-cache-gateway.mjs";

function pagesContext() {
  const seen = [];
  const ctx = {
    exports: {
      PublicPages: {
        fetch(request, init) {
          seen.push({
            url: request.url,
            method: request.method,
            redirect: request.redirect,
            cacheKey: init?.cf?.cacheKey,
            purge: request.headers.get("x-zhipanda-cache-purge"),
          });
          return Promise.resolve(new Response("ok"));
        },
      },
    },
  };
  return { ctx, seen };
}

test("a probe or campaign link reuses the canonical cached page", async () => {
  const { ctx, seen } = pagesContext();
  const response = await routeCachedPublicRequest(
    new Request("https://www.zhipanda.com/zh/pandas?utm_source=newsletter&probe=15&page=2"),
    {},
    ctx,
    null,
  );
  assert.equal(response.status, 200);
  assert.equal(seen[0].url, "https://www.zhipanda.com/zh/pandas?page=2");
  assert.equal(seen[0].cacheKey, "/zh/pandas?page=2");
  assert.equal(seen[0].redirect, "follow");
  assert.equal(seen[0].purge, null);
});

test("functional query parameters keep the caller's order", async () => {
  const { ctx, seen } = pagesContext();
  await routeCachedPublicRequest(
    new Request("https://www.zhipanda.com/map?mode=individual&focus=mei-xiang"),
    {},
    ctx,
    null,
  );
  assert.equal(seen[0].url, "https://www.zhipanda.com/map?mode=individual&focus=mei-xiang");
  assert.equal(seen[0].cacheKey, "/map?focus=mei-xiang&mode=individual");
});

test("a purge from the API binding is forwarded and a client header is not", async () => {
  const { ctx, seen } = pagesContext();
  ctx.props = { publicCachePurge: true };
  await routeCachedPublicRequest(
    new Request("https://zhipanda.com/__public-cache/purge", { method: "POST" }),
    {},
    ctx,
    null,
  );
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].purge, "1");
  assert.equal(seen[0].cacheKey, undefined);

  const visitor = pagesContext();
  await routeCachedPublicRequest(
    new Request("https://www.zhipanda.com/zh", { headers: { "x-zhipanda-cache-purge": "1" } }),
    {},
    visitor.ctx,
    null,
  );
  assert.equal(visitor.seen[0].purge, null);
  assert.equal(visitor.seen[0].cacheKey, "/zh");
});
