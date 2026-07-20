import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildRollbackPreflightSql,
  buildRollbackUpdateSql,
  buildRollbackVerificationSql,
  parseCommonD1Arguments,
  querySingleD1Row,
  repositoryRoot,
  runWranglerD1,
  singleRowFromWranglerJson,
  validateRollbackPreflight,
  validateRollbackVerification,
  writeJsonReport,
} from "./d1-public-release.mjs";

function defaultReportPath(targetVersion) {
  return path.join(
    repositoryRoot,
    ".release-gate",
    `d1-public-release-rollback-${targetVersion}.json`,
  );
}

export function runRollback(argv = process.argv.slice(2)) {
  const startedAt = new Date().toISOString();
  let options;
  let reportPath;
  let report = {
    schema_version: 1,
    operation: "rollback-public-release-d1",
    outcome: "failed",
    started_at: startedAt,
  };

  try {
    options = parseCommonD1Arguments(argv, "rollback");
    reportPath = options.report ?? defaultReportPath(options.rollbackTarget);
    report = {
      ...report,
      mode: options.execute ? "execute" : "dry-run",
      target: options.target.slice(2),
      database: options.database,
      rollback_target: options.rollbackTarget,
    };
    const preflightRow = querySingleD1Row(
      options,
      buildRollbackPreflightSql(options.rollbackTarget),
      "D1 Public Release rollback preflight",
    );
    const switchedAt = options.switchedAt ?? new Date().toISOString();

    report = {
      ...report,
      mode: options.execute ? "execute" : "dry-run",
      target: options.target.slice(2),
      database: options.database,
      source_release: preflightRow.current_release,
      rollback_target: options.rollbackTarget,
      requested_switched_at: switchedAt,
      preflight: {
        target_release_rows: preflightRow.target_release_rows,
        target_record_rows: preflightRow.target_record_rows,
        target_whole_withdrawals: preflightRow.target_whole_withdrawals,
      },
    };
    const preflight = validateRollbackPreflight(preflightRow, options.rollbackTarget);

    if (!options.execute) {
      report.outcome = "passed";
      report.finished_at = new Date().toISOString();
      writeJsonReport(reportPath, report);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return report;
    }

    const updateSql = buildRollbackUpdateSql(
      preflight.currentRelease,
      options.rollbackTarget,
      switchedAt,
    );
    const stdout = runWranglerD1(
      options,
      ["--command", updateSql, "--json", "--yes"],
      { capture: true },
    );
    const updateRow = singleRowFromWranglerJson(
      stdout,
      "D1 Public Release rollback update",
    );
    if (
      updateRow.dataset_release_version !== options.rollbackTarget ||
      updateRow.switched_at !== switchedAt
    ) {
      throw new Error(
        `D1 rollback update returned unexpected pointer state: ${JSON.stringify(updateRow)}.`,
      );
    }

    const verificationRow = querySingleD1Row(
      options,
      buildRollbackVerificationSql(preflight.currentRelease, options.rollbackTarget),
      "D1 Public Release rollback verification",
    );
    const verification = validateRollbackVerification(
      verificationRow,
      preflight.currentRelease,
      options.rollbackTarget,
    );

    report.outcome = "passed";
    report.execution = {
      pointer_only: true,
      guarded_source_release: preflight.currentRelease,
      switched_at: switchedAt,
    };
    report.verification = {
      current_release: verification.currentRelease,
      retained_source_release: verification.retainedSourceRelease,
      retained_source_record_rows: verification.retainedSourceRecords,
      rollback_target_record_rows: verification.targetRecords,
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
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runRollback();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
