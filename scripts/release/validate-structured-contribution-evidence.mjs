import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

export class StructuredContributionEvidenceError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "StructuredContributionEvidenceError";
    this.details = details;
  }
}

export const requiredIssue193Categories = Object.freeze([
  "draft-validation-submit-revisions",
  "private-upload-attachment-security",
  "reviewer-workflow",
  "curation-release-projection",
  "notifications-email",
  "browser-mobile-wcag",
  "operations-privacy-recovery",
]);

const defaultEvidenceUrl = new URL(
  "../../data/release-evidence/issue-193-structured-contribution-review-to-archive.json",
  import.meta.url,
);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function arrayOfNonEmptyStrings(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function collectScenarioCommands(scenario) {
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
    throw new StructuredContributionEvidenceError(
      "Issue #193 evidence references must point to repository files",
      missing.map((reference) => `missing evidence_ref: ${reference}`),
    );
  }
}

export function validateStructuredContributionEvidence(evidence) {
  const errors = [];

  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new StructuredContributionEvidenceError("Evidence package must be a JSON object");
  }
  if (evidence.schema_version !== 1) errors.push("schema_version must be 1");
  if (evidence.issue !== 193) errors.push("issue must be 193");
  if (evidence.map_issue !== 174) errors.push("map_issue must be 174");
  if (!isNonEmptyString(evidence.closure_rule)) errors.push("closure_rule is required");
  if (!arrayOfNonEmptyStrings(evidence.rollback_switches) || evidence.rollback_switches.length < 5) {
    errors.push("rollback_switches must list all #174 rollback switches");
  }
  if (!arrayOfNonEmptyStrings(evidence.artifact_locations)) {
    errors.push("artifact_locations must list immutable final artifacts");
  }

  const categories = Array.isArray(evidence.categories) ? evidence.categories : [];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const actualCategoryIds = categories.map((category) => category.id).sort();
  const expectedCategoryIds = [...requiredIssue193Categories].sort();
  if (JSON.stringify(actualCategoryIds) !== JSON.stringify(expectedCategoryIds)) {
    errors.push(
      `categories must match issue #193 exactly: ${requiredIssue193Categories.join(", ")}`,
    );
  }

  for (const categoryId of requiredIssue193Categories) {
    const category = categoriesById.get(categoryId);
    if (!category) continue;
    if (!isNonEmptyString(category.required_by_issue_193)) {
      errors.push(`${categoryId} must quote the #193 requirement it closes`);
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
      if (collectScenarioCommands(scenario).length === 0) {
        errors.push(`${scenarioPrefix} must list gate_commands or artifact_locations`);
      }
    }
  }

  const blockers = Array.isArray(evidence.blockers) ? evidence.blockers : [];
  const blockerIssues = new Set(blockers.map((blocker) => blocker.issue));
  for (const issue of [186, 187, 188, 189, 192]) {
    if (!blockerIssues.has(issue)) errors.push(`blocker #${issue} must be represented`);
  }
  for (const blocker of blockers) {
    if (blocker.status !== "closed") {
      errors.push(`blocker #${blocker.issue} must be closed before #174 final certification`);
    }
  }

  if (errors.length > 0) {
    throw new StructuredContributionEvidenceError("Issue #193 evidence package is incomplete", errors);
  }

  return {
    issue: evidence.issue,
    map_issue: evidence.map_issue,
    category_count: categories.length,
    scenario_count: categories.reduce((count, category) => count + category.scenarios.length, 0),
    rollback_switch_count: evidence.rollback_switches.length,
    artifact_count: evidence.artifact_locations.length,
  };
}

export async function validateStructuredContributionEvidenceFile(
  evidenceUrl = defaultEvidenceUrl,
) {
  const raw = await readFile(evidenceUrl, "utf8");
  const evidence = JSON.parse(raw);
  const summary = validateStructuredContributionEvidence(evidence);
  await assertEvidenceReferencesExist(evidence, evidenceUrl);
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateStructuredContributionEvidenceFile()
    .then((summary) => {
      console.log(
        `issue #${summary.issue} evidence covers ${summary.category_count} categories and ${summary.scenario_count} scenarios`,
      );
    })
    .catch((error) => {
      if (error instanceof StructuredContributionEvidenceError) {
        console.error(error.message);
        for (const detail of error.details) console.error(`- ${detail}`);
      } else {
        console.error(error instanceof Error ? error.message : error);
      }
      process.exitCode = 1;
    });
}
