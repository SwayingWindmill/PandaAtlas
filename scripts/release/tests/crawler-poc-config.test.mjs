import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../../../.github/workflows/crawler-poc.yml", import.meta.url);
const rootPackagePath = new URL("../../../package.json", import.meta.url);
const apiProjectPath = new URL("../../../services/api/pyproject.toml", import.meta.url);
const acquisitionPolicyPath = new URL(
  "../../../services/api/app/acquisition/policy.py",
  import.meta.url,
);
const acquisitionCapabilityPath = new URL(
  "../../../services/api/app/acquisition/capabilities.py",
  import.meta.url,
);

function escaped(text) {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test("crawler PoC commands use the locked optional dependency boundary", async () => {
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  const apiProject = await readFile(apiProjectPath, "utf8");

  assert.equal(
    rootPackage.scripts["crawler:poc"],
    "uv run --isolated --directory services/api --frozen --extra crawler-poc python scripts/run_crawler_poc.py --browser-lab",
  );
  assert.equal(
    rootPackage.scripts["crawler:poc:strict"],
    "uv run --isolated --directory services/api --frozen --extra crawler-poc python scripts/run_crawler_poc.py --require-browser-lab",
  );
  assert.equal(
    rootPackage.scripts["test:crawler-poc"],
    "uv run --isolated --directory services/api --frozen --extra dev --extra crawler-poc pytest -q tests/acquisition",
  );
  assert.equal(
    rootPackage.scripts["lint:crawler-poc"],
    "uv run --isolated --directory services/api --frozen --extra dev --extra crawler-poc ruff check app/acquisition tests/acquisition scripts/run_crawler_poc.py",
  );
  assert.match(apiProject, /crawler-poc = \[/);
  assert.match(apiProject, /scrapy==2\.17\.0/);
  assert.match(apiProject, /scrapling\[fetchers\]==0\.4\.8/);
});

test("crawler PoC CI requires real controlled browser evidence on Linux and Windows", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  for (const requiredText of [
    "os: ubuntu-latest",
    "os: windows-latest",
    'PYTHON_VERSION: "3.12"',
    'UV_VERSION: "0.11.7"',
    "uv sync --frozen --extra dev --extra crawler-poc",
    "uv run playwright install --with-deps chromium",
    "uv run playwright install chromium",
    "uv run scrapling install",
    "uv run pytest -q tests/acquisition",
    "uv run ruff check app/acquisition tests/acquisition scripts/run_crawler_poc.py",
    "uv run python scripts/run_crawler_poc.py --require-browser-lab",
    "run: git diff --exit-code",
    "uses: actions/upload-artifact@v7.0.1",
  ]) {
    assert.match(workflow, escaped(requiredText));
  }
});

test("crawler policy enables identity consistency but fails closed on blocking", async () => {
  const [policy, capabilities] = await Promise.all([
    readFile(acquisitionPolicyPath, "utf8"),
    readFile(acquisitionCapabilityPath, "utf8"),
  ]);

  assert.match(policy, /production acquisition must obey robots\.txt/);
  assert.match(policy, /automatic proxy rotation is not a production capability/);
  assert.match(policy, /stealth-lab is restricted to loopback-controlled fixtures/);
  assert.match(capabilities, /"stealthy_headers": True/);
  assert.match(capabilities, /"impersonate": "chrome"/);
  assert.match(capabilities, /"on_401_403_429_challenge": "stop-and-review"/);
  assert.match(capabilities, /"automatic_identity_switch": False/);
  assert.match(capabilities, /"solve_cloudflare": False/);
});
