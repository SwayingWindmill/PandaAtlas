import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("pull requests run changed-scope development verification and real API integration", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github", "workflows", "development-verification.yml"),
    "utf8",
  );

  assert.match(workflow, /services\/api\/\*\*/);
  assert.match(workflow, /packages\/api-client\/\*\*/);
  assert.match(workflow, /infra\/supabase\/\*\*/);
  assert.match(workflow, /npm run verify:dev -- --base origin\/\$\{\{ github\.base_ref \}\}/);
  assert.match(workflow, /npm run infra:start/);
  assert.match(workflow, /npm run ops -- run api\.integration/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /npm run infra:stop/);
});
