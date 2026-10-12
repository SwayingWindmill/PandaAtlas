import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePrStack } from "../check-pr-stack-depth.mjs";

const openPrs = new Map([
  ["feat/1-parent", { number: 1, baseRefName: "main" }],
  ["feat/2-child", { number: 2, baseRefName: "feat/1-parent" }],
]);
const findOpenPrByHead = (headRef) => openPrs.get(headRef) ?? null;

test("a pull request targeting the default branch passes", () => {
  assert.equal(evaluatePrStack({ baseRef: "main", defaultBranch: "main", findOpenPrByHead }).ok, true);
});

test("one layer of stacking on a parent that targets the default branch passes", () => {
  const outcome = evaluatePrStack({ baseRef: "feat/1-parent", defaultBranch: "main", findOpenPrByHead });
  assert.equal(outcome.ok, true);
  assert.match(outcome.reason, /#1/);
});

test("stacking on a parent that is itself stacked fails and names the parent", () => {
  const outcome = evaluatePrStack({ baseRef: "feat/2-child", defaultBranch: "main", findOpenPrByHead });
  assert.equal(outcome.ok, false);
  assert.match(outcome.reason, /#2/);
  assert.match(outcome.reason, /Merge #2/);
});

test("a base branch without an open pull request passes", () => {
  assert.equal(
    evaluatePrStack({ baseRef: "release/2026-10", defaultBranch: "main", findOpenPrByHead }).ok,
    true,
  );
});
