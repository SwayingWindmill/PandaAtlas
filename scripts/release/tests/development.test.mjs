import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyDevelopmentScopes,
  createDevelopmentPlan,
  developmentPlanOutputs,
  normalizeChangedPath,
} from "../development.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("normalizes Windows and relative changed paths", () => {
  assert.equal(normalizeChangedPath(".\\apps\\web\\app\\page.tsx"), "apps/web/app/page.tsx");
  assert.equal(normalizeChangedPath("./services/api/app/main.py"), "services/api/app/main.py");
});

test("documentation and agent-policy changes do not trigger code gates", () => {
  assert.deepEqual(
    classifyDevelopmentScopes(["AGENTS.md", "docs/release/release-gate.md", "README.md"]),
    [],
  );
});

test("web changes select only the web development scope", () => {
  assert.deepEqual(classifyDevelopmentScopes(["apps/web/app/en/page.tsx"]), ["web"]);
});

test("FastAPI changes select only the api development scope", () => {
  assert.deepEqual(classifyDevelopmentScopes(["services/api/app/main.py"]), ["api"]);
});

test("Worker changes select only the worker development scope", () => {
  assert.deepEqual(classifyDevelopmentScopes(["services/worker-api/src/index.ts"]), ["worker"]);
});

test("reviewed collection changes select curation and golden-data checks", () => {
  assert.deepEqual(
    classifyDevelopmentScopes([
      "scripts/curation/process_panda_media.py",
      "data/reviewed-batches/2026.07.24.3/source.json",
      "contracts/golden-dataset/mei-xiang-family.v1.json",
    ]),
    ["curation", "data"],
  );
});

test("release orchestration changes select release tests", () => {
  assert.deepEqual(classifyDevelopmentScopes(["scripts/release/gate-core.mjs"]), ["release"]);
});

test("root script changes select only release-development contracts", () => {
  assert.deepEqual(classifyDevelopmentScopes(["package.json"]), ["release"]);
});

test("generated worktrees do not expand development scope", () => {
  assert.deepEqual(classifyDevelopmentScopes([".worktrees/old/apps/web/app/page.tsx"]), []);
});

test("root JavaScript dependency changes select affected JavaScript scopes", () => {
  assert.deepEqual(classifyDevelopmentScopes(["package-lock.json"]), [
    "release",
    "web",
    "worker",
  ]);
});

test("infrastructure changes select API and release checks", () => {
  assert.deepEqual(classifyDevelopmentScopes(["infra/supabase/migrations/0012_example.sql"]), [
    "release",
    "api",
  ]);
});

test("hybrid production deployment changes select API and release checks", () => {
  assert.deepEqual(
    classifyDevelopmentScopes([
      ".dockerignore",
      "deploy/hybrid-production/docker-compose.zhipanda.yml",
      "scripts/deployment/hybrid-production.mjs",
    ]),
    ["release", "api"],
  );
});

test("Cloudflare infrastructure changes select Worker and release checks", () => {
  assert.deepEqual(classifyDevelopmentScopes(["infra/cloudflare/d1/schema.sql"]), [
    "release",
    "worker",
  ]);
});

test("identity contracts select API checks", () => {
  assert.deepEqual(classifyDevelopmentScopes(["contracts/panda-identity-resolution.v1.json"]), [
    "api",
  ]);
});

test("frontend withdrawal evidence selects release checks", () => {
  assert.deepEqual(classifyDevelopmentScopes(["data/frontend-withdrawals/example.json"]), [
    "release",
  ]);
});

test("development plans preserve scope order and avoid duplicate commands", () => {
  const plan = createDevelopmentPlan(["apps/web/app/page.tsx", "package-lock.json"]);

  assert.deepEqual(plan.scopes, ["release", "web", "worker"]);
  assert.deepEqual(
    plan.groups.map((group) => group.scope),
    ["release", "web", "worker"],
  );
  assert.equal(
    new Set(plan.groups.flatMap((group) => group.commands.map((command) => command.id))).size,
    plan.groups.flatMap((group) => group.commands).length,
  );
});

test("development plan outputs avoid unnecessary CI setup", () => {
  assert.deepEqual(developmentPlanOutputs(createDevelopmentPlan(["AGENTS.md"])), {
    run_checks: "false",
    requires_node_modules: "false",
    requires_python: "false",
    requires_uv: "false",
    scopes: "",
  });

  assert.deepEqual(developmentPlanOutputs(createDevelopmentPlan(["apps/web/app/page.tsx"])), {
    run_checks: "true",
    requires_node_modules: "true",
    requires_python: "false",
    requires_uv: "false",
    scopes: "web",
  });

  assert.deepEqual(
    developmentPlanOutputs(createDevelopmentPlan(["scripts/curation/process_panda_media.py"])),
    {
      run_checks: "true",
      requires_node_modules: "false",
      requires_python: "true",
      requires_uv: "true",
      scopes: "curation",
    },
  );

  assert.deepEqual(developmentPlanOutputs(createDevelopmentPlan(["services/api/app/main.py"])), {
    run_checks: "true",
    requires_node_modules: "false",
    requires_python: "true",
    requires_uv: "true",
    scopes: "api",
  });
});

test("CLI writes GitHub Actions outputs without running checks", async () => {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), "panda-development-gate-"));
  const outputPath = path.join(tempDirectory, "github-output.txt");

  try {
    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts", "release", "development.mjs"),
        "--list",
        "--github-output",
        "--paths=AGENTS.md",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, GITHUB_OUTPUT: outputPath },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const output = await readFile(outputPath, "utf8");
    assert.match(output, /^run_checks=false$/m);
    assert.match(output, /^requires_node_modules=false$/m);
    assert.match(output, /^requires_python=false$/m);
    assert.match(output, /^requires_uv=false$/m);
    assert.match(output, /^scopes=$/m);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});

test("AGENTS reserves expensive release certification for final candidates", async () => {
  const agents = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");

  assert.match(agents, /npm run verify:dev/);
  assert.match(agents, /delivery:map-close/);
  assert.match(agents, /full release gate should run at most once for a candidate commit/i);
  assert.match(agents, /Move expensive checks to final certification/i);
});

test("release workflow skips draft map-close runs and cancels stale PR runs", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github", "workflows", "release-gate.yml"),
    "utf8",
  );

  assert.match(workflow, /- ready_for_review/);
  assert.match(workflow, /- converted_to_draft/);
  assert.match(
    workflow,
    /group: release-gate-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/,
  );
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.match(workflow, /development-gate:/);
  assert.match(workflow, /--list --github-output/);
  assert.match(workflow, /requires_node_modules == 'true'/);
  assert.match(workflow, /requires_python == 'true'/);
  assert.match(workflow, /requires_uv == 'true'/);
  assert.match(workflow, /run_checks == 'true'/);
  assert.match(
    workflow,
    /npm run verify:dev -- --base "\$\{\{ github\.event\.pull_request\.base\.sha \}\}"/,
  );
  assert.match(workflow, /github\.event\.pull_request\.draft == false/);

  const developmentJob = workflow.slice(
    workflow.indexOf("  development-gate:"),
    workflow.indexOf("  release-gate:"),
  );
  assert.doesNotMatch(developmentJob, /playwright install|release:default|release:extended/);
});
