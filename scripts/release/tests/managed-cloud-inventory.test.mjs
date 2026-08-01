import assert from "node:assert/strict";
import test from "node:test";

import {
  loadManagedCloudInventory,
  validateManagedCloudInventory,
} from "../check-managed-cloud-inventory.mjs";

function cloneInventory() {
  return structuredClone(loadManagedCloudInventory());
}

test("managed-cloud Phase 0 inventory is complete and evidence-backed", () => {
  const summary = validateManagedCloudInventory(cloneInventory());

  assert.equal(summary.phase_0_complete, true);
  assert.ok(summary.responsibilities >= 18);
  assert.ok(summary.production_responsibilities >= 12);
  assert.equal(summary.domains, 3);
  assert.ok(summary.environment_variables >= 20);
  assert.ok(summary.known_gaps >= 8);
});

test("managed-cloud target rejects self-managed production infrastructure", () => {
  const inventory = cloneInventory();
  const web = inventory.responsibilities.find(
    (item) => item.id === "web-production-runtime",
  );
  web.target_owner = "self-managed VPS";

  assert.throws(
    () => validateManagedCloudInventory(inventory, { checkEvidence: false }),
    /forbidden production infrastructure: self-managed/,
  );
});

test("managed-cloud target keeps Vercel, Supabase, R2, GitHub Actions, and Cloudflare DNS boundaries", () => {
  const inventory = cloneInventory();
  const byId = new Map(inventory.responsibilities.map((item) => [item.id, item]));

  assert.deepEqual(byId.get("web-production-runtime").target_runtimes, ["vercel"]);
  assert.deepEqual(byId.get("authoritative-database").target_runtimes, ["supabase"]);
  assert.deepEqual(byId.get("d1-public-projection").target_runtimes, ["retired"]);
  assert.deepEqual(
    byId.get("public-media-storage-and-delivery").target_runtimes,
    ["cloudflare-r2"],
  );
  assert.deepEqual(
    byId.get("research-and-source-acquisition").target_runtimes,
    ["github-actions"],
  );
  assert.deepEqual(
    byId.get("dns-and-domain-routing").target_runtimes,
    ["cloudflare-dns"],
  );
});

test("managed-cloud inventory requires repository evidence for every responsibility", () => {
  const inventory = cloneInventory();
  inventory.responsibilities[0].evidence = ["missing/deployment-evidence.txt"];

  assert.throws(
    () => validateManagedCloudInventory(inventory),
    /references missing evidence missing\/deployment-evidence\.txt/,
  );
});

test("managed-cloud inventory classifies production credentials as secrets", () => {
  const inventory = cloneInventory();
  const databaseUrl = inventory.environment_variables.find(
    (item) => item.name === "DATABASE_URL",
  );
  databaseUrl.secret = false;

  assert.throws(
    () => validateManagedCloudInventory(inventory, { checkEvidence: false }),
    /DATABASE_URL must be classified as secret/,
  );
});
