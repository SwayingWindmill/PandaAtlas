import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BatchOperationError,
  createBatchPlan,
  executeBatchOperation,
  loadBatchCatalog,
  normalizeManifestPath,
  validateBatchCatalog,
} from "../../batch/operations.mjs";
import {
  checkBatchWorkflowInterface,
  validateBatchWorkflowText,
} from "../check-batch-workflow-interface.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const workflowPath = path.join(repoRoot, ".github", "workflows", "batch-operations.yml");

test("batch catalog exposes the standard operations", () => {
  const catalog = loadBatchCatalog();
  assert.deepEqual(validateBatchCatalog(catalog), []);
  assert.equal(catalog.operations.length, 9);
  assert.deepEqual(
    catalog.operations.filter((item) => item.status === "ready").map((item) => item.id),
    ["research.validate", "curation.validate", "media.process"],
  );
});

test("ready commands cannot drift through catalog-only changes", () => {
  const catalog = structuredClone(loadBatchCatalog());
  catalog.operations.find((item) => item.id === "research.validate").command.push("--version");
  assert.ok(
    validateBatchCatalog(catalog).some((item) => item.includes("code-level allowlist")),
  );
});

test("ready plans expose fixed command requirements", () => {
  const catalog = loadBatchCatalog();
  const plan = createBatchPlan({ catalog, operationId: "media.process", repositoryRoot: repoRoot });
  assert.equal(plan.executable, true);
  assert.equal(plan.requires_python, true);
  assert.equal(plan.requires_uv, true);
  assert.equal(plan.command[0], "uv");
  assert.ok(plan.artifact_paths.every((item) => item.startsWith(".batch-work/")));
});

test("manifest paths cannot escape the repository", () => {
  assert.throws(() => normalizeManifestPath("../secret.json", repoRoot), BatchOperationError);
  assert.throws(() => normalizeManifestPath("C:/secret.json", repoRoot), BatchOperationError);
});

test("planned write operations remain non-executable", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "panda-batch-plan-"));
  try {
    await writeFile(path.join(root, "release.json"), "{}\n", "utf8");
    const catalog = loadBatchCatalog();
    const plan = createBatchPlan({
      catalog,
      operationId: "release.publish",
      manifestPath: "release.json",
      repositoryRoot: root,
    });
    assert.equal(plan.executable, false);
    assert.equal(plan.approval_required, true);
    assert.throws(
      () => executeBatchOperation({
        catalog,
        operationId: "release.publish",
        manifestPath: "release.json",
        repositoryRoot: root,
        changeReference: "issue-999",
      }),
      /is not executable/,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("ready adapters execute without a shell and record results", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "panda-batch-run-"));
  try {
    const catalog = loadBatchCatalog();
    const calls = [];
    const outcome = executeBatchOperation({
      catalog,
      operationId: "research.validate",
      repositoryRoot: root,
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0 };
      },
    });
    assert.equal(outcome.status, "passed");
    assert.equal(calls[0].command, "node");
    assert.equal(calls[0].options.shell, false);
    const result = JSON.parse(
      await readFile(path.join(root, ".batch-work", "result.json"), "utf8"),
    );
    assert.equal(result.operation, "research.validate");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("approval execution requires change reference and protected environment", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "panda-batch-approval-"));
  try {
    await writeFile(path.join(root, "manifest.json"), "{}\n", "utf8");
    const catalog = structuredClone(loadBatchCatalog());
    const operation = catalog.operations.find((item) => item.id === "research.validate");
    operation.effect = "production-write";
    operation.approval_required = true;
    operation.manifest_required = true;
    assert.throws(
      () => createBatchPlan({
        catalog,
        operationId: "research.validate",
        manifestPath: "manifest.json",
        executeRequested: true,
        repositoryRoot: root,
      }),
      /requires --change-reference/,
    );
    assert.throws(
      () => executeBatchOperation({
        catalog,
        operationId: "research.validate",
        manifestPath: "manifest.json",
        repositoryRoot: root,
        changeReference: "issue-123",
        approvedEnvironment: "wrong-environment",
      }),
      /requires the production-batch approval environment/,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("tracked workflow passes and unsafe mutations fail", async () => {
  assert.deepEqual(checkBatchWorkflowInterface({ repositoryRoot: repoRoot, quiet: true }), {
    operations: 9,
    ready: 3,
  });
  const catalog = loadBatchCatalog();
  const workflowText = await readFile(workflowPath, "utf8");
  const unsafe = workflowText
    .replace("contents: read", "contents: write")
    .replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:");
  const violations = validateBatchWorkflowText({ workflowText: unsafe, catalog });
  assert.ok(violations.includes("workflow contains forbidden contents write permission"));
  assert.ok(violations.includes("workflow contains forbidden push trigger"));
  assert.ok(violations.includes("workflow must be workflow_dispatch-only"));
});
