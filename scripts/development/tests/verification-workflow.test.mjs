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
  assert.match(workflow, /verify\.mjs --list \$VERIFY_SELECTION --github-output/u);
  // The verify job runs exactly the scopes the plan selected.
  assert.match(workflow, /SCOPES: \$\{\{ needs\.plan\.outputs\.scopes \}\}/u);
  assert.match(workflow, /args\+=\(--scope "\$scope"\)/u);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/u);
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

test("only pull requests fetch full history, because only they diff against a base", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github", "workflows", "development-verification.yml"),
    "utf8",
  );

  // 0 is falsy in GitHub expressions, so the full-history value must be the fallback, not the && branch.
  const depths = [...workflow.matchAll(/fetch-depth: (.+)/gu)].map((match) => match[1].trim());
  assert.ok(depths.length > 0);
  for (const depth of depths) assert.equal(depth, "${{ github.event_name != 'pull_request' && 1 || 0 }}");
});

test("production deploys only from main, after approval, API before Web", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github", "workflows", "production-deploy.yml"),
    "utf8",
  );

  assert.match(workflow, /on:\s*\r?\n\s*push:\s*\r?\n\s*branches: \[main\]/u);
  assert.doesNotMatch(workflow, /pull_request/u);
  assert.match(workflow, /environment: production/u);
  // The Cloudflare token exists only in the approved deploy job.
  const [build, deploy] = workflow.split(/\n  deploy:\r?\n/u);
  assert.ok(deploy !== undefined);
  assert.doesNotMatch(build, /secrets\./u);
  const apiDeploy = deploy.indexOf("working-directory: services/api");
  const webDeploy = deploy.indexOf("working-directory: apps/web");
  assert.ok(apiDeploy !== -1 && webDeploy > apiDeploy, "the API Worker deploys before the Web Worker");
  assert.match(deploy, /cf deploy --prebuilt --mode production --tag/u);
  assert.match(deploy, /if: github\.ref == 'refs\/heads\/main'/u);
  assert.match(deploy, /npm ci --ignore-scripts/u);
  // .cloudflare is a hidden directory, which upload-artifact skips by default.
  assert.match(build, /include-hidden-files: true/u);
});

test("no workspace keeps a workstation production deploy script", async () => {
  for (const workspace of ["apps/web", "services/api"]) {
    const manifest = JSON.parse(await readFile(path.join(repoRoot, workspace, "package.json"), "utf8"));
    assert.equal(Object.values(manifest.scripts).some((script) => /\bcf deploy\b/u.test(script)), false, workspace);
  }
});
