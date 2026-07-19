import { spawn } from "node:child_process";
import process from "node:process";

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(command, ["exec", "playwright", "--", "test"], {
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
