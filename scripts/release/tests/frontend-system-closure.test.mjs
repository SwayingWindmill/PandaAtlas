import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateFrontendSystemClosure } from "../check-frontend-system-closure.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const canonicalIds = [
  "home",
  "atlas",
  "profile",
  "lineage",
  "map",
  "my-pandas",
  "institution",
  "place",
].sort();

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

test("Slice 11 closes legacy public ownership and validates all inventories", async () => {
  assert.deepEqual(await validateFrontendSystemClosure(repoRoot), []);
});

test("Slice 11 inventories cover every canonical public surface", async () => {
  const contract = await json("contracts/frontend-system-closure.v1.json");
  const states = await json(contract.state_registry);
  const screenshots = await json(contract.screenshot_inventory);
  const budgets = await json(contract.route_budget_inventory);

  assert.deepEqual([...contract.canonical_surface_ids].sort(), canonicalIds);
  for (const inventory of [states, screenshots, budgets]) {
    assert.deepEqual(inventory.surfaces.map((surface) => surface.id).sort(), canonicalIds);
  }
  for (const legacyPath of contract.forbidden_legacy_paths) {
    assert.equal(existsSync(path.join(repoRoot, legacyPath)), false, legacyPath);
  }
});

test("Slice 11 architecture, browser matrix, and canonical budgets are release gates", async () => {
  const defaultGate = await readFile(path.join(repoRoot, "scripts/release/default.mjs"), "utf8");
  const rootPackage = await json("package.json");
  const webPackage = await json("apps/web/package.json");
  const playwrightConfig = await readFile(path.join(repoRoot, "apps/web/playwright.config.ts"), "utf8");
  const browserMatrixRunner = await readFile(path.join(repoRoot, "apps/web/scripts/run-browser-matrix.mjs"), "utf8");
  const browserRuntimeCheck = await readFile(path.join(repoRoot, "apps/web/scripts/check-playwright-runtime.mjs"), "utf8");
  const releaseWorkflow = await readFile(path.join(repoRoot, ".github/workflows/release-gate.yml"), "utf8");

  assert.match(defaultGate, /frontend-system-closure/);
  assert.match(defaultGate, /check:frontend-system-closure/);
  assert.match(defaultGate, /canonical-route-budgets/);
  assert.match(defaultGate, /check:route-performance-budgets/);
  assert.equal(rootPackage.scripts["smoke:web:matrix"], "npm run smoke:matrix -w web");
  assert.equal(webPackage.scripts["smoke:matrix"], "node scripts/run-browser-matrix.mjs");
  assert.match(browserMatrixRunner, /cmd\.exe/);
  assert.match(browserMatrixRunner, /npm exec playwright -- test/);
  assert.match(browserMatrixRunner, /PLAYWRIGHT_BROWSER_MATRIX: "1"/);
  assert.match(browserRuntimeCheck, /chromium, firefox, webkit/);
  assert.match(browserRuntimeCheck, /RELEASE_GATE_USE_SYSTEM_EDGE/);
  assert.match(browserRuntimeCheck, /"msedge"/);
  assert.match(releaseWorkflow, /playwright install --with-deps chromium firefox webkit/);
  assert.match(releaseWorkflow, /playwright install chromium firefox webkit/);
  assert.equal((releaseWorkflow.match(/PLAYWRIGHT_BROWSER_MATRIX: "1"/g) ?? []).length, 2);
  for (const browser of ["chromium", "firefox", "webkit"]) {
    assert.match(playwrightConfig, new RegExp(`name: ["']${browser}["']`));
  }
});

test("canonical route budget checker reads emitted build assets and gzip limits", async () => {
  const source = await readFile(path.join(repoRoot, "scripts/release/check-route-performance-budgets.mjs"), "utf8");
  assert.match(source, /app-build-manifest\.json/);
  assert.match(source, /gzipSync/);
  assert.match(source, /first_load_javascript_gzip_limit_bytes/);
  assert.match(source, /initial_static_transfer_gzip_limit_bytes/);
});
