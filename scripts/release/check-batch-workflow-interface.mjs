import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  defaultCatalogPath,
  loadBatchCatalog,
  validateBatchCatalog,
} from "../batch/operations.mjs";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export class BatchWorkflowInterfaceError extends Error {
  constructor(violations) {
    const ordered = [...new Set(violations)].sort();
    super(`Batch workflow interface failed with ${ordered.length} violation(s)`);
    this.name = "BatchWorkflowInterfaceError";
    this.violations = ordered;
  }
}

function topLevelTriggerKeys(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  const start = lines.findIndex((line) => /^on:\s*$/.test(line));
  if (start < 0) return [];
  const keys = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z0-9_-]+:\s*/.test(line)) break;
    const match = /^  ([A-Za-z0-9_-]+):\s*/.exec(line);
    if (match) keys.push(match[1]);
  }
  return keys;
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

export function validateBatchWorkflowText({ workflowText, catalog }) {
  const normalizedWorkflow = workflowText.replaceAll("\r\n", "\n");
  workflowText = normalizedWorkflow;
  const violations = validateBatchCatalog(catalog);
  const triggerKeys = topLevelTriggerKeys(normalizedWorkflow);
  if (triggerKeys.length !== 1 || triggerKeys[0] !== "workflow_dispatch") {
    violations.push("workflow must be workflow_dispatch-only");
  }

  const requiredFragments = [
    "permissions:\n  contents: read",
    "concurrency:",
    "cancel-in-progress: false",
    "default: false",
    "type: boolean",
    "environment: production-batch",
    "BATCH_APPROVAL_ENVIRONMENT: production-batch",
    "node scripts/batch/operations.mjs plan",
    "node scripts/batch/operations.mjs run --execute",
    "check-workspace-cleanliness.mjs --context batch-operation",
    "check-workspace-cleanliness.mjs --context protected-batch-operation",
    "reject-unavailable-execution:",
  ];
  for (const fragment of requiredFragments) {
    if (!workflowText.includes(fragment)) violations.push(`workflow missing required fragment: ${fragment}`);
  }

  for (const operation of catalog.operations) {
    if (!workflowText.includes(`          - ${operation.id}`)) {
      violations.push(`workflow operation choices missing ${operation.id}`);
    }
  }

  if (countMatches(workflowText, /actions\/upload-artifact@/g) < 3) {
    violations.push("workflow must upload plan, unprotected result, and protected result artifacts");
  }
  if (!/execute:\r?\n(?:        .*\r?\n)*?        default: false/.test(workflowText)) {
    violations.push("execute input must default to false");
  }
  if (!workflowText.includes("needs.plan.outputs.approval_required == 'false'")) {
    violations.push("unprotected execution must require approval_required=false");
  }
  if (!workflowText.includes("needs.plan.outputs.approval_required == 'true'")) {
    violations.push("protected execution must require approval_required=true");
  }

  const forbiddenPatterns = [
    [/^\s*push:\s*$/m, "push trigger"],
    [/^\s*pull_request:\s*$/m, "pull_request trigger"],
    [/^\s*schedule:\s*$/m, "schedule trigger"],
    [/^\s*repository_dispatch:\s*$/m, "repository_dispatch trigger"],
    [/contents:\s*write/, "contents write permission"],
    [/\bgit\s+push\b/i, "git push command"],
    [/\bgh\s+pr\s+(merge|create)\b/i, "GitHub PR mutation command"],
    [/\bshell:\s*(bash|pwsh|cmd)\b/i, "custom shell override"],
  ];
  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(workflowText)) violations.push(`workflow contains forbidden ${label}`);
  }

  return [...new Set(violations)].sort();
}

export function checkBatchWorkflowInterface({
  repositoryRoot = repoRoot,
  catalogPath = defaultCatalogPath,
  quiet = false,
} = {}) {
  const catalog = loadBatchCatalog(catalogPath);
  const workflowPath = path.join(repositoryRoot, ...catalog.workflow.split("/"));
  const workflowText = readFileSync(workflowPath, "utf8");
  const violations = validateBatchWorkflowText({ workflowText, catalog });
  if (violations.length > 0) throw new BatchWorkflowInterfaceError(violations);

  if (!quiet) {
    const ready = catalog.operations.filter((operation) => operation.status === "ready").length;
    const planned = catalog.operations.length - ready;
    console.log(
      `[batch-workflow-interface] passed (${catalog.operations.length} operations; ${ready} ready, ${planned} planned)`,
    );
  }
  return {
    operations: catalog.operations.length,
    ready: catalog.operations.filter((operation) => operation.status === "ready").length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    checkBatchWorkflowInterface();
  } catch (error) {
    if (error instanceof BatchWorkflowInterfaceError) {
      console.error(error.message);
      for (const violation of error.violations) console.error(`- ${violation}`);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}
