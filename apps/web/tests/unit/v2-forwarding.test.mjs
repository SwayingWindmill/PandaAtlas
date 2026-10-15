import assert from "node:assert/strict";
import { test } from "node:test";

import { forwardToV2, refuseStateChange } from "../../lib/server/v2-forwarding.ts";

const ORIGIN = "https://www.example.test";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function harness({ token = "session-token", reply = () => Response.json({ ok: true }) } = {}) {
  const upstream = [];
  return {
    upstream,
    dependencies: {
      baseUrl: "https://api.example.test",
      transport: async (request) => {
        upstream.push({ request, body: request.method === "GET" ? null : await request.text() });
        return reply(request);
      },
      getAccessToken: async () => token,
    },
  };
}

function request(method, path, { headers = {}, body } = {}) {
  return new Request(`${ORIGIN}${path}`, { method, headers, body });
}

test("a request without a session is refused before anything is forwarded", async () => {
  const { dependencies, upstream } = harness({ token: null });
  const response = await forwardToV2(request("GET", "/api/engagement/favorites"), dependencies);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), "Bearer");
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.deepEqual(upstream, []);
});

test("only listed paths and methods are forwarded", async () => {
  const { dependencies, upstream } = harness();
  assert.equal((await forwardToV2(request("GET", "/api/v2/pandas"), dependencies)).status, 404);
  assert.equal((await forwardToV2(request("GET", "/api/admin/review/cases/abc/claim"), dependencies)).status, 405);
  assert.equal((await forwardToV2(request("DELETE", "/api/admin/review/cases"), dependencies)).status, 405);
  assert.deepEqual(upstream, []);
});

test("a state-changing request from another site is refused", async () => {
  const { dependencies, upstream } = harness();
  const crossSite = request("POST", "/api/engagement/favorites/p1", { headers: { "sec-fetch-site": "cross-site" } });
  assert.equal((await forwardToV2(crossSite, dependencies)).status, 403);
  const foreignOrigin = request("POST", "/api/engagement/favorites/p1", { headers: { origin: "https://evil.example" } });
  assert.equal((await forwardToV2(foreignOrigin, dependencies)).status, 403);
  assert.deepEqual(upstream, []);

  const sameSite = request("POST", "/api/engagement/favorites/p1", {
    headers: { "sec-fetch-site": "same-origin", origin: ORIGIN },
  });
  assert.equal((await forwardToV2(sameSite, dependencies)).status, 200);
  assert.equal(upstream.length, 1);
});

test("a body that is not JSON is refused", async () => {
  const { dependencies, upstream } = harness();
  const form = request("POST", "/api/admin/review/cases", {
    headers: { "sec-fetch-site": "same-origin", "content-type": "application/x-www-form-urlencoded" },
    body: "submissionId=1",
  });
  assert.equal((await forwardToV2(form, dependencies)).status, 415);
  assert.deepEqual(upstream, []);
});

test("the routes that compose operations apply the same state-change rule", () => {
  const crossSite = request("POST", "/api/games/guess/answer", { headers: { "sec-fetch-site": "cross-site" } });
  assert.equal(refuseStateChange(crossSite)?.status, 403);
  const form = request("POST", "/api/auth/email-otp/start", {
    headers: { "sec-fetch-site": "same-origin", "content-type": "text/plain" },
    body: "email=a@b.c",
  });
  assert.equal(refuseStateChange(form)?.status, 415);
  const json = request("POST", "/api/auth/email-otp/start", {
    headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(refuseStateChange(json), undefined);
});

test("a write without a body is forwarded without one, and a literal segment wins over a parameter", async () => {
  const { dependencies, upstream } = harness();
  const toggle = request("POST", "/api/engagement/favorites/p1", { headers: { "sec-fetch-site": "same-origin" } });
  assert.equal((await forwardToV2(toggle, dependencies)).status, 200);
  assert.equal(upstream[0].request.headers.has("content-type"), false);
  assert.equal(upstream[0].body, "");

  await forwardToV2(request("GET", "/api/admin/staff/accounts/catalog"), dependencies);
  assert.equal(upstream[1].request.url, "https://api.example.test/api/v2/staff/accounts/catalog");
  await forwardToV2(request("GET", "/api/admin/staff/accounts/acc-1"), dependencies);
  assert.equal(upstream[2].request.url, "https://api.example.test/api/v2/staff/accounts/acc-1");
});

test("refusals are Problem Details with a code", async () => {
  const { dependencies } = harness({ token: null });
  const response = await forwardToV2(request("GET", "/api/engagement/favorites"), dependencies);
  assert.equal(response.headers.get("content-type"), "application/problem+json");
  assert.deepEqual(await response.json(), {
    type: "about:blank",
    title: "Authentication required",
    status: 401,
    detail: "Authentication is required for this operation.",
    code: "web.sessionRequired",
  });
});

test("a listed GET is forwarded with the bearer token, a correlation id and its query", async () => {
  const { dependencies, upstream } = harness({
    reply: () => new Response('{"items":[]}', { status: 200, headers: { "content-type": "application/json" } }),
  });
  const response = await forwardToV2(request("GET", "/api/admin/review/cases?limit=25&state=new"), dependencies);

  assert.equal(upstream.length, 1);
  const forwarded = upstream[0].request;
  assert.equal(forwarded.method, "GET");
  assert.equal(forwarded.url, "https://api.example.test/api/v2/review/cases?limit=25&state=new");
  assert.equal(forwarded.headers.get("authorization"), "Bearer session-token");
  assert.match(forwarded.headers.get("x-correlation-id"), UUID);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.deepEqual(await response.json(), { items: [] });
});

test("web parameters fill the API path in order and JSON bodies pass through", async () => {
  const { dependencies, upstream } = harness({ reply: () => new Response(null, { status: 204 }) });
  const response = await forwardToV2(
    request("PATCH", "/api/notification/inbox/msg%201/read", {
      headers: { "sec-fetch-site": "same-origin", "content-type": "application/json; charset=utf-8" },
      body: '{"read":true}',
    }),
    dependencies,
  );
  assert.equal(upstream[0].request.url, "https://api.example.test/api/v2/me/notifications/msg%201/read");
  assert.equal(upstream[0].request.headers.get("content-type"), "application/json");
  assert.equal(upstream[0].body, '{"read":true}');
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("the API's status, body and challenge come back unchanged", async () => {
  const { dependencies } = harness({
    reply: () =>
      Response.json({ status: 401, code: "auth.invalidToken" }, { status: 401, headers: { "www-authenticate": 'Bearer error="invalid_token"' } }),
  });
  const response = await forwardToV2(request("GET", "/api/identity/session"), dependencies);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), 'Bearer error="invalid_token"');
  assert.deepEqual(await response.json(), { status: 401, code: "auth.invalidToken" });
});
