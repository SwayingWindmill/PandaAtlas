import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../../../.github/workflows/release-gate.yml", import.meta.url);
const actionPath = new URL(
  "../../../.github/actions/setup-release-candidate/action.yml",
  import.meta.url,
);

function jobSource(workflow, jobId, nextJobId) {
  const normalized = workflow.replaceAll("\r\n", "\n");
  const start = normalized.indexOf(`  ${jobId}:\n`);
  assert.notEqual(start, -1, `Missing Workflow job ${jobId}`);
  const end = nextJobId
    ? normalized.indexOf(`  ${nextJobId}:\n`, start + 1)
    : normalized.length;
  assert.notEqual(end, -1, `Missing Workflow job boundary ${nextJobId}`);
  return normalized.slice(start, end);
}

test("release candidate bootstrap owns the pinned cross-platform toolchain", async () => {
  const action = await readFile(actionPath, "utf8");

  assert.match(action, /using: composite/);
  for (const input of ["node-version", "npm-version", "python-version", "uv-version"]) {
    assert.match(action, new RegExp(`  ${input}:[\\s\\S]*?required: true`));
    assert.match(action, new RegExp(`inputs\\.${input}`));
  }
  assert.match(action, /uses: actions\/setup-node@v6\.4\.0/);
  assert.match(action, /uses: actions\/setup-python@v6\.3\.0/);
  assert.match(action, /npm install --global "npm@\$\{RELEASE_NPM_VERSION\}"/);
  assert.match(action, /python -m pip install "uv==\$\{RELEASE_UV_VERSION\}"/);
  assert.match(action, /run: npm ci/);
  assert.equal((action.match(/shell: bash/g) ?? []).length, 3);
  assert.doesNotMatch(action, /actions\/checkout/);
});

test("final-candidate jobs reuse one bootstrap while development remains planner-driven", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const finalJobs = [
    ["release-gate", "release-gate-windows"],
    ["release-gate-windows", "supabase-foundation"],
    ["supabase-foundation", "release-gate-extended"],
    ["release-gate-extended", null],
  ];

  assert.equal(
    (workflow.match(/uses: \.\/\.github\/actions\/setup-release-candidate/g) ?? []).length,
    4,
  );

  for (const [jobId, nextJobId] of finalJobs) {
    const source = jobSource(workflow, jobId, nextJobId);
    assert.match(source, /uses: actions\/checkout@v7\.0\.0[\s\S]*?clean: true/);
    assert.match(source, /uses: \.\/\.github\/actions\/setup-release-candidate/);
    for (const input of ["node-version", "npm-version", "python-version", "uv-version"]) {
      assert.match(source, new RegExp(`${input}: \\$\\{\\{ env\\.`));
    }
    assert.doesNotMatch(source, /uses: actions\/setup-node/);
    assert.doesNotMatch(source, /uses: actions\/setup-python/);
    assert.doesNotMatch(source, /npm install --global/);
    assert.doesNotMatch(source, /python -m pip install/);
    assert.doesNotMatch(source, /run: npm ci/);
  }

  const development = jobSource(workflow, "development-gate", "release-gate");
  assert.doesNotMatch(development, /setup-release-candidate/);
  assert.match(development, /id: development-plan/);
  assert.match(development, /requires_node_modules/);
  assert.match(development, /requires_python/);
  assert.match(development, /requires_uv/);

  const authoritative = jobSource(workflow, "release-gate", "release-gate-windows");
  assert.match(authoritative, /show-versions: "true"/);
  assert.equal((workflow.match(/show-versions: "true"/g) ?? []).length, 1);
});
