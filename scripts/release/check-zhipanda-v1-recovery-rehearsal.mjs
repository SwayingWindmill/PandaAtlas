import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const defaultRehearsalContractPath = path.join(
  repositoryRoot,
  "contracts",
  "zhipanda-v1-recovery-rehearsal.v1.json",
);

const REQUIRED_SCENARIOS = new Map([
  [
    "moderation-stop-drain-orchestration",
    {
      issue: 197,
      checks: new Set([
        "new-commands-stop-fail-closed",
        "in-flight-appeal-drains",
        "projection-replay-is-idempotent",
      ]),
    },
  ],
  [
    "privacy-tombstone-replay-orchestration",
    {
      issue: 198,
      checks: new Set([
        "confirmed-deletion-blocks-authentication",
        "restore-demonstrates-replay-need",
        "tombstone-replay-deletes-only-non-held-contexts",
        "duplicate-tombstone-replay-is-idempotent",
      ]),
    },
  ],
  [
    "audit-integrity-recovery-orchestration",
    {
      issue: 199,
      checks: new Set([
        "required-audit-outage-fails-closed",
        "audit-projection-rebuild-is-idempotent",
        "integrity-mismatch-is-detected",
        "expired-export-ciphertext-is-removed-but-fact-remains",
        "healthy-required-audit-command-succeeds",
      ]),
    },
  ],
]);

const REQUIRED_FEATURE_DRILLS = [
  "moderation-stop-drain",
  "privacy-tombstone-replay",
  "audit-integrity-recovery",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireRepositoryPath(errors, root, relativePath, label) {
  if (!isNonEmptyString(relativePath)) {
    errors.push(`${label} must be a repository-relative path.`);
    return;
  }
  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    errors.push(`${label} must stay inside the repository.`);
    return;
  }
  if (!existsSync(path.join(root, relativePath))) {
    errors.push(`${label} references missing path ${relativePath}.`);
  }
}

function equalSets(first, second) {
  return first.size === second.size && [...first].every((item) => second.has(item));
}

export function loadRecoveryRehearsalContract(
  filePath = defaultRehearsalContractPath,
) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function validateRecoveryRehearsalContract(
  contract,
  {
    checkEvidence = true,
    root = repositoryRoot,
  } = {},
) {
  const errors = [];

  if (contract.schema_version !== 1) {
    errors.push("schema_version must be 1.");
  }
  if (contract.rehearsal_id !== "zhipanda-v1-cross-feature-recovery") {
    errors.push("rehearsal_id must be zhipanda-v1-cross-feature-recovery.");
  }
  if (contract.issue !== 200) {
    errors.push("issue must be 200.");
  }
  if (contract.status !== "available") {
    errors.push("status must be available.");
  }
  if (contract.command !== "node scripts/release/run-zhipanda-v1-recovery-rehearsal.mjs") {
    errors.push("command must execute the versioned recovery rehearsal runner.");
  }
  if (contract.report_path !== ".release-gate/zhipanda-v1-recovery-rehearsal.json") {
    errors.push("report_path must stay inside .release-gate.");
  }
  if (contract.runbook !== "docs/runbooks/zhipanda-v1-recovery-rehearsal.md") {
    errors.push("runbook must name the versioned recovery rehearsal procedure.");
  }

  const integration = contract.release_integration ?? {};
  if (integration.test_glob !== "scripts/release/tests/*.test.mjs") {
    errors.push("release_integration.test_glob must use the existing Release Gate test glob.");
  }
  if (integration.test_path !== "scripts/release/tests/zhipanda-v1-recovery-rehearsal.test.mjs") {
    errors.push("release_integration.test_path must name the rehearsal regression suite.");
  }

  if (checkEvidence) {
    requireRepositoryPath(
      errors,
      root,
      "scripts/release/run-zhipanda-v1-recovery-rehearsal.mjs",
      "rehearsal runner",
    );
    requireRepositoryPath(
      errors,
      root,
      integration.test_path,
      "release_integration.test_path",
    );
    requireRepositoryPath(errors, root, contract.runbook, "runbook");
  }

  const scenarios = Array.isArray(contract.scenarios) ? contract.scenarios : [];
  const scenarioIds = new Set();
  for (const scenario of scenarios) {
    if (!isNonEmptyString(scenario.id)) {
      errors.push("scenarios contains a record without an id.");
      continue;
    }
    if (scenarioIds.has(scenario.id)) {
      errors.push(`scenarios contains duplicate id ${scenario.id}.`);
    }
    scenarioIds.add(scenario.id);

    const required = REQUIRED_SCENARIOS.get(scenario.id);
    if (!required) {
      errors.push(`Unsupported rehearsal scenario ${scenario.id}.`);
      continue;
    }
    if (scenario.blocked_feature_issue !== required.issue) {
      errors.push(`${scenario.id} must remain bound to Issue #${required.issue}.`);
    }
    const checks = new Set(
      Array.isArray(scenario.required_checks) ? scenario.required_checks : [],
    );
    if (!equalSets(checks, required.checks)) {
      errors.push(`${scenario.id} must declare the complete required check set.`);
    }
    if (!isNonEmptyString(scenario.limitation)
      || !scenario.limitation.includes("Model-level orchestration rehearsal")
      || !scenario.limitation.includes("real PostgreSQL")
      || !scenario.limitation.includes("remains required")) {
      errors.push(`${scenario.id} must preserve the real PostgreSQL limitation.`);
    }
  }

  for (const scenarioId of REQUIRED_SCENARIOS.keys()) {
    if (!scenarioIds.has(scenarioId)) {
      errors.push(`Missing required rehearsal scenario ${scenarioId}.`);
    }
  }

  const boundary = contract.completion_boundary ?? {};
  if (boundary.resolves_feature_drills !== false) {
    errors.push("completion_boundary.resolves_feature_drills must remain false.");
  }
  if (!Array.isArray(boundary.required_before_complete)
    || JSON.stringify(boundary.required_before_complete) !== JSON.stringify(REQUIRED_FEATURE_DRILLS)) {
    errors.push("completion_boundary.required_before_complete must retain all three feature drills.");
  }
  if (!isNonEmptyString(boundary.rule)
    || !boundary.rule.includes("does not replace feature-specific real PostgreSQL")) {
    errors.push("completion_boundary.rule must forbid substituting the rehearsal for feature drills.");
  }

  if (errors.length > 0) {
    throw new Error(`Recovery rehearsal validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    rehearsal_id: contract.rehearsal_id,
    status: contract.status,
    scenarios: scenarios.length,
    required_checks: scenarios.reduce(
      (total, scenario) => total + scenario.required_checks.length,
      0,
    ),
    feature_drills_resolved: false,
    release_gate_integrated: true,
  };
}

export function run(filePath = defaultRehearsalContractPath) {
  const contract = loadRecoveryRehearsalContract(filePath);
  const summary = validateRecoveryRehearsalContract(contract);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv[2] ? path.resolve(process.argv[2]) : defaultRehearsalContractPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
