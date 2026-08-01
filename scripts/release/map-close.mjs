import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createMapCloseCertificationPlan,
  MAP_CLOSE_PROFILE,
  MAP_CLOSE_WEB_ENVIRONMENT,
} from "./certification/map-close-plan.mjs";
import { ReleaseGateError, runReleaseGate } from "./gate-core.mjs";
import { sealMapCloseEvidence } from "./map-close-evidence.mjs";
import {
  releaseReportDir,
  runDefaultReleaseGate,
} from "./default.mjs";

function prepareMapCloseWebEnvironment() {
  for (const [name, value] of Object.entries(MAP_CLOSE_WEB_ENVIRONMENT)) {
    if (!process.env[name]) process.env[name] = value;
  }
}

function resolvePlaywrightEnv() {
  const env = {
    PLAYWRIGHT_WEB_SERVER_MODE: "production",
    PLAYWRIGHT_REUSE_EXISTING_SERVER: "0",
    PLAYWRIGHT_NEXT_DIST_DIR: ".next",
  };
  if (process.env.PLAYWRIGHT_BROWSER_CHANNEL) {
    return { ...env, PLAYWRIGHT_BROWSER_CHANNEL: process.env.PLAYWRIGHT_BROWSER_CHANNEL };
  }
  if (process.platform !== "win32" || process.env.RELEASE_GATE_USE_SYSTEM_EDGE === "0") {
    return env;
  }
  const edgeCandidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe")
      : null,
  ].filter(Boolean);
  return edgeCandidates.some((candidate) => existsSync(candidate))
    ? { ...env, PLAYWRIGHT_BROWSER_CHANNEL: "msedge" }
    : env;
}

export async function runMapCloseGate() {
  prepareMapCloseWebEnvironment();
  await runDefaultReleaseGate();

  const plan = createMapCloseCertificationPlan({
    profile: MAP_CLOSE_PROFILE.AUTHORITATIVE,
    playwrightEnv: resolvePlaywrightEnv(),
  });
  const report = await runReleaseGate({
    gate: plan.gate,
    reportDir: releaseReportDir,
    steps: plan.steps,
  });

  await sealMapCloseEvidence({ reportDir: releaseReportDir });
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMapCloseGate().catch((error) => {
    if (!(error instanceof ReleaseGateError)) {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}
