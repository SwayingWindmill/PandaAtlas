import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = "8000";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..", "..");
export const apiDir = path.join(repoRoot, "services", "api");
export const apiBaseUrl = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;

function commandName(name) {
  return name;
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

export async function runCommand(command, args, options = {}) {
  const cwd = options.cwd ?? repoRoot;
  const env = { ...process.env, ...options.env };

  console.log(`\n> ${formatCommand(command, args)}`);

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(
        new Error(
          `${formatCommand(command, args)} failed with code ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}`,
        ),
      );
    });
  });
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
  console.log(`\n> ${formatCommand(commandName("uv"), ["run", "uvicorn", "app.main:app", "--host", DEFAULT_HOST, "--port", DEFAULT_PORT])}`);

  const child = spawn(
    commandName("uv"),
    ["run", "uvicorn", "app.main:app", "--host", DEFAULT_HOST, "--port", DEFAULT_PORT],
    {
      cwd: apiDir,
      env: {
        ...process.env,
        DB_USE_MOCK_FALLBACK: "true",
        ...envOverrides,
      },
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  return child;
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
  const exited = Promise.race([waitForExit(child), delay(5000)]);
  await exited;

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
  }
}

export async function runDefaultReleaseGate() {
  const npm = commandName("npm");
  const uv = commandName("uv");
  let apiProcess;

  await runCommand(npm, ["run", "lint:web"]);
  await runCommand(npm, ["run", "typecheck:web"]);
  await runCommand(npm, ["run", "build:web"]);
  await runCommand(npm, ["run", "check:public-api-boundary"]);
  await runCommand(npm, ["run", "typecheck:api:cf"]);
  await runCommand(npm, ["run", "smoke:api:cf"]);

  await runCommand(uv, ["run", "python", "-m", "compileall", "app"], { cwd: apiDir });
  await runCommand(uv, ["run", "ruff", "check", "app", "tests", "scripts"], { cwd: apiDir });
  await runCommand(uv, ["run", "pytest", "-q"], { cwd: apiDir });
  await runCommand(uv, ["run", "python", "scripts/check_openapi_contract.py"], { cwd: apiDir });

  try {
    apiProcess = startApiServer({ DB_USE_MOCK_FALLBACK: "true" });
    await waitForServer(`${apiBaseUrl}/health`, apiProcess);
    await runCommand(uv, ["run", "python", "scripts/smoke_test_public_api.py"], {
      cwd: apiDir,
      env: {
        API_BASE_URL: apiBaseUrl,
      },
    });
  } finally {
    await stopProcess(apiProcess);
  }

  await runCommand(npm, ["run", "smoke:web"]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDefaultReleaseGate().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
