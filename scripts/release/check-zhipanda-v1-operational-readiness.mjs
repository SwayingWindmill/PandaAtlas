import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const defaultContractPath = path.join(
  repositoryRoot,
  "contracts",
  "zhipanda-v1-operational-readiness.v1.json",
);

const REQUIRED_SLO_IDS = new Set([
  "auth",
  "follow",
  "feed",
  "activity_projection",
  "inbox",
  "queue",
  "email",
  "submissions",
  "attachment_scanning",
  "archive_chain",
  "publish_projection",
  "privacy_deletion",
  "audit",
  "admin_access",
]);

const REQUIRED_P1_SLO_IDS = new Set([
  "auth",
  "activity_projection",
  "queue",
  "attachment_scanning",
  "archive_chain",
  "publish_projection",
  "privacy_deletion",
  "audit",
  "admin_access",
]);

const REQUIRED_AVAILABLE_DRILLS = new Set([
  "immutable-release-recovery",
  "postgres-attachment-recovery",
  "identity-engagement-recovery",
  "notification-staging",
  "api-withdrawal-rollback",
  "web-withdrawal-rollback",
  "supabase-clean-reset",
]);

const REQUIRED_PLANNED_DRILLS = new Map([
  ["moderation-stop-drain", 197],
  ["privacy-tombstone-replay", 198],
  ["audit-integrity-recovery", 199],
]);

const REQUIRED_GATE_PATHS = new Map([
  ["default_gate", "scripts/release/default.mjs"],
  ["extended_gate", "scripts/release/extended.mjs"],
  ["map_close_gate", "scripts/release/map-close.mjs"],
  ["windows_gate", "scripts/release/windows-map-close.mjs"],
  ["test_glob", "scripts/release/tests/*.test.mjs"],
]);

const REQUIRED_MAP_CLOSE_FLAGS = new Set([
  "all_planned_drills_resolved",
  "linux_and_windows",
  "default_and_extended_gate",
  "clean_checkout_no_diff",
  "browser_mobile_wcag_2_2_aa",
  "performance_security_privacy",
  "immutable_evidence_hashes",
  "launch_owner_and_go_no_go",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireUnique(errors, records, label) {
  const seen = new Set();
  for (const record of records) {
    const id = record?.id;
    if (!isNonEmptyString(id)) {
      errors.push(`${label} contains a record without an id.`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`${label} contains duplicate id ${id}.`);
    }
    seen.add(id);
  }
  return seen;
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

export function loadOperationalReadinessContract(filePath = defaultContractPath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function validateOperationalReadinessContract(
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
  if (contract.contract_id !== "zhipanda-v1-operational-readiness") {
    errors.push("contract_id must be zhipanda-v1-operational-readiness.");
  }
  if (contract.issue !== 200) {
    errors.push("issue must be 200.");
  }
  if (!new Set(["in-progress", "complete"]).has(contract.status)) {
    errors.push("status must be in-progress or complete.");
  }

  const releaseSystem = contract.release_system ?? {};
  for (const [field, expected] of REQUIRED_GATE_PATHS) {
    if (releaseSystem[field] !== expected) {
      errors.push(`release_system.${field} must be ${expected}.`);
    }
    if (checkEvidence && field !== "test_glob") {
      requireRepositoryPath(errors, root, releaseSystem[field], `release_system.${field}`);
    }
  }
  if (!isNonEmptyString(releaseSystem.rule)
    || !releaseSystem.rule.includes("existing Release Gate")
    || !releaseSystem.rule.includes("do not create an independent")) {
    errors.push("release_system.rule must forbid an independent certification path.");
  }

  const slos = Array.isArray(contract.service_level_objectives)
    ? contract.service_level_objectives
    : [];
  const sloIds = requireUnique(errors, slos, "service_level_objectives");
  for (const requiredId of REQUIRED_SLO_IDS) {
    if (!sloIds.has(requiredId)) {
      errors.push(`Missing required SLO ${requiredId}.`);
    }
  }
  for (const id of sloIds) {
    if (!REQUIRED_SLO_IDS.has(id)) {
      errors.push(`Unsupported SLO ${id}; update the versioned contract before adding domains.`);
    }
  }

  const runbookSections = Array.isArray(contract.required_runbook_sections)
    ? contract.required_runbook_sections
    : [];
  const runbookSectionSet = new Set(runbookSections);
  if (runbookSectionSet.size !== runbookSections.length) {
    errors.push("required_runbook_sections must not contain duplicates.");
  }
  if (!runbookSectionSet.has("launch-decision-and-evidence")) {
    errors.push("required_runbook_sections must include launch-decision-and-evidence.");
  }

  for (const slo of slos) {
    const prefix = `SLO ${slo.id ?? "<missing-id>"}`;
    for (const [field, value] of [
      ["owner", slo.owner],
      ["sli", slo.sli],
      ["objective", slo.objective],
      ["rollback_control", slo.rollback_control],
      ["runbook_anchor", slo.runbook_anchor],
    ]) {
      if (!isNonEmptyString(value)) {
        errors.push(`${prefix} must define ${field}.`);
      }
    }
    if (isNonEmptyString(slo.runbook_anchor)
      && !runbookSectionSet.has(slo.runbook_anchor)) {
      errors.push(`${prefix} references undeclared runbook anchor ${slo.runbook_anchor}.`);
    }

    const alert = slo.alert ?? {};
    if (!new Set(["P1", "P2"]).has(alert.severity)) {
      errors.push(`${prefix} alert severity must be P1 or P2.`);
    }
    if (REQUIRED_P1_SLO_IDS.has(slo.id) && alert.severity !== "P1") {
      errors.push(`${prefix} is safety-critical and must alert at P1.`);
    }
    if (!isNonEmptyString(alert.condition)) {
      errors.push(`${prefix} must define an alert condition.`);
    }
    if (!Number.isInteger(alert.for_minutes) || alert.for_minutes < 0) {
      errors.push(`${prefix} alert.for_minutes must be a non-negative integer.`);
    }
  }

  const drills = Array.isArray(contract.recovery_drills)
    ? contract.recovery_drills
    : [];
  const drillIds = requireUnique(errors, drills, "recovery_drills");
  for (const id of REQUIRED_AVAILABLE_DRILLS) {
    if (!drillIds.has(id)) {
      errors.push(`Missing available recovery drill ${id}.`);
    }
  }
  for (const id of REQUIRED_PLANNED_DRILLS.keys()) {
    if (!drillIds.has(id)) {
      errors.push(`Missing planned recovery drill ${id}.`);
    }
  }

  for (const drill of drills) {
    const prefix = `recovery drill ${drill.id ?? "<missing-id>"}`;
    if (!isNonEmptyString(drill.proves)) {
      errors.push(`${prefix} must describe what it proves.`);
    }
    if (drill.status === "available") {
      if (!REQUIRED_AVAILABLE_DRILLS.has(drill.id)) {
        errors.push(`${prefix} is not a recognized available drill in schema version 1.`);
      }
      if (!isNonEmptyString(drill.command) || !drill.command.startsWith("npm run ")) {
        errors.push(`${prefix} must use an npm run command.`);
      }
      if (drill.blocked_by_issue !== undefined) {
        errors.push(`${prefix} must not declare blocked_by_issue once available.`);
      }
      if (checkEvidence) {
        requireRepositoryPath(errors, root, drill.evidence, `${prefix} evidence`);
      } else if (!isNonEmptyString(drill.evidence)) {
        errors.push(`${prefix} must name evidence.`);
      }
    } else if (drill.status === "planned") {
      const expectedIssue = REQUIRED_PLANNED_DRILLS.get(drill.id);
      if (expectedIssue === undefined) {
        errors.push(`${prefix} is not a recognized planned drill in schema version 1.`);
      } else if (drill.blocked_by_issue !== expectedIssue) {
        errors.push(`${prefix} must be blocked by issue ${expectedIssue}.`);
      }
      if (drill.command !== null) {
        errors.push(`${prefix} command must remain null until the blocking slice lands.`);
      }
      if (drill.evidence !== undefined) {
        errors.push(`${prefix} must not claim evidence before implementation.`);
      }
    } else {
      errors.push(`${prefix} status must be available or planned.`);
    }
  }

  const mapClose = contract.map_close_requirements ?? {};
  for (const field of REQUIRED_MAP_CLOSE_FLAGS) {
    if (mapClose[field] !== true) {
      errors.push(`map_close_requirements.${field} must be true.`);
    }
  }

  if (contract.status === "complete") {
    const planned = drills.filter((drill) => drill.status === "planned");
    if (planned.length > 0) {
      errors.push("A complete operational readiness contract cannot contain planned drills.");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Operational readiness validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    contract_id: contract.contract_id,
    status: contract.status,
    slos: slos.length,
    p1_slos: slos.filter((slo) => slo.alert?.severity === "P1").length,
    available_drills: drills.filter((drill) => drill.status === "available").length,
    planned_drills: drills.filter((drill) => drill.status === "planned").length,
    runbook_sections: runbookSections.length,
    release_gate_integrated: true,
  };
}

export function run(filePath = defaultContractPath) {
  const contract = loadOperationalReadinessContract(filePath);
  const summary = validateOperationalReadinessContract(contract);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv[2] ? path.resolve(process.argv[2]) : defaultContractPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
