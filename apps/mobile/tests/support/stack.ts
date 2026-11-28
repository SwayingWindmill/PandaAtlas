import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { seedFixture } from "./backend.ts";
import { type Fixture, statePath } from "./fixture.ts";

// The app under test, as e2e.config.ts starts it (`app.command`): the NestJS API on the local Supabase
// database, this run's fixture data, and the Expo web build. e2e has no global setup or second web server, so
// this one process brings them all up and stops them when e2e stops it. Start Supabase first
// (npm run infra:start).
//   node tests/support/stack.ts <app port>

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const mobileRoot = path.resolve(import.meta.dirname, "../..");
const appPort = Number(process.argv[2] ?? 8792);
const apiPort = 3101;
const appOrigin = `http://localhost:${appPort}`;
const windows = process.platform === "win32";

const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json", "--workdir", "infra"], { cwd: repoRoot, encoding: "utf8", shell: true }),
) as { API_URL?: string; DB_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string; MAILPIT_URL: string };
// The Data API is off locally, so status omits API_URL; Auth answers on the gateway port (infra/supabase/config.toml).
const supabaseUrl = status.API_URL ?? "http://127.0.0.1:54321";

const fixtureToken = randomBytes(24).toString("hex");
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;

const apiEnv = {
  APP_ENV: "development",
  HOST: "127.0.0.1",
  PORT: String(apiPort),
  DATABASE_URL: status.DB_URL,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
  CORS_ALLOW_ORIGINS: appOrigin,
  E2E_FIXTURE_TOKEN: fixtureToken,
};

const children: ChildProcess[] = [];

function stop(code: number): never {
  for (const child of children) {
    if (child.pid === undefined || child.exitCode !== null) continue;
    // Expo starts its own workers; on Windows only taskkill /T reaches them.
    if (windows) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, () => stop(0));

/** Starts a Node script directly, not through a shell, so the recorded pid is the server itself. */
function start(script: string, args: string[], cwd: string, env: Record<string, string>): void {
  const command = process.execPath;
  const child = spawn(command, [script, ...args], { cwd, env: { ...process.env, ...env }, stdio: "inherit" });
  child.on("exit", (code) => {
    console.error(`[stack] ${script} ${args.join(" ")} exited with ${code}`);
    stop(code ?? 1);
  });
  children.push(child);
}

async function waitForApi(): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const healthy = await fetch(`http://127.0.0.1:${apiPort}/health`).then(
      (response) => response.ok,
      () => false,
    );
    if (healthy) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The API did not answer on port ${apiPort}.`);
}

// Build the API first, boot the dev/test E2E fixture server, seed via HTTP, then serve the Expo web bundle.
execFileSync("npm", ["run", "build:local", "-w", "@zhipanda/api"], { cwd: repoRoot, stdio: "inherit", shell: true });
start("dist/e2e-fixture-server.js", [], path.join(repoRoot, "services/api"), apiEnv);
try {
  await waitForApi();
  const data = await seedFixture(apiBaseUrl, fixtureToken);
  const state: Fixture = { ...data, mailpitUrl: status.MAILPIT_URL, apiBaseUrl, fixtureToken };
  await writeFile(statePath, JSON.stringify(state), "utf8");
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  stop(1);
}
start(path.join(repoRoot, "node_modules/expo/bin/cli"), ["start", "--web", "--port", String(appPort)], mobileRoot, {
  CI: "1",
  BROWSER: "none",
  EXPO_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
  EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
});

// On Windows e2e ends this process outright, so the signal handlers above never run. A detached watchdog
// takes the API and Expo down with their child processes once this process is gone.
if (windows) {
  const pids = children.flatMap((child) => (child.pid === undefined ? [] : [child.pid]));
  const watchdog = `
    const [parent, ...pids] = process.argv.slice(1).map(Number);
    setInterval(() => {
      try { process.kill(parent, 0); return; } catch {}
      for (const pid of pids) require("node:child_process").spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
      process.exit(0);
    }, 1000);`;
  spawn(process.execPath, ["-e", watchdog, String(process.pid), ...pids.map(String)], { detached: true, stdio: "ignore" }).unref();
}
