import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { listRepositoryPaths } from "./repository-paths.mjs";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const FORBIDDEN_DIRECTORY_NAMES = new Map([
  [".audit", "pstack local checklist or decision trail"],
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
];
const ACTIVE_AGENT_NAVIGATION_RETIRED_REFERENCES = new Map([
  ["docs/agents/codegraph.md", ["FastAPI", "services/worker-api"]],
]);

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
  return listRepositoryPaths({ cwd }).map(normalizeRepositoryPath).filter(Boolean);
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

const AGENTS_SKILLS_PREFIX = ".agents/skills/";
const CLAUDE_SKILLS_PREFIX = ".claude/skills/";
const ALLOWED_AGENTS_SKILL_ROOT_FILES = new Set(["PSTACK-LICENSE.txt"]);
const ALLOWED_CLAUDE_SKILL_ROOT_FILES = new Set(["README.md"]);

function collectSkillMirrorEntries(paths, prefix, allowedRootFiles, violations) {
  const entries = new Map();
  for (const rawPath of paths) {
    const normalized = normalizeRepositoryPath(rawPath);
    if (!normalized.startsWith(prefix)) continue;
    const rel = normalized.slice(prefix.length);
    if (!rel) continue;
    if (!rel.includes("/")) {
      if (!allowedRootFiles.has(rel)) {
        violations.push({
          path: normalized,
          reason: `unexpected root file under ${prefix}; move into a skill directory or remove`,
        });
      }
      continue;
    }
    entries.set(rel, normalized);
  }
  return entries;
}

export function findSkillMirrorViolations(paths, { cwd = repoRoot } = {}) {
  const violations = [];
  const uniquePaths = [...new Set(paths.map(normalizeRepositoryPath).filter(Boolean))].sort();
  const agentsEntries = collectSkillMirrorEntries(
    uniquePaths,
    AGENTS_SKILLS_PREFIX,
    ALLOWED_AGENTS_SKILL_ROOT_FILES,
    violations,
  );
  const claudeEntries = collectSkillMirrorEntries(
    uniquePaths,
    CLAUDE_SKILLS_PREFIX,
    ALLOWED_CLAUDE_SKILL_ROOT_FILES,
    violations,
  );

  for (const [rel, agentsPath] of agentsEntries) {
    if (!claudeEntries.has(rel)) {
      violations.push({
        path: agentsPath,
        reason: `missing mirrored counterpart at ${CLAUDE_SKILLS_PREFIX}${rel}; mirror .agents/skills/ and .claude/skills/ 1:1`,
      });
    }
  }

  for (const [rel, claudePath] of claudeEntries) {
    if (!agentsEntries.has(rel)) {
      violations.push({
        path: claudePath,
        reason: `missing mirrored counterpart at ${AGENTS_SKILLS_PREFIX}${rel}; mirror .agents/skills/ and .claude/skills/ 1:1`,
      });
    }
  }

  for (const [rel, agentsPath] of agentsEntries) {
    const claudePath = claudeEntries.get(rel);
    if (!claudePath) continue;
    const agentsAbs = path.join(cwd, ...agentsPath.split("/"));
    const claudeAbs = path.join(cwd, ...claudePath.split("/"));
    if (!existsSync(agentsAbs)) {
      violations.push({ path: agentsPath, reason: "skill file is missing on disk" });
      continue;
    }
    if (!existsSync(claudeAbs)) {
      violations.push({ path: claudePath, reason: "skill file is missing on disk" });
      continue;
    }
    if (Buffer.compare(readFileSync(agentsAbs), readFileSync(claudeAbs)) !== 0) {
      violations.push({
        path: agentsPath,
        reason: `byte content drifted from ${claudePath}; mirror .agents/skills/ and .claude/skills/ 1:1`,
      });
    }
  }

  return violations.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

export function checkRepositoryHygiene({ cwd = repoRoot, quiet = false } = {}) {
  const paths = collectRepositoryPaths({ cwd });
  const violations = findRepositoryHygieneViolations(paths);
  const retiredRuntimeImports = findRetiredRuntimeImports(paths, { cwd });
  const authorityDocumentationViolations = findCurrentAuthorityDocumentationViolations({ cwd });
  const activeAgentNavigationViolations = findActiveAgentNavigationViolations({ cwd });
  const skillMirrorViolations = findSkillMirrorViolations(paths, { cwd });

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
  violations.push(...skillMirrorViolations);
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
