import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
export const defaultWranglerCli = path.join(
  repositoryRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

const RELEASE_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function assertReleaseVersion(value, label = "release version") {
  if (!RELEASE_VERSION_PATTERN.test(value ?? "")) {
    throw new Error(`Invalid ${label}: ${value ?? "missing"}`);
  }
  return value;
}

export function assertIsoTimestamp(value, label = "timestamp") {
  if (!ISO_TIMESTAMP_PATTERN.test(value ?? "")) {
    throw new Error(`Invalid ${label}: ${value ?? "missing"}`);
  }
  return value;
}

export function quoteSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function expectedPublicRecordCount(manifest) {
  const counts = manifest?.record_counts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    throw new Error("Public Release manifest is missing record_counts.");
  }

  let total = 0;
  for (const [entityType, count] of Object.entries(counts)) {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid record count for ${entityType}: ${String(count)}`);
    }
    total += count;
  }
  return total;
}

export function buildD1ImportBatchSql(releaseSql, releaseVersion) {
  assertReleaseVersion(releaseVersion);
  const normalized = releaseSql.replaceAll("\r\n", "\n").trim();
  if (!/^begin\s+immediate\s*;\s*/i.test(normalized)) {
    throw new Error("Public Release d1.sql must start with BEGIN IMMEDIATE.");
  }
  if (!/\s*commit\s*;$/i.test(normalized)) {
    throw new Error("Public Release d1.sql must end with COMMIT.");
  }

  const batchSql = normalized
    .replace(/^begin\s+immediate\s*;\s*/i, "")
    .replace(/\s*commit\s*;$/i, "")
    .trim();

  if (/^\s*(?:begin|commit|rollback|savepoint|release)\b/im.test(batchSql)) {
    throw new Error("D1 import batch contains an unexpected explicit transaction statement.");
  }

  const pointerMatches = [...batchSql.matchAll(/update\s+public_release_pointer\b/gi)];
  if (pointerMatches.length !== 1) {
    throw new Error(
      `Public Release d1.sql must update public_release_pointer exactly once; found ${pointerMatches.length}.`,
    );
  }

  const escapedVersion = releaseVersion.replaceAll(".", "\\.");
  const pointerAtEnd = new RegExp(
    `update\\s+public_release_pointer\\s+set\\s+dataset_release_version\\s*=\\s*'${escapedVersion}'[\\s\\S]*?where\\s+singleton\\s*=\\s*1\\s*;\\s*$`,
    "i",
  );
  if (!pointerAtEnd.test(batchSql)) {
    throw new Error(
      "Public Release pointer update must target the candidate release and remain the final statement.",
    );
  }

  const releaseInsert = new RegExp(
    `insert\\s+into\\s+public_releases[\\s\\S]*?values\\s*\\(\\s*'${escapedVersion}'`,
    "i",
  );
  if (!releaseInsert.test(batchSql)) {
    throw new Error("Public Release d1.sql does not insert the candidate release identity.");
  }

  return `${batchSql}\n`;
}

export function inspectPublicReleaseArtifact(
  releaseVersion,
  releaseDirectory = path.join(repositoryRoot, "data", "public-releases", releaseVersion),
) {
  assertReleaseVersion(releaseVersion);
  const manifestPath = path.join(releaseDirectory, "manifest.json");
  const sqlPath = path.join(releaseDirectory, "d1.sql");
  const manifestBuffer = readFileSync(manifestPath);
  const sqlBuffer = readFileSync(sqlPath);
  const manifest = JSON.parse(manifestBuffer.toString("utf8"));

  if (manifest.dataset_release_version !== releaseVersion) {
    throw new Error(
      `Manifest release mismatch: expected ${releaseVersion}, found ${manifest.dataset_release_version}.`,
    );
  }

  const descriptor = manifest.files?.["d1.sql"];
  if (!descriptor) {
    throw new Error("Public Release manifest does not describe d1.sql.");
  }
  const actualBytes = statSync(sqlPath).size;
  const actualSha256 = sha256(sqlBuffer);
  if (descriptor.bytes !== actualBytes) {
    throw new Error(
      `Public Release d1.sql byte-size drift: manifest=${descriptor.bytes}, actual=${actualBytes}.`,
    );
  }
  if (descriptor.sha256 !== actualSha256) {
    throw new Error(
      `Public Release d1.sql SHA-256 drift: manifest=${descriptor.sha256}, actual=${actualSha256}.`,
    );
  }

  const expectedRecords = expectedPublicRecordCount(manifest);
  const expectedApiPandas = manifest.record_counts?.api_pandas;
  if (!Number.isInteger(expectedApiPandas) || expectedApiPandas < 1) {
    throw new Error("Public Release manifest must declare a positive api_pandas count.");
  }

  const batchSql = buildD1ImportBatchSql(sqlBuffer.toString("utf8"), releaseVersion);
  return {
    releaseVersion,
    releaseDirectory,
    manifestPath,
    sqlPath,
    manifest,
    manifestSha256: sha256(manifestBuffer),
    sqlSha256: actualSha256,
    sqlBytes: actualBytes,
    expectedRecords,
    expectedApiPandas,
    batchSql,
  };
}

export function wranglerResultsFromJson(stdout) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Wrangler did not return valid JSON: ${error.message}`);
  }
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Wrangler did not return a D1 result array.");
  }
  if (payload.some((item) => item?.success !== true)) {
    throw new Error("Wrangler returned an unsuccessful D1 result.");
  }
  return payload;
}

export function rowsFromWranglerJson(stdout) {
  return wranglerResultsFromJson(stdout).flatMap((item) => item.results ?? []);
}

export function singleRowFromWranglerJson(stdout, label) {
  const rows = rowsFromWranglerJson(stdout);
  if (rows.length !== 1) {
    throw new Error(`${label} expected exactly one row; received ${rows.length}.`);
  }
  return rows[0];
}

function integerField(row, field) {
  const value = row?.[field];
  if (!Number.isInteger(value)) {
    throw new Error(`D1 verification field ${field} is not an integer: ${String(value)}`);
  }
  return value;
}

export function buildActivationPreflightSql(releaseVersion) {
  assertReleaseVersion(releaseVersion);
  const target = quoteSqlLiteral(releaseVersion);
  return `select
  (select dataset_release_version from public_release_pointer where singleton = 1) as current_release,
  (select count(*) from public_releases where dataset_release_version = ${target}) as target_release_rows,
  (select count(*) from public_release_records where dataset_release_version = ${target}) as target_record_rows,
  (select count(*) from public_release_withdrawals where dataset_release_version = ${target} and entity_type is null and entity_id is null) as target_whole_withdrawals,
  (select count(*) from public_releases where dataset_release_version = (select dataset_release_version from public_release_pointer where singleton = 1)) as rollback_release_rows,
  (select count(*) from public_release_records where dataset_release_version = (select dataset_release_version from public_release_pointer where singleton = 1)) as rollback_record_rows`;
}

export function validateActivationPreflight(row, releaseVersion) {
  assertReleaseVersion(releaseVersion);
  const currentRelease = row?.current_release;
  if (typeof currentRelease !== "string" || !RELEASE_VERSION_PATTERN.test(currentRelease)) {
    throw new Error("D1 has no valid current Public Release pointer.");
  }
  if (currentRelease === releaseVersion) {
    throw new Error(`Public Release ${releaseVersion} is already current.`);
  }
  const targetReleaseRows = integerField(row, "target_release_rows");
  const targetRecordRows = integerField(row, "target_record_rows");
  const targetWithdrawals = integerField(row, "target_whole_withdrawals");
  const rollbackReleaseRows = integerField(row, "rollback_release_rows");
  const rollbackRecordRows = integerField(row, "rollback_record_rows");
  if (targetReleaseRows !== 0 || targetRecordRows !== 0 || targetWithdrawals !== 0) {
    throw new Error(
      `Target release ${releaseVersion} already has D1 state: releases=${targetReleaseRows}, records=${targetRecordRows}, withdrawals=${targetWithdrawals}.`,
    );
  }
  if (rollbackReleaseRows !== 1 || rollbackRecordRows < 1) {
    throw new Error(
      `Current rollback release ${currentRelease} is incomplete: releases=${rollbackReleaseRows}, records=${rollbackRecordRows}.`,
    );
  }
  return {
    currentRelease,
    rollbackReleaseRows,
    rollbackRecordRows,
  };
}

export function buildActivationVerificationSql(releaseVersion, rollbackVersion) {
  assertReleaseVersion(releaseVersion);
  assertReleaseVersion(rollbackVersion, "rollback version");
  const target = quoteSqlLiteral(releaseVersion);
  const rollback = quoteSqlLiteral(rollbackVersion);
  return `select
  (select dataset_release_version from public_release_pointer where singleton = 1) as current_release,
  (select count(*) from public_releases where dataset_release_version = ${target}) as target_release_rows,
  (select count(*) from public_release_records where dataset_release_version = ${target}) as target_record_rows,
  (select count(*) from public_release_records where dataset_release_version = ${target} and entity_type = 'api_pandas') as target_api_pandas_rows,
  (select public_schema_version from public_releases where dataset_release_version = ${target}) as target_public_schema_version,
  (select database_migration_version from public_releases where dataset_release_version = ${target}) as target_database_migration_version,
  (select publication_batch_id from public_releases where dataset_release_version = ${target}) as target_publication_batch_id,
  (select projection_code_version from public_releases where dataset_release_version = ${target}) as target_projection_code_version,
  (select released_at from public_releases where dataset_release_version = ${target}) as target_released_at,
  (select count(*) from public_release_withdrawals where dataset_release_version = ${target} and entity_type is null and entity_id is null) as target_whole_withdrawals,
  (select count(*) from public_releases where dataset_release_version = ${rollback}) as rollback_release_rows,
  (select count(*) from public_release_records where dataset_release_version = ${rollback}) as rollback_record_rows`;
}

export function validateActivationVerification(row, artifact, rollbackVersion) {
  if (row?.current_release !== artifact.releaseVersion) {
    throw new Error(
      `D1 pointer verification failed: expected ${artifact.releaseVersion}, found ${String(row?.current_release)}.`,
    );
  }
  if (integerField(row, "target_release_rows") !== 1) {
    throw new Error("D1 target release registry row was not created exactly once.");
  }
  const actualRecords = integerField(row, "target_record_rows");
  if (actualRecords !== artifact.expectedRecords) {
    throw new Error(
      `D1 target record count mismatch: expected ${artifact.expectedRecords}, found ${actualRecords}.`,
    );
  }
  const actualApiPandas = integerField(row, "target_api_pandas_rows");
  if (actualApiPandas !== artifact.expectedApiPandas) {
    throw new Error(
      `D1 api_pandas count mismatch: expected ${artifact.expectedApiPandas}, found ${actualApiPandas}.`,
    );
  }
  const metadataFields = [
    ["target_public_schema_version", "public_schema_version"],
    ["target_database_migration_version", "database_migration_version"],
    ["target_publication_batch_id", "publication_batch_id"],
    ["target_projection_code_version", "projection_code_version"],
    ["target_released_at", "released_at"],
  ];
  for (const [rowField, manifestField] of metadataFields) {
    if (row?.[rowField] !== artifact.manifest[manifestField]) {
      throw new Error(
        `D1 metadata mismatch for ${manifestField}: expected ${artifact.manifest[manifestField]}, found ${String(row?.[rowField])}.`,
      );
    }
  }
  if (integerField(row, "target_whole_withdrawals") !== 0) {
    throw new Error(`Activated release ${artifact.releaseVersion} is withdrawn.`);
  }
  if (integerField(row, "rollback_release_rows") !== 1) {
    throw new Error(`Rollback release ${rollbackVersion} is missing from D1 history.`);
  }
  if (integerField(row, "rollback_record_rows") < 1) {
    throw new Error(`Rollback release ${rollbackVersion} has no retained records.`);
  }
  return {
    currentRelease: artifact.releaseVersion,
    targetRecordRows: actualRecords,
    targetApiPandasRows: actualApiPandas,
    rollbackVersion,
    rollbackRecordRows: row.rollback_record_rows,
  };
}

export function buildRollbackPreflightSql(targetVersion) {
  assertReleaseVersion(targetVersion, "rollback target");
  const target = quoteSqlLiteral(targetVersion);
  return `select
  (select dataset_release_version from public_release_pointer where singleton = 1) as current_release,
  (select count(*) from public_releases where dataset_release_version = ${target}) as target_release_rows,
  (select count(*) from public_release_records where dataset_release_version = ${target}) as target_record_rows,
  (select count(*) from public_release_withdrawals where dataset_release_version = ${target} and entity_type is null and entity_id is null) as target_whole_withdrawals`;
}

export function validateRollbackPreflight(row, targetVersion) {
  assertReleaseVersion(targetVersion, "rollback target");
  const currentRelease = row?.current_release;
  if (typeof currentRelease !== "string" || !RELEASE_VERSION_PATTERN.test(currentRelease)) {
    throw new Error("D1 has no valid current Public Release pointer.");
  }
  if (currentRelease === targetVersion) {
    throw new Error(`Rollback target ${targetVersion} is already current.`);
  }
  const targetReleaseRows = integerField(row, "target_release_rows");
  const targetRecordRows = integerField(row, "target_record_rows");
  const targetWithdrawals = integerField(row, "target_whole_withdrawals");
  if (targetReleaseRows !== 1 || targetRecordRows < 1) {
    throw new Error(
      `Rollback target ${targetVersion} is incomplete: releases=${targetReleaseRows}, records=${targetRecordRows}.`,
    );
  }
  if (targetWithdrawals !== 0) {
    throw new Error(`Rollback target ${targetVersion} is withdrawn.`);
  }
  return { currentRelease, targetVersion, targetRecordRows };
}

export function buildRollbackUpdateSql(currentVersion, targetVersion, switchedAt) {
  assertReleaseVersion(currentVersion, "current release");
  assertReleaseVersion(targetVersion, "rollback target");
  assertIsoTimestamp(switchedAt, "rollback switched_at");
  return `update public_release_pointer
set dataset_release_version = ${quoteSqlLiteral(targetVersion)},
    switched_at = ${quoteSqlLiteral(switchedAt)}
where singleton = 1
  and dataset_release_version = ${quoteSqlLiteral(currentVersion)}
returning dataset_release_version, switched_at`;
}

export function buildRollbackVerificationSql(sourceVersion, targetVersion) {
  assertReleaseVersion(sourceVersion, "rollback source");
  assertReleaseVersion(targetVersion, "rollback target");
  const source = quoteSqlLiteral(sourceVersion);
  const target = quoteSqlLiteral(targetVersion);
  return `select
  (select dataset_release_version from public_release_pointer where singleton = 1) as current_release,
  (select count(*) from public_releases where dataset_release_version = ${source}) as source_release_rows,
  (select count(*) from public_release_records where dataset_release_version = ${source}) as source_record_rows,
  (select count(*) from public_releases where dataset_release_version = ${target}) as target_release_rows,
  (select count(*) from public_release_records where dataset_release_version = ${target}) as target_record_rows`;
}

export function validateRollbackVerification(row, sourceVersion, targetVersion) {
  if (row?.current_release !== targetVersion) {
    throw new Error(
      `D1 rollback pointer verification failed: expected ${targetVersion}, found ${String(row?.current_release)}.`,
    );
  }
  if (integerField(row, "source_release_rows") !== 1 || integerField(row, "source_record_rows") < 1) {
    throw new Error(`Rollback source ${sourceVersion} was not retained as immutable history.`);
  }
  if (integerField(row, "target_release_rows") !== 1 || integerField(row, "target_record_rows") < 1) {
    throw new Error(`Rollback target ${targetVersion} is incomplete after pointer switch.`);
  }
  return {
    currentRelease: targetVersion,
    retainedSourceRelease: sourceVersion,
    retainedSourceRecords: row.source_record_rows,
    targetRecords: row.target_record_rows,
  };
}

export function wranglerExecuteArguments(options, executionArguments) {
  const args = ["d1", "execute", options.database];
  if (options.config) args.push("--config", options.config);
  args.push(options.target);
  if (options.persistTo) args.push("--persist-to", options.persistTo);
  args.push(...executionArguments);
  return args;
}

export function runWranglerD1(
  options,
  executionArguments,
  { capture = false, wranglerCli = defaultWranglerCli } = {},
) {
  const result = spawnSync(
    process.execPath,
    [wranglerCli, ...wranglerExecuteArguments(options, executionArguments)],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler exited with status ${result.status}.`);
  }
  return result.stdout ?? "";
}

export function querySingleD1Row(options, sql, label) {
  const stdout = runWranglerD1(
    options,
    ["--command", sql, "--json"],
    { capture: true },
  );
  return singleRowFromWranglerJson(stdout, label);
}

export function writeJsonReport(reportPath, report) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function parseCommonD1Arguments(argv, mode) {
  const options = {
    database: null,
    config: null,
    target: null,
    persistTo: null,
    execute: false,
    report: null,
    releaseVersion: null,
    rollbackTarget: null,
    switchedAt: null,
  };

  const valueArguments = new Set([
    "--database",
    "--config",
    "--persist-to",
    "--report",
    "--release",
    "--to",
    "--switched-at",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (valueArguments.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      index += 1;
      switch (argument) {
        case "--database":
          options.database = value;
          break;
        case "--config":
          options.config = path.resolve(repositoryRoot, value);
          break;
        case "--persist-to":
          options.persistTo = path.resolve(repositoryRoot, value);
          break;
        case "--report":
          options.report = path.resolve(repositoryRoot, value);
          break;
        case "--release":
          options.releaseVersion = value;
          break;
        case "--to":
          options.rollbackTarget = value;
          break;
        case "--switched-at":
          options.switchedAt = value;
          break;
        default:
          throw new Error(`Unsupported argument: ${argument}`);
      }
      continue;
    }

    switch (argument) {
      case "--remote":
      case "--local":
      case "--preview":
        if (options.target) throw new Error("Choose exactly one D1 target.");
        options.target = argument;
        break;
      case "--execute":
        options.execute = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.database) throw new Error("--database is required.");
  if (!options.target) throw new Error("Choose --remote, --local, or --preview.");
  if (options.target === "--local" && !options.persistTo) {
    throw new Error("--persist-to is required with --local.");
  }
  if (mode === "activate") {
    assertReleaseVersion(options.releaseVersion);
    if (options.rollbackTarget || options.switchedAt) {
      throw new Error("Activation does not accept --to or --switched-at.");
    }
  } else if (mode === "rollback") {
    assertReleaseVersion(options.rollbackTarget, "rollback target");
    if (options.releaseVersion) throw new Error("Rollback does not accept --release.");
    if (options.switchedAt) assertIsoTimestamp(options.switchedAt, "rollback switched_at");
  } else {
    throw new Error(`Unknown D1 release mode: ${mode}`);
  }
  return options;
}
