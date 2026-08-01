import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkRepositoryHygiene,
  findRepositoryHygieneViolations,
  normalizeRepositoryPath,
  repositoryHygieneViolation,
} from "../check-repository-hygiene.mjs";

test("normalizes repository paths across operating systems", () => {
  assert.equal(normalizeRepositoryPath(".\\apps\\web\\app\\page.tsx"), "apps/web/app/page.tsx");
  assert.equal(normalizeRepositoryPath("./services//api/app/main.py"), "services/api/app/main.py");
});

test("allows source, evidence, and root planning files", () => {
  assert.equal(repositoryHygieneViolation("apps/web/app/page.tsx"), null);
  assert.equal(repositoryHygieneViolation("data/frontend-evidence/test-results.json"), null);
  assert.equal(repositoryHygieneViolation("task_plan.md"), null);
  assert.equal(repositoryHygieneViolation("findings.md"), null);
  assert.equal(repositoryHygieneViolation("progress.md"), null);
});

test("rejects generated build, cache, dependency, and test output", () => {
  const violations = findRepositoryHygieneViolations([
    ".batch-work/plan.json",
    "apps/web/.next/server/app.js",
    "apps/web/test-results/example/error-context.md",
    "node_modules/example/index.js",
    "services/api/app/__pycache__/main.cpython-314.pyc",
    "services/api/panda_atlas_api.egg-info/PKG-INFO",
    "apps/web/tsconfig.tsbuildinfo",
    "apps/web/.vercel/project.json",
  ]);

  assert.deepEqual(
    violations.map(({ path }) => path),
    [
      ".batch-work/plan.json",
      "apps/web/.next/server/app.js",
      "apps/web/.vercel/project.json",
      "apps/web/test-results/example/error-context.md",
      "apps/web/tsconfig.tsbuildinfo",
      "node_modules/example/index.js",
      "services/api/app/__pycache__/main.cpython-314.pyc",
      "services/api/panda_atlas_api.egg-info/PKG-INFO",
    ],
  );
});

test("rejects copy-style filenames that commonly come from accidental duplicates", () => {
  assert.equal(
    repositoryHygieneViolation("apps/web/middleware (1).ts"),
    "copy-style filename suffix such as (1)",
  );
  assert.equal(
    repositoryHygieneViolation("apps/web/tests/smoke/localized-trust-spine (2).spec.ts"),
    "copy-style filename suffix such as (1)",
  );
  assert.equal(repositoryHygieneViolation("docs/adr-0001.md"), null);
});

test("deduplicates and sorts violations for stable output", () => {
  assert.deepEqual(findRepositoryHygieneViolations([
    "build/test-results/result.json",
    "apps/web/middleware (1).ts",
    "build/test-results/result.json",
  ]), [
    {
      path: "apps/web/middleware (1).ts",
      reason: "copy-style filename suffix such as (1)",
    },
    {
      path: "build/test-results/result.json",
      reason: "test runner output",
    },
  ]);
});

test("checks tracked and unignored paths in a real Git repository", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-repository-hygiene-"));

  try {
    execFileSync("git", ["init", "--quiet"], { cwd });
    await writeFile(path.join(cwd, "source.ts"), "export const value = 1;\n", "utf8");
    assert.doesNotThrow(() => checkRepositoryHygiene({ cwd, quiet: true }));

    await writeFile(path.join(cwd, "source (1).ts"), "export const value = 2;\n", "utf8");
    assert.throws(
      () => checkRepositoryHygiene({ cwd, quiet: true }),
      /source \(1\)\.ts: copy-style filename suffix/,
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
