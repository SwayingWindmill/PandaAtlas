import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runCommand } from "./command-runner.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const generatedPaths = [
  "services/api/openapi/panda-atlas-v2.json",
  "packages/api-client/src/schema.generated.ts",
];

async function readGeneratedOutputs() {
  return new Map(await Promise.all(generatedPaths.map(async (relativePath) => [
    relativePath,
    (await readFile(path.join(repoRoot, relativePath), "utf8")).replaceAll("\r\n", "\n"),
  ])));
}

const before = await readGeneratedOutputs();

await runCommand("npm", ["run", "openapi:generate", "-w", "@zhipanda/api"]);
await runCommand("npm", ["run", "generate", "-w", "@zhipanda/api-client"]);

const after = await readGeneratedOutputs();
const drifted = generatedPaths.filter((relativePath) => before.get(relativePath) !== after.get(relativePath));

if (drifted.length > 0) {
  console.error("[api-contract] generated contract drift detected:");
  for (const relativePath of drifted) console.error(`- ${relativePath}`);
  console.error("[api-contract] regenerated files were left in place for review.");
  process.exitCode = 1;
} else {
  console.log("[api-contract] OpenAPI and generated API client are current.");
}
