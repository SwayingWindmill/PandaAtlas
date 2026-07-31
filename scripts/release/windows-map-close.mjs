import process from "node:process";
import { fileURLToPath } from "node:url";

import { ReleaseGateError, runReleaseGate } from "./gate-core.mjs";
import {
  apiDir,
  apiReleaseEnv,
  releaseReportDir,
  runCommand,
  uvRunPrefix,
} from "./default.mjs";

const webEnvironment = {
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65534",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  NEXT_PUBLIC_ENGAGEMENT_ENABLED: "true",
  NEXT_PUBLIC_FEED_ENABLED: "true",
  NEXT_PUBLIC_NOTIFICATION_ENABLED: "true",
};

export async function runWindowsMapCloseCompatibility() {
  return runReleaseGate({
    gate: "windows-map-close-compatibility",
    reportDir: releaseReportDir,
    steps: [
      {
        id: "release-contracts",
        label: "Release orchestration contracts",
        run: () => runCommand("npm", ["run", "test:release-gate"]),
      },
      {
        id: "web-lint",
        label: "Windows Web lint and architecture guards",
        run: () => runCommand("npm", ["run", "lint:web"]),
      },
      {
        id: "web-typecheck",
        label: "Windows Web TypeScript",
        run: () => runCommand("npm", ["run", "typecheck:web"]),
      },
      {
        id: "web-build",
        label: "Windows Web production build",
        dependsOn: ["web-lint", "web-typecheck"],
        run: () => runCommand("npm", ["run", "build:web"], { env: webEnvironment }),
      },
      {
        id: "api-sync",
        label: "Windows locked FastAPI environment",
        run: () =>
          runCommand("uv", ["sync", "--directory", apiDir, "--frozen", "--extra", "dev"], {
            env: apiReleaseEnv,
          }),
      },
      {
        id: "api-lint",
        label: "Windows FastAPI lint",
        dependsOn: ["api-sync"],
        run: () =>
          runCommand("uv", [...uvRunPrefix, "ruff", "check", "app", "tests", "scripts"], {
            cwd: apiDir,
            env: apiReleaseEnv,
          }),
      },
      {
        id: "api-tests",
        label: "Windows FastAPI regression tests",
        dependsOn: ["api-sync"],
        run: () =>
          runCommand("uv", [...uvRunPrefix, "pytest", "-q"], {
            cwd: apiDir,
            env: apiReleaseEnv,
          }),
      },
      {
        id: "published-return-loop-browser",
        label: "Windows private Inbox and notification preference browser journey",
        dependsOn: ["web-build"],
        run: () =>
          runCommand(
            "npm",
            [
              "run",
              "smoke",
              "-w",
              "web",
              "--",
              "tests/smoke/published-return-loop.spec.ts",
            ],
            {
              env: {
                ...webEnvironment,
                PLAYWRIGHT_WEB_SERVER_MODE: "production",
                PLAYWRIGHT_REUSE_EXISTING_SERVER: "0",
                PLAYWRIGHT_NEXT_DIST_DIR: ".next",
              },
            },
          ),
      },
    ],
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
