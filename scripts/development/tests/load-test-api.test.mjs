import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import {
  SCENARIOS,
  assertTargetAllowed,
  buildSchedule,
  computePercentiles,
  parseArgs,
  renderMarkdownReport,
  runLoadTest,
} from "../load-test-api.mjs";

test("parseArgs validates defaults, mutual exclusions, and authenticated-read token requirement", () => {
  assert.deepEqual(parseArgs(["--help"]).help, true);

  const defaults = parseArgs([], {});
  assert.equal(defaults.baseUrl, "http://127.0.0.1:3001");
  assert.equal(defaults.scenario, "mixed-launch");
  assert.deepEqual(defaults.concurrency, [1, 5, 10, 20]);
  assert.equal(defaults.requests, 100);
  assert.equal(defaults.warmup, 5);

  const timed = parseArgs(["--duration-sec", "5", "--concurrency", "1,5,5", "--format", "json"]);
  assert.equal(timed.durationSec, 5);
  assert.equal(timed.requests, undefined);
  assert.deepEqual(timed.concurrency, [1, 5]);
  assert.equal(timed.format, "json");

  assert.throws(() => parseArgs(["--requests", "10", "--duration-sec", "5"]), /mutually exclusive/u);
  assert.throws(() => parseArgs(["--scenario", "unknown"]), /--scenario must be one of/u);
  assert.throws(() => parseArgs(["--panda-slug", "Bad_Slug"]), /malformed/u);
  assert.throws(() => parseArgs(["--scenario", "authenticated-read"], {}), /requires --bearer-token/u);

  const authed = parseArgs(["--scenario", "authenticated-read"], { LOAD_TEST_BEARER_TOKEN: "tok-123" });
  assert.equal(authed.bearerToken, "tok-123");
});

test("assertTargetAllowed allows loopback targets and blocks unconfirmed remote hosts", () => {
  assert.equal(assertTargetAllowed("http://127.0.0.1:3001/").baseUrl, "http://127.0.0.1:3001");
  assert.equal(assertTargetAllowed("http://localhost:3001").isLoopback, true);

  assert.throws(() => assertTargetAllowed("https://api.zhipanda.com"), /Refusing non-loopback/u);
  assert.throws(
    () => assertTargetAllowed("https://api.zhipanda.com", { allowRemote: true, confirmHost: "wrong.example.com" }),
    /Refusing non-loopback/u,
  );

  const confirmed = assertTargetAllowed("https://staging-api.example.com/", {
    allowRemote: true,
    confirmHost: "staging-api.example.com",
  });
  assert.equal(confirmed.baseUrl, "https://staging-api.example.com");
  assert.equal(confirmed.isLoopback, false);
});

test("computePercentiles computes min, p50, p95, p99, max accurately", () => {
  assert.deepEqual(computePercentiles([]), { count: 0, minMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, avgMs: 0 });
  const samples = Array.from({ length: 100 }, (_, i) => i + 1);
  const stats = computePercentiles(samples);
  assert.equal(stats.count, 100);
  assert.equal(stats.minMs, 1);
  assert.equal(stats.p50Ms, 50);
  assert.equal(stats.p95Ms, 95);
  assert.equal(stats.p99Ms, 99);
  assert.equal(stats.maxMs, 100);
});

test("SCENARIOS mixed-launch schedule preserves public/authenticated split", () => {
  const authedToday = SCENARIOS["authenticated-read"]("2026-11-22");
  assert.ok(authedToday.every((item) => item.route.startsWith("/api/v2/me")));
  assert.ok(authedToday.some((item) => item.route === "/api/v2/me/daily-checkins?today=2026-11-22"));
  assert.ok(buildSchedule("authenticated-read", { today: "2026-11-22" }).includes("/api/v2/me/daily-checkins?today=2026-11-22"));

  const publicCachedRoutes = SCENARIOS["public-cached"]("he-hua-chengdu").map((item) => item.route);
  assert.ok(publicCachedRoutes.includes("/api/v2/pandas"));
  assert.ok(!publicCachedRoutes.some((route) => route.includes("limit=")));

  const unauthSchedule = buildSchedule("mixed-launch", { pandaSlug: "he-hua-chengdu", hasToken: false });
  assert.equal(unauthSchedule.length, 32);
  assert.ok(unauthSchedule.includes("/api/v2/pandas/he-hua-chengdu"));
  assert.ok(!unauthSchedule.some((route) => route.startsWith("/api/v2/me")));

  const cachedRoutes = new Set(publicCachedRoutes);
  const uncachedRoutes = new Set(SCENARIOS["public-db-uncached"]().map((item) => item.route));
  const firstEight = unauthSchedule.slice(0, 8);
  assert.equal(firstEight.filter((route) => cachedRoutes.has(route)).length, 6);
  assert.equal(firstEight.filter((route) => uncachedRoutes.has(route)).length, 2);

  const authSchedule = buildSchedule("mixed-launch", {
    pandaSlug: "he-hua-chengdu",
    hasToken: true,
    today: "2026-11-22",
  });
  const firstTenAuth = authSchedule.slice(0, 10);
  const authedRoutes = new Set(authedToday.map((item) => item.route));
  assert.equal(firstTenAuth.filter((route) => cachedRoutes.has(route)).length, 7);
  assert.equal(firstTenAuth.filter((route) => uncachedRoutes.has(route)).length, 2);
  assert.equal(firstTenAuth.filter((route) => authedRoutes.has(route)).length, 1);
  assert.ok(authSchedule.includes("/api/v2/me/daily-checkins?today=2026-11-22"));
});

test("runLoadTest measures queueing latency past 5-slot DB semaphore and counts 429s against a real HTTP server", async () => {
  // Simulate Hyperdrive's 5 origin connections for DB-backed routes plus occasional 429 rate-limit hits.
  let activeDbSlots = 0;
  let maxObservedSlots = 0;
  let dbHits = 0;
  const waitQueue = [];

  function acquireSlot() {
    if (activeDbSlots < 5) {
      activeDbSlots += 1;
      if (activeDbSlots > maxObservedSlots) maxObservedSlots = activeDbSlots;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      waitQueue.push(() => {
        activeDbSlots += 1;
        if (activeDbSlots > maxObservedSlots) maxObservedSlots = activeDbSlots;
        resolve();
      });
    });
  }

  function releaseSlot() {
    activeDbSlots -= 1;
    const next = waitQueue.shift();
    if (next) next();
  }

  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/v2/updates") {
      dbHits += 1;
      if (dbHits >= 2) {
        res.writeHead(429, { "content-type": "application/problem+json", "retry-after": "60" });
        res.end(JSON.stringify({ status: 429, code: "rate_limit.exceeded" }));
        return;
      }
    }
    await acquireSlot();
    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseSlot();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const options = parseArgs([
      "--base-url",
      `http://127.0.0.1:${port}`,
      "--scenario",
      "public-db-uncached",
      "--concurrency",
      "1,10",
      "--requests",
      "20",
      "--warmup",
      "2",
      "--format",
      "markdown",
    ]);
    const report = await runLoadTest(options);
    assert.equal(report.levels.length, 2);

    const [single, burst] = report.levels;
    assert.equal(single.concurrency, 1);
    assert.equal(single.requests, 20);
    assert.equal(single.networkErrors, 0);
    assert.ok(single.ok2xx + single.rateLimited429 === 20);

    assert.equal(burst.concurrency, 10);
    assert.equal(burst.requests, 20);
    assert.equal(burst.networkErrors, 0);
    assert.ok(burst.rateLimited429 >= 1, "expected 429 responses to be tallied");
    assert.ok(burst.p50Ms > single.p50Ms, `expected queueing delay at c=10 (${burst.p50Ms}ms > ${single.p50Ms}ms)`);
    assert.equal(maxObservedSlots, 5);

    const markdown = renderMarkdownReport(report);
    assert.match(markdown, /Load Test Report \(public-db-uncached\)/u);
    assert.match(markdown, /Per-Route Breakdown \(Concurrency=10\)/u);
    assert.match(markdown, /\| Route \| Requests \| 2xx \| 429 \| 4xx \| 5xx \| Errors \|/u);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
