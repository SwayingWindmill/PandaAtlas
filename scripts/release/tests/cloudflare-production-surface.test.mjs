import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import webConfig from "../../../apps/web/cloudflare.config.ts";
import apiConfig from "../../../services/api/cloudflare.config.ts";

const production = { mode: "production", isPreview: false };
const workers = {
  web: webConfig(production).worker,
  api: apiConfig(production).worker,
};

test("production Workers are reachable only through zhipanda.com custom domains", () => {
  for (const [name, worker] of Object.entries(workers)) {
    assert.equal(worker.workersDev, false, `${name} must not serve on workers.dev`);
    for (const domain of worker.domains) assert.match(domain, /(^|\.)zhipanda\.com$/u, `${name} domain ${domain}`);
  }
});

test("the production Web Worker serves cacheable responses from Workers Cache", () => {
  assert.deepEqual(workers.web.cache, { enabled: false });
  assert.equal(workers.web.exports.default, undefined);
  assert.deepEqual(workers.web.exports.PublicPages, { type: "worker", cache: { enabled: true } });
});

test("the API authorizes Web public-cache purges through its service binding props, not a secret", () => {
  assert.deepEqual(workers.api.env.PUBLIC_WEB, { type: "worker", worker: "zhipanda-v2-web", props: { publicCachePurge: true } });
  for (const key of ["PUBLIC_REVALIDATION_AUTH", "PUBLIC_WEB_BASE_URL"]) assert.equal(key in workers.api.env, false, key);
});

test("robots.txt is a static asset that allows search, forbids AI training and hides private paths", () => {
  const robots = readFileSync(new URL("../../../apps/web/public/robots.txt", import.meta.url), "utf8");
  assert.match(robots, /^Content-Signal: search=yes, ai-train=no$/mu);
  const disallowed = new Set(robots.split(/\r?\n/u).filter((line) => line.startsWith("Disallow: ")).map((line) => line.slice("Disallow: ".length)));
  for (const path of ["/admin", "/api/", "/auth/", "/zh/me", "/en/me", "/zh/contribute", "/en/contribute"]) {
    assert.ok(disallowed.has(path), path);
  }
  // Filter query variants are crawl traps; the faceted pages themselves stay crawlable.
  for (const page of ["/zh/moments", "/en/moments", "/zh/pandas", "/en/pandas"]) {
    assert.ok(disallowed.has(`${page}?`), `${page}?`);
    assert.ok(!disallowed.has(page), page);
  }
  assert.ok(!disallowed.has("/me"), "a bare /me prefix would also block /media");
  assert.match(robots, new RegExp(`^Sitemap: ${workers.web.env.SITE_URL.value}/sitemap.xml$`, "mu"));
});

test("the production API runs next to its Supabase database region", () => {
  assert.deepEqual(workers.api.placement, { region: "aws:ap-northeast-1" });
  assert.equal(workers.web.placement, undefined);
});

test("production API CORS allows only the custom-domain Web origins", () => {
  const binding = workers.api.env.CORS_ALLOW_ORIGINS;
  assert.equal(binding.type, "text");
  assert.deepEqual(binding.value.split(","), ["https://zhipanda.com", "https://www.zhipanda.com"]);
});

test("the production API runs async downstream from a fifteen-minute Cron Trigger", () => {
  assert.deepEqual(workers.api.triggers, [{ type: "scheduled", schedule: "*/15 * * * *" }]);
  assert.equal("CRON_SECRET" in workers.api.env, false);
});

test("no production text binding points at a workers.dev origin", () => {
  for (const [name, worker] of Object.entries(workers)) {
    for (const [key, binding] of Object.entries(worker.env)) {
      if (binding.type !== "text") continue;
      assert.doesNotMatch(binding.value, /workers\.dev/u, `${name} ${key}`);
    }
  }
});

test("the production Web Worker does not expose an admin shell flag", () => {
  const previous = process.env.ADMIN_SHELL_ENABLED;
  process.env.ADMIN_SHELL_ENABLED = "true";
  try {
    assert.equal("ADMIN_SHELL_ENABLED" in webConfig(production).worker.env, false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SHELL_ENABLED;
    else process.env.ADMIN_SHELL_ENABLED = previous;
  }
});

test("the production API excludes E2E fixture endpoints and tokens", () => {
  const workerEntry = readFileSync(new URL("../../../services/api/worker/index.mjs", import.meta.url), "utf8");
  const appModule = readFileSync(new URL("../../../services/api/src/app.module.ts", import.meta.url), "utf8");
  assert.doesNotMatch(workerEntry, /e2e-fixture/u);
  assert.doesNotMatch(appModule, /e2e-fixture/u);
  assert.equal("E2E_FIXTURE_TOKEN" in workers.api.env, false);
});

test("production Workers configure distinct Cloudflare rate-limit namespaces for ask, writes, sensitive ops and OTP", () => {
  const bindings = [
    ["api", "ASK_RATE_LIMIT", workers.api.env.ASK_RATE_LIMIT],
    ["api", "WRITE_RATE_LIMIT", workers.api.env.WRITE_RATE_LIMIT],
    ["api", "SENSITIVE_RATE_LIMIT", workers.api.env.SENSITIVE_RATE_LIMIT],
    ["web", "AUTH_OTP_RATE_LIMIT", workers.web.env.AUTH_OTP_RATE_LIMIT],
  ];
  const namespaces = new Set();
  for (const [worker, name, binding] of bindings) {
    assert.ok(binding, `${worker}.${name} must be configured`);
    assert.equal(binding.type, "rate-limit", `${worker}.${name} must be a rateLimit binding`);
    assert.ok(!namespaces.has(binding.namespace), `duplicate rate-limit namespace ${binding.namespace}`);
    namespaces.add(binding.namespace);
  }
});
