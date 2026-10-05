import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkRepositoryHygiene,
  findBrokenContractReadmeLinks,
  findCurrentAuthorityDocumentationViolations,
  findRetiredRuntimeImports,
  findRepositoryHygieneViolations,
  normalizeRepositoryPath,
  repositoryHygieneViolation,
} from "../check-repository-hygiene.mjs";

test("normalizes repository paths across operating systems", () => {
  assert.equal(normalizeRepositoryPath(".\\apps\\web\\app\\page.tsx"), "apps/web/app/page.tsx");
  assert.equal(normalizeRepositoryPath("./tools//panda-data/src/main.py"), "tools/panda-data/src/main.py");
});

test("allows source, evidence, and glossary files", () => {
  assert.equal(repositoryHygieneViolation("apps/web/app/page.tsx"), null);
  assert.equal(repositoryHygieneViolation("data/frontend-evidence/test-results.json"), null);
  assert.equal(repositoryHygieneViolation("infra/supabase/config.toml"), null);
  assert.equal(repositoryHygieneViolation("GLOSSARY-MAP.md"), null);
  assert.equal(repositoryHygieneViolation("contracts/golden-dataset/GLOSSARY.md"), null);
});

test("rejects repository-root Supabase CLI state outside the canonical infra project", () => {
  assert.equal(
    repositoryHygieneViolation("supabase/.temp/start-secrets"),
    "non-canonical Supabase project state; use infra/supabase",
  );
  assert.equal(
    repositoryHygieneViolation("supabase/.branches/_current_branch"),
    "non-canonical Supabase project state; use infra/supabase",
  );
});

test("rejects the retired CONTEXT domain documentation convention", () => {
  assert.equal(
    repositoryHygieneViolation("CONTEXT-MAP.md"),
    "retired domain documentation filename; use GLOSSARY-MAP.md",
  );
  assert.equal(
    repositoryHygieneViolation("contracts/golden-dataset/CONTEXT.md"),
    "retired domain documentation filename; use GLOSSARY.md",
  );
});

test("rejects generated build, cache, dependency, and test output", () => {
  const violations = findRepositoryHygieneViolations([
    ".batch-work/plan.json",
    "apps/web/.next/server/app.js",
    "apps/web/test-results/example/error-context.md",
    "node_modules/example/index.js",
    "tools/panda-data/src/panda_data/__pycache__/cli.cpython-314.pyc",
    "tools/panda-data/zhipanda_panda_data.egg-info/PKG-INFO",
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
      "tools/panda-data/src/panda_data/__pycache__/cli.cpython-314.pyc",
      "tools/panda-data/zhipanda_panda_data.egg-info/PKG-INFO",
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

test("detects Python imports from the retired API acquisition runtime", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-retired-runtime-"));
  try {
    await mkdir(path.join(cwd, "scripts"), { recursive: true });
    await writeFile(
      path.join(cwd, "scripts", "legacy.py"),
      "from app.acquisition.models import ResponseEnvelope\n",
      "utf8",
    );
    await writeFile(
      path.join(cwd, "scripts", "current.py"),
      "from panda_data.acquisition.models import ResponseEnvelope\n",
      "utf8",
    );

    assert.deepEqual(
      findRetiredRuntimeImports(["scripts/legacy.py", "scripts/current.py"], { cwd }),
      ["scripts/legacy.py"],
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("current authority documentation does not reference retired FastAPI serverless surfaces", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-current-docs-"));
  try {
    await mkdir(path.join(cwd, "docs", "architecture"), { recursive: true });
    await mkdir(path.join(cwd, "docs", "deployment"), { recursive: true });
    await mkdir(path.join(cwd, "contracts"), { recursive: true });
    await writeFile(path.join(cwd, "README.md"), "# Current\n", "utf8");
    await writeFile(path.join(cwd, "contracts", "README.md"), "# Contracts\n", "utf8");
    await writeFile(path.join(cwd, "docs", "architecture", "README.md"), "# Architecture\n", "utf8");
    await writeFile(
      path.join(cwd, "docs", "architecture", "zhipanda-v2-architecture-baseline.md"),
      "Retired detail: docs/architecture/api-request-runtime-boundary.md\n",
      "utf8",
    );
    await writeFile(
      path.join(cwd, "docs", "deployment", "runtime-status.md"),
      "Current runtime is Cloudflare.\n",
      "utf8",
    );

    assert.deepEqual(findCurrentAuthorityDocumentationViolations({ cwd }), [
      "docs/architecture/zhipanda-v2-architecture-baseline.md: docs/architecture/api-request-runtime-boundary.md",
    ]);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("contracts README links only to contract files that exist", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-contract-links-"));
  try {
    await mkdir(path.join(cwd, "contracts"), { recursive: true });
    await writeFile(
      path.join(cwd, "contracts", "README.md"),
      "- [existing](existing.v1.json)\n- [missing](missing.v1.json)\n",
      "utf8",
    );
    await writeFile(path.join(cwd, "contracts", "existing.v1.json"), "{}\n", "utf8");

    assert.deepEqual(findBrokenContractReadmeLinks({ cwd }), ["contracts/missing.v1.json"]);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
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

    await writeFile(
      path.join(cwd, "legacy.py"),
      "import app.acquisition.wikimedia_media_discovery\n",
      "utf8",
    );
    assert.throws(
      () => checkRepositoryHygiene({ cwd, quiet: true }),
      /legacy\.py: retired Python acquisition runtime import/,
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
