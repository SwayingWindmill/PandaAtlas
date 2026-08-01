import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertTrackedWorkspaceClean,
  inspectTrackedWorkspace,
  WorkspaceCleanlinessError,
} from "../check-workspace-cleanliness.mjs";

const silentLogger = { log() {}, error() {} };

function git(cwd, ...args) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

async function createRepository() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "panda-workspace-cleanliness-"));
  git(cwd, "init", "--quiet");
  git(cwd, "config", "user.email", "release-gate@example.invalid");
  git(cwd, "config", "user.name", "Release Gate");
  await writeFile(path.join(cwd, "tracked.txt"), "clean\n", "utf8");
  git(cwd, "add", "tracked.txt");
  git(cwd, "commit", "--quiet", "-m", "fixture");
  return cwd;
}

test("tracked workspace cleanliness passes a clean repository and ignores untracked files", async () => {
  const cwd = await createRepository();
  try {
    await writeFile(path.join(cwd, "untracked.txt"), "generated\n", "utf8");
    assert.deepEqual(inspectTrackedWorkspace({ cwd }), { clean: true, diagnostics: [] });
    assert.doesNotThrow(() =>
      assertTrackedWorkspaceClean({ context: "test-clean", cwd, logger: silentLogger }),
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("tracked workspace cleanliness fails with actionable diagnostics", async () => {
  const cwd = await createRepository();
  try {
    await writeFile(path.join(cwd, "tracked.txt"), "dirty  \n", "utf8");
    const inspection = inspectTrackedWorkspace({ cwd });
    assert.equal(inspection.clean, false);
    assert.match(inspection.diagnostics.find(({ label }) => label === "Modified tracked files").output, /tracked\.txt/);
    assert.match(inspection.diagnostics.find(({ label }) => label === "Whitespace errors").output, /trailing whitespace/);

    assert.throws(
      () => assertTrackedWorkspaceClean({ context: "test-dirty", cwd, logger: silentLogger }),
      (error) => {
        assert.ok(error instanceof WorkspaceCleanlinessError);
        assert.equal(error.context, "test-dirty");
        assert.ok(error.diagnostics.length >= 6);
        return true;
      },
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Release Gate workflow uses one cleanliness interface for every tracked-file check", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/release-gate.yml", import.meta.url),
    "utf8",
  );
  const invocations = workflow.match(
    /node scripts\/release\/check-workspace-cleanliness\.mjs --context [\w-]+/g,
  ) ?? [];

  assert.deepEqual(invocations, [
    "node scripts/release/check-workspace-cleanliness.mjs --context development-gate",
    "node scripts/release/check-workspace-cleanliness.mjs --context authoritative-map-close",
    "node scripts/release/check-workspace-cleanliness.mjs --context windows-map-close",
    "node scripts/release/check-workspace-cleanliness.mjs --context extended-gate",
  ]);
  assert.doesNotMatch(workflow, /^\s*run:\s*git diff --exit-code\s*$/gm);
});
