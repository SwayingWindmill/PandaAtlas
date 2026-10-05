import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { repoRoot } from "./catalog.mjs";
import { resolveDevelopmentInvocation, runDevelopmentCommand } from "./operations.mjs";

const WEB_HOST = "127.0.0.1";
const WEB_PORT = 3400;
const API_HOST = "127.0.0.1";
const API_PORT = 3001;
const WEB_ORIGIN = `http://${WEB_HOST}:${WEB_PORT}`;
const API_ORIGIN = `http://${API_HOST}:${API_PORT}`;
const READY_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 500;
const RUNTIME_STATE_DIRECTORY = path.join(repoRoot, ".devspace-local");
const RUNTIME_STATE_PATH = path.join(RUNTIME_STATE_DIRECTORY, "admin-runtime.json");
const STOP_REQUEST_PATH = path.join(RUNTIME_STATE_DIRECTORY, "admin-runtime.stop");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mergeNoProxy(current) {
  return [...new Set(["127.0.0.1", "localhost", ...(current ?? "").split(",").filter(Boolean)])].join(",");
}

function parseJsonPayload(output) {
  const start = output.indexOf("{");
  if (start < 0) throw new Error("Supabase status did not return JSON output");
  return JSON.parse(output.slice(start));
}

async function runCaptured(command, args) {
  const invocation = resolveDevelopmentInvocation(command, args);
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd: repoRoot,
      env: process.env,
      shell: invocation.shell,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} stopped by signal ${signal}`));
        return;
      }
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function readSupabaseStatus() {
  const result = await runCaptured("npx", [
    "--yes",
    "supabase@2.110.0",
    "status",
    "--workdir",
    "infra",
    "-o",
    "json",
  ]);
  if (result.code !== 0 && !result.stdout.includes("{")) {
    throw new Error(`Unable to read local Supabase status: ${result.stderr.trim() || `exit ${result.code}`}`);
  }
  const status = parseJsonPayload(result.stdout);
  for (const key of ["API_URL", "DB_URL", "PUBLISHABLE_KEY"]) {
    if (typeof status[key] !== "string" || status[key].length === 0) {
      throw new Error(`Supabase status is missing ${key}`);
    }
  }
  return status;
}

async function probe(url, timeoutMs = 1_500) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

async function waitForUrl(label, url) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await probe(url)) return;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`${label} did not become ready within ${READY_TIMEOUT_MS / 1000}s: ${url}`);
}

async function readRuntimeState() {
  try {
    return JSON.parse(await readFile(RUNTIME_STATE_PATH, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeRuntimeState(state) {
  await mkdir(RUNTIME_STATE_DIRECTORY, { recursive: true });
  await writeFile(RUNTIME_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function removeRuntimeState() {
  await rm(RUNTIME_STATE_PATH, { force: true });
}

async function writeStopRequest() {
  await mkdir(RUNTIME_STATE_DIRECTORY, { recursive: true });
  await writeFile(STOP_REQUEST_PATH, "stop\n", "utf8");
}

async function removeStopRequest() {
  await rm(STOP_REQUEST_PATH, { force: true });
}

async function stopWasRequested() {
  try {
    await readFile(STOP_REQUEST_PATH, "utf8");
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function assertPortAvailable(label, host, port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      reject(new Error(`${label} cannot start because ${host}:${port} is already in use (${error.code ?? error.message})`));
    });
    server.listen({ host, port }, () => server.close(resolve));
  });
}

function spawnNpm(args, env) {
  const invocation = resolveDevelopmentInvocation("npm", args);
  return spawn(invocation.executable, invocation.args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    shell: invocation.shell,
    stdio: "inherit",
    windowsHide: false,
  });
}

async function terminatePidTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    const result = await runCaptured("taskkill", ["/PID", String(pid), "/T", "/F"]);
    let stillExists = true;
    try {
      process.kill(pid, 0);
    } catch {
      stillExists = false;
    }
    if (result.code !== 0 && stillExists) {
      console.warn(`[admin:dev] taskkill warning: ${result.stderr.trim()}`);
    }
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function terminateChildTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await terminatePidTree(child.pid);
}

function childExitPromise(label, child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ label, code, signal }));
  });
}

async function ensureFoundation() {
  let status;
  try {
    status = await readSupabaseStatus();
    const healthUrl = `${status.API_URL.replace(/\/$/u, "")}/auth/v1/health`;
    if (await probe(healthUrl)) return status;
  } catch {
    status = undefined;
  }

  console.log("[admin:dev] Starting pinned local Supabase foundation...");
  await runDevelopmentCommand("foundation.start");
  status = await readSupabaseStatus();
  await waitForUrl("Supabase", `${status.API_URL.replace(/\/$/u, "")}/auth/v1/health`);
  return status;
}

function runtimeEnvironment(status) {
  const noProxy = mergeNoProxy(process.env.NO_PROXY);
  return {
    api: {
      APP_ENV: "development",
      HOST: API_HOST,
      PORT: String(API_PORT),
      DATABASE_URL: status.DB_URL,
      SUPABASE_URL: status.API_URL,
      CORS_ALLOW_ORIGINS: WEB_ORIGIN,
      NO_PROXY: noProxy,
      no_proxy: mergeNoProxy(process.env.no_proxy),
    },
    web: {
      ADMIN_SHELL_ENABLED: "true",
      API_BASE_URL: API_ORIGIN,
      NEXT_PUBLIC_API_BASE_URL: API_ORIGIN,
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
      NO_PROXY: noProxy,
      no_proxy: mergeNoProxy(process.env.no_proxy),
    },
  };
}

async function printStatus() {
  let supabaseOrigin = "http://127.0.0.1:54321";
  try {
    const status = await readSupabaseStatus();
    supabaseOrigin = status.API_URL.replace(/\/$/u, "");
  } catch {
    // A fully stopped Supabase stack may not have containers to inspect. Probe the pinned local endpoint below.
  }

  const checks = [
    ["Supabase", `${supabaseOrigin}/auth/v1/health`],
    ["NestJS API", `${API_ORIGIN}/health`],
    ["Admin Web", `${WEB_ORIGIN}/admin`],
  ];
  let healthy = true;
  for (const [label, url] of checks) {
    const ready = await probe(url);
    healthy &&= ready;
    console.log(`[admin:status] ${label}: ${ready ? "ready" : "down"} | ${url}`);
  }
  console.log(`[admin:status] 后台入口: ${WEB_ORIGIN}/admin`);
  if (!healthy) process.exitCode = 1;
}

async function stopAdminRuntime() {
  const state = await readRuntimeState();
  if (state) await writeStopRequest();
  try {
    if (state) {
      console.log("[admin:stop] Stopping recorded Web/API process trees...");
      await Promise.all([
        terminatePidTree(state.webPid),
        terminatePidTree(state.apiPid),
      ]);
      await removeRuntimeState();
    } else {
      console.log("[admin:stop] No recorded Web/API runtime state found.");
    }

    console.log("[admin:stop] Stopping local Supabase foundation...");
    await runDevelopmentCommand("foundation.stop");
    console.log("[admin:stop] Local admin runtime stopped.");
  } finally {
    await removeStopRequest();
  }
}

async function runAdminRuntime() {
  await removeStopRequest();
  const existingState = await readRuntimeState();
  if (existingState) {
    const [apiReady, webReady] = await Promise.all([
      probe(`${API_ORIGIN}/health`),
      probe(`${WEB_ORIGIN}/admin`),
    ]);
    if (apiReady && webReady) {
      console.log("[admin:dev] Local admin runtime is already ready.");
      console.log(`[admin:dev] 后台首页: ${WEB_ORIGIN}/admin`);
      console.log("[admin:dev] Use `npm run stop:admin` before starting a fresh runtime.");
      return;
    }
    console.log("[admin:dev] Found interrupted runtime state; cleaning recorded Web/API processes...");
    await Promise.all([
      terminatePidTree(existingState.webPid),
      terminatePidTree(existingState.apiPid),
    ]);
    await removeRuntimeState();
    await sleep(500);
  }

  await assertPortAvailable("NestJS API", API_HOST, API_PORT);
  await assertPortAvailable("Web", WEB_HOST, WEB_PORT);

  const foundationStatus = await ensureFoundation();
  const env = runtimeEnvironment(foundationStatus);
  const children = [];
  let stopping = false;

  async function cleanup() {
    if (stopping) return;
    stopping = true;
    await Promise.all(children.map(({ child }) => terminateChildTree(child)));
    await removeRuntimeState();
  }

  try {
    console.log("[admin:dev] Starting NestJS API on http://127.0.0.1:3001 ...");
    const api = spawnNpm(["run", "dev", "-w", "@zhipanda/api"], env.api);
    children.push({ label: "NestJS API", child: api });
    const apiExit = childExitPromise("NestJS API", api);

    console.log("[admin:dev] Starting Web on http://127.0.0.1:3400 ...");
    const web = spawnNpm(
      ["run", "dev", "-w", "web", "--", "--host", WEB_HOST, "--port", String(WEB_PORT)],
      env.web,
    );
    children.push({ label: "Web", child: web });
    const webExit = childExitPromise("Web", web);
    const firstExit = Promise.race([apiExit, webExit]);

    await writeRuntimeState({
      apiPid: api.pid,
      webPid: web.pid,
    });

    const readiness = await Promise.race([
      Promise.all([
        waitForUrl("NestJS API", `${API_ORIGIN}/health`),
        waitForUrl("Admin Web", `${WEB_ORIGIN}/admin`),
      ]).then(() => ({ ready: true })),
      firstExit.then((exit) => ({ ready: false, exit })),
    ]);
    if (!readiness.ready) {
      const currentState = await readRuntimeState();
      if (await stopWasRequested() || !currentState) {
        console.log("[admin:dev] Runtime stopped by `npm run stop:admin` during startup.");
        return;
      }
      const { label, code, signal } = readiness.exit;
      throw new Error(`${label} exited before readiness (code=${code ?? "null"}, signal=${signal ?? "none"})`);
    }

    console.log("\n[admin:dev] Local admin runtime is ready.");
    console.log(`[admin:dev] 后台首页: ${WEB_ORIGIN}/admin`);
    console.log(`[admin:dev] 审核: ${WEB_ORIGIN}/admin/reviews`);
    console.log(`[admin:dev] 内容治理: ${WEB_ORIGIN}/admin/moderation`);
    console.log(`[admin:dev] API health: ${API_ORIGIN}/health`);
    console.log("[admin:dev] Ctrl+C stops Web/API; use `npm run stop:admin` to stop the complete stack.\n");

    const stopSignal = new Promise((resolve) => {
      process.once("SIGINT", () => resolve({ label: "SIGINT", expected: true }));
      process.once("SIGTERM", () => resolve({ label: "SIGTERM", expected: true }));
    });
    const outcome = await Promise.race([
      stopSignal,
      firstExit.then(({ label, code, signal }) => ({ label, code, signal, expected: false })),
    ]);
    if (!outcome.expected) {
      const currentState = await readRuntimeState();
      if (await stopWasRequested() || !currentState) {
        console.log("[admin:dev] Runtime stopped by `npm run stop:admin`.");
        return;
      }
      throw new Error(`${outcome.label} stopped unexpectedly (code=${outcome.code ?? "null"}, signal=${outcome.signal ?? "none"})`);
    }
  } finally {
    await cleanup();
  }
}

export async function runLocalAdminRuntime(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === "--status") {
    await printStatus();
    return;
  }
  if (argv.length === 1 && argv[0] === "--stop") {
    await stopAdminRuntime();
    return;
  }
  if (argv.length > 0) throw new Error(`Unknown local admin runtime argument: ${argv.join(" ")}`);
  await runAdminRuntime();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLocalAdminRuntime().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
