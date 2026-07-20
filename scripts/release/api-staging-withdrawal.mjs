import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { quoteSqlLiteral, rowsFromWranglerJson } from "./d1-public-release.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(scriptDirectory, "../..");
export const defaultStagingConfigPath = path.join(
  repositoryRoot,
  "services/worker-api/wrangler.staging.jsonc",
);

export const STAGING_WORKER_NAME = "panda-atlas-api-staging";
export const STAGING_DATABASE_NAME = "panda-atlas-staging";
export const STAGING_MEDIA_BUCKET = "panda-atlas-media-staging";
export const STAGING_GEO_BUCKET = "panda-atlas-geo-staging";
const productionConfig = JSON.parse(
  readFileSync(
    path.join(repositoryRoot, "services/worker-api/wrangler.jsonc"),
    "utf8",
  ),
);
const productionD1 = (productionConfig.d1_databases ?? []).find(
  (item) => item.binding === "DB",
);
const productionBuckets = new Map(
  (productionConfig.r2_buckets ?? []).map((item) => [item.binding, item.bucket_name]),
);
if (!productionD1) throw new Error("Production Wrangler config is missing the DB binding.");
if (!productionBuckets.has("MEDIA_BUCKET") || !productionBuckets.has("GEO_BUCKET")) {
  throw new Error("Production Wrangler config is missing required R2 bindings.");
}
export const PRODUCTION_WORKER_NAME = productionConfig.name;
export const PRODUCTION_DATABASE_NAME = productionD1.database_name;
export const PRODUCTION_DATABASE_ID = productionD1.database_id;
export const PRODUCTION_MEDIA_BUCKET = productionBuckets.get("MEDIA_BUCKET");
export const PRODUCTION_GEO_BUCKET = productionBuckets.get("GEO_BUCKET");
export const PLACEHOLDER_DATABASE_ID = "00000000-0000-0000-0000-000000000000";
export const BASELINE_RELEASE = "2026.07.18.1";
export const ROLLBACK_RELEASE = "2026.07.20.1";
export const CURRENT_RELEASE = "2026.07.20.2";
const currentReleaseManifest = JSON.parse(
  readFileSync(
    path.join(repositoryRoot, "data/public-releases", CURRENT_RELEASE, "manifest.json"),
    "utf8",
  ),
);
export const CURRENT_PUBLIC_SCHEMA = currentReleaseManifest.public_schema_version;
export const CURRENT_DATABASE_MIGRATION = currentReleaseManifest.database_migration_version;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RELEASE_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
const RELEASE_MIGRATIONS = [
  "0005_versioned_public_releases.sql",
  "0007a_public_releases_immutable_update.sql",
  "0007b_public_releases_immutable_delete.sql",
  "0007c_public_release_records_immutable_update.sql",
  "0007d_public_release_records_immutable_delete.sql",
  "0007e_public_release_withdrawals_immutable_update.sql",
  "0007f_public_release_withdrawals_immutable_delete.sql",
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function requireReleaseVersion(value, label = "release version") {
  requireCondition(RELEASE_PATTERN.test(value ?? ""), `Invalid ${label}: ${String(value)}`);
  return value;
}

function bindingMap(records) {
  return new Map((records ?? []).map((record) => [record.binding, record]));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function readStagingConfig(configPath = defaultStagingConfigPath) {
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function validateStagingConfig(config, { allowPlaceholder = false } = {}) {
  requireCondition(config && typeof config === "object", "Staging Wrangler config is missing.");
  requireCondition(
    config.name === STAGING_WORKER_NAME,
    `Staging Worker name must be ${STAGING_WORKER_NAME}; got ${String(config.name)}.`,
  );
  requireCondition(config.name !== PRODUCTION_WORKER_NAME, "Production Worker config is forbidden.");
  requireCondition(config.workers_dev === true, "Staging Worker must use workers_dev.");
  requireCondition(
    Array.isArray(config.routes) && config.routes.length === 0,
    "Staging Worker must not declare custom routes.",
  );
  requireCondition(config.vars?.APP_ENV === "staging", "Staging Worker APP_ENV must be staging.");

  const d1 = config.d1_databases ?? [];
  requireCondition(d1.length === 1, `Staging config must declare exactly one D1 binding; got ${d1.length}.`);
  const database = d1[0];
  requireCondition(database.binding === "DB", "Staging D1 binding must be DB.");
  requireCondition(
    database.database_name === STAGING_DATABASE_NAME,
    `Staging D1 database must be ${STAGING_DATABASE_NAME}; got ${String(database.database_name)}.`,
  );
  requireCondition(
    database.database_name !== PRODUCTION_DATABASE_NAME,
    "Production D1 database name is forbidden.",
  );
  requireCondition(
    UUID_PATTERN.test(database.database_id ?? ""),
    `Staging D1 database_id is not a valid UUID: ${String(database.database_id)}.`,
  );
  requireCondition(
    database.database_id !== PRODUCTION_DATABASE_ID,
    "Production D1 database ID is forbidden.",
  );
  if (!allowPlaceholder) {
    requireCondition(
      database.database_id !== PLACEHOLDER_DATABASE_ID,
      "Staging D1 database_id is still the non-executable placeholder.",
    );
  }

  const buckets = bindingMap(config.r2_buckets);
  requireCondition(buckets.size === 2, `Staging config must declare exactly two R2 bindings; got ${buckets.size}.`);
  requireCondition(
    buckets.get("MEDIA_BUCKET")?.bucket_name === STAGING_MEDIA_BUCKET,
    `MEDIA_BUCKET must bind ${STAGING_MEDIA_BUCKET}.`,
  );
  requireCondition(
    buckets.get("GEO_BUCKET")?.bucket_name === STAGING_GEO_BUCKET,
    `GEO_BUCKET must bind ${STAGING_GEO_BUCKET}.`,
  );
  for (const bucket of buckets.values()) {
    requireCondition(
      ![PRODUCTION_MEDIA_BUCKET, PRODUCTION_GEO_BUCKET].includes(bucket.bucket_name),
      `Production R2 bucket ${bucket.bucket_name} is forbidden.`,
    );
  }

  return {
    workerName: config.name,
    databaseName: database.database_name,
    databaseId: database.database_id,
    mediaBucket: buckets.get("MEDIA_BUCKET").bucket_name,
    geoBucket: buckets.get("GEO_BUCKET").bucket_name,
  };
}

export function validateStagingBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Staging base URL: ${String(value)}.`);
  }
  requireCondition(url.protocol === "https:", "Staging base URL must use HTTPS.");
  requireCondition(
    url.hostname.startsWith(`${STAGING_WORKER_NAME}.`) && url.hostname.endsWith(".workers.dev"),
    `Staging base URL must target ${STAGING_WORKER_NAME} on workers.dev.`,
  );
  requireCondition(url.pathname === "/", "Staging base URL must not contain a path.");
  return url.origin;
}

export function buildStagingReleaseResetSql() {
  const migrationNames = RELEASE_MIGRATIONS.map(quoteSqlLiteral).join(", ");
  return `drop view if exists current_public_records;
drop view if exists current_public_release;
drop table if exists public_release_pointer;
drop table if exists public_release_withdrawals;
drop table if exists public_release_records;
drop table if exists public_releases;
create table if not exists d1_migrations (
  id integer primary key autoincrement,
  name text,
  applied_at timestamp not null default current_timestamp
);
delete from d1_migrations where name in (${migrationNames});`;
}

export function buildBaselineVerificationSql(releaseVersion = BASELINE_RELEASE) {
  requireReleaseVersion(releaseVersion);
  const release = quoteSqlLiteral(releaseVersion);
  return `select
  (select dataset_release_version from public_release_pointer where singleton = 1) as current_release,
  (select count(*) from public_releases where dataset_release_version = ${release}) as release_rows,
  (select count(*) from public_release_records where dataset_release_version = ${release}) as record_rows,
  (select count(*) from public_release_records where dataset_release_version = ${release} and entity_type = 'api_pandas') as api_panda_rows,
  (select count(*) from public_release_withdrawals where dataset_release_version = ${release}) as withdrawal_rows`;
}

export function validateBaselineVerification(row, artifact) {
  requireCondition(row?.current_release === artifact.releaseVersion, "Baseline pointer verification failed.");
  requireCondition(row?.release_rows === 1, "Baseline release row was not created exactly once.");
  requireCondition(
    row?.record_rows === artifact.expectedRecords,
    `Baseline record count mismatch: expected ${artifact.expectedRecords}; got ${String(row?.record_rows)}.`,
  );
  requireCondition(
    row?.api_panda_rows === artifact.expectedApiPandas,
    `Baseline api_pandas count mismatch: expected ${artifact.expectedApiPandas}; got ${String(row?.api_panda_rows)}.`,
  );
  requireCondition(row?.withdrawal_rows === 0, "Baseline release unexpectedly contains withdrawals.");
  return row;
}

function requireIsoTimestamp(value, label) {
  requireCondition(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value ?? ""),
    `${label} must be an ISO UTC timestamp.`,
  );
}

export function buildEntityWithdrawalSql({
  releaseVersion = CURRENT_RELEASE,
  pandaId,
  reason,
  withdrawnAt,
}) {
  requireReleaseVersion(releaseVersion);
  requireCondition(typeof pandaId === "string" && pandaId.length > 0, "Entity withdrawal requires pandaId.");
  requireCondition(typeof reason === "string" && reason.trim().length > 0, "Entity withdrawal requires reason.");
  requireIsoTimestamp(withdrawnAt, "Entity withdrawal withdrawn_at");
  const release = quoteSqlLiteral(releaseVersion);
  const panda = quoteSqlLiteral(pandaId);
  return `insert into public_release_withdrawals (
  dataset_release_version, entity_type, entity_id, reason, withdrawn_at
)
select ${release}, 'pandas', ${panda},
  ${quoteSqlLiteral(reason)}, ${quoteSqlLiteral(withdrawnAt)}
where exists (
  select 1 from public_release_pointer
  where singleton = 1 and dataset_release_version = ${release}
)
  and not exists (
    select 1 from public_release_withdrawals
    where dataset_release_version = ${release}
      and entity_type = 'pandas'
      and entity_id = ${panda}
  )
returning id, dataset_release_version, entity_type, entity_id, reason, withdrawn_at`;
}

export function buildWholeReleaseWithdrawalSql({
  releaseVersion = CURRENT_RELEASE,
  reason,
  withdrawnAt,
}) {
  requireReleaseVersion(releaseVersion);
  requireCondition(typeof reason === "string" && reason.trim().length > 0, "Whole-release withdrawal requires reason.");
  requireIsoTimestamp(withdrawnAt, "Whole-release withdrawal withdrawn_at");
  const release = quoteSqlLiteral(releaseVersion);
  return `insert into public_release_withdrawals (
  dataset_release_version, entity_type, entity_id, reason, withdrawn_at
)
select ${release}, null, null,
  ${quoteSqlLiteral(reason)}, ${quoteSqlLiteral(withdrawnAt)}
where exists (
  select 1 from public_release_pointer
  where singleton = 1 and dataset_release_version = ${release}
)
  and not exists (
    select 1 from public_release_withdrawals
    where dataset_release_version = ${release}
      and entity_type is null
      and entity_id is null
  )
returning id, dataset_release_version, entity_type, entity_id, reason, withdrawn_at`;
}

export function buildEntityWithdrawalVerificationSql({
  releaseVersion = CURRENT_RELEASE,
  pandaId,
  unrelatedPandaId,
}) {
  requireReleaseVersion(releaseVersion);
  const release = quoteSqlLiteral(releaseVersion);
  const panda = quoteSqlLiteral(pandaId);
  const unrelated = quoteSqlLiteral(unrelatedPandaId);
  return `select
  (select dataset_release_version from public_release_pointer where singleton = 1) as current_release,
  (select count(*) from current_public_release) as current_release_rows,
  (select count(*) from public_release_withdrawals where dataset_release_version = ${release} and entity_type = 'pandas' and entity_id = ${panda}) as panda_withdrawal_rows,
  (select count(*) from public_release_records where dataset_release_version = ${release} and entity_type = 'api_pandas' and entity_id = ${panda}) as retained_panda_rows,
  (select count(*) from public_release_records record where record.dataset_release_version = ${release} and record.entity_type = 'api_pandas' and record.entity_id = ${panda} and not exists (
    select 1 from public_release_withdrawals withdrawal
    where withdrawal.dataset_release_version = record.dataset_release_version
      and ((withdrawal.entity_type is null and withdrawal.entity_id is null)
        or ((withdrawal.entity_type = record.entity_type or withdrawal.entity_type = 'pandas') and withdrawal.entity_id = record.entity_id))
  )) as visible_panda_rows,
  (select count(*) from public_release_records record where record.dataset_release_version = ${release} and record.entity_type = 'api_pandas' and record.entity_id = ${unrelated} and not exists (
    select 1 from public_release_withdrawals withdrawal
    where withdrawal.dataset_release_version = record.dataset_release_version
      and ((withdrawal.entity_type is null and withdrawal.entity_id is null)
        or ((withdrawal.entity_type = record.entity_type or withdrawal.entity_type = 'pandas') and withdrawal.entity_id = record.entity_id))
  )) as unrelated_visible_rows,
  (select count(*) from public_release_records where dataset_release_version = ${release}) as retained_release_records`;
}

export function validateEntityWithdrawalVerification(row, releaseVersion = CURRENT_RELEASE) {
  requireCondition(row?.current_release === releaseVersion, "Entity withdrawal changed the release pointer.");
  requireCondition(row?.current_release_rows === 1, "Entity withdrawal hid the whole release.");
  requireCondition(row?.panda_withdrawal_rows === 1, "Entity withdrawal was not appended exactly once.");
  requireCondition(row?.retained_panda_rows === 1, "Entity withdrawal lost immutable panda history.");
  requireCondition(row?.visible_panda_rows === 0, "Entity withdrawal did not hide the target panda.");
  requireCondition(row?.unrelated_visible_rows === 1, "Entity withdrawal hid an unrelated panda.");
  requireCondition(row?.retained_release_records > 0, "Entity withdrawal lost release history.");
  return row;
}

export function buildWholeReleaseVerificationSql(releaseVersion = CURRENT_RELEASE) {
  requireReleaseVersion(releaseVersion);
  const release = quoteSqlLiteral(releaseVersion);
  return `select
  (select dataset_release_version from public_release_pointer where singleton = 1) as pointer_release,
  (select count(*) from current_public_release) as current_release_rows,
  (select count(*) from current_public_records) as current_record_rows,
  (select count(*) from public_release_withdrawals where dataset_release_version = ${release} and entity_type is null and entity_id is null) as whole_withdrawal_rows,
  (select count(*) from public_releases where dataset_release_version = ${release}) as retained_release_rows,
  (select count(*) from public_release_records where dataset_release_version = ${release}) as retained_record_rows`;
}

export function validateWholeReleaseVerification(row, releaseVersion = CURRENT_RELEASE) {
  requireCondition(row?.pointer_release === releaseVersion, "Whole-release withdrawal changed the pointer.");
  requireCondition(row?.current_release_rows === 0, "Whole-release withdrawal did not hide current release.");
  requireCondition(row?.current_record_rows === 0, "Whole-release withdrawal did not hide current records.");
  requireCondition(row?.whole_withdrawal_rows === 1, "Whole-release withdrawal was not appended exactly once.");
  requireCondition(row?.retained_release_rows === 1, "Whole-release withdrawal lost release history.");
  requireCondition(row?.retained_record_rows > 0, "Whole-release withdrawal lost record history.");
  return row;
}

export function reviewedMediaObjects(
  datasetPath = path.join(repositoryRoot, "data/reviewed-batches", CURRENT_RELEASE, "source.json"),
) {
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
  const objects = [];
  for (const media of dataset.media ?? []) {
    if (media.publication_status !== "published" || media.public?.status !== "available") continue;
    for (const derivative of media.public.derivatives ?? []) {
      const url = new URL(derivative.url);
      const prefix = "/media/";
      requireCondition(url.origin === "https://api.zhipanda.com", `${media.id} derivative origin drifted.`);
      requireCondition(url.pathname.startsWith(prefix), `${media.id} derivative path is not public media.`);
      objects.push({
        mediaId: media.id,
        pandaId: media.public.panda_id,
        kind: derivative.kind,
        objectKey: url.pathname.slice(prefix.length),
        bytes: derivative.bytes,
        sha256: derivative.sha256,
      });
    }
  }
  objects.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
  const keys = new Set(objects.map((item) => item.objectKey));
  requireCondition(keys.size === objects.length, "Reviewed media object keys are not unique.");
  requireCondition(objects.length > 0, "Reviewed release has no available media objects.");
  return objects;
}

export function parseWranglerRows(stdout, label) {
  const rows = rowsFromWranglerJson(stdout);
  requireCondition(rows.length === 1, `${label} expected exactly one row; got ${rows.length}.`);
  return rows[0];
}

export function runCommand(command, args, { cwd = repositoryRoot, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} exited with status ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function stagingConfigChecksum(configPath = defaultStagingConfigPath) {
  return sha256(readFileSync(configPath));
}

export function assertBaselineHttpEvidence(evidence) {
  requireCondition(evidence.release?.status === 200, "Staging current release endpoint did not return 200.");
  requireCondition(
    evidence.release?.body?.dataset_release_version === CURRENT_RELEASE,
    `Staging current release is not ${CURRENT_RELEASE}.`,
  );
  requireCondition(
    evidence.release?.datasetVersion === CURRENT_RELEASE &&
      evidence.release?.publicSchemaVersion === CURRENT_PUBLIC_SCHEMA &&
      evidence.release?.migrationVersion === CURRENT_DATABASE_MIGRATION,
    "Staging current release headers drifted.",
  );
  requireCondition(evidence.pandas?.every((item) => item.status === 200), "A required Staging panda profile failed.");
  requireCondition(
    evidence.pandas?.every(
      (item) =>
        item.datasetVersion === CURRENT_RELEASE &&
        item.publicSchemaVersion === CURRENT_PUBLIC_SCHEMA &&
        item.migrationVersion === CURRENT_DATABASE_MIGRATION,
    ),
    "A required Staging panda profile omitted or drifted release headers.",
  );
  requireCondition(evidence.media?.status === 200, "Staging reviewed media did not return 200.");
  requireCondition(evidence.media?.contentType === "image/webp", "Staging reviewed media MIME drifted.");
  requireCondition(
    evidence.media?.cacheControl === "public, max-age=31536000, immutable",
    "Staging reviewed media cache policy drifted.",
  );
  return evidence;
}

export function assertProductionCanaryEvidence(before, after) {
  for (const [label, evidence] of [["before", before], ["after", after]]) {
    requireCondition(evidence?.status === 200, `Production canary ${label} did not return 200.`);
    requireCondition(
      evidence?.body?.dataset_release_version === CURRENT_RELEASE &&
        evidence?.datasetVersion === CURRENT_RELEASE &&
        evidence?.publicSchemaVersion === CURRENT_PUBLIC_SCHEMA &&
        evidence?.migrationVersion === CURRENT_DATABASE_MIGRATION,
      `Production canary ${label} release identity drifted.`,
    );
  }
  return { before, after };
}

export function assertEntityWithdrawalHttpEvidence(evidence) {
  requireCondition(evidence.release?.status === 200, "Entity withdrawal hid the current release endpoint.");
  requireCondition(evidence.targetPanda?.status === 404, "Entity withdrawal did not hide the target panda endpoint.");
  requireCondition(evidence.unrelatedPanda?.status === 200, "Entity withdrawal hid an unrelated panda endpoint.");
  requireCondition(
    Array.isArray(evidence.withdrawnMedia) &&
      evidence.withdrawnMedia.length > 0 &&
      evidence.withdrawnMedia.every((item) => item.status === 404),
    "A withdrawn Staging media derivative did not return 404.",
  );
  requireCondition(
    Array.isArray(evidence.retainedMedia) &&
      evidence.retainedMedia.length > 0 &&
      evidence.retainedMedia.every((item) => item.status === 200),
    "Entity withdrawal removed unrelated Staging media.",
  );
  return evidence;
}

export function assertWholeReleaseHttpEvidence(evidence) {
  requireCondition(evidence.release?.status === 410, "Whole-release withdrawal did not return 410 for current release.");
  requireCondition(evidence.pandas?.status === 410, "Whole-release withdrawal did not return 410 for public data.");
  return evidence;
}
