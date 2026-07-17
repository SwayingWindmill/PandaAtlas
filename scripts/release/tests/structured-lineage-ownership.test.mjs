import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("localized structured lineage owns the production route without API or graph fallback", async () => {
  const localizedPage = await source("apps/web/app/[locale]/lineage/page.tsx");
  const legacyPage = await source("apps/web/app/lineage/page.tsx");
  const query = await source("apps/web/features/lineage/lineage-query.ts");
  const viewModel = await source("apps/web/features/lineage/lineage-view-model.ts");
  const page = await source("apps/web/features/lineage/structured-lineage-page.tsx");
  const publicRelease = await source("apps/web/features/public-content/public-release.ts");

  assert.match(localizedPage, /loadPublishedLineageDataset/);
  assert.match(localizedPage, /buildStructuredLineageViewModel/);
  assert.doesNotMatch(localizedPage, /api-client|lineage-explorer|lineage-data/);
  assert.doesNotMatch(page, /["']use client["']|lineage-explorer|api-client/);

  assert.match(legacyPage, /permanentRedirect/);
  assert.match(legacyPage, /localizedPublicDestination/);
  assert.doesNotMatch(legacyPage, /LineageExplorer|getPandaLineage/);

  for (const parameter of ["focus", "ancestors", "descendants", "relation"]) {
    assert.match(query, new RegExp(`\\b${parameter}\\b`));
  }
  assert.match(query, /needsNormalization/);

  assert.match(viewModel, /PublicParentageAssertionSummary/);
  assert.match(viewModel, /assertionsByChild/);
  assert.match(viewModel, /assertionsByParent/);
  assert.match(viewModel, /tentative/);
  assert.match(viewModel, /disputed/);
  assert.match(viewModel, /superseded/);
  assert.doesNotMatch(viewModel, /father_id|mother_id/);

  assert.match(publicRelease, /loadPublishedLineageDataset/);
  assert.match(publicRelease, /TRUSTED_PARENTAGE_ASSERTIONS/);
  assert.match(publicRelease, /TRUSTED_LINEAGE_NODES/);
});
