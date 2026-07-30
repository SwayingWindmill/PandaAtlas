import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDirectory, "..", "..");
export const defaultContractPath = path.join(
  repoRoot,
  "contracts",
  "archive-governance-migration.v1.json",
);

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".sql",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".venv",
  "__pycache__",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function listTextFiles(rootPath) {
  if (!existsSync(rootPath)) return [];
  const files = [];
  const visit = (current) => {
    const metadata = statSync(current);
    if (metadata.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(path.basename(current))) return;
      for (const entry of readdirSync(current)) visit(path.join(current, entry));
      return;
    }
    if (metadata.size > 2_000_000 || !TEXT_EXTENSIONS.has(path.extname(current))) return;
    files.push(current);
  };
  visit(rootPath);
  return files;
}

export function validateArchiveGovernanceInventory({
  contractPath = defaultContractPath,
  root = repoRoot,
} = {}) {
  const contract = readJson(contractPath);
  if (contract.schema_version !== 1 || contract.issue !== 190) {
    throw new Error("Archive governance migration contract identity is invalid");
  }
  if (contract.feature_flag !== "ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED") {
    throw new Error("Archive governance migration feature flag is invalid");
  }

  const entries = Array.isArray(contract.entries) ? contract.entries : [];
  const inventoryPaths = new Set();
  const classifiedCategories = new Set();
  const markerEvidence = [];

  for (const entry of entries) {
    if (!entry || typeof entry.path !== "string" || inventoryPaths.has(entry.path)) {
      throw new Error(`Archive governance inventory has an invalid or duplicate path: ${entry?.path}`);
    }
    inventoryPaths.add(entry.path);
    if (!Array.isArray(entry.categories) || !entry.categories.length) {
      throw new Error(`Archive governance inventory entry lacks categories: ${entry.path}`);
    }
    if (typeof entry.disposition !== "string" || !entry.disposition) {
      throw new Error(`Archive governance inventory entry lacks a disposition: ${entry.path}`);
    }
    const absolutePath = path.join(root, entry.path);
    if (!existsSync(absolutePath)) {
      throw new Error(`Archive governance inventory path is missing: ${entry.path}`);
    }
    const source = readFileSync(absolutePath, "utf8");
    for (const category of entry.categories) classifiedCategories.add(category);
    for (const marker of entry.markers ?? []) {
      if (!source.includes(marker)) {
        throw new Error(`Archive governance marker is missing from ${entry.path}: ${marker}`);
      }
      markerEvidence.push({ path: entry.path, marker });
    }
  }

  for (const category of contract.required_categories ?? []) {
    if (!classifiedCategories.has(category)) {
      throw new Error(`Archive governance inventory does not classify category: ${category}`);
    }
  }

  const detectedPaths = new Set();
  for (const scanRoot of contract.scan_roots ?? []) {
    for (const absolutePath of listTextFiles(path.join(root, scanRoot))) {
      const relativePath = normalize(path.relative(root, absolutePath));
      const source = readFileSync(absolutePath, "utf8");
      if ((contract.high_signal_markers ?? []).some((marker) => source.includes(marker))) {
        detectedPaths.add(relativePath);
      }
    }
  }

  const unclassified = [...detectedPaths]
    .filter((relativePath) => !inventoryPaths.has(relativePath))
    .sort();
  if (unclassified.length) {
    throw new Error(`unclassified approval-governance path: ${unclassified.join(", ")}`);
  }

  return {
    status: "PASS",
    issue: contract.issue,
    source_policy: contract.source_policy,
    target_policy: contract.target_policy,
    inventory_entries: entries.length,
    classified_categories: [...classifiedCategories].sort(),
    detected_paths: [...detectedPaths].sort(),
    marker_evidence_count: markerEvidence.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(validateArchiveGovernanceInventory(), null, 2));
  } catch (error) {
    console.error(`[archive-governance-migration] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
