import assert from "node:assert/strict";
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

test("production API CORS allows only the custom-domain Web origins", () => {
  const binding = workers.api.env.CORS_ALLOW_ORIGINS;
  assert.equal(binding.type, "text");
  assert.deepEqual(binding.value.split(","), ["https://zhipanda.com", "https://www.zhipanda.com"]);
});

test("the production API runs async downstream from a five-minute Cron Trigger", () => {
  assert.deepEqual(workers.api.triggers, [{ type: "scheduled", schedule: "*/5 * * * *" }]);
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
