import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_READ_UNAVAILABLE_DIGEST,
  publicReadUnavailableDuringRequest,
  isPublicReadUnavailable,
  readPublicMetadata,
  readPublicResource,
  requirePublicCollection,
  settlePublicRead,
  withPublicReadRequest,
} from "../../lib/server/public-read.ts";
import { PUBLIC_NOT_FOUND_EDGE_CACHE_CONTROL, withEdgeCachePolicy } from "../../worker/edge-cache.mjs";

function apiResult(status, data) {
  return { data, error: data === undefined ? { status } : undefined, response: new Response(null, { status }) };
}

function cachedPage(path, status, cacheControl) {
  const headers = { "Content-Type": "text/html; charset=utf-8" };
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  return withEdgeCachePolicy(new Request(`https://zhipanda.com${path}`), new Response("body", { status, headers }));
}

test("an API failure becomes an uncached 503 and a genuine 404 stays cacheable", async () => {
  await withPublicReadRequest(async () => {
    assert.deepEqual(requirePublicCollection(apiResult(200, { items: [] })), { items: [] });
    assert.equal(readPublicResource(apiResult(404)), null);
    assert.equal(publicReadUnavailableDuringRequest(), false);

    assert.throws(() => requirePublicCollection(apiResult(500), { mark: false }), (error) => {
      assert.equal(error.digest, PUBLIC_READ_UNAVAILABLE_DIGEST);
      return true;
    });
    assert.equal(publicReadUnavailableDuringRequest(), false);

    await assert.rejects(
      settlePublicRead(Promise.reject(new Error("Connection terminated unexpectedly"))),
      (error) => {
        assert.equal(error.name, "PublicReadUnavailable");
        assert.equal(error.digest, PUBLIC_READ_UNAVAILABLE_DIGEST);
        assert.equal(error.cause.message, "Connection terminated unexpectedly");
        return true;
      },
    );
    assert.equal(publicReadUnavailableDuringRequest(), true);

    for (const status of [500, 503]) {
      assert.throws(() => readPublicResource(apiResult(status)), (error) => error.digest === PUBLIC_READ_UNAVAILABLE_DIGEST);
    }
    assert.throws(() => requirePublicCollection(apiResult(404)), (error) => error.digest === PUBLIC_READ_UNAVAILABLE_DIGEST);
    assert.equal(await readPublicMetadata(() => readPublicResource(apiResult(404))), null);
    assert.equal(await readPublicMetadata(() => {
      requirePublicCollection(apiResult(503));
      return null;
    }), null);
    await assert.rejects(readPublicMetadata(() => Promise.reject(new Error("boom"))), (error) => !isPublicReadUnavailable(error));
  });

  const failure = cachedPage("/zh/pandas", 503, "public, max-age=600");
  assert.equal(failure.status, 503);
  assert.equal(failure.headers.get("Cache-Control"), "private, no-store");
  assert.equal(failure.headers.get("Cloudflare-CDN-Cache-Control"), null);
  assert.equal(await failure.text(), "body");

  const missing = cachedPage("/zh/pandas/not-a-panda", 404, "private, no-cache, no-store, max-age=0, must-revalidate");
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("Cloudflare-CDN-Cache-Control"), PUBLIC_NOT_FOUND_EDGE_CACHE_CONTROL);
  assert.equal(missing.headers.get("Cache-Control"), "public, max-age=0, must-revalidate");
});
