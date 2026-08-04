import assert from "node:assert/strict";
import test from "node:test";

import {
  loadRecoveryRehearsalContract,
  validateRecoveryRehearsalContract,
} from "../check-zhipanda-v1-recovery-rehearsal.mjs";

function cloneContract() {
  return structuredClone(loadRecoveryRehearsalContract());
}

test("cross-feature rehearsal contract is executable and Release Gate integrated", () => {
  const summary = validateRecoveryRehearsalContract(cloneContract());

  assert.deepEqual(summary, {
    rehearsal_id: "zhipanda-v1-cross-feature-recovery",
    status: "available",
    scenarios: 3,
    required_checks: 12,
    feature_drills_resolved: false,
    release_gate_integrated: true,
  });
});

test("rehearsal cannot claim to resolve real feature recovery drills", () => {
  const contract = cloneContract();
  contract.completion_boundary.resolves_feature_drills = true;

  assert.throws(
    () => validateRecoveryRehearsalContract(contract, { checkEvidence: false }),
    /resolves_feature_drills must remain false/,
  );
});

test("rehearsal retains all feature-specific completion blockers", () => {
  const contract = cloneContract();
  contract.completion_boundary.required_before_complete = [
    "privacy-tombstone-replay",
    "audit-integrity-recovery",
  ];

  assert.throws(
    () => validateRecoveryRehearsalContract(contract, { checkEvidence: false }),
    /must retain all three feature drills/,
  );
});

test("scenario checks cannot be weakened", () => {
  const contract = cloneContract();
  const privacy = contract.scenarios.find(
    (scenario) => scenario.id === "privacy-tombstone-replay-orchestration",
  );
  privacy.required_checks = privacy.required_checks.filter(
    (check) => check !== "duplicate-tombstone-replay-is-idempotent",
  );

  assert.throws(
    () => validateRecoveryRehearsalContract(contract, { checkEvidence: false }),
    /must declare the complete required check set/,
  );
});

test("scenario limitations must preserve the real PostgreSQL boundary", () => {
  const contract = cloneContract();
  contract.scenarios[0].limitation = "This is the final recovery certification.";

  assert.throws(
    () => validateRecoveryRehearsalContract(contract, { checkEvidence: false }),
    /must preserve the real PostgreSQL limitation/,
  );
});

test("rehearsal must remain inside the existing Release Gate test glob", () => {
  const contract = cloneContract();
  contract.release_integration.test_glob = "scripts/parallel-certification/*.test.mjs";

  assert.throws(
    () => validateRecoveryRehearsalContract(contract, { checkEvidence: false }),
    /must use the existing Release Gate test glob/,
  );
});
