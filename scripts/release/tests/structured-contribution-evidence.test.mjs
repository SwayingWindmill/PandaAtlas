import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  StructuredContributionEvidenceError,
  requiredIssue193Categories,
  validateStructuredContributionEvidence,
  validateStructuredContributionEvidenceFile,
} from "../validate-structured-contribution-evidence.mjs";

const evidenceUrl = new URL(
  "../../../data/release-evidence/issue-193-structured-contribution-review-to-archive.json",
  import.meta.url,
);
const docsUrl = new URL(
  "../../../docs/release/issue-193-structured-contribution-review-to-archive.md",
  import.meta.url,
);

test("issue 193 evidence matrix covers every required category", async () => {
  const summary = await validateStructuredContributionEvidenceFile(evidenceUrl);

  assert.equal(summary.issue, 193);
  assert.equal(summary.map_issue, 174);
  assert.equal(summary.category_count, requiredIssue193Categories.length);
  assert.ok(summary.scenario_count >= requiredIssue193Categories.length);
  assert.ok(summary.rollback_switch_count >= 5);
  assert.ok(summary.artifact_count >= 4);
});

test("issue 193 evidence validator fails closed for incomplete scenarios", async () => {
  const evidence = JSON.parse(await readFile(evidenceUrl, "utf8"));
  evidence.categories[0].scenarios[0].status = "planned";
  evidence.categories[0].scenarios[0].evidence_refs = [];

  assert.throws(
    () => validateStructuredContributionEvidence(evidence),
    (error) => {
      assert.ok(error instanceof StructuredContributionEvidenceError);
      assert.match(error.message, /incomplete/);
      assert.ok(error.details.some((detail) => detail.includes("is not covered")));
      assert.ok(error.details.some((detail) => detail.includes("evidence_refs")));
      return true;
    },
  );
});

test("issue 193 evidence validator fails closed for open blockers", async () => {
  const evidence = JSON.parse(await readFile(evidenceUrl, "utf8"));
  evidence.blockers[0].status = "required_closed_before_final";

  assert.throws(
    () => validateStructuredContributionEvidence(evidence),
    (error) => {
      assert.ok(error instanceof StructuredContributionEvidenceError);
      assert.ok(error.details.some((detail) => detail.includes("must be closed")));
      return true;
    },
  );
});

test("issue 193 docs name the immutable evidence package and categories", async () => {
  const docs = await readFile(docsUrl, "utf8");

  assert.match(
    docs,
    /data\/release-evidence\/issue-193-structured-contribution-review-to-archive\.json/,
  );
  assert.match(docs, /node scripts\/release\/validate-structured-contribution-evidence\.mjs/);
  assert.match(docs, /map-close-manifest\.sha256/);
  for (const category of requiredIssue193Categories) {
    assert.match(docs, new RegExp(category));
  }
});
