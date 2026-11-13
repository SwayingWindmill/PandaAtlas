// Runs before `npm run infra:start`. On Windows, Hyper-V and WinNAT reserve blocks of ports out of
// the TCP dynamic range (49152-65535 by default), and a reserved port cannot be bound, so local
// Supabase fails to start with "ports are not available". Elsewhere there is nothing to check.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Every `port` in the config. A section with `enabled = false` can still need its port: the Data
 * API is off, yet Auth answers on the [api] gateway port.
 */
export function configuredPorts(configToml) {
  return [...configToml.matchAll(/^\s*port\s*=\s*(\d+)\s*(?:#.*)?$/gm)].map((match) => Number(match[1]));
}

export function reservedRanges(netshOutput) {
  return [...netshOutput.matchAll(/^\s*(\d+)\s+(\d+)\s*\*?\s*$/gm)].map((match) => [Number(match[1]), Number(match[2])]);
}

export function blockedPorts(ports, ranges) {
  return ports.filter((port) => ranges.some(([start, end]) => port >= start && port <= end));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href && process.platform === "win32") {
  const ports = configuredPorts(readFileSync(new URL("../../infra/supabase/config.toml", import.meta.url), "utf8"));
  const ranges = ["ipv4", "ipv6"].flatMap((family) =>
    reservedRanges(execFileSync("netsh", ["interface", family, "show", "excludedportrange", "protocol=tcp"], { encoding: "utf8" })),
  );
  const blocked = blockedPorts(ports, ranges);
  if (blocked.length > 0) {
    console.error(`Windows has reserved local Supabase port(s) ${blocked.join(", ")}, so infra:start would fail.`);
    console.error("Windows reserves ports out of its dynamic range. Move that range above every port this repo uses,");
    console.error("once, in an administrator PowerShell, then reboot:");
    console.error("  netsh int ipv4 set dynamic tcp start=60000 num=5536");
    console.error("  netsh int ipv6 set dynamic tcp start=60000 num=5536");
    console.error("Until then (administrator): `net stop winnat`, run `npm run infra:start`, then `net start winnat`.");
    process.exit(1);
  }
}
