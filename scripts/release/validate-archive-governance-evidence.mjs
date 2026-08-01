import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

export class ArchiveGovernanceEvidenceError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ArchiveGovernanceEvidenceError";
    this.details = details;
  }
}

export const requiredIssue196Categories = Object.freeze([
  "inventory-adr-cutover",
  "migration-rehearsal-integrity",
  "accountable-publication-transaction",
  "projection-activity-notification",
  "correction-rollback-identity-history",
  "admin-browser-accessibility-budget",
  "operations-recovery-cross-platform",
]);

export const requiredIssue196Blockers = Object.freeze([190, 191, 194, 195, 182, 192]);

const defaultEvidenceUrl = new URL(
  "../../data/release-evidence/issue-196-single-accountable-archive-governance.json",
  import.meta.url,
);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function arrayOfNonEmptyStrings(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function collectScenarioExecutionEvidence(scenario) {
  return [
    ...(Array.isArray(scenario.gate_commands) ? scenario.gate_commands : []),
    ...(Array.isArray(scenario.artifact_locations) ? scenario.artifact_locations : []),
  ];
}

function collectEvidenceRefs(evidence) {
  return evidence.categories.flatMap((category) =>
    category.scenarios.flatMap((scenario) => scenario.evidence_refs),
  );
}

function repositoryRootFromEvidenceUrl(evidenceUrl) {
  return new URL("../../", evidenceUrl);
}

async function assertEvidenceReferencesExist(evidence, evidenceUrl) {
  const missing = [];
  const repositoryRoot = repositoryRootFromEvidenceUrl(evidenceUrl);
  for (const reference of new Set(collectEvidenceRefs(evidence))) {
    try {
      await access(new URL(reference, repositoryRoot), constants.R_OK);
    } catch {
      missing.push(reference);
    }
  }
  if (missing.length > 0) {
    throw new ArchiveGovernanceEvidenceError(
      "Issue #196 evidence references must point to repository files",
      missing.map((reference) => `missing evidence_ref: ${reference}`),
    );
  }
}

export function validateArchiveGovernanceEvidence(evidence) {
  const errors = [];

  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new ArchiveGovernanceEvidenceError("Evidence package must be a JSON object");
  }
  if (evidence.schema_version !== 1) errors.push("schema_version must be 1");
  if (evidence.issue !== 196) errors.push("issue must be 196");
  if (evidence.map_issue !== 175) errors.push("map_issue must be 175");
  if (evidence.owned_by !== "delivery:map-close") {
    errors.push("owned_by must be delivery:map-close");
  }
  if (!isNonEmptyString(evidence.closure_rule)) errors.push("closure_rule is required");
  if (!arrayOfNonEmptyStrings(evidence.rollback_switches) || evidence.rollback_switches.length < 6) {
    errors.push("rollback_switches must list all #175 rollback switches");
  }
  if (!arrayOfNonEmptyStrings(evidence.artifact_locations) || evidence.artifact_locations.length < 5) {
    errors.push("artifact_locations must list final immutable evidence locations");
  }

  const categories = Array.isArray(evidence.categories) ? evidence.categories : [];
  const categoryIds = categories.map((category) => category.id);
  const actualCategoryIds = [...categoryIds].sort();
  const expectedCategoryIds = [...requiredIssue196Categories].sort();
  if (new Set(categoryIds).size !== categoryIds.length) {
    errors.push("categories must not contain duplicate ids");
  }
  if (JSON.stringify(actualCategoryIds) !== JSON.stringify(expectedCategoryIds)) {
    errors.push(
      `categories must match issue #196 exactly: ${requiredIssue196Categories.join(", ")}`,
    );
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  for (const categoryId of requiredIssue196Categories) {
    const category = categoriesById.get(categoryId);
    if (!category) continue;
    if (!isNonEmptyString(category.required_by_issue_196)) {
      errors.push(`${categoryId} must quote the #196 requirement it closes`);
    }
    const scenarios = Array.isArray(category.scenarios) ? category.scenarios : [];
    if (scenarios.length === 0) errors.push(`${categoryId} must include scenarios`);
    const scenarioIds = new Set();
    for (const scenario of scenarios) {
      const scenarioPrefix = `${categoryId}/${scenario.id ?? "unknown"}`;
      if (!isNonEmptyString(scenario.id)) errors.push(`${categoryId} has a scenario without id`);
      if (scenarioIds.has(scenario.id)) errors.push(`${scenarioPrefix} duplicates a scenario id`);
      scenarioIds.add(scenario.id);
      if (scenario.status !== "covered") errors.push(`${scenarioPrefix} is not covered`);
      if (!isNonEmptyString(scenario.acceptance)) {
        errors.push(`${scenarioPrefix} must describe acceptance`);
      }
      if (!arrayOfNonEmptyStrings(scenario.evidence_refs) || scenario.evidence_refs.length === 0) {
        errors.push(`${scenarioPrefix} must list evidence_refs`);
      }
      if (collectScenarioExecutionEvidence(scenario).length === 0) {
        errors.push(`${scenarioPrefix} must list gate_commands or artifact_locations`);
      }
    }
  }

  const blockers = Array.isArray(evidence.blockers) ? evidence.blockers : [];
  const blockerIssues = blockers.map((blocker) => blocker.issue);
  if (new Set(blockerIssues).size !== blockerIssues.length) {
    errors.push("blockers must not contain duplicate issues");
  }
  for (const issue of requiredIssue196Blockers) {
    const blocker = blockers.find((candidate) => candidate.issue === issue);
    if (!blocker) errors.push(`blocker #${issue} must be represented`);
    else if (blocker.status !== "closed") {
      errors.push(`blocker #${issue} must be closed before #175 final certification`);
    }
  }

  if (errors.length > 0) {
    throw new ArchiveGovernanceEvidenceError("Issue #196 evidence package is incomplete", errors);
  }

  return {
    issue: evidence.issue,
    map_issue: evidence.map_issue,
    category_count: categories.length,
    scenario_count: categories.reduce((count, category) => count + category.scenarios.length, 0),
    blocker_count: blockers.length,
    rollback_switch_count: evidence.rollback_switches.length,
    artifact_count: evidence.artifact_locations.length,
  };
}

export async function validateArchiveGovernanceEvidenceFile(evidenceUrl = defaultEvidenceUrl) {
  const raw = await readFile(evidenceUrl, "utf8");
  const evidence = JSON.parse(raw);
  const summary = validateArchiveGovernanceEvidence(evidence);
  await assertEvidenceReferencesExist(evidence, evidenceUrl);
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateArchiveGovernanceEvidenceFile()
    .then((summary) => {
      console.log(
        `issue #${summary.issue} evidence covers ${summary.category_count} categories and ${summary.scenario_count} scenarios`,
      );
    })
    .catch((error) => {
      if (error instanceof ArchiveGovernanceEvidenceError) {
        console.error(error.message);
        for (const detail of error.details) console.error(`- ${detail}`);
      } else {
        console.error(error instanceof Error ? error.message : error);
      }
      process.exitCode = 1;
    });
}
