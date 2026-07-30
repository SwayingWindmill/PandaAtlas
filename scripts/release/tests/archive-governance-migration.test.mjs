import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  defaultContractPath,
  repoRoot,
  validateArchiveGovernanceInventory,
} from "../check-archive-governance-migration.mjs";

test("archive governance migration inventory covers every classified assumption", () => {
  const result = validateArchiveGovernanceInventory();

  assert.equal(result.status, "PASS");
  assert.equal(result.issue, 190);
  assert.equal(result.source_policy, "four-eyes-v1");
  assert.equal(result.target_policy, "single-accountable-approver-v1");
  assert.ok(result.inventory_entries >= 19);
  assert.ok(result.classified_categories.includes("ui"));
  assert.ok(result.classified_categories.includes("metric"));
  assert.ok(result.classified_categories.includes("runbook"));
});

test("archive governance migration inventory fails on an unclassified approval-governance path", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "archive-governance-"));
  try {
    const contract = JSON.parse(await readFile(defaultContractPath, "utf8"));
    contract.entries = contract.entries.filter(
      (entry) => entry.path !== "services/api/app/api/v1/admin_publications.py",
    );
    const contractPath = path.join(directory, "contract.json");
    await writeFile(contractPath, JSON.stringify(contract), "utf8");

    assert.throws(
      () => validateArchiveGovernanceInventory({ contractPath, root: repoRoot }),
      /unclassified approval-governance path: .*admin_publications\.py/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("compatibility migration never auto-promotes legacy approval to ready", async () => {
  const [migration, adr] = await Promise.all([
    readFile(
      path.join(
        repoRoot,
        "infra/supabase/migrations/0018_single_accountable_approver_compatibility.sql",
      ),
      "utf8",
    ),
    readFile(
      path.join(
        repoRoot,
        "docs/architecture/adr-0002-single-accountable-archive-approver.md",
      ),
      "utf8",
    ),
  ]);

  assert.match(migration, /status = 'approved' then 'legacy_approved'/);
  assert.doesNotMatch(migration, /set\s+status\s*=\s*'ready'/i);
  assert.match(migration, /requires_explicit_revalidation/);
  assert.match(migration, /release_count_before/);
  assert.match(migration, /release_count_after/);
  assert.match(adr, /Never becomes ready automatically/);
  assert.match(adr, /archive_governance_migration_required/);
});
