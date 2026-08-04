import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runRecoveryRehearsal,
  writeRecoveryRehearsal,
} from "../run-zhipanda-v1-recovery-rehearsal.mjs";

function scenario(report, id) {
  return report.scenarios.find((item) => item.id === id);
}

function checkById(item, id) {
  return item.checks.find((check) => check.id === id);
}

test("cross-feature recovery rehearsal passes every deterministic check", () => {
  const report = runRecoveryRehearsal({ generatedAt: "2026-08-04T00:00:00.000Z" });

  assert.equal(report.outcome, "passed");
  assert.equal(report.summary.scenarios, 3);
  assert.ok(report.summary.checks >= 12);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.passed, report.summary.checks);
  assert.equal(report.evidence_id.length, 64);
  assert.ok(
    report.summary.limitations.every((limitation) =>
      limitation.includes("real PostgreSQL") && limitation.includes("remains required"),
    ),
  );
});

test("moderation rehearsal stops new commands and drains an in-flight appeal", () => {
  const report = runRecoveryRehearsal();
  const moderation = scenario(report, "moderation-stop-drain-orchestration");

  assert.equal(checkById(moderation, "new-commands-stop-fail-closed").passed, true);
  assert.equal(checkById(moderation, "in-flight-appeal-drains").passed, true);
  assert.equal(checkById(moderation, "projection-replay-is-idempotent").passed, true);
  assert.equal(moderation.result.projection["sanction-1"].active, false);
  assert.equal(moderation.result.projection["sanction-1"].restored, true);
});

test("privacy rehearsal reapplies deletion tombstones after restore without widening Holds", () => {
  const report = runRecoveryRehearsal();
  const privacy = scenario(report, "privacy-tombstone-replay-orchestration");

  assert.equal(
    checkById(privacy, "restore-demonstrates-replay-need").passed,
    true,
  );
  assert.equal(
    checkById(privacy, "tombstone-replay-deletes-only-non-held-contexts").passed,
    true,
  );
  assert.equal(
    checkById(privacy, "duplicate-tombstone-replay-is-idempotent").passed,
    true,
  );
  assert.equal(privacy.result.account.authentication, "blocked");
  assert.equal(privacy.result.contexts.archive_provenance, "retained-under-hold");
  assert.equal(privacy.result.contexts.engagement, "deleted");
});

test("audit rehearsal fails closed, rebuilds idempotently, and detects digest tampering", () => {
  const report = runRecoveryRehearsal();
  const audit = scenario(report, "audit-integrity-recovery-orchestration");

  assert.equal(checkById(audit, "required-audit-outage-fails-closed").passed, true);
  assert.equal(checkById(audit, "audit-projection-rebuild-is-idempotent").passed, true);
  assert.equal(checkById(audit, "integrity-mismatch-is-detected").passed, true);
  assert.equal(
    checkById(audit, "expired-export-ciphertext-is-removed-but-fact-remains").passed,
    true,
  );
  assert.notEqual(audit.result.expected_digest, audit.result.tampered_digest);
});

test("rehearsal evidence id excludes generation metadata", () => {
  const first = runRecoveryRehearsal({ generatedAt: "2026-08-04T00:00:00.000Z" });
  const second = runRecoveryRehearsal({ generatedAt: "2026-08-05T00:00:00.000Z" });

  assert.notEqual(first.generated_at, second.generated_at);
  assert.equal(first.evidence_id, second.evidence_id);
});

test("rehearsal writes machine-readable release evidence", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "zhipanda-recovery-"));
  const outputPath = path.join(directory, "report.json");
  const report = writeRecoveryRehearsal({
    outputPath,
    generatedAt: "2026-08-04T00:00:00.000Z",
  });
  const written = JSON.parse(readFileSync(outputPath, "utf8"));

  assert.equal(written.outcome, "passed");
  assert.equal(written.evidence_id, report.evidence_id);
  assert.equal(written.summary.failed, 0);
});
