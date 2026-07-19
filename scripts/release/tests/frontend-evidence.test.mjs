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

test("classifies public release migration and Cloudflare entry changes as Level 3", () => {
  const result = classifyFrontendRisk([
    "apps/web/cloudflare/worker-entry.mjs",
    "apps/web/wrangler.staging.jsonc",
    "infra/cloudflare/d1/migrations/0007a_public_releases_immutable_update.sql",
    "scripts/release/apply-d1-migrations.mjs",
  ]);

  assert.equal(result.level, 3);
  assert.ok(result.matches.every((match) => match.level === 3));
});

test("validates the issue 40 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-40.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("validates the issue 43 Slice 2 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-43.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("validates the issue 45 Slice 3 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-45.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("validates the issue 47 Slice 4 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-47.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("validates the issue 49 Slice 6 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-49.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("validates the issue 51 Slice 7 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-51.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("validates the issue 53 Slice 8 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-53.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("validates the issue 57 Slice 10 manifest and keeps the release blocked", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../../data/frontend-evidence/issue-57.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("validates the final Public Beta manifest and keeps it blocked for missing signed environments", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../../data/frontend-evidence/public-beta-2026.07.18.1.json", import.meta.url),
      "utf8",
    ),
  );

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "BLOCKED");
});

test("a final GO decision requires explicit bilingual human session metadata", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../../data/frontend-evidence/public-beta-2026.07.18.1.json", import.meta.url),
      "utf8",
    ),
  );
  manifest.human_signoff = {
    status: "PASS",
    detail: "Human review passed.",
    evidence: ["owner approval"],
    sessions: [],
  };
  manifest.release_decision = { status: "GO", detail: "All evidence passed." };

  const errors = validateFrontendEvidenceManifest(manifest);
  assert.ok(
    errors.includes(
      "human_signoff.sessions must contain signed human sessions when status is PASS",
    ),
  );
});

test("human sessions must be bound to the current Production deployment", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../../data/frontend-evidence/public-beta-2026.07.18.1.json", import.meta.url),
      "utf8",
    ),
  );
  manifest.human_signoff = {
    status: "PASS",
    detail: "Human review passed.",
    evidence: ["signed session record"],
    sessions: [{
      evaluator: "Named human evaluator",
      language_proficiency: "Professional proficiency in Chinese and English",
      date: "2026-07-19",
      locales: ["zh-CN", "en"],
      os: { name: "Recorded OS", version: "recorded-version" },
      browser: { name: "Recorded browser", version: "recorded-version" },
      assistive_technology: { name: "Recorded screen reader", version: "recorded-version" },
      production_version: "previous-production-version",
      journeys: ["Complete bilingual canonical public journeys"],
      observations: ["Observed announcements and task completion"],
      result: "PASS",
    }],
  };
  manifest.release_decision = { status: "GO", detail: "All evidence passed." };

  assert.ok(
    validateFrontendEvidenceManifest(manifest).includes(
      "human_signoff.sessions[0].production_version must match artifact.frontend_deployment_id",
    ),
  );
});

test("the final Public Beta manifest becomes eligible for GO with complete bilingual sessions", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../../data/frontend-evidence/public-beta-2026.07.18.1.json", import.meta.url),
      "utf8",
    ),
  );
  const environment = {
    evaluator: "Named human evaluator",
    language_proficiency: "Professional proficiency in Chinese and English",
    date: "2026-07-19",
    locales: ["zh-CN", "en"],
    os: { name: "Recorded OS", version: "recorded-version" },
    browser: { name: "Recorded browser", version: "recorded-version" },
    assistive_technology: { name: "Recorded screen reader", version: "recorded-version" },
    production_version: manifest.artifact.frontend_deployment_id,
    journeys: ["Complete bilingual canonical public journeys"],
    observations: [
      "Observed names, roles, states, dynamic announcements, map and lineage equivalents",
    ],
    result: "PASS",
  };
  manifest.human_signoff = {
    status: "PASS",
    detail: "Signed bilingual human screen-reader review passed with explicit environment records.",
    evidence: ["signed session record"],
    sessions: [environment],
  };
  manifest.release_decision = { status: "GO", detail: "All required evidence passed." };

  assert.deepEqual(validateFrontendEvidenceManifest(manifest), []);
  assert.equal(computeFrontendReleaseDecision(manifest), "GO");
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
  manifest.artifact.commit = "UNBOUND_WORKING_TREE";
  manifest.artifact.build_checksum = null;
  manifest.artifact.frontend_deployment_id = null;
  manifest.artifact.api_deployment_id = null;
  manifest.staging = { status: "PASS", detail: "Staging passed.", evidence: ["staging-run"] };
  manifest.human_signoff = { status: "PASS", detail: "Human sign-off passed.", evidence: ["human-record"] };
  manifest.release_decision = { status: "GO", detail: "All evidence passed." };

  const errors = validateFrontendEvidenceManifest(manifest);
  assert.ok(errors.includes("a GO decision requires an immutable artifact commit"));
  assert.ok(errors.includes("a GO decision requires artifact.build_checksum"));
  assert.ok(errors.includes("a GO decision requires artifact.frontend_deployment_id"));
  assert.ok(errors.includes("a GO decision requires artifact.api_deployment_id"));
});
