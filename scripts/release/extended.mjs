import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  environmentFlag,
  requireEnvironmentValue,
} from "./certification/capabilities.mjs";
import { runEvidenceSealedCertification } from "./certification/lifecycle.mjs";
import { ReleaseGateError } from "./gate-core.mjs";
import { runMapCloseGate } from "./map-close.mjs";
import {
  apiBaseUrl,
  apiDir,
  apiReleaseEnv,
  releaseReportDir,
  runCommand,
  runEnvironmentCheck,
  startApiServer,
  stopProcess,
  uvRunPrefix,
  waitForServer,
} from "./default.mjs";

async function runAdminImportSmoke(uv) {
  const adminApiToken = requireEnvironmentValue("ADMIN_API_TOKEN", {
    enabledBy: "RUN_ADMIN_IMPORT_SMOKE",
  });
  let apiProcess;
  let primaryError;

  try {
    apiProcess = startApiServer({
      DB_USE_MOCK_FALLBACK: process.env.DB_USE_MOCK_FALLBACK ?? "true",
      DATABASE_URL: process.env.DATABASE_URL,
      ADMIN_API_TOKEN: adminApiToken,
    });
    await waitForServer(`${apiBaseUrl}/health`, apiProcess);
    await runCommand(
      uv,
      [...uvRunPrefix, "python", "scripts/smoke_test_admin_import.py"],
      {
        cwd: apiDir,
        env: {
          ...apiReleaseEnv,
          API_BASE_URL: apiBaseUrl,
          ADMIN_API_TOKEN: adminApiToken,
          SMOKE_IMPORT_SOURCE_NAME: process.env.SMOKE_IMPORT_SOURCE_NAME,
        },
      },
    );
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await stopProcess(apiProcess);
    } catch (stopError) {
      if (!primaryError) throw stopError;
      console.error(`Failed to stop extended API process: ${String(stopError)}`);
    }
  }
}

export async function runExtendedReleaseGate() {
  const uv = "uv";
  const runRealDbTests = environmentFlag("RUN_REAL_DB_TESTS");
  const runAdminImport = environmentFlag("RUN_ADMIN_IMPORT_SMOKE");
  const runPostgresAttachmentRecovery = environmentFlag("RUN_POSTGRES_ATTACHMENT_RECOVERY");
  const runIdentityEngagementRecovery = environmentFlag("RUN_IDENTITY_ENGAGEMENT_RECOVERY");

  await runMapCloseGate();

  return runEvidenceSealedCertification({
    gate: "extended",
    reportDir: releaseReportDir,
    steps: [
      {
        id: "postgres-attachment-recovery",
        label: "PostgreSQL and evidence-attachment recovery drill",
        skipReason: runPostgresAttachmentRecovery
          ? undefined
          : "RUN_POSTGRES_ATTACHMENT_RECOVERY is not enabled",
        run: () =>
          runEnvironmentCheck(
            uv,
            [...uvRunPrefix, "python", "scripts/run_postgres_attachment_recovery_drill.py"],
            { cwd: apiDir, env: apiReleaseEnv },
          ),
      },
      {
        id: "identity-engagement-recovery",
        label: "Identity and engagement deletion, retry, and restore drill",
        skipReason: runIdentityEngagementRecovery
          ? undefined
          : "RUN_IDENTITY_ENGAGEMENT_RECOVERY is not enabled",
        run: () => {
          requireEnvironmentValue("DATABASE_URL", {
            enabledBy: "RUN_IDENTITY_ENGAGEMENT_RECOVERY",
          });
          return runEnvironmentCheck(
            uv,
            [...uvRunPrefix, "python", "scripts/run_identity_engagement_recovery_drill.py"],
            { cwd: apiDir, env: apiReleaseEnv },
          );
        },
      },
      {
        id: "real-db-tests",
        label: "FastAPI real database integration tests",
        skipReason: runRealDbTests ? undefined : "RUN_REAL_DB_TESTS is not enabled",
        run: () => {
          requireEnvironmentValue("DATABASE_URL", { enabledBy: "RUN_REAL_DB_TESTS" });
          return runCommand(
            uv,
            [
              ...uvRunPrefix,
              "pytest",
              "-q",
              "tests/integration/test_real_db_chain.py",
              "tests/integration/test_engagement_real_db.py",
            ],
            { cwd: apiDir, env: apiReleaseEnv },
          );
        },
      },
      {
        id: "admin-import-smoke",
        label: "FastAPI admin import smoke",
        skipReason: runAdminImport ? undefined : "RUN_ADMIN_IMPORT_SMOKE is not enabled",
        run: () => runAdminImportSmoke(uv),
      },
    ],
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runExtendedReleaseGate().catch((error) => {
    if (!(error instanceof ReleaseGateError)) {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}
