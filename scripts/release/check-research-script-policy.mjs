import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const RESEARCH_SCRIPT_PREFIX = "scripts/research/";
const RESEARCH_BATCH_PREFIX = "data/research-batches/";
const CONTRACT_PATH = "contracts/research-batch.v1.json";
const ALLOWED_ROOT_FILES = new Set(["README.md", "__init__.py", "run_batch.py"]);
const ALLOWED_RESEARCH_AREAS = new Set([
  "adapters",
  "archive",
  "builders",
  "migrations",
  "runners",
  "tests",
  "validators",
]);
const ROUND_SPECIFIC_PATTERN = /(?:^|[_-])rounds?[_-]?\d/i;
const DATE_SPECIFIC_PATTERN = /(?:^|[_-])20\d{2}[_-]\d{2}[_-]\d{2}(?:[_-]|\.)/;

export class ResearchScriptPolicyError extends Error {
  constructor(violations) {
    super(`Research script policy failed with ${violations.length} violation(s)`);
    this.name = "ResearchScriptPolicyError";
    this.violations = violations;
  }
}

export function normalizeRepositoryPath(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/g, "/");
}

export function researchScriptViolation(value) {
  const repositoryPath = normalizeRepositoryPath(value);
  if (!repositoryPath.startsWith(RESEARCH_SCRIPT_PREFIX)) return null;

  const relativePath = repositoryPath.slice(RESEARCH_SCRIPT_PREFIX.length);
  if (!relativePath) return null;

  const segments = relativePath.split("/");
  const filename = segments.at(-1);

  if (segments.length === 1) {
    if (ALLOWED_ROOT_FILES.has(filename)) return null;
    return "root-level research files are limited to README.md, __init__.py, and run_batch.py";
  }

  const area = segments[0];
  if (!ALLOWED_RESEARCH_AREAS.has(area)) {
    return `research code must live under one of: ${[...ALLOWED_RESEARCH_AREAS].join(", ")}`;
  }

  if (area === "archive") return null;

  if (ROUND_SPECIFIC_PATTERN.test(filename)) {
    return "round-specific code must be represented by a batch manifest or moved to archive";
  }

  if (DATE_SPECIFIC_PATTERN.test(filename)) {
    return "date-specific code must be represented by a batch manifest or moved to archive";
  }

  return null;
}

function validateStringArray(field, value, errors, { allowedValues } = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${field} must be a non-empty array`);
    return;
  }

  const normalized = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") {
      errors.push(`${field} values must be non-empty strings`);
      continue;
    }
    normalized.push(item.trim());
  }

  if (new Set(normalized).size !== normalized.length) {
    errors.push(`${field} values must be unique`);
  }

  if (allowedValues) {
    for (const item of normalized) {
      if (!allowedValues.has(item)) errors.push(`${field} contains unsupported value: ${item}`);
    }
  }
}

export function validateResearchBatchManifest({ manifestPath, manifest, contract }) {
  const errors = [];
  const normalizedPath = normalizeRepositoryPath(manifestPath);
  const relativePath = normalizedPath.startsWith(RESEARCH_BATCH_PREFIX)
    ? normalizedPath.slice(RESEARCH_BATCH_PREFIX.length)
    : normalizedPath;

  if (relativePath.includes("/")) {
    errors.push("batch manifests must be direct children of data/research-batches");
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["manifest must be a JSON object"];
  }

  const requiredFields = new Set(contract.required_fields ?? []);
  const optionalFields = new Set(contract.optional_fields ?? []);
  const allowedFields = new Set([...requiredFields, ...optionalFields]);

  for (const field of requiredFields) {
    if (!(field in manifest)) errors.push(`missing required field: ${field}`);
  }

  for (const field of Object.keys(manifest)) {
    if (!allowedFields.has(field)) errors.push(`unknown field: ${field}`);
  }

  if (manifest.schema_version !== contract.schema_version) {
    errors.push(`schema_version must be ${contract.schema_version}`);
  }

  const batchIdPattern = new RegExp(contract.batch_id_pattern);
  if (typeof manifest.batch_id !== "string" || !batchIdPattern.test(manifest.batch_id)) {
    errors.push("batch_id must use YYYY-MM-DD-kebab-case");
  } else if (path.posix.basename(normalizedPath) !== `${manifest.batch_id}.json`) {
    errors.push("filename must match batch_id");
  }

  const builderPattern = new RegExp(contract.builder_pattern);
  if (typeof manifest.builder !== "string" || !builderPattern.test(manifest.builder)) {
    errors.push("builder must be a stable kebab-case identifier");
  }

  validateStringArray("subjects", manifest.subjects, errors);
  validateStringArray("sources", manifest.sources, errors);
  validateStringArray("operations", manifest.operations, errors, {
    allowedValues: new Set(contract.allowed_operations ?? []),
  });

  if (manifest.dry_run_default !== true) {
    errors.push("dry_run_default must be true");
  }

  if (
    "description" in manifest &&
    (typeof manifest.description !== "string" || manifest.description.trim() === "")
  ) {
    errors.push("description must be a non-empty string when provided");
  }

  if (
    "metadata" in manifest &&
    (!manifest.metadata || typeof manifest.metadata !== "object" || Array.isArray(manifest.metadata))
  ) {
    errors.push("metadata must be an object when provided");
  }

  return errors;
}

export function collectResearchPolicyPaths({ cwd = repoRoot } = {}) {
  const result = spawnSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "scripts/research",
      "data/research-batches",
      CONTRACT_PATH,
    ],
    { cwd, encoding: "utf8", windowsHide: true },
  );

  if (result.error) throw new Error(`Unable to inspect research policy paths: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ls-files failed with code ${result.status}: ${result.stderr.trim()}`);
  }

  return [...new Set(result.stdout.split(/\r?\n/).map(normalizeRepositoryPath).filter(Boolean))].sort();
}

export function checkResearchScriptPolicy({ cwd = repoRoot, quiet = false, logger = console } = {}) {
  const contractFile = path.join(cwd, ...CONTRACT_PATH.split("/"));
  let contract;
  try {
    contract = JSON.parse(readFileSync(contractFile, "utf8"));
  } catch (error) {
    throw new ResearchScriptPolicyError([
      `${CONTRACT_PATH}: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }

  const paths = collectResearchPolicyPaths({ cwd });
  const violations = [];

  for (const repositoryPath of paths) {
    const scriptViolation = researchScriptViolation(repositoryPath);
    if (scriptViolation) violations.push(`${repositoryPath}: ${scriptViolation}`);

    if (repositoryPath.startsWith(RESEARCH_BATCH_PREFIX) && repositoryPath.endsWith(".json")) {
      const manifestFile = path.join(cwd, ...repositoryPath.split("/"));
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
      } catch (error) {
        violations.push(
          `${repositoryPath}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }

      for (const error of validateResearchBatchManifest({
        manifestPath: repositoryPath,
        manifest,
        contract,
      })) {
        violations.push(`${repositoryPath}: ${error}`);
      }
    }
  }

  if (violations.length > 0) throw new ResearchScriptPolicyError(violations.sort());

  const manifestsChecked = paths.filter(
    (repositoryPath) =>
      repositoryPath.startsWith(RESEARCH_BATCH_PREFIX) && repositoryPath.endsWith(".json"),
  ).length;

  if (!quiet) {
    logger.log(
      `[research-script-policy] passed (${paths.length} governed paths, ${manifestsChecked} batch manifests)`,
    );
  }

  return { paths_checked: paths.length, manifests_checked: manifestsChecked };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    checkResearchScriptPolicy();
  } catch (error) {
    if (error instanceof ResearchScriptPolicyError) {
      console.error(error.message);
      for (const violation of error.violations) console.error(`- ${violation}`);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}
