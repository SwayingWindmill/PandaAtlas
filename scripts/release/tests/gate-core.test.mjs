import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EnvironmentBlockedError,
  ReleaseGateError,
  runReleaseGate,
} from "../gate-core.mjs";

const silentLogger = { log() {} };

test("release gate reports passed, failed, skipped, and environment-blocked steps", async () => {
  const reportDir = await mkdtemp(path.join(os.tmpdir(), "panda-release-gate-"));
  const order = [];

  try {
    await assert.rejects(
      runReleaseGate({
        gate: "test",
        platform: "win32",
        reportDir,
        logger: silentLogger,
        steps: [
          {
            id: "pass",
            label: "Passing step",
            run: async () => {
              order.push("pass");
            },
          },
          {
            id: "skip",
            label: "Platform skip",
            skipReason: "Linux-only runtime",
          },
          {
            id: "blocked",
            label: "Missing browser",
            run: async () => {
              order.push("blocked");
              throw new EnvironmentBlockedError("Chromium executable is unavailable");
            },
          },
          {
            id: "failed",
            label: "Failing test",
            run: async () => {
              order.push("failed");
              throw new Error("assertion failed");
            },
          },
          {
            id: "dependent",
            label: "Dependent step",
            dependsOn: ["failed"],
            run: async () => {
              order.push("dependent");
            },
          },
        ],
      }),
      (error) => {
        assert.ok(error instanceof ReleaseGateError);
        assert.equal(error.report.outcome, "failed");
        assert.deepEqual(error.report.counts, {
          passed: 1,
          failed: 1,
          skipped: 2,
          environment_blocked: 1,
        });
        return true;
      },
    );

    assert.deepEqual(order, ["pass", "blocked", "failed"]);

    const report = JSON.parse(await readFile(path.join(reportDir, "test.json"), "utf8"));
    assert.equal(report.schema_version, 1);
    assert.equal(report.platform, "win32");
    assert.deepEqual(
      report.steps.map(({ id, status }) => [id, status]),
      [
        ["pass", "passed"],
        ["skip", "skipped"],
        ["blocked", "environment-blocked"],
        ["failed", "failed"],
        ["dependent", "skipped"],
      ],
    );

    const markdown = await readFile(path.join(reportDir, "test.md"), "utf8");
    assert.match(markdown, /\| Missing browser \| environment-blocked \|/);
    assert.match(markdown, /\| Dependent step \| skipped \| Dependency failed did not pass/);
  } finally {
    await rm(reportDir, { recursive: true, force: true });
  }
});

test("skipped steps do not fail an otherwise successful gate", async () => {
  const reportDir = await mkdtemp(path.join(os.tmpdir(), "panda-release-gate-"));

  try {
    const report = await runReleaseGate({
      gate: "partial",
      platform: "win32",
      reportDir,
      logger: silentLogger,
      steps: [
        { id: "d1", label: "D1 smoke", run: async () => undefined },
        { id: "http", label: "Worker HTTP smoke", skipReason: "Linux CI only" },
      ],
    });

    assert.equal(report.outcome, "passed");
    assert.deepEqual(report.counts, {
      passed: 1,
      failed: 0,
      skipped: 1,
      environment_blocked: 0,
    });
  } finally {
    await rm(reportDir, { recursive: true, force: true });
  }
});
