import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { sealMapCloseEvidence } from "../map-close-evidence.mjs";

test("map-close evidence manifest hashes reports and canonical contract artifacts", async () => {
  const reportDir = await mkdtemp(path.join(os.tmpdir(), "panda-map-close-evidence-"));
  await writeFile(path.join(reportDir, "default.json"), '{"outcome":"passed"}\n', "utf8");
  await writeFile(path.join(reportDir, "map-close.json"), '{"outcome":"passed"}\n', "utf8");
  await writeFile(
    path.join(reportDir, "panda-atlas-v1-integrated.yaml"),
    "openapi: 3.1.0\npaths: {}\n",
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "panda-atlas-v1-integrated.yaml.sha256"),
    `${"a".repeat(64)}  panda-atlas-v1-integrated.yaml\n`,
    "utf8",
  );

  const manifest = await sealMapCloseEvidence({
    reportDir,
    commitSha: "841bd12ab182a77c159f671b866e94cf299d0681",
    generatedAt: "2026-07-29T06:00:00.000Z",
    platform: "test",
  });

  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.commit_sha, "841bd12ab182a77c159f671b866e94cf299d0681");
  assert.deepEqual(
    manifest.artifacts.map((artifact) => artifact.path),
    [
      "default.json",
      "map-close.json",
      "panda-atlas-v1-integrated.yaml",
      "panda-atlas-v1-integrated.yaml.sha256",
    ],
  );
  assert.ok(manifest.artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)));

  const persisted = JSON.parse(
    await readFile(path.join(reportDir, "map-close-manifest.json"), "utf8"),
  );
  assert.deepEqual(persisted, manifest);
  const digest = (
    await readFile(path.join(reportDir, "map-close-manifest.sha256"), "utf8")
  ).trim();
  assert.match(digest, /^[a-f0-9]{64}  map-close-manifest\.json$/);
});
