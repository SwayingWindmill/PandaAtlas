import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runCommand } from "./command-runner.mjs";
import { SCHEMA_SNAPSHOT_RELATIVE_PATH, dumpDbSchema } from "./dump-db-schema.mjs";
import { captureGeneratedOutputs, settleGeneratedOutputs } from "./generated-output-drift.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const generatedDirectory = path.join(repoRoot, "services/api/src/platform/database");
const generatedNamePattern = /^database\..+\.generated\.ts$/u;
const localDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function generatedPaths() {
  const paths = (await readdir(generatedDirectory))
    .filter((name) => generatedNamePattern.test(name))
    .sort()
    .map((name) => path.join("services/api/src/platform/database", name).replaceAll("\\", "/"));
  if (existsSync(path.join(repoRoot, SCHEMA_SNAPSHOT_RELATIVE_PATH))) {
    paths.push(SCHEMA_SNAPSHOT_RELATIVE_PATH);
  }
  return paths.sort();
}

const beforePaths = await generatedPaths();
const before = await captureGeneratedOutputs(repoRoot, beforePaths);

await runCommand("npm", ["run", "db:types", "-w", "@zhipanda/api"], {
  env: { DATABASE_URL: localDatabaseUrl },
});
await dumpDbSchema({ repoRoot, databaseUrl: localDatabaseUrl });

const afterPaths = await generatedPaths();
const after = await captureGeneratedOutputs(repoRoot, afterPaths);
const allPaths = [...new Set([...beforePaths, ...afterPaths])].sort();
const drifted = await settleGeneratedOutputs(repoRoot, before, after, allPaths);

if (drifted.length > 0) {
  console.error("[api-db-types] generated database type or schema snapshot drift detected:");
  for (const relativePath of drifted) console.error(`- ${relativePath}`);
  console.error("[api-db-types] regenerated files were left in place for review.");
  process.exitCode = 1;
} else {
  console.log("[api-db-types] generated Kysely database types and schema snapshot are current.");
}
