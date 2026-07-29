import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { ReleaseGateError, runReleaseGate } from "./gate-core.mjs";
import { sealMapCloseEvidence } from "./map-close-evidence.mjs";
import {
  apiDir,
  apiReleaseEnv,
  releaseReportDir,
  runCommand,
  runDefaultReleaseGate,
  uvRunPrefix,
} from "./default.mjs";

const mapCloseWebEnvironment = {
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65534",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  NEXT_PUBLIC_ENGAGEMENT_ENABLED: "true",
};

function prepareMapCloseWebEnvironment() {
  for (const [name, value] of Object.entries(mapCloseWebEnvironment)) {
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
  const playwrightEnv = resolvePlaywrightEnv();

  const report = await runReleaseGate({
    gate: "map-close",
    reportDir: releaseReportDir,
    steps: [
      {
        id: "supabase-foundation-contracts",
        label: "Supabase/PostGIS/PGMQ foundation contracts",
        run: () =>
          runCommand(
            "uv",
            [
              ...uvRunPrefix,
              "pytest",
              "-q",
              "tests/scripts/test_check_zhipanda_foundation.py",
              "tests/contracts/test_integration_event_contract.py",
              "tests/contracts/test_identity_capability_storage_contract.py",
            ],
            { cwd: apiDir, env: apiReleaseEnv },
          ),
      },
      {
        id: "identity-engagement-contracts",
        label: "Identity, capability, Follow, consent, and Passport contracts",
        run: () =>
          runCommand(
            "uv",
            [
              ...uvRunPrefix,
              "pytest",
              "-q",
              "tests/identity",
              "tests/engagement",
              "tests/api/test_engagement_feature_flags.py",
            ],
            { cwd: apiDir, env: apiReleaseEnv },
          ),
      },
      {
        id: "secure-web-boundary",
        label: "Public/admin bundle, browser-write, and legacy Saved boundary",
        run: () => runCommand("node", ["scripts/release/check-secure-engagement-boundary.mjs"]),
      },
      {
        id: "follow-through-login-browser",
        label: "Follow-through-login and private Passport browser journey",
        dependsOn: ["secure-web-boundary", "identity-engagement-contracts"],
        run: () =>
          runCommand(
            "npm",
            [
              "run",
              "smoke",
              "-w",
              "web",
              "--",
              "tests/smoke/follow-through-login.spec.ts",
            ],
            { env: playwrightEnv },
          ),
      },
      {
        id: "admin-shell-browser",
        label: "Bounded React-admin shell, headers, keyboard, and WCAG",
        dependsOn: ["secure-web-boundary"],
        run: () =>
          runCommand("npm", ["run", "test:admin-shell", "-w", "web"], {
            env: playwrightEnv,
          }),
      },
    ],
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
