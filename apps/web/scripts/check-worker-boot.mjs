// Boots the built Web Worker (.cloudflare/output) in local workerd and requires /zh/terms to render.
// Catches Workers startup failures the production build does not: Vite can emit a top-level
// `Could not resolve "..."` throw for an optional peer, and workerd evaluates it while validating
// the script (Cloudflare API error 10021). /zh/terms is local legal copy, so the check does not
// need the API. Run `npm run build:cloudflare` first.
import { spawn, spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(webRoot, ".cloudflare", "output");
const port = Number(process.env.WORKER_BOOT_PORT ?? 8798);
const failurePattern = /ERR_RUNTIME_FAILURE|Could not resolve|Uncaught Error/u;
const unresolvedImport = 'Could not resolve "';

async function assertBundleResolvesImports() {
  let files;
  try {
    files = await readdir(outputRoot, { recursive: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error("Web Worker build output is missing. Run npm run build:cloudflare -w web first.");
    }
    throw error;
  }
  const scripts = files.filter((file) => file.endsWith(".js"));
  if (scripts.length === 0) throw new Error("Web Worker build output has no JavaScript modules.");
  const unresolved = [];
  for (const file of scripts) {
    const source = await readFile(path.join(outputRoot, file), "utf8");
    if (source.includes(unresolvedImport)) unresolved.push(file);
  }
  if (unresolved.length > 0) {
    throw new Error(`Built Web Worker still has an unresolved import stub in ${unresolved.join(", ")}.`);
  }
}

function startPreview() {
  const viteCli = path.join(path.dirname(fileURLToPath(import.meta.resolve("vite"))), "../../bin/vite.js");
  const preview = spawn(
    process.execPath,
    [viteCli, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--mode", "production"],
    {
      cwd: webRoot,
      detached: process.platform !== "win32",
      windowsHide: true,
    },
  );
  let output = "";
  preview.stdout.on("data", (chunk) => { output += chunk; });
  preview.stderr.on("data", (chunk) => { output += chunk; });
  return {
    preview,
    readOutput: () => output,
    stop() {
      if (preview.exitCode !== null) return;
      try {
        if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(preview.pid), "/T", "/F"], { stdio: "ignore" });
        else process.kill(-preview.pid, "SIGTERM");
      } catch {
        // The preview process has already exited.
      }
    },
  };
}

async function check(session) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const output = session.readOutput();
    if (failurePattern.test(output)) throw new Error("Web Worker failed to boot in workerd.");
    if (session.preview.exitCode !== null) throw new Error(`vite preview exited with code ${session.preview.exitCode}.`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/zh/terms`);
      const body = await response.text();
      if (failurePattern.test(session.readOutput()) || body.includes(unresolvedImport)) {
        throw new Error("Web Worker failed to boot in workerd.");
      }
      if (response.status === 200 && body.includes("<html")) return response.status;
      throw new Error(`Unexpected /zh/terms response ${response.status}: ${body.slice(0, 200)}`);
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith("Unexpected /zh/terms") || error.message.startsWith("Web Worker failed"))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("Timed out waiting for the Web Worker to render /zh/terms.");
}

let session;
try {
  await assertBundleResolvesImports();
  session = startPreview();
  const status = await check(session);
  console.log(`[worker-boot] Web Worker booted in workerd; /zh/terms -> ${status}`);
} catch (error) {
  console.error(`[worker-boot] ${error instanceof Error ? error.message : String(error)}`);
  if (session) console.error(session.readOutput().slice(-4_000));
  process.exitCode = 1;
} finally {
  session?.stop();
}
