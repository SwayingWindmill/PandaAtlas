import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkRepositoryHygiene,
  findActiveAgentNavigationViolations,
  findCurrentAuthorityDocumentationViolations,
  findRetiredRuntimeImports,
  findRepositoryHygieneViolations,
  findSkillMirrorViolations,
  normalizeRepositoryPath,
  repositoryHygieneViolation,
} from "../check-repository-hygiene.mjs";

test("normalizes repository paths across operating systems", () => {
  assert.equal(normalizeRepositoryPath(".\\apps\\web\\app\\page.tsx"), "apps/web/app/page.tsx");
  assert.equal(normalizeRepositoryPath("./tools//panda-data/src/main.py"), "tools/panda-data/src/main.py");
});

test("allows source, evidence, and glossary files", () => {
  assert.equal(repositoryHygieneViolation("apps/web/app/page.tsx"), null);
  assert.equal(repositoryHygieneViolation("data/release-manifests/2026.10.31.1.json"), null);
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

test("active agent navigation does not point at retired request runtimes", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-agent-navigation-"));
  try {
    await mkdir(path.join(cwd, "docs", "agents"), { recursive: true });
    await writeFile(
      path.join(cwd, "docs", "agents", "codegraph.md"),
      "Index FastAPI under services/api and services/worker-api.\n",
      "utf8",
    );

    assert.deepEqual(findActiveAgentNavigationViolations({ cwd }), [
      "docs/agents/codegraph.md: FastAPI",
      "docs/agents/codegraph.md: services/worker-api",
    ]);
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

test("local excludes cannot hide working-tree files while tracked .gitignore rules still apply", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-repository-hygiene-excludes-"));

  try {
    execFileSync("git", ["init", "--quiet"], { cwd });
    await writeFile(path.join(cwd, ".gitignore"), "node_modules/\n", "utf8");
    await mkdir(path.join(cwd, "node_modules"), { recursive: true });
    await writeFile(path.join(cwd, "node_modules", "index.js"), "module.exports = 1;\n", "utf8");
    assert.doesNotThrow(() => checkRepositoryHygiene({ cwd, quiet: true }));

    const localExcludes = path.join(cwd, "local-excludes.txt");
    await writeFile(localExcludes, "/hidden (1).ts\n", "utf8");
    execFileSync("git", ["config", "core.excludesFile", localExcludes], { cwd });
    await writeFile(path.join(cwd, ".git", "info", "exclude"), "/private (1).ts\n", "utf8");
    await writeFile(path.join(cwd, "hidden (1).ts"), "export const value = 1;\n", "utf8");
    await writeFile(path.join(cwd, "private (1).ts"), "export const value = 2;\n", "utf8");

    assert.throws(
      () => checkRepositoryHygiene({ cwd, quiet: true }),
      (error) => /hidden \(1\)\.ts/.test(error.message) && /private \(1\)\.ts/.test(error.message),
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("enforces 1:1 byte-for-byte mirroring between .agents/skills and .claude/skills", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-skill-mirror-"));
  try {
    await mkdir(path.join(cwd, ".agents", "skills", "poteto-mode"), { recursive: true });
    await mkdir(path.join(cwd, ".claude", "skills", "poteto-mode"), { recursive: true });
    await writeFile(path.join(cwd, ".agents", "skills", "PSTACK-LICENSE.txt"), "MIT\n", "utf8");
    await writeFile(path.join(cwd, ".claude", "skills", "README.md"), "# Skills\n", "utf8");
    await writeFile(path.join(cwd, ".agents", "skills", "poteto-mode", "SKILL.md"), "# Poteto\n", "utf8");
    await writeFile(path.join(cwd, ".claude", "skills", "poteto-mode", "SKILL.md"), "# Poteto\n", "utf8");

    const matchingPaths = [
      ".agents/skills/PSTACK-LICENSE.txt",
      ".agents/skills/poteto-mode/SKILL.md",
      ".claude/skills/README.md",
      ".claude/skills/poteto-mode/SKILL.md",
    ];
    assert.deepEqual(findSkillMirrorViolations(matchingPaths, { cwd }), []);

    await writeFile(path.join(cwd, ".claude", "skills", "poteto-mode", "SKILL.md"), "# Drifted\n", "utf8");
    assert.match(
      findSkillMirrorViolations(matchingPaths, { cwd })[0]?.reason ?? "",
      /byte content drifted/,
    );

    assert.match(
      findSkillMirrorViolations(
        [".agents/skills/poteto-mode/SKILL.md", ".claude/skills/other/SKILL.md"],
        { cwd },
      )
        .map((item) => item.reason)
        .join("\n"),
      /missing mirrored counterpart/,
    );

    assert.match(
      findSkillMirrorViolations([".agents/skills/extra.txt", ".claude/skills/extra.txt"], { cwd })[0]
        ?.reason ?? "",
      /unexpected root file/,
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("rejects tracked .audit files while allowing git-ignored .audit in the working tree", async () => {
  assert.equal(repositoryHygieneViolation(".audit/todo.md"), "pstack local checklist or decision trail");

  const cwd = await mkdtemp(path.join(tmpdir(), "panda-audit-ignore-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd });
    await writeFile(path.join(cwd, ".gitignore"), ".audit/\n", "utf8");
    await mkdir(path.join(cwd, ".audit"), { recursive: true });
    await writeFile(path.join(cwd, ".audit", "todo.md"), "- [ ] check\n", "utf8");
    assert.doesNotThrow(() => checkRepositoryHygiene({ cwd, quiet: true }));
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
