import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const defaultCatalogPath = path.join(repoRoot, "contracts", "batch-operations.v1.json");

const OPERATION_ID_PATTERN = /^(research|curation|media|release|recovery)\.[a-z][a-z0-9-]*$/;
const ALLOWED_STATUSES = new Set(["ready", "planned"]);
const ALLOWED_EFFECTS = new Set([
  "read-only",
  "generated-output",
  "isolated-state",
  "authoritative-write",
  "external-write",
  "production-write",
]);
const APPROVAL_EFFECTS = new Set([
  "authoritative-write",
  "external-write",
  "production-write",
]);
const ALLOWED_EXECUTABLES = new Set(["node", "python", "uv"]);
const EXPECTED_OPERATION_IDS = new Set([
  "research.validate",
  "research.build",
  "curation.validate",
  "curation.apply",
  "media.process",
  "media.publish",
  "release.build",
  "release.publish",
  "recovery.drill",
]);
const EXPECTED_READY_COMMANDS = new Map([
  ["research.validate", ["node", "scripts/release/check-research-script-policy.mjs"]],
  ["curation.validate", ["python", "scripts/curation/validate_panda_curation.py"]],
  [
    "media.process",
    [
      "uv",
      "run",
      "--isolated",
      "--directory",
      "services/api",
      "--frozen",
      "--extra",
      "dev",
      "python",
      "../../scripts/curation/process_panda_media.py",
      "--output-dir",
      "../../.batch-work/media",
    ],
  ],
]);

export class BatchOperationError extends Error {
  constructor(message, violations = []) {
    super(message);
    this.name = "BatchOperationError";
    this.violations = [...violations];
  }
}

export function loadBatchCatalog(catalogPath = defaultCatalogPath) {
  const payload = JSON.parse(readFileSync(catalogPath, "utf8"));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BatchOperationError("Batch operation catalog must be a JSON object");
  }
  return payload;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateStringArray(value, label, violations, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    violations.push(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array`);
    return;
  }
  for (const item of value) {
    if (!isNonEmptyString(item) || item.includes("\0") || item.includes("\n") || item.includes("\r")) {
      violations.push(`${label} values must be non-empty single-line strings`);
    }
  }
}

export function validateBatchCatalog(catalog) {
  const violations = [];
  if (catalog.schema_version !== 1) violations.push("schema_version must be 1");
  if (!isNonEmptyString(catalog.workflow)) violations.push("workflow must be a path string");
  if (!isNonEmptyString(catalog.approval_environment)) {
    violations.push("approval_environment must be a non-empty string");
  }
  if (catalog.artifact_directory !== ".batch-work") {
    violations.push("artifact_directory must remain .batch-work");
  }
  if (!Array.isArray(catalog.operations)) {
    violations.push("operations must be an array");
    return violations;
  }

  const ids = [];
  for (const [index, operation] of catalog.operations.entries()) {
    const label = `operations[${index}]`;
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
      violations.push(`${label} must be an object`);
      continue;
    }
    if (!isNonEmptyString(operation.id) || !OPERATION_ID_PATTERN.test(operation.id)) {
      violations.push(`${label}.id must use domain.action kebab-case`);
    } else {
      ids.push(operation.id);
    }
    if (!ALLOWED_STATUSES.has(operation.status)) {
      violations.push(`${label}.status must be ready or planned`);
    }
    if (!ALLOWED_EFFECTS.has(operation.effect)) {
      violations.push(`${label}.effect is unsupported`);
    }
    if (typeof operation.approval_required !== "boolean") {
      violations.push(`${label}.approval_required must be boolean`);
    }
    if (typeof operation.manifest_required !== "boolean") {
      violations.push(`${label}.manifest_required must be boolean`);
    }
    if (!isNonEmptyString(operation.idempotency)) {
      violations.push(`${label}.idempotency must be documented`);
    }
    if (APPROVAL_EFFECTS.has(operation.effect) && operation.approval_required !== true) {
      violations.push(`${label} write effects require approval_required=true`);
    }
    if (APPROVAL_EFFECTS.has(operation.effect) && operation.manifest_required !== true) {
      violations.push(`${label} write effects require manifest_required=true`);
    }

    if (operation.status === "ready") {
      validateStringArray(operation.command, `${label}.command`, violations);
      if (Array.isArray(operation.command) && !ALLOWED_EXECUTABLES.has(operation.command[0])) {
        violations.push(`${label}.command executable is not allowlisted`);
      }
      const expectedCommand = EXPECTED_READY_COMMANDS.get(operation.id);
      if (!expectedCommand) {
        violations.push(`${label} cannot become ready without a code-level command allowlist`);
      } else if (JSON.stringify(operation.command) !== JSON.stringify(expectedCommand)) {
        violations.push(`${label}.command does not match the code-level allowlist`);
      }
      if ("blocked_reason" in operation) {
        violations.push(`${label}.blocked_reason is not allowed for ready operations`);
      }
    } else {
      if (EXPECTED_READY_COMMANDS.has(operation.id)) {
        violations.push(`${label}.status must remain ready while its command is allowlisted`);
      }
      if ("command" in operation) {
        violations.push(`${label}.command is forbidden while status=planned`);
      }
      if (!isNonEmptyString(operation.blocked_reason)) {
        violations.push(`${label}.blocked_reason is required while status=planned`);
      }
    }

    if ("artifact_paths" in operation) {
      validateStringArray(operation.artifact_paths, `${label}.artifact_paths`, violations);
      for (const artifactPath of operation.artifact_paths ?? []) {
        const normalized = String(artifactPath).replaceAll("\\", "/");
        if (!(normalized === ".batch-work" || normalized.startsWith(".batch-work/"))) {
          violations.push(`${label}.artifact_paths must stay under .batch-work`);
        }
      }
    }
  }

  if (new Set(ids).size !== ids.length) violations.push("operation IDs must be unique");
  for (const expectedId of EXPECTED_OPERATION_IDS) {
    if (!ids.includes(expectedId)) violations.push(`missing standard operation: ${expectedId}`);
  }
  for (const id of ids) {
    if (!EXPECTED_OPERATION_IDS.has(id)) violations.push(`unexpected operation ID: ${id}`);
  }

  const rules = catalog.rules;
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    violations.push("rules must be an object");
  } else {
    const requiredRules = {
      workflow_dispatch_only: true,
      dry_run_default: true,
      contents_permission: "read",
      production_writes_require_environment: true,
      concurrency_cancel_in_progress: false,
      upload_plan_and_result_artifacts: true,
      write_job_summary: true,
      forbid_default_branch_push: true,
      fixed_command_arrays_only: true,
    };
    for (const [name, expected] of Object.entries(requiredRules)) {
      if (rules[name] !== expected) violations.push(`rules.${name} must be ${JSON.stringify(expected)}`);
    }
  }

  return [...new Set(violations)].sort();
}

export function getBatchOperation(catalog, operationId) {
  const operation = catalog.operations.find((item) => item.id === operationId);
  if (!operation) throw new BatchOperationError(`Unknown batch operation: ${operationId}`);
  return operation;
}

export function normalizeManifestPath(manifestPath, repositoryRoot = repoRoot) {
  const value = String(manifestPath ?? "").trim().replaceAll("\\", "/");
  if (!value) return null;
  if (path.posix.isAbsolute(value) || /^[A-Za-z]:\//.test(value)) {
    throw new BatchOperationError("manifest_path must be repository-relative");
  }
  const normalized = path.posix.normalize(value).replace(/^\.\//, "");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new BatchOperationError("manifest_path must stay inside the repository");
  }
  if (!normalized.endsWith(".json")) {
    throw new BatchOperationError("manifest_path must reference a JSON file");
  }
  const absolutePath = path.join(repositoryRoot, ...normalized.split("/"));
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    throw new BatchOperationError(`manifest_path does not exist as a file: ${normalized}`);
  }
  const realRepositoryRoot = realpathSync(repositoryRoot);
  const realManifestPath = realpathSync(absolutePath);
  const relativeRealPath = path.relative(realRepositoryRoot, realManifestPath);
  if (relativeRealPath === ".." || relativeRealPath.startsWith(`..${path.sep}`)) {
    throw new BatchOperationError("manifest_path symlink must stay inside the repository");
  }
  return normalized;
}

function operationRequirements(operation) {
  const executable = operation.command?.[0];
  return {
    requires_node: executable === "node",
    requires_python: executable === "python" || executable === "uv",
    requires_uv: executable === "uv",
  };
}

export function createBatchPlan({
  catalog,
  operationId,
  manifestPath = null,
  executeRequested = false,
  repositoryRoot = repoRoot,
  changeReference = null,
}) {
  const violations = validateBatchCatalog(catalog);
  if (violations.length > 0) {
    throw new BatchOperationError(
      `Batch operation catalog failed with ${violations.length} violation(s)`,
      violations,
    );
  }

  const operation = getBatchOperation(catalog, operationId);
  const normalizedManifest = normalizeManifestPath(manifestPath, repositoryRoot);
  if (operation.manifest_required && normalizedManifest === null) {
    throw new BatchOperationError(`${operation.id} requires --manifest`);
  }
  if (executeRequested && operation.approval_required && !isNonEmptyString(changeReference)) {
    throw new BatchOperationError(`${operation.id} execution requires --change-reference`);
  }

  const requirements = operationRequirements(operation);
  return {
    schema_version: 1,
    operation: operation.id,
    status: operation.status,
    executable: operation.status === "ready",
    effect: operation.effect,
    approval_required: operation.approval_required,
    approval_environment: operation.approval_required ? catalog.approval_environment : null,
    manifest_path: normalizedManifest,
    execute_requested: Boolean(executeRequested),
    change_reference: isNonEmptyString(changeReference) ? changeReference.trim() : null,
    idempotency: operation.idempotency,
    blocked_reason: operation.blocked_reason ?? null,
    command: operation.command ?? null,
    artifact_directory: catalog.artifact_directory,
    artifact_paths: operation.artifact_paths ?? [],
    ...requirements,
  };
}

function appendGithubOutput(name, value, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) return;
  appendFileSync(outputPath, `${name}=${String(value)}\n`, "utf8");
}

function appendSummary(plan, summaryPath = process.env.GITHUB_STEP_SUMMARY, heading = "Batch plan") {
  if (!summaryPath) return;
  const lines = [
    `## ${heading}`,
    "",
    `- Operation: \`${plan.operation}\``,
    `- Status: \`${plan.status}\``,
    `- Effect: \`${plan.effect}\``,
    `- Execute requested: \`${plan.execute_requested}\``,
    `- Executable now: \`${plan.executable}\``,
    `- Approval required: \`${plan.approval_required}\``,
    `- Manifest: ${plan.manifest_path ? `\`${plan.manifest_path}\`` : "not required"}`,
    `- Idempotency: ${plan.idempotency}`,
  ];
  if (plan.blocked_reason) lines.push(`- Blocked reason: ${plan.blocked_reason}`);
  if (plan.change_reference) lines.push(`- Change reference: \`${plan.change_reference}\``);
  appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

export function writeBatchPlan(plan, { repositoryRoot = repoRoot } = {}) {
  const outputDirectory = path.join(repositoryRoot, ...plan.artifact_directory.split("/"));
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, "plan.json");
  writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  appendGithubOutput("operation", plan.operation);
  appendGithubOutput("status", plan.status);
  appendGithubOutput("executable", plan.executable);
  appendGithubOutput("approval_required", plan.approval_required);
  appendGithubOutput("requires_node", plan.requires_node);
  appendGithubOutput("requires_python", plan.requires_python);
  appendGithubOutput("requires_uv", plan.requires_uv);
  appendGithubOutput("artifact_directory", plan.artifact_directory);
  appendSummary(plan);
  return outputPath;
}

export function executeBatchOperation({
  catalog,
  operationId,
  manifestPath = null,
  repositoryRoot = repoRoot,
  changeReference = null,
  approvedEnvironment = process.env.BATCH_APPROVAL_ENVIRONMENT,
  spawn = spawnSync,
}) {
  const plan = createBatchPlan({
    catalog,
    operationId,
    manifestPath,
    executeRequested: true,
    repositoryRoot,
    changeReference,
  });
  if (!plan.executable) {
    throw new BatchOperationError(
      `${plan.operation} is not executable: ${plan.blocked_reason ?? "adapter unavailable"}`,
    );
  }
  if (plan.approval_required && approvedEnvironment !== catalog.approval_environment) {
    throw new BatchOperationError(
      `${plan.operation} requires the ${catalog.approval_environment} approval environment`,
    );
  }

  writeBatchPlan(plan, { repositoryRoot });
  const [command, ...args] = plan.command;
  const startedAt = new Date().toISOString();
  const result = spawn(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env },
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });
  const exitCode = result.error ? 1 : (result.status ?? 1);
  const outcome = {
    schema_version: 1,
    operation: plan.operation,
    status: exitCode === 0 ? "passed" : "failed",
    effect: plan.effect,
    manifest_path: plan.manifest_path,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    exit_code: exitCode,
    error: result.error?.message ?? null,
  };
  const outputDirectory = path.join(repositoryRoot, ...plan.artifact_directory.split("/"));
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(path.join(outputDirectory, "result.json"), `${JSON.stringify(outcome, null, 2)}\n`);
  appendSummary(plan, process.env.GITHUB_STEP_SUMMARY, "Batch execution");

  if (exitCode !== 0) {
    throw new BatchOperationError(`${plan.operation} failed with exit code ${exitCode}`);
  }
  return outcome;
}

function parseCli(argv) {
  const [action, ...rest] = argv;
  const options = {
    action,
    operationId: process.env.BATCH_OPERATION ?? "",
    manifestPath: process.env.BATCH_MANIFEST_PATH ?? "",
    changeReference: process.env.BATCH_CHANGE_REFERENCE ?? "",
    executeRequested: process.env.BATCH_EXECUTE_REQUESTED === "true",
    json: false,
    catalogPath: defaultCatalogPath,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--operation") options.operationId = rest[++index] ?? "";
    else if (value === "--manifest") options.manifestPath = rest[++index] ?? "";
    else if (value === "--change-reference") options.changeReference = rest[++index] ?? "";
    else if (value === "--execute-requested") options.executeRequested = true;
    else if (value === "--execute") options.executeRequested = true;
    else if (value === "--json") options.json = true;
    else if (value === "--catalog") options.catalogPath = path.resolve(rest[++index] ?? "");
    else throw new BatchOperationError(`Unknown argument: ${value}`);
  }
  if (!new Set(["plan", "run"]).has(options.action)) {
    throw new BatchOperationError("Usage: operations.mjs <plan|run> --operation <id>");
  }
  if (!options.operationId) throw new BatchOperationError("--operation is required");
  return options;
}

function printError(error) {
  console.error(error instanceof Error ? error.message : String(error));
  for (const violation of error?.violations ?? []) console.error(`- ${violation}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCli(process.argv.slice(2));
    const catalog = loadBatchCatalog(options.catalogPath);
    if (options.action === "plan") {
      const plan = createBatchPlan({
        catalog,
        operationId: options.operationId,
        manifestPath: options.manifestPath,
        executeRequested: options.executeRequested,
        changeReference: options.changeReference,
      });
      const outputPath = writeBatchPlan(plan);
      if (options.json) console.log(JSON.stringify(plan, null, 2));
      else console.log(`[batch] planned ${plan.operation} -> ${outputPath}`);
    } else {
      if (!options.executeRequested) {
        throw new BatchOperationError("run requires --execute or BATCH_EXECUTE_REQUESTED=true");
      }
      const result = executeBatchOperation({
        catalog,
        operationId: options.operationId,
        manifestPath: options.manifestPath,
        changeReference: options.changeReference,
      });
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`[batch] passed ${result.operation}`);
    }
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}
