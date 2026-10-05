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

  assert.match(workflow, /on:\s*\n\s*pull_request:\s*\n/u);
  assert.doesNotMatch(workflow, /pull_request:\s*\n\s*paths:/u);
  assert.match(workflow, /npm run verify:dev -- --base origin\/\$\{\{ github\.base_ref \}\}/);
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
