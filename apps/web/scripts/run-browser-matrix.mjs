import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const command = isWindows ? process.env.ComSpec ?? "cmd.exe" : "npm";
const args = isWindows
  ? ["/d", "/s", "/c", "npm exec playwright -- test"]
  : ["exec", "playwright", "--", "test"];
const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSER_MATRIX: "1",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) console.error(`Browser matrix stopped by ${signal}`);
  process.exitCode = code ?? 1;
});
