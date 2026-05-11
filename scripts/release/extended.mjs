import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  apiBaseUrl,
  apiDir,
  repoRoot,
  runCommand,
  runDefaultReleaseGate,
  startApiServer,
  stopProcess,
  waitForServer,
} from "./default.mjs";

function commandName(name) {
  return name;
}

function envFlag(name) {
  return (process.env[name] ?? "0").trim().toLowerCase() === "1";
}

export async function runExtendedReleaseGate() {
  const uv = commandName("uv");
  const runRealDbTests = envFlag("RUN_REAL_DB_TESTS");
  const runAdminImportSmoke = envFlag("RUN_ADMIN_IMPORT_SMOKE");
  let apiProcess;

  await runDefaultReleaseGate();

  if (!runRealDbTests && !runAdminImportSmoke) {
    console.log("\nExtended gate flags not enabled. Skipping optional extended checks.");
    return;
  }

  if (runRealDbTests && !process.env.DATABASE_URL) {
    throw new Error("RUN_REAL_DB_TESTS=1 requires DATABASE_URL to be set.");
  }

  if (runAdminImportSmoke && !process.env.ADMIN_API_TOKEN) {
    throw new Error("RUN_ADMIN_IMPORT_SMOKE=1 requires ADMIN_API_TOKEN to be set.");
  }

  if (runRealDbTests) {
    await runCommand(uv, ["run", "pytest", "-q", "tests/integration/test_real_db_chain.py"], {
      cwd: apiDir,
    });
  }

  if (!runAdminImportSmoke) {
    return;
  }

  try {
    apiProcess = startApiServer({
      DB_USE_MOCK_FALLBACK: process.env.DB_USE_MOCK_FALLBACK ?? "true",
      DATABASE_URL: process.env.DATABASE_URL,
      ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN,
    });
    await waitForServer(`${apiBaseUrl}/health`, apiProcess);
    await runCommand(uv, ["run", "python", "scripts/smoke_test_admin_import.py"], {
      cwd: apiDir,
      env: {
        API_BASE_URL: apiBaseUrl,
        ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN,
        SMOKE_IMPORT_SOURCE_NAME: process.env.SMOKE_IMPORT_SOURCE_NAME,
      },
    });
  } finally {
    await stopProcess(apiProcess);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runExtendedReleaseGate().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
