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

  assert.equal(inventory.schema_version, 1);
  assert.equal(inventory.inventory.length, 8);
  assert.equal(
    inventory.inventory.reduce(
      (count, entry) => count + (entry.matches[compatibilityTerm] ?? 0),
      0,
    ),
    23,
  );
  assert.ok(
    inventory.inventory.every(
      (entry) =>
        entry.category === "technical-compatible" &&
        entry.user_visibility === "internal" &&
        entry.expected_action === "retain-compatibility" &&
        entry.matches[compatibilityTerm] > 0,
    ),
  );
  assert.match(checker, /zhipanda-brand-technical-inventory\.v1\.json/);
  assert.match(checker, /technicalContract\.inventory/);
  assert.match(checker, /excluded_paths/);
  assert.match(checker, /refreshEntries\(technicalContract\.inventory/);
});
