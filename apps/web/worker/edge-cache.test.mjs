import assert from "node:assert/strict";
import test from "node:test";

import { PUBLIC_EDGE_CACHE_CONTROL, withEdgeCachePolicy } from "./edge-cache.mjs";

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

test("sitemap.xml is cached at the edge", () => {
  assert.equal(apply("/sitemap.xml", { headers: { "Content-Type": "application/xml" } }).headers.get("Cloudflare-CDN-Cache-Control"), PUBLIC_EDGE_CACHE_CONTROL);
});

test("private routes, errors and personalised responses keep their own no-store policy", () => {
  const cases = [
    ["/zh/me", page],
    ["/zh/contribute", page],
    ["/admin", page],
    ["/zh/pandas/missing", { ...page, status: 404 }],
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
