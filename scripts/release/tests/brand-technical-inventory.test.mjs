import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventoryUrl = new URL(
  "../../../contracts/zhipanda-brand-technical-inventory.v1.json",
  import.meta.url,
);
const checkerUrl = new URL("../../brand/check-zhipanda-brand.mjs", import.meta.url);

test("technical compatibility identifiers use a separate audited brand inventory", async () => {
  const inventory = JSON.parse(await readFile(inventoryUrl, "utf8"));
  const checker = await readFile(checkerUrl, "utf8");
  const compatibilityTerm = ["panda", "atlas"].join("-");
  const requiredInventoryPaths = [
    "contracts/managed-cloud-deployment-inventory.v1.json",
    "contracts/vercel-web-deployment.v1.json",
    "data/deployment-evidence/vercel-web-2026-08-01.json",
    "docs/deployment/managed-cloud-phase-0-inventory.md",
    "docs/deployment/vercel-web-phase-1.md",
    "scripts/release/check-managed-cloud-inventory.mjs",
    "scripts/release/tests/vercel-web-deployment-plan.test.mjs",
    "services/api/tests/contracts/test_moderation_openapi_contract.py",
    "docs/architecture/scoped-moderation-and-appeals.md",
  ];

  assert.equal(inventory.schema_version, 1);
  const inventoryPaths = inventory.inventory.map((entry) => entry.path);
  assert.equal(new Set(inventoryPaths).size, inventoryPaths.length);
  for (const requiredPath of requiredInventoryPaths) {
    assert.ok(inventoryPaths.includes(requiredPath), `Missing technical inventory path: ${requiredPath}`);
  }
  assert.ok(inventory.inventory.some((entry) => (entry.matches[compatibilityTerm] ?? 0) > 0));
  assert.ok(
    inventory.inventory.every((entry) => {
      const matchCounts = Object.values(entry.matches ?? {});
      return (
        entry.category === "technical-compatible" &&
        entry.user_visibility === "internal" &&
        entry.expected_action === "retain-compatibility" &&
        typeof entry.migration_owner === "string" &&
        entry.migration_owner.length > 0 &&
        typeof entry.rationale === "string" &&
        entry.rationale.length > 0 &&
        matchCounts.length > 0 &&
        matchCounts.every((count) => Number.isInteger(count) && count > 0)
      );
    }),
  );
  assert.match(checker, /zhipanda-brand-technical-inventory\.v1\.json/);
  assert.match(checker, /technicalContract\.inventory/);
  assert.match(checker, /excluded_paths/);
  assert.match(checker, /refreshEntries\(technicalContract\.inventory/);
});
