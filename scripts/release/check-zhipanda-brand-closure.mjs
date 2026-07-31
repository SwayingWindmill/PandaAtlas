import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidencePath = path.join(repositoryRoot, "data/frontend-evidence/issue-220.json");
const brandContractPath = path.join(repositoryRoot, "contracts/zhipanda-brand-migration.v1.json");

const requiredSurfaceGroups = [
  "shell_navigation_metadata_sharing",
  "authentication_account_follow_feed_inbox",
  "email_identity",
  "homepage_discovery_profiles",
  "lineage_institutions_places_map",
  "activity_sources_contribution",
  "structured_public_release_metadata",
];

const publicFiles = [
  {
    path: "apps/web/app/layout.tsx",
    required: ["吱熊猫 ZhiPanda", "openGraph", "twitter"],
  },
  {
    path: "apps/web/foundation/metadata/public-metadata.ts",
    required: ["ZHIPANDA_APPLICATION_NAME", "ZHIPANDA_PUBLIC_ORIGIN", "alternates"],
  },
  {
    path: "apps/web/features/home/editorial-home-view-model.ts",
    required: ["认识你关注的每一只熊猫", "Discover the pandas you care about"],
  },
  {
    path: "apps/web/app/[locale]/pandas/page.tsx",
    required: ["熊猫图鉴", "Panda guide"],
  },
  {
    path: "apps/web/features/profile/trusted-profile-page.tsx",
    required: ["熊猫资料", "Panda introduction"],
  },
  {
    path: "apps/web/features/lineage/structured-lineage-page.tsx",
    required: ["熊猫家族", "Panda families"],
  },
  {
    path: "apps/web/features/map/structured-map-page.tsx",
    required: ["看看大熊猫生活在哪里", "See where giant pandas live"],
  },
  {
    path: "apps/web/components/patterns/public-entity-page.tsx",
    required: ["熊猫机构", "Panda institution"],
  },
  {
    path: "apps/web/features/feed/public-panda-activity.tsx",
    required: ["熊猫动态", "Panda updates"],
  },
  {
    path: "apps/web/features/notification-center/notification-center-page.tsx",
    required: ["吱熊猫通知", "ZhiPanda notification"],
  },
  {
    path: "apps/web/features/contribute/contribution-editor.tsx",
    required: ["分享熊猫资料", "Share panda information"],
  },
  {
    path: "services/api/scripts/run_notification_staging_drill.py",
    required: ["ZhiPanda notification staging verification"],
  },
  {
    path: "services/api/app/notification/templates.py",
    required: ["ZhiPanda"],
  },
  {
    path: "services/api/app/projection/collection_release.py",
    required: ["ZhiPanda collection release"],
  },
];

const compatibilityChecks = [
  { path: "package.json", fragment: '"name": "panda-atlas"' },
  { path: "services/worker-api/wrangler.jsonc", fragment: "panda-atlas" },
  {
    path: "scripts/release/run-frontend-staging-withdrawal.mjs",
    fragment: "PandaAtlas-Frontend-Staging-Drill/1.0",
  },
  {
    path: "services/api/app/projection/collection_release.py",
    fragment: "panda-atlas-collection-release-candidate/v1",
  },
];

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] ?? 0) + 1;
  return counts;
}

function requirePass(value, pathName, errors) {
  if (value !== "PASS") errors.push(`${pathName} must equal PASS`);
}

function requireString(value, pathName, errors) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${pathName} is required`);
}

export async function validateZhiPandaBrandClosure({
  evidenceFile = evidencePath,
  brandContractFile = brandContractPath,
} = {}) {
  const errors = [];
  const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
  const brandContract = JSON.parse(await readFile(brandContractFile, "utf8"));

  if (evidence.schema_version !== 1) errors.push("schema_version must equal 1");
  if (evidence.issue !== 220 || evidence.parent_issue !== 215) {
    errors.push("issue closure must bind issue #220 to parent #215");
  }
  if (evidence.outcome !== "PASS") errors.push("outcome must equal PASS");
  if (evidence.public_brand?.zh !== brandContract.public_brand?.zh) {
    errors.push("Chinese public brand must match the brand contract");
  }
  if (evidence.public_brand?.en !== brandContract.public_brand?.en) {
    errors.push("English public brand must match the brand contract");
  }
  if (evidence.public_brand?.audience !== "giant panda enthusiasts") {
    errors.push("public audience must remain giant panda enthusiasts");
  }

  const inventory = brandContract.inventory ?? [];
  const categoryCounts = countBy(inventory, "category");
  requirePass(evidence.inventory?.status, "inventory.status", errors);
  if (evidence.inventory?.classified_files !== inventory.length) {
    errors.push("inventory.classified_files must match the machine-readable inventory");
  }
  if (evidence.inventory?.unclassified_files !== 0) errors.push("inventory.unclassified_files must equal 0");
  if (evidence.inventory?.public_migration_debt !== 0) errors.push("inventory.public_migration_debt must equal 0");
  for (const [category, count] of Object.entries(evidence.inventory?.categories ?? {})) {
    if ((categoryCounts[category] ?? 0) !== count) {
      errors.push(`inventory category ${category} must equal ${count}`);
    }
  }
  if ((categoryCounts["public-visible"] ?? 0) !== 0) {
    errors.push("legacy-brand inventory must contain no remaining public-visible entries");
  }
  if (inventory.some((entry) => String(entry.expected_action).startsWith("migrate"))) {
    errors.push("legacy-brand inventory must contain no remaining migration action");
  }

  for (const group of requiredSurfaceGroups) {
    requirePass(evidence.public_surface_groups?.[group], `public_surface_groups.${group}`, errors);
  }

  requirePass(evidence.compatibility?.status, "compatibility.status", errors);
  for (const item of evidence.compatibility?.preserved ?? []) {
    requireString(item.path, "compatibility.preserved[].path", errors);
    requireString(item.reason, "compatibility.preserved[].reason", errors);
    if (!inventory.some((entry) => entry.path === item.path)) {
      errors.push(`compatibility path ${item.path} must remain classified in the brand inventory`);
    }
  }

  const publicTexts = [];
  for (const file of publicFiles) {
    const absolutePath = path.join(repositoryRoot, file.path);
    const text = await readFile(absolutePath, "utf8");
    publicTexts.push({ path: file.path, text });
    for (const fragment of file.required) {
      if (!text.includes(fragment)) errors.push(`${file.path} must contain ${JSON.stringify(fragment)}`);
    }
  }
  for (const term of brandContract.public_legacy_brand_terms ?? []) {
    for (const file of publicTexts) {
      if (file.text.toLowerCase().includes(term.toLowerCase())) {
        errors.push(`${file.path} contains retired public brand ${JSON.stringify(term)}`);
      }
    }
  }

  for (const check of compatibilityChecks) {
    const text = await readFile(path.join(repositoryRoot, check.path), "utf8");
    if (!text.includes(check.fragment)) {
      errors.push(`${check.path} must retain compatibility identifier ${JSON.stringify(check.fragment)}`);
    }
  }
  for (const item of evidence.compatibility?.preserved ?? []) {
    await access(path.join(repositoryRoot, item.path));
  }

  for (const requiredTone of ["warm", "lively", "curious", "concise", "evidence-honest"]) {
    if (!(brandContract.tone?.required ?? []).includes(requiredTone)) {
      errors.push(`brand contract must retain ${requiredTone} tone`);
    }
  }
  for (const prohibited of ["unsupported-personality", "invented-story", "invented-count-or-location"]) {
    if (!(brandContract.tone?.prohibited_public_behaviors ?? []).includes(prohibited)) {
      errors.push(`brand contract must prohibit ${prohibited}`);
    }
  }

  requirePass(evidence.staging?.status, "staging.status", errors);
  if (!/^[a-f0-9]{40}$/.test(evidence.artifact?.commit ?? "")) errors.push("artifact.commit must be a full Git SHA");
  if (!/^https:\/\/[^/]+\.workers\.dev$/.test(evidence.artifact?.staging_url ?? "")) {
    errors.push("artifact.staging_url must be an isolated workers.dev URL");
  }
  for (const field of ["staging_worker_version", "staging_deployment_id"]) {
    if (!/^[a-f0-9-]{36}$/.test(evidence.artifact?.[field] ?? "")) errors.push(`artifact.${field} must be a deployment UUID`);
  }
  for (const field of ["build_checksum", "browser_report_checksum"]) {
    if (!/^sha256:[a-f0-9]{64}$/.test(evidence.artifact?.[field] ?? "")) errors.push(`artifact.${field} must be a SHA-256 digest`);
  }
  if (!Number.isInteger(evidence.artifact?.build_files) || evidence.artifact.build_files <= 0) {
    errors.push("artifact.build_files must be a positive integer");
  }
  for (const [check, status] of Object.entries(evidence.staging?.checks ?? {})) {
    requirePass(status, `staging.checks.${check}`, errors);
  }
  for (const route of ["/zh", "/en", "/zh/pandas", "/en/pandas", "/zh/lineage", "/en/lineage", "/zh/map", "/en/map"]) {
    if (!(evidence.staging?.routes ?? []).includes(route)) errors.push(`staging.routes must include ${route}`);
  }

  requirePass(evidence.verification?.status, "verification.status", errors);
  for (const group of ["browser", "accessibility", "static_and_content", "metadata_and_identity"]) {
    if (!Array.isArray(evidence.verification?.[group]) || evidence.verification[group].length === 0) {
      errors.push(`verification.${group} must contain evidence`);
    }
  }

  requirePass(evidence.human_review?.status, "human_review.status", errors);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.human_review?.date ?? "")) errors.push("human_review.date must use YYYY-MM-DD");
  requireString(evidence.human_review?.reviewer_role, "human_review.reviewer_role", errors);
  requireString(evidence.human_review?.detail, "human_review.detail", errors);
  if (!Array.isArray(evidence.human_review?.evidence) || evidence.human_review.evidence.length < 2) {
    errors.push("human_review.evidence must contain at least two records");
  }

  if (evidence.release_decision?.status !== "GO") errors.push("release_decision.status must equal GO");
  requireString(evidence.release_decision?.detail, "release_decision.detail", errors);

  return errors;
}

async function runCli() {
  const errors = await validateZhiPandaBrandClosure();
  if (errors.length) {
    for (const error of errors) process.stderr.write(`[zhipanda-brand-closure] ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("ZhiPanda public-brand closure check passed for issue #220.\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runCli();
