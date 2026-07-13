import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const HOST = "127.0.0.1";
const PORT = "8787";
const BASE_URL = `http://${HOST}:${PORT}`;
const PERSIST_PATH = ".wrangler/smoke-state";

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "null"}${signal ? ` (${signal})` : ""}`));
    });
  });
}

async function waitForServer(child) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Worker exited before becoming ready with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for Worker: ${String(lastError)}`);
}

async function expectJson(path, expectedStatus, init) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  }
  return payload;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    await runCommand("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function main() {
  const wranglerBin = path.resolve(process.cwd(), "../../node_modules/wrangler/bin/wrangler.js");
  const d1Args = [wranglerBin, "d1", "execute", "panda-atlas", "--local", "--persist-to", PERSIST_PATH];

  await runCommand(process.execPath, [...d1Args, "--file=../../infra/cloudflare/d1/schema.sql"]);
  await runCommand(process.execPath, [...d1Args, "--file=../../infra/cloudflare/d1/seed.sql"]);

  if (process.platform === "win32") {
    console.warn(
      "D1 schema and seed smoke checks passed. Skipping the HTTP Worker runtime on Windows because workerd currently terminates during native startup; Linux CI runs the complete HTTP smoke flow."
    );
    return;
  }

  const worker = spawn(
    process.execPath,
    [
      wranglerBin,
      "dev",
      "--local",
      "--host",
      HOST,
      "--port",
      PORT,
      "--persist-to",
      PERSIST_PATH,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );

  try {
    await waitForServer(worker);

    const health = await expectJson("/health", 200);
    if (health?.db !== "ok") {
      throw new Error(`Worker health did not report db=ok: ${JSON.stringify(health)}`);
    }

    const pandas = await expectJson("/api/v1/pandas?page_size=3", 200);
    if (!Array.isArray(pandas?.items) || pandas.items.length === 0) {
      throw new Error("Worker panda list smoke response was empty");
    }

    const distribution = await expectJson(
      "/api/v1/map/distribution?bbox=100,25,110,36&layer=wild&zoom=4",
      200
    );
    if (distribution?.meta?.limit !== 1500 || distribution.meta.requested_zoom !== 4) {
      throw new Error("Unexpected distribution metadata: " + JSON.stringify(distribution?.meta));
    }
    await expectJson("/api/v1/admin/import-sources", 404);
    await expectJson("/api/v1/admin/import-jobs", 404, {
      method: "POST",
      headers: {
        Authorization: "Bearer ignored-on-read-projection",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source_name: "must-not-execute.sql" }),
    });

    console.log("Cloudflare Worker smoke test passed");
  } finally {
    await stopProcess(worker);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
