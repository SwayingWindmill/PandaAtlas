import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const codegraphArgs = process.argv.slice(2);
const require = createRequire(import.meta.url);

if (codegraphArgs.length === 0) {
  console.error("Usage: node scripts/codegraph.mjs <codegraph command> [...args]");
  process.exitCode = 2;
} else {
  let cliPath;
  try {
    const packagePath = require.resolve("@colbymchenry/codegraph/package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    cliPath = path.resolve(path.dirname(packagePath), packageJson.bin.codegraph);
  } catch (error) {
    console.error("The local CodeGraph CLI is unavailable. Run `npm ci` from the repository root.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const child = spawn(process.execPath, [cliPath, ...codegraphArgs], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CODEGRAPH_TELEMETRY: process.env.CODEGRAPH_TELEMETRY ?? "0",
    },
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error(`Unable to start the local CodeGraph CLI: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`CodeGraph exited after signal ${signal}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
}
