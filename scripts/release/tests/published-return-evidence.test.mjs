import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { sealPublishedReturnEvidence } from "../seal-published-return-evidence.mjs";

const junit = '<?xml version="1.0"?><testsuites><testsuite name="return" tests="1" failures="0" errors="0"><testcase name="pass"/></testsuite></testsuites>\n';

test("published-return foundation manifest hashes every required passing artifact", async () => {
  const reportDir = await mkdtemp(path.join(os.tmpdir(), "panda-published-return-"));
  for (const name of [
    "activity-real-db.xml",
    "engagement-real-db.xml",
    "feed-real-db.xml",
    "notification-real-db.xml",
  ]) {
    await writeFile(path.join(reportDir, name), junit, "utf8");
  }
  await writeFile(
    path.join(reportDir, "identity-engagement-recovery.json"),
    '{"outcome":"passed"}\n',
    "utf8",
  );
  await writeFile(
    path.join(reportDir, "notification-staging.json"),
    '{"outcome":"environment-blocked"}\n',
    "utf8",
  );

  const manifest = await sealPublishedReturnEvidence({
    reportDir,
    commitSha: "044b804d5c39bd87d8a48cdd069e8b4062e095a7",
    generatedAt: "2026-07-30T07:30:00.000Z",
    platform: "test",
  });

  assert.equal(manifest.map_issue, 173);
  assert.equal(manifest.closing_issue, 186);
  assert.equal(manifest.artifacts.length, 6);
  assert.ok(manifest.artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)));
  const persisted = JSON.parse(
    await readFile(path.join(reportDir, "published-return-foundation-manifest.json"), "utf8"),
  );
  assert.deepEqual(persisted, manifest);
  assert.match(
    (await readFile(path.join(reportDir, "published-return-foundation-manifest.sha256"), "utf8")).trim(),
    /^[a-f0-9]{64}  published-return-foundation-manifest\.json$/,
  );
});
