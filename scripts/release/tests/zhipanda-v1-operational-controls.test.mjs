import assert from "node:assert/strict";
import test from "node:test";

import {
  loadOperationalControlMatrix,
  validateOperationalControlMatrix,
} from "../check-zhipanda-v1-operational-controls.mjs";

function cloneMatrix() {
  return structuredClone(loadOperationalControlMatrix());
}

test("V1 operational control matrix binds repository and final-candidate gates", () => {
  const summary = validateOperationalControlMatrix(cloneMatrix());

  assert.deepEqual(summary, {
    matrix_id: "zhipanda-v1-operational-controls",
    status: "in-progress",
    controls: 15,
    available_controls: 11,
    final_candidate_controls: 4,
    evidence_files: 23,
    release_gate_integrated: true,
  });
});

test("operational controls cannot drop a required security boundary", () => {
  const matrix = cloneMatrix();
  matrix.controls = matrix.controls.filter(
    (control) => control.id !== "sensitive-log-redaction",
  );

  assert.throws(
    () => validateOperationalControlMatrix(matrix, { checkEvidence: false }),
    /Missing required operational control sensitive-log-redaction/,
  );
});

test("final-candidate controls cannot be downgraded to repository available", () => {
  const matrix = cloneMatrix();
  const windows = matrix.controls.find((control) => control.id === "windows-map-close");
  windows.status = "available";

  assert.throws(
    () => validateOperationalControlMatrix(matrix, { checkEvidence: false }),
    /windows-map-close status must be final-candidate/,
  );
});

test("operational controls require repository evidence paths", () => {
  const matrix = cloneMatrix();
  const control = matrix.controls.find(
    (item) => item.id === "public-private-api-boundary",
  );
  control.evidence[0].path = "missing/public-boundary.mjs";

  assert.throws(
    () => validateOperationalControlMatrix(matrix),
    /references missing path missing\/public-boundary\.mjs/,
  );
});

test("operational controls require evidence assertion tokens", () => {
  const matrix = cloneMatrix();
  const control = matrix.controls.find(
    (item) => item.id === "admin-runtime-isolation",
  );
  control.evidence[0].contains.push("parallel-admin-server-runtime");

  assert.throws(
    () => validateOperationalControlMatrix(matrix),
    /missing required assertion token "parallel-admin-server-runtime"/,
  );
});

test("complete control status requires final-candidate evidence closure", () => {
  const matrix = cloneMatrix();
  matrix.status = "complete";

  assert.throws(
    () => validateOperationalControlMatrix(matrix, { checkEvidence: false }),
    /cannot contain final-candidate controls without candidate evidence/,
  );
});

test("completion rule retains every environment-dependent control", () => {
  const matrix = cloneMatrix();
  matrix.completion_rule.required_final_candidate_controls = [
    "linux-map-close",
    "windows-map-close",
  ];

  assert.throws(
    () => validateOperationalControlMatrix(matrix, { checkEvidence: false }),
    /must retain all final-candidate controls/,
  );
});
