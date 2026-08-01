import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createMapCloseCertificationPlan,
  MAP_CLOSE_PROFILE,
} from "./certification/map-close-plan.mjs";
import { ReleaseGateError, runReleaseGate } from "./gate-core.mjs";
import { releaseReportDir } from "./default.mjs";

export async function runWindowsMapCloseCompatibility() {
  const plan = createMapCloseCertificationPlan({
    profile: MAP_CLOSE_PROFILE.WINDOWS_COMPATIBILITY,
  });
  return runReleaseGate({
    gate: plan.gate,
    reportDir: releaseReportDir,
    steps: plan.steps,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runWindowsMapCloseCompatibility().catch((error) => {
    if (!(error instanceof ReleaseGateError)) {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}
