import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDirectory, "..", "..");
export const defaultContractPath = path.join(
  repoRoot,
  "contracts",
  "zhipanda-v1-delivery-closeout.v1.json",
);

const REQUIRED_PREREQUISITES = new Set([181, 186, 193, 196, 197, 198, 199, 200]);
const REQUIRED_DOMAINS = new Set([
  "public-follow-return",
  "archive-publish-return",
  "contribution-to-publication",
  "moderation-privacy-audit",
  "failure-recovery",
]);
const REQUIRED_REPOSITORY_GATES = new Set([
  "delivery-contract",
  "approved-release-bootstrap",
  "linux-authoritative-map-close",
  "windows-map-close",
  "supabase-published-return",
]);
const REQUIRED_EXTERNAL_GATES = new Set([
  "extended-real-service",
  "vercel-web-final-preview",
  "vercel-api-final-preview",
]);
const REQUIRED_EXTERNAL_REQUIREMENTS = new Set([
  "staging-credentials",
  "vercel-provider-capacity",
  "launch-decision",
]);
const REQUIRED_ROLLBACK_SWITCHES = new Set([
  "IDENTITY_AUTH_ENABLED",
  "ENGAGEMENT_ENABLED",
  "FEED_ENABLED",
  "NOTIFICATION_ENABLED",
  "NOTIFICATION_EMAIL_ENABLED",
  "COMMUNITY_INTAKE_ENABLED",
  "ARCHIVE_SINGLE_ACCOUNTABLE_APPROVER_ENABLED",
  "MODERATION_ENABLED",
  "PRIVACY_OPERATIONS_ENABLED",
  "UNIFIED_AUDIT_ENABLED",
  "ADMIN_SHELL_ENABLED",
]);
const COMMIT_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const DECISION_STATUSES = new Set(["pending", "go", "no-go"]);
const CONTRACT_STATUSES = new Set(["in-progress", "complete"]);
const DOMAIN_STATUSES = new Set(["repository-verified", "staging-verified", "passed"]);
const GATE_STATUSES = new Set(["pending", "blocked", "passed"]);
const REQUIREMENT_STATUSES = new Set(["blocked", "ready", "passed"]);
const SENSITIVE_KEY_PATTERN = /(password|secret|private[_-]?key|access[_-]?token|refresh[_-]?token|database[_-]?url)/i;
const SENSITIVE_VALUE_PATTERN = /(postgres(?:ql)?:\/\/[^\s]+:[^\s]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----|sb_secret_|sk_live_|ghp_)/i;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function requireUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)) {
      throw new Error(`${label} contains an invalid or duplicate id: ${item?.id}`);
    }
    ids.add(item.id);
  }
  return ids;
}

function requireExactSet(actual, expected, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`${label} mismatch; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`);
  }
}

function scanForSensitiveMaterial(value, location = "contract") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSensitiveMaterial(entry, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new Error(`Sensitive key is forbidden in delivery closeout evidence: ${location}.${key}`);
      }
      scanForSensitiveMaterial(entry, `${location}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && SENSITIVE_VALUE_PATTERN.test(value)) {
    throw new Error(`Sensitive value is forbidden in delivery closeout evidence: ${location}`);
  }
}

function requireDecisionMetadata(decision) {
  if (typeof decision.owner !== "string" || !decision.owner.trim()) {
    throw new Error("Final launch decision requires an accountable owner");
  }
  if (typeof decision.decided_at !== "string" || !decision.decided_at.trim()) {
    throw new Error("Final launch decision requires decided_at");
  }
  if (typeof decision.version !== "string" || !decision.version.trim()) {
    throw new Error("Final launch decision requires a version");
  }
  if (typeof decision.reason !== "string" || !decision.reason.trim()) {
    throw new Error("Final launch decision requires a reason");
  }
  if (!COMMIT_SHA_PATTERN.test(decision.candidate_sha ?? "")) {
    throw new Error("Final launch decision requires a valid Git candidate SHA");
  }
  if (!SHA256_PATTERN.test(decision.evidence_sha256 ?? "")) {
    throw new Error("Final launch decision requires a SHA-256 evidence identity");
  }
}

export function validateZhiPandaV1DeliveryCloseout({
  contractPath = defaultContractPath,
} = {}) {
  const contract = readJson(contractPath);
  scanForSensitiveMaterial(contract);

  if (
    contract.schema_version !== 1 ||
    contract.contract_id !== "zhipanda-v1-delivery-closeout" ||
    contract.issue !== 201
  ) {
    throw new Error("ZhiPanda V1 delivery closeout contract identity is invalid");
  }
  if (!CONTRACT_STATUSES.has(contract.status)) {
    throw new Error(`Unsupported delivery closeout status: ${contract.status}`);
  }
  if (!COMMIT_SHA_PATTERN.test(contract.baseline?.master_sha ?? "")) {
    throw new Error("Delivery closeout baseline master SHA is invalid");
  }
  if (contract.baseline?.operational_readiness_pr !== 285 || contract.baseline?.operational_readiness_issue !== 200) {
    throw new Error("Delivery closeout baseline must bind PR #285 and Issue #200");
  }

  const prerequisites = Array.isArray(contract.prerequisite_issues)
    ? contract.prerequisite_issues
    : [];
  const prerequisiteIds = new Set();
  for (const entry of prerequisites) {
    if (!Number.isInteger(entry?.issue) || prerequisiteIds.has(entry.issue)) {
      throw new Error(`Invalid or duplicate prerequisite issue: ${entry?.issue}`);
    }
    if (entry.state !== "closed") {
      throw new Error(`Prerequisite Issue #${entry.issue} is not recorded as closed`);
    }
    prerequisiteIds.add(entry.issue);
  }
  requireExactSet(prerequisiteIds, REQUIRED_PREREQUISITES, "prerequisite issue inventory");

  const domains = Array.isArray(contract.closed_loop_domains) ? contract.closed_loop_domains : [];
  const domainIds = requireUniqueIds(domains, "closed-loop domain inventory");
  requireExactSet(domainIds, REQUIRED_DOMAINS, "closed-loop domain inventory");
  for (const domain of domains) {
    if (!DOMAIN_STATUSES.has(domain.status)) {
      throw new Error(`Unsupported status for closed-loop domain ${domain.id}: ${domain.status}`);
    }
    if (!Array.isArray(domain.evidence) || domain.evidence.length < 3 || domain.evidence.some((entry) => typeof entry !== "string" || !entry.trim())) {
      throw new Error(`Closed-loop domain ${domain.id} lacks concrete evidence coverage`);
    }
  }

  const gates = Array.isArray(contract.final_gates) ? contract.final_gates : [];
  const gateIds = requireUniqueIds(gates, "final gate inventory");
  requireExactSet(
    gateIds,
    new Set([...REQUIRED_REPOSITORY_GATES, ...REQUIRED_EXTERNAL_GATES]),
    "final gate inventory",
  );
  for (const gate of gates) {
    if (!GATE_STATUSES.has(gate.status)) {
      throw new Error(`Unsupported status for final gate ${gate.id}: ${gate.status}`);
    }
    if (typeof gate.evidence !== "string" || !gate.evidence.trim()) {
      throw new Error(`Final gate ${gate.id} lacks evidence guidance`);
    }
    if (REQUIRED_REPOSITORY_GATES.has(gate.id) && gate.status !== "passed") {
      throw new Error(`Repository final gate must be passed: ${gate.id}`);
    }
  }

  const requirements = Array.isArray(contract.external_requirements)
    ? contract.external_requirements
    : [];
  const requirementIds = requireUniqueIds(requirements, "external requirement inventory");
  requireExactSet(requirementIds, REQUIRED_EXTERNAL_REQUIREMENTS, "external requirement inventory");
  for (const requirement of requirements) {
    if (requirement.necessary !== true) {
      throw new Error(`External requirement must remain necessary: ${requirement.id}`);
    }
    if (!REQUIREMENT_STATUSES.has(requirement.status)) {
      throw new Error(`Unsupported external requirement status for ${requirement.id}: ${requirement.status}`);
    }
    if (typeof requirement.detail !== "string" || !requirement.detail.trim()) {
      throw new Error(`External requirement ${requirement.id} lacks operator guidance`);
    }
  }

  const decision = contract.launch_decision ?? {};
  if (!DECISION_STATUSES.has(decision.status)) {
    throw new Error(`Unsupported launch decision status: ${decision.status}`);
  }
  if (!COMMIT_SHA_PATTERN.test(decision.candidate_sha ?? "")) {
    throw new Error("Launch candidate SHA is invalid");
  }
  const rollbackSwitches = new Set(Array.isArray(decision.rollback_switches) ? decision.rollback_switches : []);
  requireExactSet(rollbackSwitches, REQUIRED_ROLLBACK_SWITCHES, "launch rollback switch inventory");
  if (decision.post_launch_measurement?.metric !== "30-day effective-follow-return") {
    throw new Error("Post-launch measurement must remain 30-day effective-follow-return");
  }

  const allDomainsPassed = domains.every((domain) => domain.status === "passed");
  const allGatesPassed = gates.every((gate) => gate.status === "passed");
  const allRequirementsPassed = requirements.every((requirement) => requirement.status === "passed");

  if (decision.status !== "pending") {
    requireDecisionMetadata(decision);
  } else if (
    decision.owner !== null ||
    decision.decided_at !== null ||
    decision.version !== null ||
    decision.evidence_sha256 !== null ||
    decision.reason !== null
  ) {
    throw new Error("Pending launch decision must not contain partial decision metadata");
  }

  if (decision.status === "go" && (!allDomainsPassed || !allGatesPassed || !allRequirementsPassed)) {
    throw new Error("GO decision is forbidden until every domain, gate, and external requirement passes");
  }
  if (contract.status === "complete") {
    if (decision.status === "pending") {
      throw new Error("Complete delivery closeout cannot retain a pending launch decision");
    }
    if (!allDomainsPassed || !allGatesPassed || !allRequirementsPassed) {
      throw new Error("Complete delivery closeout requires all domains, gates, and external requirements to pass");
    }
  }
  if (contract.production_mutations_performed !== false) {
    throw new Error("Repository delivery closeout contract must not claim production mutations");
  }
  if (!Array.isArray(contract.rules) || contract.rules.length < 4) {
    throw new Error("Delivery closeout contract lacks required safety rules");
  }

  return {
    status: "PASS",
    contract_status: contract.status,
    decision_status: decision.status,
    prerequisite_count: prerequisites.length,
    domain_count: domains.length,
    repository_gate_count: gates.filter((gate) => REQUIRED_REPOSITORY_GATES.has(gate.id) && gate.status === "passed").length,
    pending_gate_ids: gates.filter((gate) => gate.status !== "passed").map((gate) => gate.id).sort(),
    blocked_requirement_ids: requirements.filter((entry) => entry.status !== "passed").map((entry) => entry.id).sort(),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(validateZhiPandaV1DeliveryCloseout(), null, 2));
  } catch (error) {
    console.error(`[zhipanda-v1-delivery-closeout] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
