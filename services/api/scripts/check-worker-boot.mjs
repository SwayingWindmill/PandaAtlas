// Boots the built API Worker (.cloudflare/output) in local workerd and requires the application's
// own /health response. Catches Workers-only startup failures such as an unsettled top-level await,
// which unit tests running on Node cannot see (#524). It then requires a failing /ready request to
// write its structured error entry to the Worker's console, which is what Workers Logs ingests (#559).
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.WORKER_BOOT_PORT ?? 8799);
const deadline = Date.now() + 90_000;
const failurePattern = /unsettled|ERR_RUNTIME_FAILURE|Uncaught Error/u;

const viteCli = path.join(path.dirname(fileURLToPath(import.meta.resolve("vite"))), "../../bin/vite.js");
const preview = spawn(process.execPath, [viteCli, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: apiRoot,
  detached: process.platform !== "win32",
  windowsHide: true,
  env: {
    ...process.env,
    // Startup must not need the database; any unreachable URL satisfies the Hyperdrive binding.
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: "postgresql://boot:boot@127.0.0.1:1/boot",
  },
});

let output = "";
preview.stdout.on("data", (chunk) => { output += chunk; });
preview.stderr.on("data", (chunk) => { output += chunk; });

function stopPreview() {
  if (preview.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(preview.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-preview.pid, "SIGTERM");
}

async function check() {
  while (Date.now() < deadline) {
    if (failurePattern.test(output)) throw new Error("API Worker failed to boot in workerd.");
    if (preview.exitCode !== null) throw new Error(`vite preview exited with code ${preview.exitCode}.`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const body = await response.text();
      if (response.status === 200 && body === JSON.stringify({ status: "ok" })) return body;
      throw new Error(`Unexpected /health response ${response.status}: ${body.slice(0, 200)}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unexpected /health")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error("Timed out waiting for the API Worker to serve /health.");
}

// The boot database is unreachable, so /ready fails and must log one entry carrying its request id.
async function checkFailureLogged() {
  const response = await fetch(`http://127.0.0.1:${port}/ready`);
  await response.text();
  const requestId = response.headers.get("x-request-id");
  if (response.status !== 503 || requestId === null) {
    throw new Error(`Unexpected /ready response ${response.status} (request id ${requestId}).`);
  }
  while (Date.now() < deadline) {
    if (output.includes(requestId) && output.includes("Request failed")) return requestId;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The failed /ready request ${requestId} was not logged to the Worker console.`);
}

try {
  const body = await check();
  console.log(`[worker-boot] API Worker booted in workerd; /health -> ${body}`);
  const requestId = await checkFailureLogged();
  console.log(`[worker-boot] failed /ready request ${requestId} was logged to the Worker console`);
} catch (error) {
  console.error(`[worker-boot] ${error instanceof Error ? error.message : String(error)}`);
  console.error(output.slice(-4_000));
  process.exitCode = 1;
} finally {
  stopPreview();
}
