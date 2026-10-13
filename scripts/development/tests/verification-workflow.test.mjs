import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("every pull request reaches the shared planner and API scopes run database-backed checks", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github", "workflows", "development-verification.yml"),
    "utf8",
  );

  assert.match(workflow, /on:\s*\r?\n\s*pull_request:\s*\r?\n/u);
  assert.doesNotMatch(workflow, /pull_request:\s*\r?\n\s*paths:/u);
  // Pull requests verify their changed scopes; every merge to main verifies all scopes.
  assert.match(workflow, /push:\s*\r?\n\s*branches: \[main\]/u);
  assert.match(workflow, /VERIFY_SELECTION: \$\{\{ github\.event_name == 'pull_request' && format\('--base origin\/\{0\}', github\.base_ref\) \|\| '--all' \}\}/u);
  assert.match(workflow, /verify\.mjs --list \$\{\{ env\.VERIFY_SELECTION \}\} --github-output/u);
  assert.match(workflow, /npm run verify:dev -- \$\{\{ env\.VERIFY_SELECTION \}\}/u);
  assert.match(workflow, /requires_python: \$\{\{ steps\.plan\.outputs\.requires_python \}\}/);
  assert.match(workflow, /requires_uv: \$\{\{ steps\.plan\.outputs\.requires_uv \}\}/);
  assert.match(workflow, /if: needs\.plan\.outputs\.requires_python == 'true'/);
  assert.match(workflow, /actions\/setup-python@v6\.3\.0/);
  assert.match(workflow, /if: needs\.plan\.outputs\.requires_uv == 'true'/);
  assert.match(workflow, /python -m pip install uv==\$\{\{ env\.UV_VERSION \}\}/);
  assert.match(workflow, /npm run infra:start/);
  assert.match(workflow, /npm run ops -- run api\.integration/);
  assert.match(workflow, /npm run ops -- run api\.db-types/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /npm run infra:stop/);
});

test("crawler PoC workflow targets the active panda-data runtime", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github", "workflows", "crawler-poc.yml"),
    "utf8",
  );

  assert.match(workflow, /tools\/panda-data\/src\/panda_data\/acquisition\/\*\*/u);
  assert.match(workflow, /tools\/panda-data\/tests\/test_source_runtime\.py/u);
  assert.match(workflow, /tools\/panda-data\/pyproject\.toml/u);
  assert.match(workflow, /tools\/panda-data\/uv\.lock/u);
  assert.match(workflow, /npm run lint:crawler-poc/u);
  assert.match(workflow, /npm run test:crawler-poc/u);
  assert.match(workflow, /npm run source:xi-lun/u);
  assert.match(workflow, /npm run crawler:poc:strict/u);
  assert.match(workflow, /uv run --isolated --directory tools\/panda-data --frozen --extra crawler playwright install --with-deps chromium/u);
  assert.match(workflow, /uv run --isolated --directory tools\/panda-data --frozen --extra crawler scrapling install/u);
  assert.match(workflow, /git diff --exit-code/u);
  assert.match(workflow, /path: \.release-gate\//u);
  assert.doesNotMatch(workflow, /services\/api\//u);
});

test("the Cloudflare deployability build also verifies main and reuses cached Playwright browsers", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github", "workflows", "cloudflare-deployability.yml"),
    "utf8",
  );

  assert.match(workflow, /on:\s*\r?\n\s*push:\s*\r?\n\s*branches: \[main\]/u);
  assert.match(workflow, /path: ~\/\.cache\/ms-playwright\s*\r?\n\s*key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ steps\.playwright\.outputs\.version \}\}/u);
  assert.match(workflow, /if: steps\.playwright-cache\.outputs\.cache-hit != 'true'\s*\r?\n\s*run: npx playwright install --with-deps chromium/u);
});
