import assert from "node:assert/strict";
import test from "node:test";

import {
  malformedPathResponse,
  pathHasValidPercentEncoding,
} from "../../../apps/web/cloudflare/request-guard.mjs";

test("accepts valid public paths without changing their semantics", () => {
  for (const url of [
    "https://example.test/zh/atlas/mei-xiang",
    "https://example.test/zh/atlas/%E7%BE%8E%E9%A6%99",
    "https://example.test/atlas/a%2Fb",
    "https://example.test/atlas?q=%E7%BE%8E%E9%A6%99",
  ]) {
    assert.equal(pathHasValidPercentEncoding(url), true, url);
    assert.equal(malformedPathResponse(new Request(url)), null, url);
  }
});

test("rejects malformed path encoding before OpenNext can decode it", async () => {
  for (const url of [
    "https://example.test/atlas/%E0%A4%A",
    "https://example.test/atlas/%ZZ",
    "https://example.test/atlas/%",
  ]) {
    assert.equal(pathHasValidPercentEncoding(url), false, url);

    const response = malformedPathResponse(new Request(url));
    assert.ok(response, url);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await response.text(), "Bad Request");
  }
});

test("query-string encoding does not turn a valid request path into a framework error", () => {
  const url = "https://example.test/atlas?q=%E0%A4%A";

  assert.equal(pathHasValidPercentEncoding(url), true);
  assert.equal(malformedPathResponse(new Request(url)), null);
});
