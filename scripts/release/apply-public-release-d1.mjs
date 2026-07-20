import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildActivationPreflightSql,
  buildActivationVerificationSql,
  inspectPublicReleaseArtifact,
  parseCommonD1Arguments,
  querySingleD1Row,
  repositoryRoot,
  runWranglerD1,
  validateActivationPreflight,
  validateActivationVerification,
  writeJsonReport,
} from "./d1-public-release.mjs";

function defaultReportPath(releaseVersion) {
  return path.join(
    repositoryRoot,
    ".release-gate",
    `d1-public-release-${releaseVersion}.json`,
  );
}

export function runActivation(argv = process.argv.slice(2)) {
  const startedAt = new Date().toISOString();
  let options;
  let reportPath;
  let report = {
    schema_version: 1,
    operation: "activate-public-release-d1",
    outcome: "failed",
    started_at: startedAt,
  };
  let temporaryDirectory;

  try {
    options = parseCommonD1Arguments(argv, "activate");
    reportPath = options.report ?? defaultReportPath(options.releaseVersion);
    report = {
      ...report,
      mode: options.execute ? "execute" : "dry-run",
      target: options.target.slice(2),
      database: options.database,
      requested_release: options.releaseVersion,
    };
    const artifact = inspectPublicReleaseArtifact(options.releaseVersion);
    const preflightRow = querySingleD1Row(
      options,
      buildActivationPreflightSql(options.releaseVersion),
      "D1 Public Release activation preflight",
    );
    report = {
      ...report,
      release: {
        dataset_release_version: artifact.releaseVersion,
        public_schema_version: artifact.manifest.public_schema_version,
        database_migration_version: artifact.manifest.database_migration_version,
        publication_batch_id: artifact.manifest.publication_batch_id,
        projection_code_version: artifact.manifest.projection_code_version,
        released_at: artifact.manifest.released_at,
        expected_record_count: artifact.expectedRecords,
        expected_api_pandas_count: artifact.expectedApiPandas,
      },
      artifact: {
        manifest_sha256: artifact.manifestSha256,
        d1_sql_sha256: artifact.sqlSha256,
        d1_sql_bytes: artifact.sqlBytes,
        tracked_d1_sql: path.relative(repositoryRoot, artifact.sqlPath).replaceAll("\\", "/"),
        transformed_batch: "outer BEGIN IMMEDIATE/COMMIT removed in a temporary file only",
      },
      preflight: {
        current_release: preflightRow.current_release,
        rollback_release_rows: preflightRow.rollback_release_rows,
        rollback_record_rows: preflightRow.rollback_record_rows,
        target_release_rows: preflightRow.target_release_rows,
        target_record_rows: preflightRow.target_record_rows,
        target_whole_withdrawals: preflightRow.target_whole_withdrawals,
      },
    };
    const preflight = validateActivationPreflight(preflightRow, options.releaseVersion);

    if (!options.execute) {
      report.outcome = "passed";
      report.finished_at = new Date().toISOString();
      writeJsonReport(reportPath, report);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return report;
    }

    temporaryDirectory = mkdtempSync(path.join(tmpdir(), "pandaatlas-public-release-"));
    const temporarySqlPath = path.join(
      temporaryDirectory,
      `public-release-${artifact.releaseVersion}.sql`,
    );
    writeFileSync(temporarySqlPath, artifact.batchSql, "utf8");
    runWranglerD1(options, ["--file", temporarySqlPath, "--yes"]);

    const verificationRow = querySingleD1Row(
      options,
      buildActivationVerificationSql(artifact.releaseVersion, preflight.currentRelease),
      "D1 Public Release activation verification",
    );
    const verification = validateActivationVerification(
      verificationRow,
      artifact,
      preflight.currentRelease,
    );

    report.outcome = "passed";
    report.execution = {
      import_method: "wrangler d1 execute --file",
      rollback_safe_batch: true,
      temporary_sql_deleted: true,
    };
    report.verification = {
      current_release: verification.currentRelease,
      target_record_rows: verification.targetRecordRows,
      target_api_pandas_rows: verification.targetApiPandasRows,
      retained_rollback_release: verification.rollbackVersion,
      retained_rollback_record_rows: verification.rollbackRecordRows,
    };
    report.finished_at = new Date().toISOString();
    writeJsonReport(reportPath, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.finished_at = new Date().toISOString();
    if (reportPath) writeJsonReport(reportPath, report);
    throw error;
  } finally {
    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runActivation();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
