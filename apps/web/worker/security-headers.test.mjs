import assert from "node:assert/strict";
import test from "node:test";

import { withSecurityHeaders } from "./security-headers.mjs";

const expected = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
};

test("every Worker response carries the baseline security headers", async () => {
  const responses = [
    new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    new Response(null, { status: 308, headers: { Location: "/zh" } }),
    new Response("Not found", { status: 404 }),
    new Response(null, { status: 204 }),
  ];
  for (const response of responses) {
    const secured = withSecurityHeaders(response);
    for (const [name, value] of Object.entries(expected)) assert.equal(secured.headers.get(name), value, `${response.status} ${name}`);
  }
});

test("security headers keep the response's status, body and own headers", async () => {
  const secured = withSecurityHeaders(new Response("body", {
    status: 206,
    statusText: "Partial Content",
    headers: { "Content-Range": "bytes 0-3/10", "Cache-Control": "public, max-age=3600" },
  }));
  assert.equal(secured.status, 206);
  assert.equal(secured.statusText, "Partial Content");
  assert.equal(secured.headers.get("Content-Range"), "bytes 0-3/10");
  assert.equal(secured.headers.get("Cache-Control"), "public, max-age=3600");
  assert.equal(await secured.text(), "body");
});
