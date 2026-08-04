import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildOperationalReadinessEvidence,
  writeOperationalReadinessEvidence,
} from "../write-zhipanda-v1-operational-readiness-evidence.mjs";

test("operational readiness evidence seals contracts, runbook, rehearsal, and gate sources", () => {
  const evidence = buildOperationalReadinessEvidence({
    generatedAt: "2026-08-04T00:00:00.000Z",
    sourceCommit: "candidate-commit",
  });

  assert.equal(evidence.schema_version, 1);
  assert.equal(evidence.contract_id, "zhipanda-v1-operational-readiness");
  assert.equal(evidence.contract_status, "in-progress");
  assert.equal(evidence.outcome, "in-progress");
  assert.match(evidence.evidence_id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(evidence.inputs.length, 9);
  assert.deepEqual(evidence.recovery_rehearsal, {
    rehearsal_id: "zhipanda-v1-cross-feature-recovery",
    status: "available",
    scenarios: 3,
    required_checks: 12,
    feature_drills_resolved: false,
    release_gate_integrated: true,
  });
  assert.equal(evidence.planned_drills.length, 3);
  assert.deepEqual(
    evidence.planned_drills.map((drill) => drill.blocked_by_issue),
    [197, 198, 199],
  );

  for (const input of evidence.inputs) {
    assert.ok(input.bytes > 0, `${input.path} must not be empty`);
    assert.match(input.sha256, /^[0-9a-f]{64}$/);
  }
});

test("immutable evidence id ignores generation metadata", () => {
  const first = buildOperationalReadinessEvidence({
    generatedAt: "2026-08-04T00:00:00.000Z",
    sourceCommit: "first-commit",
  });
  const second = buildOperationalReadinessEvidence({
    generatedAt: "2026-08-05T00:00:00.000Z",
    sourceCommit: "second-commit",
  });

  assert.equal(first.evidence_id, second.evidence_id);
  assert.notEqual(first.generated_at, second.generated_at);
  assert.notEqual(first.source_commit, second.source_commit);
});

test("operational evidence writer emits a machine-readable report without secrets", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "zhipanda-operational-evidence-"));
  const outputPath = path.join(directory, "evidence.json");

  const written = writeOperationalReadinessEvidence(outputPath, {
    generatedAt: "2026-08-04T00:00:00.000Z",
    sourceCommit: "candidate-commit",
  });
  const raw = readFileSync(outputPath, "utf8");
  const parsed = JSON.parse(raw);

  assert.deepEqual(parsed, written);
  assert.doesNotMatch(raw, /sb_secret_/i);
  assert.doesNotMatch(raw, /begin private key/i);
  assert.doesNotMatch(raw, /authorization:\s*bearer/i);
  assert.equal(parsed.summary.release_gate_integrated, true);
  assert.equal(parsed.recovery_rehearsal.feature_drills_resolved, false);
});
