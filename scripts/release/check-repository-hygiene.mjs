import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const FORBIDDEN_DIRECTORY_NAMES = new Map([
  [".batch-work", "bounded batch operation output"],
  [".next", "Next.js build output"],
  [".open-next", "OpenNext build output"],
  [".pytest_cache", "pytest cache"],
  [".release-gate", "release-gate output"],
  [".ruff_cache", "Ruff cache"],
  [".venv", "Python virtual environment"],
  [".venv-release", "release virtual environment"],
  [".vercel", "local Vercel project state"],
  [".worktrees", "nested Git worktree content"],
  [".wrangler", "Wrangler local state"],
  ["__pycache__", "Python bytecode cache"],
  ["blob-report", "Playwright blob report"],
  ["node_modules", "installed JavaScript dependencies"],
  ["playwright-report", "Playwright HTML report"],
  ["test-results", "test runner output"],
]);

const FORBIDDEN_FILE_SUFFIXES = new Map([
  [".pyc", "compiled Python bytecode"],
  [".pyd", "compiled Python extension output"],
  [".pyo", "optimized Python bytecode"],
  [".tsbuildinfo", "TypeScript incremental build output"],
]);

const COPY_SUFFIX_PATTERN = /(?:^|\/)[^/]+ \(\d+\)(?:\.[^/]+)?$/u;
const RETIRED_ACQUISITION_IMPORT_PATTERN =
  /(?:^|\n)\s*(?:from|import)\s+app\.acquisition(?:\.|\s|$)/u;
const CURRENT_AUTHORITY_DOCUMENTS = [
  "README.md",
  "contracts/README.md",
  "docs/architecture/README.md",
  "docs/architecture/zhipanda-v2-architecture-baseline.md",
  "docs/deployment/runtime-status.md",
  "docs/development-operations.md",
  "docs/monorepo-structure.md",
];
const RETIRED_CURRENT_AUTHORITY_REFERENCES = [
  "contracts/api-request-runtime-boundary.v1.json",
  "contracts/api-serverless-runtime.v1.json",
  "services/api/index.py",
  "check:api-runtime-boundary",
  "check:api-serverless-closure",
  "docs/architecture/api-request-runtime-boundary.md",
  "docs/deployment/vercel-api-phase-2.md",
];
const ACTIVE_AGENT_NAVIGATION_RETIRED_REFERENCES = new Map([
  ["docs/agents/codegraph.md", ["FastAPI", "services/worker-api"]],
]);
const CONTRACT_README_LINK_PATTERN = /\]\(([^)]+\.json)\)/gu;

export function normalizeRepositoryPath(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/gu, "/");
}

export function repositoryHygieneViolation(value) {
  const path = normalizeRepositoryPath(value);
  if (!path) return null;

  if (path === "supabase" || path.startsWith("supabase/")) {
    return "non-canonical Supabase project state; use infra/supabase";
  }

  if (path === "CONTEXT-MAP.md") {
    return "retired domain documentation filename; use GLOSSARY-MAP.md";
  }
  if (path.endsWith("/CONTEXT.md")) {
    return "retired domain documentation filename; use GLOSSARY.md";
  }

  const segments = path.split("/");
  for (const segment of segments) {
    const directoryReason = FORBIDDEN_DIRECTORY_NAMES.get(segment);
    if (directoryReason) return directoryReason;
    if (segment.endsWith(".egg-info")) return "generated Python package metadata";
  }

  for (const [suffix, reason] of FORBIDDEN_FILE_SUFFIXES) {
    if (path.endsWith(suffix)) return reason;
  }

  if (/\.wrangler-dev\.[^/]+\.log$/u.test(path)) return "Wrangler development log";
  if (COPY_SUFFIX_PATTERN.test(path)) return "copy-style filename suffix such as (1)";

  return null;
}

export function findRepositoryHygieneViolations(paths) {
  return [...new Set(paths.map(normalizeRepositoryPath).filter(Boolean))]
    .map((path) => ({ path, reason: repositoryHygieneViolation(path) }))
    .filter(({ reason }) => reason)
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

export function collectRepositoryPaths({ cwd = repoRoot } = {}) {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.error) {
    throw new Error(`Unable to inspect repository paths: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `git ls-files failed with code ${result.status}: ${(result.stderr ?? "").trim()}`,
    );
  }

  return String(result.stdout ?? "")
    .split("\0")
    .map(normalizeRepositoryPath)
    .filter(Boolean);
}

export function findRetiredRuntimeImports(paths, { cwd = repoRoot } = {}) {
  return paths
    .filter((repositoryPath) => repositoryPath.endsWith(".py"))
    .filter((repositoryPath) => {
      const file = path.join(cwd, ...repositoryPath.split("/"));
      try {
        return RETIRED_ACQUISITION_IMPORT_PATTERN.test(readFileSync(file, "utf8"));
      } catch {
        return false;
      }
    })
    .sort();
}

export function findCurrentAuthorityDocumentationViolations({ cwd = repoRoot } = {}) {
  const violations = [];
  for (const repositoryPath of CURRENT_AUTHORITY_DOCUMENTS) {
    const file = path.join(cwd, ...repositoryPath.split("/"));
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const retiredReference of RETIRED_CURRENT_AUTHORITY_REFERENCES) {
      if (text.includes(retiredReference)) {
        violations.push(`${repositoryPath}: ${retiredReference}`);
      }
    }
  }
  return violations.sort();
}

export function findActiveAgentNavigationViolations({ cwd = repoRoot } = {}) {
  const violations = [];
  for (const [repositoryPath, retiredReferences] of ACTIVE_AGENT_NAVIGATION_RETIRED_REFERENCES) {
    const file = path.join(cwd, ...repositoryPath.split("/"));
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const retiredReference of retiredReferences) {
      if (text.includes(retiredReference)) {
        violations.push(`${repositoryPath}: ${retiredReference}`);
      }
    }
  }
  return violations.sort();
}

export function findBrokenContractReadmeLinks({ cwd = repoRoot } = {}) {
  const readme = path.join(cwd, "contracts", "README.md");
  let text;
  try {
    text = readFileSync(readme, "utf8");
  } catch {
    return [];
  }

  return [...text.matchAll(CONTRACT_README_LINK_PATTERN)]
    .map((match) => match[1])
    .filter((target) => !target.includes("://"))
    .map((target) => normalizeRepositoryPath(`contracts/${target}`))
    .filter((repositoryPath) => {
      const file = path.join(cwd, ...repositoryPath.split("/"));
      try {
        readFileSync(file);
        return false;
      } catch {
        return true;
      }
    })
    .sort();
}

export function checkRepositoryHygiene({ cwd = repoRoot, quiet = false } = {}) {
  const paths = collectRepositoryPaths({ cwd });
  const violations = findRepositoryHygieneViolations(paths);
  const retiredRuntimeImports = findRetiredRuntimeImports(paths, { cwd });
  const authorityDocumentationViolations = findCurrentAuthorityDocumentationViolations({ cwd });
  const activeAgentNavigationViolations = findActiveAgentNavigationViolations({ cwd });
  const brokenContractReadmeLinks = findBrokenContractReadmeLinks({ cwd });

  for (const repositoryPath of retiredRuntimeImports) {
    violations.push({
      path: repositoryPath,
      reason: "retired Python acquisition runtime import; use tools/panda-data",
    });
  }
  for (const violation of authorityDocumentationViolations) {
    const [repositoryPath, retiredReference] = violation.split(": ", 2);
    violations.push({
      path: repositoryPath,
      reason: `current authority documentation references retired runtime surface: ${retiredReference}`,
    });
  }
  for (const violation of activeAgentNavigationViolations) {
    const [repositoryPath, retiredReference] = violation.split(": ", 2);
    violations.push({
      path: repositoryPath,
      reason: `active agent navigation references retired runtime surface: ${retiredReference}`,
    });
  }
  for (const repositoryPath of brokenContractReadmeLinks) {
    violations.push({
      path: repositoryPath,
      reason: "contracts README links to a missing contract",
    });
  }
  violations.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  if (violations.length > 0) {
    const details = violations.map(({ path, reason }) => `- ${path}: ${reason}`).join("\n");
    throw new Error(
      `Repository hygiene check failed. Remove or rename these tracked/unignored paths:\n${details}`,
    );
  }

  if (!quiet) {
    console.log(`[repository-hygiene] passed (${paths.length} tracked or unignored paths checked)`);
  }
  return { checked: paths.length, violations };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    checkRepositoryHygiene();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
