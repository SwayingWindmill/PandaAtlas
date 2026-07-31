import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateZhiPandaBrandClosure } from "../check-zhipanda-brand-closure.mjs";

const evidencePath = new URL("../../../data/frontend-evidence/issue-220.json", import.meta.url);

async function writeEvidence(mutator) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "zhipanda-brand-closure-"));
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  mutator(evidence);
  const output = path.join(directory, "issue-220.json");
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return output;
}

test("ZhiPanda brand closure evidence matches the public and compatibility contract", async () => {
  assert.deepEqual(await validateZhiPandaBrandClosure(), []);
});

test("ZhiPanda brand closure rejects an incomplete public surface group", async () => {
  const evidenceFile = await writeEvidence((evidence) => {
    evidence.public_surface_groups.email_identity = "FAIL";
  });

  const errors = await validateZhiPandaBrandClosure({ evidenceFile });
  assert.ok(errors.includes("public_surface_groups.email_identity must equal PASS"));
});

test("ZhiPanda brand closure requires immutable Staging deployment evidence", async () => {
  const evidenceFile = await writeEvidence((evidence) => {
    evidence.artifact.staging_worker_version = null;
    evidence.staging.checks.no_javascript = "BLOCKED";
  });

  const errors = await validateZhiPandaBrandClosure({ evidenceFile });
  assert.ok(errors.includes("artifact.staging_worker_version must be a deployment UUID"));
  assert.ok(errors.includes("staging.checks.no_javascript must equal PASS"));
});
