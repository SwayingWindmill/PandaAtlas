import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const FORBIDDEN_DIRECTORY_NAMES = new Map([
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

export function checkRepositoryHygiene({ cwd = repoRoot, quiet = false } = {}) {
  const paths = collectRepositoryPaths({ cwd });
  const violations = findRepositoryHygieneViolations(paths);

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
