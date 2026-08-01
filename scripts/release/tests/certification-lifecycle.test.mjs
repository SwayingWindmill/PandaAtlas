import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { runEvidenceSealedCertification } from "../certification/lifecycle.mjs";

const input = {
  gate: "map-close",
  reportDir: "/tmp/release-report",
  steps: [{ id: "check", label: "Check", run: async () => undefined }],
};

test("evidence-sealed certification runs the gate before sealing and returns its report", async () => {
  const order = [];
  const expectedReport = { gate: "map-close", outcome: "passed" };

  const report = await runEvidenceSealedCertification({
    ...input,
    async runGate(options) {
      order.push(["gate", options]);
      return expectedReport;
    },
    async sealEvidence(options) {
      order.push(["seal", options]);
    },
  });

  assert.equal(report, expectedReport);
  assert.deepEqual(order, [
    ["gate", input],
    ["seal", { reportDir: input.reportDir }],
  ]);
});

test("evidence sealing never runs after a failed certification gate", async () => {
  const gateError = new Error("gate failed");
  let sealCalls = 0;

  await assert.rejects(
    runEvidenceSealedCertification({
      ...input,
      async runGate() {
        throw gateError;
      },
      async sealEvidence() {
        sealCalls += 1;
      },
    }),
    (error) => error === gateError,
  );
  assert.equal(sealCalls, 0);
});

test("evidence sealing failures remain fatal", async () => {
  const sealError = new Error("seal failed");

  await assert.rejects(
    runEvidenceSealedCertification({
      ...input,
      async runGate() {
        return { gate: "map-close", outcome: "passed" };
      },
      async sealEvidence() {
        throw sealError;
      },
    }),
    (error) => error === sealError,
  );
});

test("certification lifecycle validates its interface before execution", async () => {
  await assert.rejects(runEvidenceSealedCertification(), /requires gate/);
  await assert.rejects(
    runEvidenceSealedCertification({ gate: "map-close" }),
    /requires reportDir/,
  );
  await assert.rejects(
    runEvidenceSealedCertification({ gate: "map-close", reportDir: "/tmp/report" }),
    /requires steps/,
  );
});

test("map-close and Extended adapters consume one evidence lifecycle", async () => {
  const [mapClose, extended] = await Promise.all([
    readFile(new URL("../map-close.mjs", import.meta.url), "utf8"),
    readFile(new URL("../extended.mjs", import.meta.url), "utf8"),
  ]);

  for (const source of [mapClose, extended]) {
    assert.match(source, /runEvidenceSealedCertification/);
    assert.doesNotMatch(source, /sealMapCloseEvidence/);
    assert.doesNotMatch(source, /runReleaseGate/);
  }
});
