import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ALLOWED_STATUSES = new Set([
  "PASS",
  "FAIL",
  "BLOCKED",
  "NOT_APPLICABLE_WITH_REASON",
]);

const REQUIRED_GROUPS = [
  "reproducibility",
  "static_correctness",
  "public_contracts",
  "media_and_content_truth",
  "browser_journeys",
  "automated_accessibility",
  "visual_regression",
  "performance_budgets",
];

function validateEvidenceItem(item, path, errors) {
  if (!item || typeof item !== "object") {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!ALLOWED_STATUSES.has(item.status)) {
    errors.push(`${path}.status must be an allowed status`);
  }
  if (typeof item.detail !== "string" || item.detail.trim() === "") {
    errors.push(`${path}.detail must be a non-empty string`);
  }
  if (item.status === "NOT_APPLICABLE_WITH_REASON" && item.detail.trim().length < 8) {
    errors.push(`${path}.detail must explain why the evidence is not applicable`);
  }
  if (item.evidence !== undefined && !Array.isArray(item.evidence)) {
    errors.push(`${path}.evidence must be an array when present`);
  } else if (Array.isArray(item.evidence)) {
    if (item.evidence.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
      errors.push(`${path}.evidence entries must be non-empty strings`);
    }
    if (item.status === "PASS" && item.evidence.length === 0) {
      errors.push(`${path}.evidence must contain at least one item when status is PASS`);
    }
  } else if (item.status === "PASS") {
    errors.push(`${path}.evidence must contain at least one item when status is PASS`);
  }
}

export function validateFrontendEvidenceManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") {
    return ["manifest must be an object"];
  }
  if (manifest.schema_version !== 1) errors.push("schema_version must equal 1");
  if (!Number.isInteger(manifest.issue) || manifest.issue <= 0) errors.push("issue must be a positive integer");
  if (!manifest.artifact || typeof manifest.artifact.commit !== "string") errors.push("artifact.commit is required");
  if (![0, 1, 2, 3].includes(manifest.risk?.computed_level)) errors.push("risk.computed_level must be 0–3");
  if (![0, 1, 2, 3].includes(manifest.risk?.declared_level)) errors.push("risk.declared_level must be 0–3");
  if ((manifest.risk?.declared_level ?? 0) < (manifest.risk?.computed_level ?? 0)) {
    errors.push("risk.declared_level cannot be below risk.computed_level");
  }
  if (!manifest.public_release?.id || !manifest.public_release?.schema_version) {
    errors.push("public_release.id and public_release.schema_version are required");
  }

  for (const group of REQUIRED_GROUPS) {
    validateEvidenceItem(manifest.check_groups?.[group], `check_groups.${group}`, errors);
  }
  validateEvidenceItem(manifest.staging, "staging", errors);
  validateEvidenceItem(manifest.human_signoff, "human_signoff", errors);

  const effectiveRiskLevel = Math.max(
    manifest.risk?.computed_level ?? 0,
    manifest.risk?.declared_level ?? 0,
  );
  if (effectiveRiskLevel === 3) {
    if (manifest.staging?.status === "NOT_APPLICABLE_WITH_REASON") {
      errors.push("Level 3 evidence cannot mark staging as not applicable");
    }
    if (manifest.human_signoff?.status === "NOT_APPLICABLE_WITH_REASON") {
      errors.push("Level 3 evidence cannot mark human_signoff as not applicable");
    }
  }

  if (!["GO", "NO_GO", "BLOCKED"].includes(manifest.release_decision?.status)) {
    errors.push("release_decision.status must be GO, NO_GO or BLOCKED");
  }
  if (typeof manifest.release_decision?.detail !== "string" || manifest.release_decision.detail.trim() === "") {
    errors.push("release_decision.detail is required");
  }
  if (manifest.release_decision?.status === "GO") {
    if (!manifest.artifact?.commit || manifest.artifact.commit === "UNBOUND_WORKING_TREE") {
      errors.push("a GO decision requires an immutable artifact commit");
    }
    if (!manifest.artifact?.build_checksum) {
      errors.push("a GO decision requires artifact.build_checksum");
    }
    if (!manifest.artifact?.frontend_deployment_id) {
      errors.push("a GO decision requires artifact.frontend_deployment_id");
    }
    if (!manifest.artifact?.api_deployment_id) {
      errors.push("a GO decision requires artifact.api_deployment_id");
    }
  }

  return errors;
}

export function computeFrontendReleaseDecision(manifest) {
  const evidence = [
    ...REQUIRED_GROUPS.map((group) => manifest.check_groups[group]),
    manifest.staging,
    manifest.human_signoff,
  ];
  if (evidence.some((item) => item.status === "FAIL")) return "NO_GO";
  if (evidence.some((item) => item.status === "BLOCKED")) return "BLOCKED";
  return "GO";
}

async function runCli() {
  const args = process.argv.slice(2);
  const requirePass = args.includes("--require-pass");
  const manifestPath = args.find((arg) => !arg.startsWith("--"));
  if (!manifestPath) {
    throw new Error("Usage: node scripts/release/validate-frontend-evidence.mjs <manifest.json> [--require-pass]");
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const errors = validateFrontendEvidenceManifest(manifest);
  if (errors.length) {
    for (const error of errors) process.stderr.write(`[frontend-evidence] ${error}\n`);
    process.exitCode = 1;
    return;
  }

  const computedDecision = computeFrontendReleaseDecision(manifest);
  if (manifest.release_decision.status !== computedDecision) {
    process.stderr.write(
      `[frontend-evidence] recorded decision ${manifest.release_decision.status} does not match computed decision ${computedDecision}\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `[frontend-evidence] valid issue=#${manifest.issue} risk=Level ${manifest.risk.computed_level} decision=${computedDecision}\n`,
  );
  if (requirePass && computedDecision !== "GO") process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
