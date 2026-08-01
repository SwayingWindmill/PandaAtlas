import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedConfigPaths = ["next-env.d.ts", "tsconfig.json"].map((file) =>
  path.join(webRoot, file),
);

const snapshots = new Map(
  await Promise.all(
    generatedConfigPaths.map(async (file) => [file, await readFile(file)]),
  ),
);

async function restoreGeneratedConfigs() {
  await Promise.all(
    [...snapshots.entries()].map(([file, content]) => writeFile(file, content)),
  );
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        playwrightCli,
        "test",
        "--config",
        "playwright.admin.config.ts",
        ...process.argv.slice(2),
      ],
      {
        cwd: webRoot,
        env: process.env,
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Admin Playwright exited from signal ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

let exitCode = 1;
try {
  exitCode = await runPlaywright();
} finally {
  await restoreGeneratedConfigs();
}

process.exitCode = exitCode;
