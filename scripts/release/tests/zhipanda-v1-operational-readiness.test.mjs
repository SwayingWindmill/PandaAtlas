import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  loadOperationalReadinessContract,
  repositoryRoot,
  validateOperationalReadinessContract,
} from "../check-zhipanda-v1-operational-readiness.mjs";

function cloneContract() {
  return structuredClone(loadOperationalReadinessContract());
}

test("V1 operational readiness is integrated into the existing Release Gate", () => {
  const summary = validateOperationalReadinessContract(cloneContract());

  assert.deepEqual(summary, {
    contract_id: "zhipanda-v1-operational-readiness",
    status: "in-progress",
    slos: 14,
    p1_slos: 9,
    available_drills: 7,
    planned_drills: 3,
    runbook_sections: 11,
    release_gate_integrated: true,
  });
});

test("operational runbook contains every contract section", () => {
  const contract = cloneContract();
  const runbook = readFileSync(
    path.join(repositoryRoot, "docs/runbooks/zhipanda-v1-operational-readiness.md"),
    "utf8",
  );

  for (const section of contract.required_runbook_sections) {
    assert.match(runbook, new RegExp(`^## ${section}$`, "m"));
  }
  assert.match(runbook, /does not authorize an independent release path/);
  assert.match(runbook, /The contract remains `in-progress` while any recovery drill is `planned`/);
});

test("operational readiness rejects a missing product SLO", () => {
  const contract = cloneContract();
  contract.service_level_objectives = contract.service_level_objectives.filter(
    (slo) => slo.id !== "privacy_deletion",
  );

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /Missing required SLO privacy_deletion/,
  );
});

test("safety-critical SLO alerts cannot be downgraded", () => {
  const contract = cloneContract();
  const audit = contract.service_level_objectives.find((slo) => slo.id === "audit");
  audit.alert.severity = "P2";

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /SLO audit is safety-critical and must alert at P1/,
  );
});

test("operational readiness forbids a parallel certification system", () => {
  const contract = cloneContract();
  contract.release_system.rule = "Create an independent certification path.";

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /must forbid an independent certification path/,
  );
});

test("planned drills cannot claim commands or evidence before their blockers land", () => {
  const contract = cloneContract();
  const replay = contract.recovery_drills.find(
    (drill) => drill.id === "privacy-tombstone-replay",
  );
  replay.command = "npm run privacy:tombstone-replay";
  replay.evidence = "temporary/privacy-evidence.json";

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /command must remain null until the blocking slice lands/,
  );
});

test("complete status requires every recovery drill to be executable", () => {
  const contract = cloneContract();
  contract.status = "complete";

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /cannot contain planned drills/,
  );
});

test("available recovery drills require repository evidence", () => {
  const contract = cloneContract();
  const drill = contract.recovery_drills.find(
    (item) => item.id === "immutable-release-recovery",
  );
  drill.evidence = "missing/recovery-evidence.md";

  assert.throws(
    () => validateOperationalReadinessContract(contract),
    /references missing path missing\/recovery-evidence\.md/,
  );
});
