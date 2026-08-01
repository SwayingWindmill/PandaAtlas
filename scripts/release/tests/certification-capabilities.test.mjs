import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  environmentFlag,
  PLAYWRIGHT_PRODUCTION_ENVIRONMENT,
  requireEnvironmentValue,
  resolvePlaywrightEnvironment,
} from "../certification/capabilities.mjs";
import { EnvironmentBlockedError } from "../gate-core.mjs";

test("environment capability flags preserve the enabled-only contract", () => {
  for (const value of ["1", " 1 ", "01", "true", "yes", "0", ""]) {
    assert.equal(
      environmentFlag("RUN_CHECK", { env: { RUN_CHECK: value } }),
      value.trim().toLowerCase() === "1",
      value,
    );
  }
  assert.equal(environmentFlag("RUN_CHECK", { env: {} }), false);
});

test("required environment values retain environment-blocked semantics", () => {
  assert.equal(
    requireEnvironmentValue("DATABASE_URL", {
      enabledBy: "RUN_REAL_DB_TESTS",
      env: { DATABASE_URL: "postgresql://example" },
    }),
    "postgresql://example",
  );
  assert.throws(
    () =>
      requireEnvironmentValue("DATABASE_URL", {
        enabledBy: "RUN_REAL_DB_TESTS",
        env: {},
      }),
    (error) => {
      assert.ok(error instanceof EnvironmentBlockedError);
      assert.equal(error.message, "RUN_REAL_DB_TESTS=1 requires DATABASE_URL to be set");
      return true;
    },
  );
});

test("Playwright capabilities preserve production defaults and explicit channel overrides", () => {
  assert.deepEqual(resolvePlaywrightEnvironment({ env: {}, platform: "linux" }), {
    ...PLAYWRIGHT_PRODUCTION_ENVIRONMENT,
  });
  assert.deepEqual(
    resolvePlaywrightEnvironment({
      env: { PLAYWRIGHT_BROWSER_CHANNEL: "chrome" },
      platform: "linux",
    }),
    { ...PLAYWRIGHT_PRODUCTION_ENVIRONMENT, PLAYWRIGHT_BROWSER_CHANNEL: "chrome" },
  );
  assert.ok(Object.isFrozen(PLAYWRIGHT_PRODUCTION_ENVIRONMENT));
});

test("Windows Playwright capabilities select Edge only when an installed candidate exists", () => {
  const checked = [];
  const withoutEdge = resolvePlaywrightEnvironment({
    env: { LOCALAPPDATA: "C:\\Users\\panda\\AppData\\Local" },
    platform: "win32",
    existsSync(candidate) {
      checked.push(candidate);
      return false;
    },
  });
  assert.deepEqual(withoutEdge, { ...PLAYWRIGHT_PRODUCTION_ENVIRONMENT });
  assert.deepEqual(checked, [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Users\\panda\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe",
  ]);

  assert.deepEqual(
    resolvePlaywrightEnvironment({
      env: {},
      platform: "win32",
      existsSync: (candidate) => candidate.startsWith("C:\\Program Files\\"),
    }),
    { ...PLAYWRIGHT_PRODUCTION_ENVIRONMENT, PLAYWRIGHT_BROWSER_CHANNEL: "msedge" },
  );
  assert.deepEqual(
    resolvePlaywrightEnvironment({
      env: { RELEASE_GATE_USE_SYSTEM_EDGE: "0" },
      platform: "win32",
      existsSync: () => true,
    }),
    { ...PLAYWRIGHT_PRODUCTION_ENVIRONMENT },
  );
});

test("release adapters consume the shared capability seam", async () => {
  const [defaultGate, mapCloseGate, extendedGate] = await Promise.all([
    readFile(new URL("../default.mjs", import.meta.url), "utf8"),
    readFile(new URL("../map-close.mjs", import.meta.url), "utf8"),
    readFile(new URL("../extended.mjs", import.meta.url), "utf8"),
  ]);

  for (const source of [defaultGate, mapCloseGate]) {
    assert.match(source, /resolvePlaywrightEnvironment/);
    assert.doesNotMatch(source, /function resolvePlaywrightEnv/);
    assert.doesNotMatch(source, /Microsoft\\\\Edge\\\\Application/);
  }
  assert.match(extendedGate, /environmentFlag/);
  assert.match(extendedGate, /requireEnvironmentValue/);
  assert.doesNotMatch(extendedGate, /function envFlag/);
  assert.doesNotMatch(extendedGate, /function requireEnvironment/);
});
