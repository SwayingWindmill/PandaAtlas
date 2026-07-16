import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyFrontendRisk } from "../classify-frontend-risk.mjs";
import {
  computeFrontendReleaseDecision,
  validateFrontendEvidenceManifest,
} from "../validate-frontend-evidence.mjs";

test("classifies global shell and public envelope changes as Level 3", () => {
  const result = classifyFrontendRisk([
    "apps/web/components/patterns/global-navigation.tsx",
    "apps/web/features/public-content/public-release.ts",
    "apps/web/styles/tokens.css",
  ]);

  assert.equal(result.level, 3);
  assert.ok(result.matches.some((match) => match.level === 3));
});

test("classifies an isolated public style change as Level 1", () => {
  const result = classifyFrontendRisk(["apps/web/styles/registers.css"]);
  assert.equal(result.level, 1);
});

test("validates the issue 40 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-40.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("rejects a declared risk below the computed risk", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-40.json", import.meta.url), "utf8"),
  );
  manifest.risk.declared_level = 2;

  assert.ok(
    validateFrontendEvidenceManifest(manifest).includes(
      "risk.declared_level cannot be below risk.computed_level",
    ),
  );
});

test("rejects PASS evidence groups without concrete evidence", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-40.json", import.meta.url), "utf8"),
  );
  manifest.check_groups.static_correctness.evidence = [];

  assert.ok(
    validateFrontendEvidenceManifest(manifest).includes(
      "check_groups.static_correctness.evidence must contain at least one item when status is PASS",
    ),
  );
});

test("Level 3 evidence cannot bypass staging or human sign-off as not applicable", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-40.json", import.meta.url), "utf8"),
  );
  manifest.staging = {
    status: "NOT_APPLICABLE_WITH_REASON",
    detail: "Staging is intentionally omitted for this test.",
    evidence: [],
  };
  manifest.human_signoff = {
    status: "NOT_APPLICABLE_WITH_REASON",
    detail: "Human sign-off is intentionally omitted for this test.",
    evidence: [],
  };

  const errors = validateFrontendEvidenceManifest(manifest);
  assert.ok(errors.includes("Level 3 evidence cannot mark staging as not applicable"));
  assert.ok(errors.includes("Level 3 evidence cannot mark human_signoff as not applicable"));
});

test("a GO decision must be bound to immutable build and deployment identities", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-40.json", import.meta.url), "utf8"),
  );
  for (const item of Object.values(manifest.check_groups)) item.status = "PASS";
  manifest.staging = { status: "PASS", detail: "Staging passed.", evidence: ["staging-run"] };
  manifest.human_signoff = { status: "PASS", detail: "Human sign-off passed.", evidence: ["human-record"] };
  manifest.release_decision = { status: "GO", detail: "All evidence passed." };

  const errors = validateFrontendEvidenceManifest(manifest);
  assert.ok(errors.includes("a GO decision requires an immutable artifact commit"));
  assert.ok(errors.includes("a GO decision requires artifact.build_checksum"));
  assert.ok(errors.includes("a GO decision requires artifact.frontend_deployment_id"));
  assert.ok(errors.includes("a GO decision requires artifact.api_deployment_id"));
});
