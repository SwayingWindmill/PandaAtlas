import assert from "node:assert/strict";
import test from "node:test";

import { isPublicCachePurge, PUBLIC_EDGE_CACHE_CONTROL, PUBLIC_NOT_FOUND_EDGE_CACHE_CONTROL, publicPageCacheKey, purgePublicCache, withEdgeCachePolicy } from "./edge-cache.mjs";

const VINEXT_DYNAMIC = "private, no-cache, no-store, max-age=0, must-revalidate";

function apply(path, { method = "GET", requestHeaders = {}, status = 200, headers = {} } = {}) {
  const request = new Request(`https://zhipanda.com${path}`, { method, headers: requestHeaders });
  const response = new Response(status === 308 ? null : "body", { status, headers });
  return withEdgeCachePolicy(request, response);
}

const page = { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": VINEXT_DYNAMIC } };

test("public page renders are cached at the edge and revalidated by browsers", async () => {
  for (const path of ["/zh", "/en/pandas", "/zh/pandas/mei-xiang", "/zh/families/ueno-twins", "/zh/moments?year=2026", "/en/map?mode=wild", "/zh/places/ueno-zoo", "/zh/games/guess"]) {
    const response = apply(path, page);
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), PUBLIC_EDGE_CACHE_CONTROL, path);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=0, must-revalidate", path);
  }
  assert.equal(await apply("/zh", page).text(), "body");
});

test("RSC navigation payloads are cached like their page, keeping the framework Vary", () => {
  const vary = "RSC, Next-Router-State-Tree, Next-Router-Prefetch";
  const response = apply("/zh/pandas?_rsc", { headers: { "Content-Type": "text/x-component", "Cache-Control": VINEXT_DYNAMIC, Vary: vary } });
  assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), PUBLIC_EDGE_CACHE_CONTROL);
  assert.equal(response.headers.get("Vary"), vary);
});

test("tracking and probe parameters share the canonical page cache key", () => {
  const canonical = publicPageCacheKey(new Request("https://www.zhipanda.com/zh"));
  assert.equal(publicPageCacheKey(new Request("https://zhipanda.com/zh?probe=99&utm_source=newsletter")), canonical);
  assert.equal(
    publicPageCacheKey(new Request("https://www.zhipanda.com/zh/moments?utm_medium=email&year=2026&utm_source=x")),
    "/zh/moments?year=2026",
  );
  assert.equal(
    publicPageCacheKey(new Request("https://zhipanda.com/zh/pandas/not-a-panda?utm_source=crawler&probe=1")),
    "/zh/pandas/not-a-panda",
  );
  assert.notEqual(
    publicPageCacheKey(new Request("https://www.zhipanda.com/zh/pandas?_rsc=1")),
    publicPageCacheKey(new Request("https://www.zhipanda.com/zh/pandas")),
  );
});

test("RSC router state stays in the page cache key", () => {
  const tree = "%5B%22%22%5D";
  const first = publicPageCacheKey(new Request("https://www.zhipanda.com/zh", { headers: { RSC: "1", "Next-Router-State-Tree": tree } }));
  const second = publicPageCacheKey(new Request("https://www.zhipanda.com/zh", { headers: { RSC: "1", "Next-Router-State-Tree": "other" } }));
  assert.notEqual(first, second);
  assert.match(first, /next-router-state-tree=/u);
});

test("sitemap.xml is cached at the edge", () => {
  assert.equal(apply("/sitemap.xml", { headers: { "Content-Type": "application/xml" } }).headers.get("Cloudflare-CDN-Cache-Control"), PUBLIC_EDGE_CACHE_CONTROL);
});

test("a genuine not-found for a public page is cached at the edge for ten minutes", async () => {
  for (const path of ["/zh/pandas/missing", "/en/families/no-such-story", "/zh/places/unknown", "/en/games/missing"]) {
    const response = apply(path, { ...page, status: 404 });
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), PUBLIC_NOT_FOUND_EDGE_CACHE_CONTROL, path);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=0, must-revalidate", path);
    assert.doesNotMatch(response.headers.get("Cloudflare-CDN-Cache-Control"), /stale-while-revalidate/u, path);
  }
  assert.equal(await apply("/zh/pandas/missing", { ...page, status: 404 }).text(), "body");

  const vary = "RSC, Next-Router-State-Tree, Next-Router-Prefetch";
  const rsc = apply("/zh/pandas/missing?_rsc", {
    status: 404,
    headers: { "Content-Type": "text/x-component", "Cache-Control": VINEXT_DYNAMIC, Vary: vary },
  });
  assert.equal(rsc.headers.get("Cloudflare-CDN-Cache-Control"), PUBLIC_NOT_FOUND_EDGE_CACHE_CONTROL);
  assert.equal(rsc.headers.get("Vary"), vary);

  const head = apply("/en/pandas/missing", { ...page, status: 404, method: "HEAD" });
  assert.equal(head.status, 404);
  assert.equal(head.headers.get("Cloudflare-CDN-Cache-Control"), PUBLIC_NOT_FOUND_EDGE_CACHE_CONTROL);
});

test("server errors are not cached even when they carry a public cache header", () => {
  for (const status of [500, 502, 503, 504]) {
    const response = apply("/zh", {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=86400", "Cloudflare-CDN-Cache-Control": PUBLIC_EDGE_CACHE_CONTROL },
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), null);
  }
  const sitemap = apply("/sitemap.xml", { status: 503, headers: { "Content-Type": "application/xml", "Cache-Control": PUBLIC_EDGE_CACHE_CONTROL } });
  assert.equal(sitemap.headers.get("Cache-Control"), "private, no-store");
  assert.equal(sitemap.headers.get("Cloudflare-CDN-Cache-Control"), null);
});

test("not-found responses outside a public page, and errors, stay uncacheable", () => {
  const cases = [
    ["/zh/pandas/missing", { ...page, status: 401 }],
    ["/zh/pandas/missing", { ...page, status: 403 }],
    ["/zh/pandas/missing", { ...page, status: 410 }],
    ["/zh/me", { ...page, status: 404 }],
    ["/admin", { ...page, status: 404 }],
    ["/zh/contribute", { ...page, status: 404 }],
    ["/sitemap.xml", { status: 404, headers: { "Content-Type": "application/xml", "Cache-Control": VINEXT_DYNAMIC } }],
    ["/zh/pandas/missing", { status: 404, headers: { "Content-Type": "application/json", "Cache-Control": VINEXT_DYNAMIC } }],
    ["/zh/pandas/missing", { ...page, status: 404, headers: { ...page.headers, "Set-Cookie": "sb-session=1" } }],
    ["/zh/pandas/missing", { ...page, status: 404, requestHeaders: { Authorization: "Bearer token" } }],
    ["/zh/pandas/missing", { ...page, status: 404, method: "POST" }],
  ];
  for (const [path, init] of cases) {
    const response = apply(path, init);
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), null, path);
    assert.equal(response.headers.get("Cache-Control"), VINEXT_DYNAMIC, path);
  }

  const bare = apply("/zh/pandas/missing", { status: 404 });
  assert.equal(bare.headers.get("Cloudflare-CDN-Cache-Control"), null);
  assert.equal(bare.headers.get("Cache-Control"), "private, no-store");

  const serverError = apply("/zh/pandas/missing", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  assert.equal(serverError.headers.get("Cloudflare-CDN-Cache-Control"), null);
  assert.equal(serverError.headers.get("Cache-Control"), "private, no-store");
});

test("private routes, errors and personalised responses keep their own no-store policy", () => {
  const cases = [
    ["/zh/me", page],
    ["/zh/contribute", page],
    ["/admin", page],
    ["/zh", { headers: { ...page.headers, "Set-Cookie": "sb-session=1" } }],
    ["/zh", { ...page, requestHeaders: { Authorization: "Bearer token" } }],
    ["/zh", { ...page, method: "POST" }],
  ];
  for (const [path, init] of cases) {
    const response = apply(path, init);
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), null, path);
    assert.equal(response.headers.get("Cache-Control"), VINEXT_DYNAMIC, path);
  }
});

test("responses without Cache-Control are never left to heuristic freshness", () => {
  const redirect = apply("/", { status: 308, headers: { Location: "/en" } });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("Location"), "/en");
  assert.equal(redirect.headers.get("Cache-Control"), "private, no-store");

  const json = apply("/api/games/guess/question", { headers: { "Content-Type": "application/json" } });
  assert.equal(json.headers.get("Cache-Control"), "private, no-store");
});

test("responses that already declare their own caching pass through unchanged", () => {
  const photo = apply("/media/pandas/photos/lun-lun/1.webp", { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" } });
  assert.equal(photo.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.equal(photo.headers.get("Cloudflare-CDN-Cache-Control"), null);
});

function purgeContext(result = { success: true, errors: [] }) {
  const calls = [];
  return { calls, props: { publicCachePurge: true }, cache: { purge: async (options) => { calls.push(options); return result; } } };
}

test("only an invocation carrying the API binding's props may purge", () => {
  assert.equal(isPublicCachePurge(purgeContext()), true);
  assert.equal(isPublicCachePurge({}), false);
  assert.equal(isPublicCachePurge({ props: {} }), false);
  assert.equal(isPublicCachePurge({ props: { publicCachePurge: "true" } }), false);
});

test("a purge request clears every cached response of the page entrypoint, including public not-found entries", async () => {
  const context = purgeContext();
  const response = await purgePublicCache(new Request("https://zhipanda.com/__public-cache/purge", { method: "POST" }), context);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(context.calls, [{ purgeEverything: true }]);
});

test("a rejected purge is reported so the API retries it", async () => {
  const context = purgeContext({ success: false, errors: [{ code: 1134, message: "rate limited" }] });
  const response = await purgePublicCache(new Request("https://zhipanda.com/__public-cache/purge", { method: "POST" }), context);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { errors: [{ code: 1134, message: "rate limited" }] });
});

test("other requests over the purge binding do nothing", async () => {
  const context = purgeContext();
  for (const request of [
    new Request("https://zhipanda.com/__public-cache/purge"),
    new Request("https://zhipanda.com/zh", { method: "POST" }),
  ]) {
    assert.equal((await purgePublicCache(request, context)).status, 404);
  }
  assert.deepEqual(context.calls, []);
});
