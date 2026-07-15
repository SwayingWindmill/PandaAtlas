import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
function quoteWindowsArgument(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@=+\\-]+$/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

test("release recovery drill leaves reproducible machine evidence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "panda-recovery-drill-"));
  const reportPath = path.join(directory, "recovery-drill.json");
  try {
    const npmArgs = ["run", "drill:release-recovery", "--", "--report", reportPath];
    const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
    const commandArgs = process.platform === "win32"
      ? ["/d", "/s", "/c", ["npm", ...npmArgs].map(quoteWindowsArgument).join(" ")]
      : npmArgs;
    const result = spawnSync(command, commandArgs, { cwd: repoRoot, encoding: "utf8" });

    assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.outcome, "passed");
    assert.deepEqual(
      report.checks.map((check) => check.id),
      [
        "atomic-switch",
        "prior-version-rollback",
        "entity-withdrawal",
        "whole-release-withdrawal",
        "cache-purge",
        "immutable-history",
        "deterministic-d1-rebuild",
      ],
    );
    assert.ok(report.checks.every((check) => check.status === "passed"));
    assert.equal(report.metrics.recovery_point_loss_operations, 0);
    assert.equal(report.evidence.history_sha256_before, report.evidence.history_sha256_after);
    assert.equal(report.evidence.operational_state_sha256, report.evidence.rebuilt_state_sha256);
    assert.equal(report.evidence.cache_entries_after_purge, 0);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
