import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const sourceRegistryPath = new URL(
  "../../../data/acquisition-sources/registry.json",
  import.meta.url,
);
const sourceReviewPath = new URL(
  "../../../docs/data-acquisition/source-review-2026-07-22.md",
  import.meta.url,
);
const commonsAdapterPath = new URL(
  "../../../services/api/app/acquisition/wikimedia_commons.py",
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
    "uv run --isolated --directory services/api --frozen --extra dev --extra crawler-poc ruff check app/acquisition tests/acquisition scripts/run_crawler_poc.py scripts/run_source_adapter.py",
  );
  assert.equal(
    rootPackage.scripts["source:xi-lun"],
    "uv run --isolated --directory services/api --frozen --extra crawler-poc python scripts/run_source_adapter.py",
  );
  assert.equal(
    rootPackage.scripts["source:xi-lun:live"],
    "uv run --isolated --directory services/api --frozen --extra crawler-poc python scripts/run_source_adapter.py --live",
  );
  assert.equal(
    rootPackage.scripts["test:source-adapters"],
    "uv run --isolated --directory services/api --frozen --extra dev --extra crawler-poc pytest -q tests/acquisition/test_source_registry.py tests/acquisition/test_wikimedia_commons_adapter.py",
  );
  assert.match(apiProject, /crawler-poc = \[/);
  assert.match(apiProject, /httpx==0\.28\.1/);
  assert.match(apiProject, /scrapy==2\.17\.0/);
  assert.match(apiProject, /scrapling\[fetchers\]==0\.4\.8/);
});

test("crawler PoC CI requires real controlled browser and offline source evidence", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  for (const requiredText of [
    "os: ubuntu-latest",
    "os: windows-latest",
    'PYTHON_VERSION: "3.12"',
    'UV_VERSION: "0.11.7"',
    "data/acquisition-sources/**",
    "services/api/scripts/run_source_adapter.py",
    "uv sync --frozen --extra dev --extra crawler-poc",
    "uv run playwright install --with-deps chromium",
    "uv run playwright install chromium",
    "uv run scrapling install",
    "uv run pytest -q tests/acquisition",
    "uv run ruff check app/acquisition tests/acquisition scripts/run_crawler_poc.py scripts/run_source_adapter.py",
    "uv run python scripts/run_source_adapter.py",
    "uv run python scripts/run_crawler_poc.py --require-browser-lab",
    "run: git diff --exit-code",
    "uses: actions/upload-artifact@v7.0.1",
    "path: .release-gate/",
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
  assert.match(policy, /browser-stealth requires a source-specific fingerprint review reference/);
  assert.match(capabilities, /CapabilityMode\.BROWSER_STEALTH/);
  assert.match(capabilities, /"stealthy_headers": True/);
  assert.match(capabilities, /"impersonate": "chrome"/);
  assert.match(capabilities, /"on_401_403_429_challenge": "stop-and-review"/);
  assert.match(capabilities, /"automatic_identity_switch": False/);
  assert.match(capabilities, /"solve_cloudflare": False/);
  assert.match(capabilities, /"block_webrtc": True/);
});

test("reviewed source registry binds access decisions and non-browser Wikimedia policy", async () => {
  const [registryText, reviewBody, adapter] = await Promise.all([
    readFile(sourceRegistryPath, "utf8"),
    readFile(sourceReviewPath),
    readFile(commonsAdapterPath, "utf8"),
  ]);
  const registry = JSON.parse(registryText);
  const normalizedReview = reviewBody.toString("utf8").replace(/\r\n?/g, "\n");
  const reviewSha256 = createHash("sha256").update(normalizedReview).digest("hex");

  assert.equal(registry.review_document_sha256, reviewSha256);
  const commons = registry.sources.find(
    (source) => source.source_id === "wikimedia-commons-action-api",
  );
  const zooAtlanta = registry.sources.find(
    (source) => source.source_id === "zoo-atlanta-public-pages",
  );
  const fuBao = registry.sources.find(
    (source) => source.source_id === "fu-bao-current-location-official-source",
  );

  assert.equal(commons.access_status, "approved");
  assert.equal(commons.browser_impersonation, false);
  assert.equal(commons.media_reuse_policy, "per-file-license-required");
  assert.equal(zooAtlanta.access_status, "permission-required");
  assert.equal(zooAtlanta.live_fetch, false);
  assert.equal(fuBao.access_status, "manual-review-required");
  assert.equal(fuBao.live_fetch, false);
  assert.match(adapter, /PandaAtlasBot\/0\.1/);
  assert.match(adapter, /must not impersonate a browser User-Agent/);
  assert.match(adapter, /original_image_requested": False/);
});
