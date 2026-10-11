import assert from "node:assert/strict";
import { test } from "node:test";

import { availablePublicationActions } from "../../features/admin/publication/available-actions.ts";

const current = {
  releaseId: "current", lifecycleState: "sealed", builtAt: "2026-10-01T00:00:00Z",
  projectionSchemaVersion: 1, isCurrent: true, suspended: false,
};
const candidate = {
  releaseId: "candidate", lifecycleState: "sealed", builtAt: "2026-10-02T00:00:00Z",
  projectionSchemaVersion: 1, isCurrent: false, suspended: false,
};
const permission = { canManage: true, canActivate: true, canEmergency: true };
const evaluate = (override = {}) => availablePublicationActions({
  selected: candidate, current, releasesReady: true, ...permission, ...override,
});

test("no privileged action is shown without a confirmed current release collection", () => {
  assert.deepEqual(evaluate({ releasesReady: false }), []);
  assert.deepEqual(evaluate({ selected: undefined }), []);
});

test("permissions and lifecycle restrict each release operation", () => {
  assert.deepEqual(evaluate({ canManage: false, canActivate: false, canEmergency: false }), []);
  assert.deepEqual(evaluate(), ["activate", "suspend"]);
  assert.deepEqual(evaluate({ selected: { ...candidate, lifecycleState: "building" } }), ["seal"]);
  assert.deepEqual(evaluate({ selected: { ...candidate, lifecycleState: "building" }, canManage: false }), []);
  assert.deepEqual(evaluate({ selected: { ...candidate, suspended: true } }), ["restore"]);
  assert.deepEqual(evaluate({ selected: { ...candidate, isCurrent: true } }), ["suspend"]);
});

test("rollback needs compatible schema and an earlier sealed release", () => {
  const older = { ...candidate, builtAt: "2026-09-01T00:00:00Z" };
  assert.deepEqual(evaluate({ selected: older }), ["rollback", "suspend"]);
  assert.deepEqual(evaluate({ selected: { ...older, projectionSchemaVersion: 2 } }), ["suspend"]);
});
