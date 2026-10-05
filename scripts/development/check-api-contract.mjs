import process from "node:process";
import { fileURLToPath } from "node:url";

import { runCommand } from "./command-runner.mjs";
import { captureGeneratedOutputs, settleGeneratedOutputs } from "./generated-output-drift.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const generatedPaths = [
  "services/api/openapi/panda-atlas-v2.json",
  "packages/api-client/src/schema.generated.ts",
];

const before = await captureGeneratedOutputs(repoRoot, generatedPaths);

await runCommand("npm", ["run", "openapi:generate", "-w", "@zhipanda/api"]);
await runCommand("npm", ["run", "generate", "-w", "@zhipanda/api-client"]);

const after = await captureGeneratedOutputs(repoRoot, generatedPaths);
const drifted = await settleGeneratedOutputs(repoRoot, before, after, generatedPaths);

if (drifted.length > 0) {
  console.error("[api-contract] generated contract drift detected:");
  for (const relativePath of drifted) console.error(`- ${relativePath}`);
  console.error("[api-contract] regenerated files were left in place for review.");
  process.exitCode = 1;
} else {
  console.log("[api-contract] OpenAPI and generated API client are current.");
}
