import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { sealMapCloseEvidence } from "../map-close-evidence.mjs";

test("map-close evidence manifest is deterministic and hashes every report", async () => {
  const reportDir = await mkdtemp(path.join(os.tmpdir(), "panda-map-close-evidence-"));
  await writeFile(path.join(reportDir, "default.json"), '{"outcome":"passed"}\n', "utf8");
  await writeFile(path.join(reportDir, "map-close.json"), '{"outcome":"passed"}\n', "utf8");

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
    ["default.json", "map-close.json"],
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
