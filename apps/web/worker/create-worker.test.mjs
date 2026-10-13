import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createWorker } from "./create-worker.mjs";
import { SECURITY_HEADERS } from "./security-headers.mjs";

const app = {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/old") return Response.redirect("https://zhipanda.com/zh", 308);
    return new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
};
const worker = createWorker(app);
const plainContext = {};

function assertSecured(response, label) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(response.headers.get(name), value, `${label}: ${name}`);
}

test("app renders and redirects carry the security headers", async () => {
  assertSecured(await worker.fetch(new Request("https://zhipanda.com/zh"), {}, plainContext), "page");
  const redirect = await worker.fetch(new Request("https://zhipanda.com/old"), {}, plainContext);
  assert.equal(redirect.status, 308);
  assertSecured(redirect, "redirect");
});

test("media responses carry the security headers", async () => {
  const response = await worker.fetch(new Request("https://zhipanda.com/media/pandas/photos/not-published.webp"), {}, plainContext);
  assert.equal(response.status, 404);
  assertSecured(response, "media");
});

test("cache-purge responses carry the security headers", async () => {
  const context = { props: { publicCachePurge: true }, cache: { purge: async () => ({ success: true, errors: [] }) } };
  const response = await worker.fetch(new Request("https://zhipanda.com/__public-cache/purge", { method: "POST" }), {}, context);
  assert.equal(response.status, 204);
  assertSecured(response, "purge");
});

test("static assets served without the Worker get the same security headers", () => {
  const rules = readFileSync(new URL("../public/_headers", import.meta.url), "utf8").split(/\r?\n/u);
  assert.equal(rules[0], "/*");
  const headers = Object.fromEntries(rules.slice(1).filter((line) => line.trim()).map((line) => {
    const separator = line.indexOf(":");
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
  assert.deepEqual(headers, SECURITY_HEADERS);
});
