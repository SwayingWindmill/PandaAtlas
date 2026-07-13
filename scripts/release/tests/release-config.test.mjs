import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../../../.github/workflows/release-gate.yml", import.meta.url);
const defaultGatePath = new URL("../default.mjs", import.meta.url);
const workerPackagePath = new URL("../../../services/worker-api/package.json", import.meta.url);

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
    "uses: actions/upload-artifact@v4",
    "run: git diff --exit-code",
  ]) {
    assert.match(workflow, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
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
