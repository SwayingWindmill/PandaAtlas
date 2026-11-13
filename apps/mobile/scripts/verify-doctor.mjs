// Read-only check that this checkout can launch the app for verification, and that nothing else
// already holds the ports. Run it first, and again whenever a launch or a drive looks wrong.
//   node apps/mobile/scripts/verify-doctor.mjs [--mode e2e|preview]
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

import { blockedPorts, configuredPorts, reservedRanges } from "../../../scripts/development/check-local-ports.mjs";

const mobileRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(mobileRoot, "../..");
const mode = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : "e2e";
const PORTS = { e2e: [3101, 8792], preview: [8796, 8797] };
if (!(mode in PORTS)) {
  console.error(`Unknown --mode ${mode}; use e2e or preview.`);
  process.exit(2);
}

const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

// A junctioned node_modules resolves Expo Router into another checkout, and the app then opens on
// "Welcome to Expo" instead of this checkout's routes.
try {
  const resolve = createRequire(path.join(mobileRoot, "package.json")).resolve;
  const root = realpathSync(repoRoot).toLowerCase() + path.sep;
  const outside = ["expo", "expo-router", "react-native"]
    .map((name) => realpathSync(resolve(`${name}/package.json`)))
    .find((file) => !file.toLowerCase().startsWith(root));
  check("dependencies", !outside, outside ? `${outside} is outside this checkout; run npm ci here` : "installed in this checkout");
} catch {
  check("dependencies", false, "node_modules is missing; run npm ci at the repo root");
}

function free(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}
/** The process listening on a port, as "pid <n>: <command line>", so a leftover can be told apart. */
function holder(port) {
  try {
    if (process.platform === "win32") {
      const script = `$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction Stop | Select-Object -First 1; $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"; "pid $($p.ProcessId): $($p.CommandLine)"`;
      return execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim();
    }
    const pid = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).trim().split("\n")[0];
    return `pid ${pid}: ${execFileSync("ps", ["-o", "command=", "-p", pid], { encoding: "utf8" }).trim()}`;
  } catch {
    return "owner unknown";
  }
}
for (const port of PORTS[mode]) {
  const ok = await free(port);
  check(`port ${port}`, ok, ok ? "free" : `in use by ${holder(port)}`);
}

if (mode === "e2e") {
  if (process.platform === "win32") {
    const config = readFileSync(path.join(repoRoot, "infra/supabase/config.toml"), "utf8");
    const ranges = ["ipv4", "ipv6"].flatMap((family) =>
      reservedRanges(execFileSync("netsh", ["interface", family, "show", "excludedportrange", "protocol=tcp"], { encoding: "utf8" })),
    );
    const blocked = blockedPorts(configuredPorts(config), ranges);
    check("supabase ports", blocked.length === 0, blocked.length === 0 ? "not reserved by Windows" : `Windows reserved ${blocked.join(", ")}; see npm run infra:start for the fix`);
  }
  let docker = false;
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    docker = true;
  } catch {}
  check("docker", docker, docker ? "running" : "not running; start Docker Desktop");
  if (docker) {
    try {
      const status = JSON.parse(
        execFileSync("npx", ["supabase", "status", "-o", "json", "--workdir", "infra"], { cwd: repoRoot, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "ignore"] }),
      );
      check("supabase", Boolean(status.DB_URL), `database at ${status.DB_URL}`);
    } catch {
      check("supabase", false, "not running; npm run infra:start");
    }
  }
}

for (const { name, ok, detail } of results) console.log(`${ok ? "ok  " : "FAIL"}  ${name}: ${detail}`);
process.exit(results.every((result) => result.ok) ? 0 : 1);
