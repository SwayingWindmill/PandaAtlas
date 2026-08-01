import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolvePlaywrightEnvironment } from "./certification/capabilities.mjs";
import { runEvidenceSealedCertification } from "./certification/lifecycle.mjs";
import {
  createMapCloseCertificationPlan,
  MAP_CLOSE_PROFILE,
  MAP_CLOSE_WEB_ENVIRONMENT,
} from "./certification/map-close-plan.mjs";
import { ReleaseGateError } from "./gate-core.mjs";
import {
  releaseReportDir,
  runDefaultReleaseGate,
} from "./default.mjs";

// Archive governance audit locator; executable definitions live in the shared plan:
// archive-governance-evidence · Exhaustive four-eyes inventory · validate-archive-governance-evidence.mjs

function prepareMapCloseWebEnvironment() {
  for (const [name, value] of Object.entries(MAP_CLOSE_WEB_ENVIRONMENT)) {
    if (!process.env[name]) process.env[name] = value;
  }
}

export async function runMapCloseGate() {
  prepareMapCloseWebEnvironment();
  await runDefaultReleaseGate();

  const plan = createMapCloseCertificationPlan({
    profile: MAP_CLOSE_PROFILE.AUTHORITATIVE,
    playwrightEnv: resolvePlaywrightEnvironment(),
  });
  return runEvidenceSealedCertification({
    gate: plan.gate,
    reportDir: releaseReportDir,
    steps: plan.steps,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMapCloseGate().catch((error) => {
    if (!(error instanceof ReleaseGateError)) {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}
