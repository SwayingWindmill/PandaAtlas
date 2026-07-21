import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const webRoot = path.join(repositoryRoot, "apps/web");
export const baselineConfigPath = path.join(webRoot, "wrangler.staging.jsonc");
export const withdrawnConfigPath = path.join(webRoot, "wrangler.staging.withdrawn.jsonc");
export const withdrawalManifestPath = path.join(
  repositoryRoot,
  "data/frontend-withdrawals/2026.07.20.2-ri-ri.json",
);
export const publicReleaseManifestPath = path.join(
  repositoryRoot,
  "data/public-releases/2026.07.20.2/manifest.json",
);
export const publicReleaseApiPath = path.join(
  repositoryRoot,
  "data/public-releases/2026.07.20.2/api.json",
);

export const STAGING_WORKER_NAME = "panda-atlas-web-staging";
export const PRODUCTION_WORKER_NAME = "panda-atlas-web";
export const WITHDRAWAL_ID = "frontend-withdrawal-2026.07.20.2-ri-ri";
export const CURRENT_RELEASE = "2026.07.20.2";
export const CURRENT_SCHEMA = "1.2.0";
export const CURRENT_MIGRATION = "0007";
export const TARGET_PANDA_ID = "57c0a1bd-cc44-5a08-ba48-f224e9956064";
export const TARGET_PANDA_SLUG = "ri-ri";
export const TARGET_MEDIA_ID = "media-ri-ri-03e20f3f6a0e2db3";
export const TARGET_MEDIA_PATH = "media-ri-ri-03e20f3f6a0e2db3-w1200.webp";
export const UNRELATED_PANDA_SLUG = "shin-shin";

const ALLOWED_MANIFEST_KEYS = new Set([
  "schema_version",
  "withdrawal_id",
  "review_state",
  "dataset_release_version",
  "public_schema_version",
  "database_migration_version",
  "public_release_manifest_sha256",
  "reviewed_at",
  "reason",
  "panda_ids",
  "media_ids",
]);

export function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function fileSha256(filename) {
  return sha256(readFileSync(filename));
}

export function readJson(filename) {
  return JSON.parse(readFileSync(filename, "utf8"));
}

export function treeSha256(directory) {
  const files = [];
  function visit(current, relative) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const nextRelative = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) visit(absolute, nextRelative);
      else if (entry.isFile()) files.push([nextRelative, readFileSync(absolute)]);
    }
  }
  visit(directory, "");
  const digest = createHash("sha256");
  for (const [relative, bytes] of files) {
    digest.update(relative);
    digest.update("\0");
    digest.update(bytes);
    digest.update("\0");
  }
  return { sha256: digest.digest("hex"), files: files.length };
}

function assertUnique(values, label) {
  requireCondition(Array.isArray(values) && values.length > 0, `${label} must be a non-empty array.`);
  requireCondition(new Set(values).size === values.length, `${label} must contain unique values.`);
  requireCondition(values.every((value) => typeof value === "string" && value.length > 0), `${label} must contain IDs.`);
}

export function validateWithdrawalArtifact({ manifest, releaseManifest, api, releaseManifestSha256 }) {
  requireCondition(manifest && typeof manifest === "object" && !Array.isArray(manifest), "Withdrawal manifest must be an object.");
  const keys = Object.keys(manifest);
  requireCondition(keys.every((key) => ALLOWED_MANIFEST_KEYS.has(key)), "Withdrawal manifest contains an unsupported field.");
  requireCondition(keys.length === ALLOWED_MANIFEST_KEYS.size, "Withdrawal manifest is missing a required field.");
  requireCondition(manifest.schema_version === 1, "Withdrawal schema_version must be 1.");
  requireCondition(manifest.withdrawal_id === WITHDRAWAL_ID, `Withdrawal ID must be ${WITHDRAWAL_ID}.`);
  requireCondition(manifest.review_state === "approved", "Withdrawal must be approved.");
  requireCondition(manifest.dataset_release_version === CURRENT_RELEASE, `Withdrawal release must be ${CURRENT_RELEASE}.`);
  requireCondition(manifest.public_schema_version === CURRENT_SCHEMA, `Withdrawal schema must be ${CURRENT_SCHEMA}.`);
  requireCondition(manifest.database_migration_version === CURRENT_MIGRATION, `Withdrawal migration must be ${CURRENT_MIGRATION}.`);
  requireCondition(!Number.isNaN(Date.parse(manifest.reviewed_at)), "Withdrawal reviewed_at must be an ISO timestamp.");
  requireCondition(typeof manifest.reason === "string" && manifest.reason.trim().length > 0, "Withdrawal reason is required.");
  assertUnique(manifest.panda_ids, "panda_ids");
  assertUnique(manifest.media_ids, "media_ids");
  requireCondition(!("slug" in manifest) && !("panda_slugs" in manifest), "Withdrawal manifest must use stable IDs, not slugs.");

  requireCondition(releaseManifest.dataset_release_version === CURRENT_RELEASE, "Tracked Public Release version drifted.");
  requireCondition(releaseManifest.public_schema_version === CURRENT_SCHEMA, "Tracked Public Schema drifted.");
  requireCondition(releaseManifest.database_migration_version === CURRENT_MIGRATION, "Tracked migration version drifted.");
  requireCondition(
    manifest.public_release_manifest_sha256 === releaseManifestSha256,
    "Withdrawal manifest is not bound to the tracked Public Release manifest SHA-256.",
  );

  const pandas = Array.isArray(api.pandas) ? api.pandas : [];
  const selected = pandas.filter((panda) => manifest.panda_ids.includes(panda.id));
  requireCondition(selected.length === manifest.panda_ids.length, "Withdrawal references an unknown panda ID.");
  requireCondition(
    selected.every((panda) => panda.public_revision?.data_version === CURRENT_RELEASE),
    "Withdrawn pandas are not owned by the expected Public Release.",
  );
  const mediaIds = selected.flatMap((panda) => (panda.media ?? []).map((media) => media.id)).sort();
  requireCondition(
    JSON.stringify(mediaIds) === JSON.stringify([...manifest.media_ids].sort()),
    "Withdrawal media IDs must exactly match every media record owned by the withdrawn pandas.",
  );
  requireCondition(manifest.panda_ids.includes(TARGET_PANDA_ID), "Ri Ri stable ID is missing from the reviewed withdrawal.");
  requireCondition(manifest.media_ids.includes(TARGET_MEDIA_ID), "Ri Ri media ID is missing from the reviewed withdrawal.");

  return {
    withdrawalId: manifest.withdrawal_id,
    release: manifest.dataset_release_version,
    schema: manifest.public_schema_version,
    migration: manifest.database_migration_version,
    pandaIds: [...manifest.panda_ids],
    mediaIds: [...manifest.media_ids],
    manifestSha256: fileSha256(withdrawalManifestPath),
    publicReleaseManifestSha256: releaseManifestSha256,
  };
}

export function inspectWithdrawalArtifact() {
  return validateWithdrawalArtifact({
    manifest: readJson(withdrawalManifestPath),
    releaseManifest: readJson(publicReleaseManifestPath),
    api: readJson(publicReleaseApiPath),
    releaseManifestSha256: fileSha256(publicReleaseManifestPath),
  });
}

export function validateWebStagingConfigs(baseline, withdrawn, production) {
  for (const [label, config] of [["baseline", baseline], ["withdrawn", withdrawn]]) {
    requireCondition(config.name === STAGING_WORKER_NAME, `${label} Worker must be ${STAGING_WORKER_NAME}.`);
    requireCondition(config.name !== production.name && config.name !== PRODUCTION_WORKER_NAME, `${label} Worker cannot target Production.`);
    requireCondition(config.workers_dev === true, `${label} Worker must enable workers.dev.`);
    requireCondition(Array.isArray(config.routes) && config.routes.length === 0, `${label} Worker must not declare custom routes.`);
    requireCondition(config.assets?.binding === "ASSETS", `${label} Worker must retain the ASSETS binding.`);
    requireCondition(config.vars?.NEXT_PUBLIC_API_BASE_URL === "https://api.zhipanda.com", `${label} API base URL drifted.`);
  }
  const shared = ["name", "main", "compatibility_date", "compatibility_flags", "workers_dev", "assets", "observability", "routes"];
  for (const key of shared) {
    requireCondition(JSON.stringify(baseline[key]) === JSON.stringify(withdrawn[key]), `Staging configs differ at ${key}.`);
  }
  requireCondition(!baseline.vars?.PANDA_ATLAS_FRONTEND_WITHDRAWAL_ID, "Baseline config must not activate a withdrawal.");
  requireCondition(
    withdrawn.vars?.PANDA_ATLAS_FRONTEND_WITHDRAWAL_ID === WITHDRAWAL_ID,
    "Withdrawn config must activate the reviewed withdrawal ID.",
  );
  return {
    workerName: STAGING_WORKER_NAME,
    baselineConfigSha256: fileSha256(baselineConfigPath),
    withdrawnConfigSha256: fileSha256(withdrawnConfigPath),
  };
}

export function inspectWebStagingConfigs() {
  return validateWebStagingConfigs(
    readJson(baselineConfigPath),
    readJson(withdrawnConfigPath),
    readJson(path.join(webRoot, "wrangler.jsonc")),
  );
}

export function validateWebStagingBaseUrl(value) {
  const url = new URL(value);
  requireCondition(url.protocol === "https:", "Web Staging URL must use HTTPS.");
  requireCondition(
    /^panda-atlas-web-staging\.[a-z0-9-]+\.workers\.dev$/i.test(url.hostname),
    "Web Staging URL must target panda-atlas-web-staging on workers.dev.",
  );
  requireCondition(url.pathname === "/", "Web Staging URL must not include a path.");
  return url.origin;
}

export function parseDeploymentOutput(output) {
  const normalized = output.replaceAll("\r", "");
  const url = normalized.match(/https:\/\/panda-atlas-web-staging\.[^\s]+\.workers\.dev/)?.[0] ?? null;
  const versionId = normalized.match(/Version ID:\s*([0-9a-f-]{36})/i)?.[1] ?? null;
  requireCondition(url && versionId, "Could not parse Staging Worker URL and Version ID from Wrangler output.");
  return { url: validateWebStagingBaseUrl(url), versionId };
}

export function parseActiveDeployment(stdout, expectedVersionId) {
  const deployments = JSON.parse(stdout);
  requireCondition(Array.isArray(deployments) && deployments.length > 0, "Wrangler returned no Staging deployments.");
  const active = [...deployments].sort(
    (left, right) => Date.parse(left.created_on) - Date.parse(right.created_on),
  ).at(-1);
  requireCondition(Array.isArray(active?.versions) && active.versions.length === 1, "Active Staging deployment must use one Worker Version.");
  const version = active.versions[0];
  requireCondition(version.percentage === 100, "Active Staging Worker Version must receive 100 percent traffic.");
  requireCondition(
    version.version_id === expectedVersionId,
    `Active Staging Worker Version is ${version.version_id}; expected ${expectedVersionId}.`,
  );
  return {
    deploymentId: active.id,
    versionId: version.version_id,
    percentage: version.percentage,
    createdOn: active.created_on,
  };
}

export function validateProductionCanary(before, after) {
  const stableMarkers = [
    CURRENT_RELEASE,
    TARGET_MEDIA_ID,
    "力力在上野动物园",
    "EleniXDD / Wikimedia Commons",
  ];
  for (const [label, item] of [["before", before], ["after", after]]) {
    requireCondition(item.status === 200, `Production ${label} canary did not return 200.`);
    requireCondition(
      typeof item.contentType === "string" && item.contentType.startsWith("text/html"),
      `Production ${label} canary did not return HTML.`,
    );
    for (const marker of stableMarkers) {
      requireCondition(item.body.includes(marker), `Production ${label} canary lost stable marker ${marker}.`);
    }
  }
}

export function isRetryableFrontendBrowserError(error) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|UND_ERR_(?:CONNECT_TIMEOUT|SOCKET)|socket hang up|network connectivity|net::ERR_|Navigation returned no response|Timeout .* exceeded|expected (?:200|404); got (?:200|404)/i.test(detail);
}

export function validateBrowserEvidence({ baseline, withdrawn, rollback }) {
  requireCondition(baseline.mode === "baseline" && baseline.outcome === "passed", "Baseline browser evidence failed.");
  requireCondition(withdrawn.mode === "withdrawn" && withdrawn.outcome === "passed", "Withdrawn browser evidence failed.");
  requireCondition(rollback.mode === "baseline" && rollback.outcome === "passed", "Rollback browser evidence failed.");
  requireCondition(baseline.baseUrl === withdrawn.baseUrl && baseline.baseUrl === rollback.baseUrl, "Browser evidence URLs drifted.");
}

export function assertDirectory(directory, label) {
  requireCondition(statSync(directory).isDirectory(), `${label} directory is missing.`);
}
