import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  EnvironmentBlockedError,
  ReleaseGateError,
  runReleaseGate,
} from "./gate-core.mjs";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = "8000";
export const uvRunPrefix = ["run", "--frozen", "--extra", "dev", "--no-sync"];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..", "..");
export const apiDir = path.join(repoRoot, "services", "api");
export const apiBaseUrl = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
export const releaseReportDir = process.env.RELEASE_GATE_REPORT_DIR
  ? path.resolve(repoRoot, process.env.RELEASE_GATE_REPORT_DIR)
  : path.join(repoRoot, ".release-gate");

export const apiReleaseEnv = {
  UV_PROJECT_ENVIRONMENT: path.join(apiDir, ".venv-release"),
  UV_PYTHON: "3.12",
  UV_LINK_MODE: process.env.UV_LINK_MODE ?? "copy",
};

export class CommandExecutionError extends Error {
  constructor(message, { exitCode = null, signal = null } = {}) {
    super(message);
    this.name = "CommandExecutionError";
    this.exitCode = exitCode;
    this.signal = signal;
  }
}

function commandName(name) {
  return name;
}

function quoteWindowsArgument(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@=+-]+$/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function windowsCommandLine(command, args) {
  return [command, ...args].map(quoteWindowsArgument).join(" ");
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

export async function runCommand(command, args, options = {}) {
  const cwd = options.cwd ?? repoRoot;
  const env = { ...process.env, ...options.env };

  console.log(`\n> ${formatCommand(command, args)}`);

  await new Promise((resolve, reject) => {
    const useCommandProcessor = process.platform === "win32" && command === "npm";
    const executable = useCommandProcessor ? process.env.ComSpec ?? "cmd.exe" : command;
    const executableArgs = useCommandProcessor
      ? ["/d", "/s", "/c", windowsCommandLine(command, args)]
      : args;
    const child = spawn(executable, executableArgs, {
      cwd,
      env,
      stdio: "inherit",
    });

    child.on("error", (error) => {
      if (error?.code === "ENOENT") {
        reject(
          new EnvironmentBlockedError(`Required command is unavailable: ${command}`, {
            cause: error,
          }),
        );
        return;
      }
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(
        new CommandExecutionError(
          `${formatCommand(command, args)} failed with code ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}`,
          { exitCode: code, signal },
        ),
      );
    });
  });
}

export async function runEnvironmentCheck(command, args, options = {}) {
  try {
    await runCommand(command, args, options);
  } catch (error) {
    if (error instanceof CommandExecutionError && error.exitCode === 2) {
      throw new EnvironmentBlockedError(error.message, { cause: error });
    }
    throw error;
  }
}

function waitForExit(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve(undefined);
      return;
    }

    child.once("exit", () => resolve(undefined));
  });
}

export function startApiServer(envOverrides = {}) {
  const command = commandName("uv");
  const args = [
    ...uvRunPrefix,
    "uvicorn",
    "app.main:app",
    "--host",
    DEFAULT_HOST,
    "--port",
    DEFAULT_PORT,
  ];
  console.log(`\n> ${formatCommand(command, args)}`);

  return spawn(command, args, {
    cwd: apiDir,
    env: {
      ...process.env,
      ...apiReleaseEnv,
      DB_USE_MOCK_FALLBACK: "true",
      ...envOverrides,
    },
    stdio: "inherit",
  });
}

export async function waitForServer(url, child, attempts = 30) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child?.exitCode !== null) {
      throw new Error(`API server exited before becoming ready (exit code: ${child.exitCode})`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Received HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${String(lastError)}` : ""}`);
}

export async function stopProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await runCommand("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([waitForExit(child), delay(5000)]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
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

  if (edgeCandidates.some((candidate) => existsSync(candidate))) {
    return { ...env, PLAYWRIGHT_BROWSER_CHANNEL: "msedge" };
  }
  return env;
}

async function runPublicApiSmoke(uv) {
  let apiProcess;
  let primaryError;

  try {
    apiProcess = startApiServer({ DB_USE_MOCK_FALLBACK: "true" });
    await waitForServer(`${apiBaseUrl}/health`, apiProcess);
    await runCommand(
      uv,
      [...uvRunPrefix, "python", "scripts/smoke_test_public_api.py"],
      {
        cwd: apiDir,
        env: {
          ...apiReleaseEnv,
          API_BASE_URL: apiBaseUrl,
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
      if (!primaryError) {
        throw stopError;
      }
      console.error(`Failed to stop API smoke process: ${String(stopError)}`);
    }
  }
}

export async function runDefaultReleaseGate() {
  const npm = commandName("npm");
  const uv = commandName("uv");
  const playwrightEnv = resolvePlaywrightEnv();
  const workerHttpSkipReason =
    process.platform === "win32"
      ? "Worker HTTP smoke is executed by Linux CI; Windows runs deterministic D1 projection smoke only."
      : undefined;

  return runReleaseGate({
    gate: "default",
    reportDir: releaseReportDir,
    steps: [
      {
        id: "release-tests",
        label: "Release gate unit tests",
        run: () => runCommand(npm, ["run", "test:release-gate"]),
      },
      {
        id: "golden-dataset",
        label: "Golden dataset contract",
        run: () => runCommand(npm, ["run", "test:golden-dataset"]),
      },
      {
        id: "web-lint",
        label: "Web lint",
        run: () => runCommand(npm, ["run", "lint:web"]),
      },
      {
        id: "web-typecheck",
        label: "Web typecheck",
        run: () => runCommand(npm, ["run", "typecheck:web"]),
      },
      {
        id: "web-build",
        label: "Web production build",
        dependsOn: ["web-lint", "web-typecheck"],
        run: () => runCommand(npm, ["run", "build:web"]),
      },
      {
        id: "map-visualization-budget",
        label: "Map visualization chunk budget",
        dependsOn: ["web-build"],
        run: () => runCommand(npm, ["run", "check:map-visualization-budget"]),
      },
      {
        id: "editorial-home-budget",
        label: "Editorial Home performance budget",
        dependsOn: ["web-build"],
        run: () => runCommand(npm, ["run", "check:editorial-home-budget"]),
      },
      {
        id: "my-pandas-budget",
        label: "My Pandas performance budget",
        dependsOn: ["web-build"],
        run: () => runCommand(npm, ["run", "check:my-pandas-budget"]),
      },
      {
        id: "beta-hard-gates",
        label: "Beta trust, privacy, and release consistency preflight",
        dependsOn: ["golden-dataset", "web-build"],
        run: () => runCommand(npm, ["run", "check:beta-hard-gates"]),
      },
      {
        id: "public-contract",
        label: "Public API boundary contract",
        run: () => runCommand(npm, ["run", "check:public-api-boundary"]),
      },
      {
        id: "worker-typecheck",
        label: "Worker typecheck",
        run: () => runCommand(npm, ["run", "typecheck:api:cf"]),
      },
      {
        id: "worker-d1-smoke",
        label: "Worker D1 projection smoke",
        dependsOn: ["worker-typecheck"],
        run: () => runCommand(npm, ["run", "smoke:api:cf:d1"]),
      },
      {
        id: "worker-http-smoke",
        label: "Worker HTTP runtime smoke",
        dependsOn: ["worker-d1-smoke"],
        skipReason: workerHttpSkipReason,
        run: () => runCommand(npm, ["run", "smoke:api:cf:http"]),
      },
      {
        id: "api-sync",
        label: "FastAPI locked dependency sync",
        run: () =>
          runCommand(uv, ["sync", "--frozen", "--extra", "dev", "--python", "3.12"], {
            cwd: apiDir,
            env: apiReleaseEnv,
          }),
      },
      {
        id: "release-recovery-drill",
        label: "Immutable release rollback and D1 rebuild drill",
        dependsOn: ["api-sync", "beta-hard-gates"],
        run: () =>
          runCommand(
            uv,
            [...uvRunPrefix, "python", "scripts/run_release_recovery_drill.py"],
            {
              cwd: apiDir,
              env: apiReleaseEnv,
            },
          ),
      },
      {
        id: "api-compile",
        label: "FastAPI compile",
        dependsOn: ["api-sync"],
        run: () =>
          runCommand(uv, [...uvRunPrefix, "python", "-m", "compileall", "app"], {
            cwd: apiDir,
            env: apiReleaseEnv,
          }),
      },
      {
        id: "api-lint",
        label: "FastAPI Ruff",
        dependsOn: ["api-sync"],
        run: () =>
          runCommand(uv, [...uvRunPrefix, "ruff", "check", "app", "tests", "scripts"], {
            cwd: apiDir,
            env: apiReleaseEnv,
          }),
      },
      {
        id: "api-tests",
        label: "FastAPI tests",
        dependsOn: ["api-sync"],
        run: () =>
          runCommand(uv, [...uvRunPrefix, "pytest", "-q"], {
            cwd: apiDir,
            env: apiReleaseEnv,
          }),
      },
      {
        id: "api-openapi",
        label: "FastAPI OpenAPI contract",
        dependsOn: ["api-sync"],
        run: () =>
          runCommand(uv, [...uvRunPrefix, "python", "scripts/check_openapi_contract.py"], {
            cwd: apiDir,
            env: apiReleaseEnv,
          }),
      },
      {
        id: "api-public-smoke",
        label: "FastAPI public HTTP smoke",
        dependsOn: ["api-compile", "api-tests", "api-openapi"],
        run: () => runPublicApiSmoke(uv),
      },
      {
        id: "browser-runtime",
        label: "Playwright browser runtime",
        dependsOn: ["web-build"],
        run: () =>
          runEnvironmentCheck(npm, ["run", "check:browser", "-w", "web"], {
            env: playwrightEnv,
          }),
      },
      {
        id: "web-accessibility",
        label: "Automated core WCAG checks",
        dependsOn: ["web-build", "browser-runtime"],
        run: () =>
          runCommand(npm, ["run", "test:accessibility", "-w", "web"], {
            env: playwrightEnv,
          }),
      },
      {
        id: "web-browser-smoke",
        label: "Web production browser smoke",
        dependsOn: ["web-build", "browser-runtime", "web-accessibility"],
        run: () => runCommand(npm, ["run", "smoke:web"], { env: playwrightEnv }),
      },
    ],
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDefaultReleaseGate().catch((error) => {
    if (!(error instanceof ReleaseGateError)) {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}
