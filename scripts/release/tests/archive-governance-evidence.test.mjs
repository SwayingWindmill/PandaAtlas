import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateArchiveGovernanceInventory } from "../check-archive-governance-migration.mjs";
import {
  ArchiveGovernanceEvidenceError,
  requiredIssue196Blockers,
  requiredIssue196Categories,
  validateArchiveGovernanceEvidence,
  validateArchiveGovernanceEvidenceFile,
} from "../validate-archive-governance-evidence.mjs";

const evidenceUrl = new URL(
  "../../../data/release-evidence/issue-196-single-accountable-archive-governance.json",
  import.meta.url,
);
const docsUrl = new URL(
  "../../../docs/release/issue-196-single-accountable-archive-governance.md",
  import.meta.url,
);

test("issue 196 evidence matrix covers every required Archive governance category", async () => {
  const summary = await validateArchiveGovernanceEvidenceFile(evidenceUrl);

  assert.equal(summary.issue, 196);
  assert.equal(summary.map_issue, 175);
  assert.equal(summary.category_count, requiredIssue196Categories.length);
  assert.ok(summary.scenario_count >= requiredIssue196Categories.length);
  assert.equal(summary.blocker_count, requiredIssue196Blockers.length);
  assert.ok(summary.rollback_switch_count >= 6);
  assert.ok(summary.artifact_count >= 5);
});

test("issue 196 final inventory has no unclassified four-eyes governance path", () => {
  const summary = validateArchiveGovernanceInventory();

  assert.equal(summary.status, "PASS");
  assert.equal(summary.issue, 190);
  assert.ok(summary.inventory_entries >= 27);
  assert.ok(summary.detected_paths.length > 0);
});

test("issue 196 evidence validator fails closed for incomplete scenarios", async () => {
  const evidence = JSON.parse(await readFile(evidenceUrl, "utf8"));
  evidence.categories[0].scenarios[0].status = "planned";
  evidence.categories[0].scenarios[0].evidence_refs = [];
  evidence.categories[0].scenarios[0].gate_commands = [];

  assert.throws(
    () => validateArchiveGovernanceEvidence(evidence),
    (error) => {
      assert.ok(error instanceof ArchiveGovernanceEvidenceError);
      assert.match(error.message, /incomplete/);
      assert.ok(error.details.some((detail) => detail.includes("is not covered")));
      assert.ok(error.details.some((detail) => detail.includes("evidence_refs")));
      assert.ok(error.details.some((detail) => detail.includes("gate_commands")));
      return true;
    },
  );
});

test("issue 196 evidence validator fails closed for open or missing blockers", async () => {
  const evidence = JSON.parse(await readFile(evidenceUrl, "utf8"));
  evidence.blockers[0].status = "open";
  evidence.blockers.pop();

  assert.throws(
    () => validateArchiveGovernanceEvidence(evidence),
    (error) => {
      assert.ok(error instanceof ArchiveGovernanceEvidenceError);
      assert.ok(error.details.some((detail) => detail.includes("must be closed")));
      assert.ok(error.details.some((detail) => detail.includes("must be represented")));
      return true;
    },
  );
});

test("issue 196 evidence validator requires exact unique categories", async () => {
  const evidence = JSON.parse(await readFile(evidenceUrl, "utf8"));
  evidence.categories.push(evidence.categories[0]);

  assert.throws(
    () => validateArchiveGovernanceEvidence(evidence),
    (error) => {
      assert.ok(error instanceof ArchiveGovernanceEvidenceError);
      assert.ok(error.details.some((detail) => detail.includes("duplicate")));
      assert.ok(error.details.some((detail) => detail.includes("match issue #196 exactly")));
      return true;
    },
  );
});

test("issue 196 docs name the immutable evidence package and closure categories", async () => {
  const docs = await readFile(docsUrl, "utf8");

  assert.match(
    docs,
    /data\/release-evidence\/issue-196-single-accountable-archive-governance\.json/,
  );
  assert.match(docs, /node scripts\/release\/validate-archive-governance-evidence\.mjs/);
  assert.match(docs, /map-close-manifest\.sha256/);
  assert.match(docs, /archive-governance-rehearsal\.json/);
  for (const category of requiredIssue196Categories) {
    assert.match(docs, new RegExp(category));
  }
});
