import { existsSync as fileExists } from "node:fs";
import path from "node:path";
import process from "node:process";

import { EnvironmentBlockedError } from "../gate-core.mjs";

export const PLAYWRIGHT_PRODUCTION_ENVIRONMENT = Object.freeze({
  PLAYWRIGHT_WEB_SERVER_MODE: "production",
  PLAYWRIGHT_REUSE_EXISTING_SERVER: "0",
  PLAYWRIGHT_NEXT_DIST_DIR: ".next",
});

export function environmentFlag(name, { env = process.env } = {}) {
  return (env[name] ?? "0").trim().toLowerCase() === "1";
}

export function requireEnvironmentValue(
  name,
  { enabledBy, env = process.env } = {},
) {
  const value = env[name];
  if (!value) {
    const prefix = enabledBy ? `${enabledBy}=1 requires ` : "Required environment value is missing: ";
    throw new EnvironmentBlockedError(`${prefix}${name}${enabledBy ? " to be set" : ""}`);
  }
  return value;
}

export function resolvePlaywrightEnvironment({
  env = process.env,
  platform = process.platform,
  existsSync = fileExists,
} = {}) {
  const resolved = { ...PLAYWRIGHT_PRODUCTION_ENVIRONMENT };
  if (env.PLAYWRIGHT_BROWSER_CHANNEL) {
    return { ...resolved, PLAYWRIGHT_BROWSER_CHANNEL: env.PLAYWRIGHT_BROWSER_CHANNEL };
  }
  if (platform !== "win32" || env.RELEASE_GATE_USE_SYSTEM_EDGE === "0") {
    return resolved;
  }

  const edgeCandidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    env.LOCALAPPDATA
      ? path.win32.join(env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe")
      : null,
  ].filter(Boolean);

  return edgeCandidates.some((candidate) => existsSync(candidate))
    ? { ...resolved, PLAYWRIGHT_BROWSER_CHANNEL: "msedge" }
    : resolved;
}
