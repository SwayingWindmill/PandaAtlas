import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkResearchScriptPolicy,
  normalizeRepositoryPath,
  researchScriptViolation,
  validateResearchBatchManifest,
} from "../check-research-script-policy.mjs";

const contract = {
  schema_version: 1,
  required_fields: [
    "schema_version",
    "batch_id",
    "builder",
    "subjects",
    "sources",
    "operations",
    "dry_run_default",
  ],
  optional_fields: ["description", "metadata"],
  batch_id_pattern: "^\\d{4}-\\d{2}-\\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$",
  builder_pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
  allowed_operations: [
    "discover",
    "collect",
    "validate",
    "build-candidates",
    "repair",
    "enrich",
    "report",
  ],
};

const validManifest = {
  schema_version: 1,
  batch_id: "2026-08-01-vienna-birthday-media",
  builder: "official-media",
  subjects: ["fu-feng", "fu-ban"],
  sources: ["vienna-zoo"],
  operations: ["discover", "validate", "build-candidates"],
  dry_run_default: true,
};

test("normalizes repository paths across platforms", () => {
  assert.equal(
    normalizeRepositoryPath(".\\scripts\\research\\builders\\official_media.py"),
    "scripts/research/builders/official_media.py",
  );
});

test("allows stable modules and archived one-off scripts", () => {
  assert.equal(researchScriptViolation("scripts/research/README.md"), null);
  assert.equal(researchScriptViolation("scripts/research/builders/official_media.py"), null);
  assert.equal(
    researchScriptViolation("scripts/research/archive/2026/build_priority_round21.py"),
    null,
  );
});

test("rejects root-level and round-specific research scripts", () => {
  assert.match(
    researchScriptViolation("scripts/research/build_priority_round21.py"),
    /root-level research files/,
  );
  assert.match(
    researchScriptViolation("scripts/research/builders/priority_round21.py"),
    /round-specific code/,
  );
  assert.match(
    researchScriptViolation("scripts/research/builders/2026_08_01_priority.py"),
    /date-specific code/,
  );
  assert.match(
    researchScriptViolation("scripts/research/one-offs/task.py"),
    /research code must live under/,
  );
});

test("accepts a valid declarative research batch", () => {
  assert.deepEqual(
    validateResearchBatchManifest({
      manifestPath: "data/research-batches/2026-08-01-vienna-birthday-media.json",
      manifest: validManifest,
      contract,
    }),
    [],
  );
});

test("rejects unsafe or ambiguous research batch manifests", () => {
  const errors = validateResearchBatchManifest({
    manifestPath: "data/research-batches/wrong-name.json",
    manifest: {
      ...validManifest,
      subjects: ["fu-feng", "fu-feng"],
      operations: ["deploy-production"],
      dry_run_default: false,
      extra: true,
    },
    contract,
  });

  assert.ok(errors.includes("filename must match batch_id"));
  assert.ok(errors.includes("subjects values must be unique"));
  assert.ok(errors.includes("operations contains unsupported value: deploy-production"));
  assert.ok(errors.includes("dry_run_default must be true"));
  assert.ok(errors.includes("unknown field: extra"));
});

test("checks tracked and unignored research inputs in a real Git repository", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "panda-research-policy-"));

  try {
    execFileSync("git", ["init", "--quiet"], { cwd });
    await mkdir(path.join(cwd, "contracts"), { recursive: true });
    await mkdir(path.join(cwd, "scripts", "research"), { recursive: true });
    await mkdir(path.join(cwd, "data", "research-batches"), { recursive: true });
    await writeFile(
      path.join(cwd, "contracts", "research-batch.v1.json"),
      `${JSON.stringify(contract, null, 2)}\n`,
      "utf8",
    );
    await writeFile(path.join(cwd, "scripts", "research", "README.md"), "# Research\n", "utf8");
    await writeFile(
      path.join(cwd, "data", "research-batches", `${validManifest.batch_id}.json`),
      `${JSON.stringify(validManifest, null, 2)}\n`,
      "utf8",
    );

    assert.doesNotThrow(() => checkResearchScriptPolicy({ cwd, quiet: true }));

    await writeFile(
      path.join(cwd, "scripts", "research", "build_subject_round12.py"),
      "print('one off')\n",
      "utf8",
    );
    assert.throws(
      () => checkResearchScriptPolicy({ cwd, quiet: true }),
      /Research script policy failed/,
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
