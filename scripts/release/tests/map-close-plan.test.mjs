import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createMapCloseCertificationPlan,
  MAP_CLOSE_PROFILE,
  MAP_CLOSE_WEB_ENVIRONMENT,
} from "../certification/map-close-plan.mjs";

const authoritativeStepIds = [
  "archive-governance-evidence",
  "archive-governance-inventory",
  "archive-governance-contracts",
  "archive-governance-openapi",
  "archive-governance-web-contracts",
  "admin-bundle-budget",
  "structured-contribution-evidence",
  "notification-center-budget",
  "zhipanda-brand-closure",
  "supabase-foundation-contracts",
  "identity-engagement-contracts",
  "secure-web-boundary",
  "follow-through-login-browser",
  "published-return-loop-browser",
  "admin-shell-browser",
];

const windowsStepIds = [
  "release-contracts",
  "web-lint",
  "web-typecheck",
  "web-build",
  "api-sync",
  "api-lint",
  "api-tests",
  "published-return-loop-browser",
];

function assertDependencyClosure(plan) {
  const ids = new Set(plan.steps.map((step) => step.id));
  assert.equal(ids.size, plan.steps.length);
  for (const step of plan.steps) {
    for (const dependency of step.dependsOn ?? []) {
      assert.ok(ids.has(dependency), `${step.id} depends on missing ${dependency}`);
    }
  }
}

test("authoritative map-close profile preserves the certified step set", () => {
  const plan = createMapCloseCertificationPlan({
    profile: MAP_CLOSE_PROFILE.AUTHORITATIVE,
    playwrightEnv: { PLAYWRIGHT_BROWSER_CHANNEL: "chromium" },
  });

  assert.equal(plan.gate, "map-close");
  assert.equal(plan.profile, MAP_CLOSE_PROFILE.AUTHORITATIVE);
  assert.deepEqual(plan.steps.map((step) => step.id), authoritativeStepIds);
  assertDependencyClosure(plan);
});

test("Windows compatibility profile preserves the certified step set", () => {
  const plan = createMapCloseCertificationPlan({
    profile: MAP_CLOSE_PROFILE.WINDOWS_COMPATIBILITY,
  });

  assert.equal(plan.gate, "windows-map-close-compatibility");
  assert.equal(plan.profile, MAP_CLOSE_PROFILE.WINDOWS_COMPATIBILITY);
  assert.deepEqual(plan.steps.map((step) => step.id), windowsStepIds);
  assertDependencyClosure(plan);
});

test("map-close profiles retain one shared public Web environment", () => {
  assert.deepEqual(MAP_CLOSE_WEB_ENVIRONMENT, {
    NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65534",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    NEXT_PUBLIC_ENGAGEMENT_ENABLED: "true",
    NEXT_PUBLIC_FEED_ENABLED: "true",
    NEXT_PUBLIC_NOTIFICATION_ENABLED: "true",
  });
  assert.ok(Object.isFrozen(MAP_CLOSE_WEB_ENVIRONMENT));
});

test("platform entrypoints remain thin certification adapters", async () => {
  const [authoritative, windows] = await Promise.all([
    readFile(new URL("../map-close.mjs", import.meta.url), "utf8"),
    readFile(new URL("../windows-map-close.mjs", import.meta.url), "utf8"),
  ]);

  for (const source of [authoritative, windows]) {
    assert.match(source, /createMapCloseCertificationPlan/);
    assert.doesNotMatch(source, /steps:\s*\[/);
    assert.doesNotMatch(source, /id:\s*"published-return-loop-browser"/);
  }
  assert.match(authoritative, /MAP_CLOSE_PROFILE\.AUTHORITATIVE/);
  assert.match(windows, /MAP_CLOSE_PROFILE\.WINDOWS_COMPATIBILITY/);
});

test("unknown certification profiles fail before a gate runs", () => {
  assert.throws(
    () => createMapCloseCertificationPlan({ profile: "unknown" }),
    /Unknown map-close certification profile/,
  );
});
