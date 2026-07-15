import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL(
  "../../../.github/workflows/release-gate.yml",
  import.meta.url,
);
const defaultGatePath = new URL("../default.mjs", import.meta.url);
const workerPackagePath = new URL(
  "../../../services/worker-api/package.json",
  import.meta.url,
);
const webPackagePath = new URL(
  "../../../apps/web/package.json",
  import.meta.url,
);
const packageLockPath = new URL("../../../package-lock.json", import.meta.url);
const rootPackagePath = new URL("../../../package.json", import.meta.url);

test("CI declares reproducible Linux and Windows default gates", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  for (const requiredText of [
    "os: ubuntu-latest",
    "os: windows-latest",
    'NPM_VERSION: "10.9.0"',
    'PYTHON_VERSION: "3.12"',
    'UV_VERSION: "0.11.7"',
    "run: npm ci",
    "npx playwright install --with-deps chromium",
    "npx playwright install chromium",
    "uses: actions/checkout@v7.0.0",
    "uses: actions/setup-node@v6.4.0",
    "uses: actions/setup-python@v6.3.0",
    "uses: actions/upload-artifact@v7.0.1",
    "include-hidden-files: true",
    "if-no-files-found: error",
    "run: git diff --exit-code",
  ]) {
    assert.match(
      workflow,
      new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});

test("default gate includes golden dataset validation", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");

  assert.match(defaultGate, /test:golden-dataset/);
  assert.match(defaultGate, /Golden dataset contract/);
});

test("default gate runs the Beta hard-gate preflight after the production build", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

  assert.equal(
    rootPackage.scripts["check:beta-hard-gates"],
    "node scripts/release/check-beta-hard-gates.mjs",
  );
  assert.match(defaultGate, /id: "beta-hard-gates"/);
  assert.match(defaultGate, /dependsOn: \["golden-dataset", "web-build"\]/);
  assert.match(defaultGate, /check:beta-hard-gates/);
});

test("default gate separates D1 and HTTP Worker smoke", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");
  const workerPackage = JSON.parse(await readFile(workerPackagePath, "utf8"));

  assert.match(defaultGate, /smoke:api:cf:d1/);
  assert.match(defaultGate, /smoke:api:cf:http/);
  assert.match(defaultGate, /process\.platform === "win32"/);
  assert.equal(
    workerPackage.scripts["smoke:d1"],
    "node scripts/smoke_test_worker.mjs --mode=d1",
  );
  assert.equal(
    workerPackage.scripts["smoke:http"],
    "node scripts/smoke_test_worker.mjs --mode=http",
  );
});

test("web lockfile retains Linux native optional packages", async () => {
  const webPackage = JSON.parse(await readFile(webPackagePath, "utf8"));
  const packageLock = JSON.parse(await readFile(packageLockPath, "utf8"));
  const expectedPackages = {
    "@tailwindcss/oxide-linux-x64-gnu": "4.2.1",
    "lightningcss-linux-x64-gnu": "1.31.1",
  };

  assert.deepEqual(webPackage.optionalDependencies, expectedPackages);
  for (const [packageName, version] of Object.entries(expectedPackages)) {
    const lockEntry = packageLock.packages[`node_modules/${packageName}`];
    assert.equal(lockEntry?.version, version);
    assert.equal(lockEntry?.optional, true);
    assert.deepEqual(lockEntry?.os, ["linux"]);
    assert.deepEqual(lockEntry?.cpu, ["x64"]);
  }
});
