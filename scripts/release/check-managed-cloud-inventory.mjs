import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const defaultInventoryPath = path.join(
  repositoryRoot,
  "contracts",
  "managed-cloud-deployment-inventory.v1.json",
);

const ALLOWED_TARGET_RUNTIMES = new Set([
  "vercel",
  "supabase",
  "github-actions",
  "cloudflare-r2",
  "cloudflare-dns",
  "cloudflare-managed",
  "local-development",
  "retired",
]);

const REQUIRED_RESPONSIBILITIES = new Set([
  "web-production-runtime",
  "web-preview-and-staging",
  "public-read-api",
  "authoritative-api",
  "authoritative-database",
  "managed-authentication-and-admin-authorization",
  "d1-public-projection",
  "public-media-storage-and-delivery",
  "research-and-source-acquisition",
  "curation-and-import-execution",
  "media-processing",
  "immutable-release-construction",
  "production-publication-orchestration",
  "quality-and-release-gates",
  "dns-and-domain-routing",
  "runtime-secrets",
  "observability",
  "backup-rollback-and-recovery",
]);

const REQUIRED_DOMAINS = new Set([
  "zhipanda.com",
  "www.zhipanda.com",
  "api.zhipanda.com",
]);

const REQUIRED_SECRET_VARIABLES = new Set([
  "DATABASE_URL",
  "REAL_DB_URL",
  "ADMIN_API_TOKEN",
  "WORKFLOW_ACTOR_TOKENS_JSON",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function recordUnique(errors, values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push(`${label} contains duplicate value ${value}.`);
    }
    seen.add(value);
  }
}

function requireResponsibilityTarget(errors, byId, id, target) {
  const item = byId.get(id);
  if (!item) return;
  if (!Array.isArray(item.target_runtimes) || !item.target_runtimes.includes(target)) {
    errors.push(`${id} must target ${target}.`);
  }
}

export function loadManagedCloudInventory(filePath = defaultInventoryPath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function validateManagedCloudInventory(
  inventory,
  {
    checkEvidence = true,
    root = repositoryRoot,
  } = {},
) {
  const errors = [];

  if (inventory.schema_version !== 1) {
    errors.push("schema_version must be 1.");
  }
  if (inventory.phase !== 0 || inventory.status !== "complete") {
    errors.push("Phase 0 inventory must be marked complete.");
  }
  if (inventory.decision !== "docs/architecture/adr-0002-managed-cloud-deployment-target.md") {
    errors.push("Inventory must bind to ADR 0002.");
  }
  if (inventory.operating_model?.production_hosting !== "managed-only") {
    errors.push("Production hosting must be managed-only.");
  }
  if (inventory.operating_model?.self_managed_production_servers_allowed !== false) {
    errors.push("Self-managed production servers must remain forbidden.");
  }

  const responsibilities = Array.isArray(inventory.responsibilities)
    ? inventory.responsibilities
    : [];
  if (responsibilities.length === 0) {
    errors.push("Responsibilities must not be empty.");
  }

  recordUnique(errors, responsibilities.map((item) => item.id), "responsibilities");
  const responsibilitiesById = new Map(responsibilities.map((item) => [item.id, item]));

  for (const requiredId of REQUIRED_RESPONSIBILITIES) {
    if (!responsibilitiesById.has(requiredId)) {
      errors.push(`Missing required responsibility ${requiredId}.`);
    }
  }

  for (const item of responsibilities) {
    const prefix = `responsibility ${item.id ?? "<missing-id>"}`;
    if (!isNonEmptyString(item.id)) errors.push(`${prefix} must have an id.`);
    if (!isNonEmptyString(item.category)) errors.push(`${prefix} must have a category.`);
    if (!isNonEmptyString(item.responsibility)) {
      errors.push(`${prefix} must describe its responsibility.`);
    }
    if (!isNonEmptyString(item.workload_class)) {
      errors.push(`${prefix} must classify its workload.`);
    }
    if (typeof item.production_dependency !== "boolean") {
      errors.push(`${prefix} must declare production_dependency.`);
    }
    if (!Array.isArray(item.current_runtimes) || item.current_runtimes.length === 0) {
      errors.push(`${prefix} must record at least one current runtime.`);
    }
    if (!isNonEmptyString(item.current_owner)) {
      errors.push(`${prefix} must record a current owner.`);
    }
    if (!Array.isArray(item.target_runtimes) || item.target_runtimes.length === 0) {
      errors.push(`${prefix} must record at least one target runtime.`);
    } else {
      for (const runtime of item.target_runtimes) {
        if (!ALLOWED_TARGET_RUNTIMES.has(runtime)) {
          errors.push(`${prefix} uses unsupported target runtime ${runtime}.`);
        }
      }
    }
    if (!isNonEmptyString(item.target_owner)) {
      errors.push(`${prefix} must record a target owner.`);
    }
    if (!Number.isInteger(item.migration_phase) || item.migration_phase < 1 || item.migration_phase > 6) {
      errors.push(`${prefix} migration_phase must be an integer from 1 through 6.`);
    }
    if (!isNonEmptyString(item.disposition)) {
      errors.push(`${prefix} must record a disposition.`);
    }
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
      errors.push(`${prefix} must record repository evidence.`);
    } else if (checkEvidence) {
      for (const evidencePath of item.evidence) {
        if (!existsSync(path.join(root, evidencePath))) {
          errors.push(`${prefix} references missing evidence ${evidencePath}.`);
        }
      }
    }

    const targetText = [
      ...(item.target_runtimes ?? []),
      item.target_owner ?? "",
      item.disposition ?? "",
    ].join(" ").toLowerCase();
    for (const forbidden of ["self-managed", "self managed", "vps", "virtual-machine", "virtual machine", "container-host", "container host"]) {
      if (targetText.includes(forbidden)) {
        errors.push(`${prefix} reintroduces forbidden production infrastructure: ${forbidden}.`);
      }
    }
  }

  requireResponsibilityTarget(errors, responsibilitiesById, "web-production-runtime", "vercel");
  requireResponsibilityTarget(errors, responsibilitiesById, "web-preview-and-staging", "vercel");
  requireResponsibilityTarget(errors, responsibilitiesById, "authoritative-database", "supabase");
  requireResponsibilityTarget(errors, responsibilitiesById, "d1-public-projection", "retired");
  requireResponsibilityTarget(errors, responsibilitiesById, "public-media-storage-and-delivery", "cloudflare-r2");
  requireResponsibilityTarget(errors, responsibilitiesById, "research-and-source-acquisition", "github-actions");
  requireResponsibilityTarget(errors, responsibilitiesById, "dns-and-domain-routing", "cloudflare-dns");

  const domains = Array.isArray(inventory.domains) ? inventory.domains : [];
  recordUnique(errors, domains.map((domain) => domain.hostname), "domains");
  const domainNames = new Set(domains.map((domain) => domain.hostname));
  for (const hostname of REQUIRED_DOMAINS) {
    if (!domainNames.has(hostname)) {
      errors.push(`Missing required public domain ${hostname}.`);
    }
  }
  for (const domain of domains) {
    if (!isNonEmptyString(domain.current_destination)) {
      errors.push(`Domain ${domain.hostname} must have a current destination.`);
    }
    if (!isNonEmptyString(domain.target_destination)) {
      errors.push(`Domain ${domain.hostname} must have a target destination.`);
    }
    if (domain.dns_owner !== "Cloudflare") {
      errors.push(`Domain ${domain.hostname} must retain Cloudflare DNS ownership.`);
    }
  }

  const resources = Array.isArray(inventory.cloud_resources)
    ? inventory.cloud_resources
    : [];
  const productionD1 = resources.find(
    (resource) => resource.provider === "Cloudflare"
      && resource.resource_type === "D1"
      && resource.environment === "production",
  );
  if (!productionD1 || !productionD1.disposition.includes("retire")) {
    errors.push("Production D1 must be recorded for retirement.");
  }
  const productionR2 = resources.find(
    (resource) => resource.provider === "Cloudflare"
      && resource.resource_type === "R2"
      && resource.name === "panda-atlas-media",
  );
  if (!productionR2 || !productionR2.disposition.startsWith("retain")) {
    errors.push("Production media R2 must be recorded for retention.");
  }

  const environmentVariables = Array.isArray(inventory.environment_variables)
    ? inventory.environment_variables
    : [];
  recordUnique(errors, environmentVariables.map((variable) => variable.name), "environment_variables");
  const variablesByName = new Map(environmentVariables.map((variable) => [variable.name, variable]));
  for (const name of REQUIRED_SECRET_VARIABLES) {
    const variable = variablesByName.get(name);
    if (!variable) {
      errors.push(`Missing required secret inventory entry ${name}.`);
    } else if (variable.secret !== true) {
      errors.push(`${name} must be classified as secret.`);
    }
  }
  const publicApiBase = variablesByName.get("NEXT_PUBLIC_API_BASE_URL");
  if (!publicApiBase || publicApiBase.secret !== false) {
    errors.push("NEXT_PUBLIC_API_BASE_URL must be inventoried as non-secret public configuration.");
  }
  const mockFallback = variablesByName.get("DB_USE_MOCK_FALLBACK");
  if (!mockFallback || mockFallback.target_production_value !== "false") {
    errors.push("DB_USE_MOCK_FALLBACK must be fixed to false for target production.");
  }

  const exitCriteria = Array.isArray(inventory.phase_0_exit_criteria)
    ? inventory.phase_0_exit_criteria
    : [];
  if (exitCriteria.length === 0 || exitCriteria.some((criterion) => criterion.complete !== true)) {
    errors.push("Every Phase 0 exit criterion must be recorded as complete.");
  }

  if (errors.length > 0) {
    throw new Error(`Managed-cloud inventory validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    inventory_id: inventory.inventory_id,
    responsibilities: responsibilities.length,
    production_responsibilities: responsibilities.filter((item) => item.production_dependency).length,
    domains: domains.length,
    cloud_resources: resources.length,
    environment_variables: environmentVariables.length,
    known_gaps: Array.isArray(inventory.known_gaps) ? inventory.known_gaps.length : 0,
    phase_0_complete: true,
  };
}

export function run(filePath = defaultInventoryPath) {
  const inventory = loadManagedCloudInventory(filePath);
  const summary = validateManagedCloudInventory(inventory);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv[2] ? path.resolve(process.argv[2]) : defaultInventoryPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
