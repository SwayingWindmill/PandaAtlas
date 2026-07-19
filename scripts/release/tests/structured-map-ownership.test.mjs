import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("localized structured map owns the production route without a map-only dependency", async () => {
  const localizedPage = await source("apps/web/app/[locale]/map/page.tsx");
  const legacyMap = await source("apps/web/app/map/page.tsx");
  const legacyDistribution = await source("apps/web/app/(site)/global-distribution/page.tsx");
  const query = await source("apps/web/features/map/map-query.ts");
  const viewModel = await source("apps/web/features/map/map-view-model.ts");
  const page = await source("apps/web/features/map/structured-map-page.tsx");
  const providerRegistry = await source("apps/web/features/map/map-provider-registry.ts");
  const publicRelease = await source("apps/web/features/public-content/public-release.ts");
  const mapDataSource = await source("apps/web/features/map/map-data-source.ts");
  const visualizationEnhancement = await source("apps/web/features/map/visualization/map-visualization-enhancement.tsx");
  const visualizationIsland = await source("apps/web/features/map/visualization/map-visualization-island.tsx");

  assert.match(localizedPage, /loadPublishedMapDataset/);
  assert.match(localizedPage, /loadHabitatMapInput/);
  assert.match(localizedPage, /buildStructuredMapViewModel/);
  assert.doesNotMatch(localizedPage, /GlobalDistributionShell|MapStage|MapLibre|PandaAtlasExplorer/);
  assert.doesNotMatch(page, /["']use client["']|maplibre-gl|GlobalDistributionShell|api-client/);

  for (const legacyPage of [legacyMap, legacyDistribution]) {
    assert.match(legacyPage, /permanentRedirect/);
    assert.match(legacyPage, /localizedPublicDestination/);
    assert.doesNotMatch(legacyPage, /GlobalDistributionShell|MapShell|PandaAtlasExplorer|getDistribution/);
  }

  for (const parameter of ["mode", "focus", "country", "status", "snapshot", "selected"]) {
    assert.match(query, new RegExp(`\\b${parameter}\\b`));
  }
  for (const mode of ["institutions", "individual", "wild"]) {
    assert.match(query, new RegExp(`\\b${mode}\\b`));
  }
  assert.match(query, /needsNormalization/);

  assert.match(viewModel, /PublicFacilitySummary/);
  assert.match(viewModel, /residencies/);
  assert.match(viewModel, /current_place/);
  assert.match(viewModel, /facility|locality|province|country/);
  assert.match(viewModel, /cached-release|unavailable/);
  assert.doesNotMatch(viewModel, /coordinates/);

  for (const field of [
    "baseMapProvider",
    "styleLicense",
    "attribution",
    "screenshotExportPolicy",
    "privacy",
    "snapshotPolicy",
    "failureBehavior",
  ]) {
    assert.match(providerRegistry, new RegExp(`\\b${field}\\b`));
  }
  assert.match(providerRegistry, /loadedByStructuredRoute:\s*false/);

  assert.match(publicRelease, /loadPublishedMapDataset/);
  assert.match(publicRelease, /TRUSTED_FACILITIES/);
  assert.match(mapDataSource, /loadHabitatMapInput/);
  assert.match(mapDataSource, /source:\s*["']cached-release["']/);
  assert.doesNotMatch(mapDataSource, /FALLBACK_PANDA|LINEAGE_PANDAS|FALLBACK_STATS/);
  assert.match(visualizationEnhancement, /MAP_VISUALIZATION_LOAD_TIMEOUT_MS/);
  assert.match(visualizationEnhancement, /map-visualization-loading/);
  assert.match(visualizationEnhancement, /map-visualization-failure/);
  assert.match(visualizationIsland, /onMount/);

  await assert.rejects(source("apps/web/components/map/map-shell.tsx"));
  await assert.rejects(source("apps/web/components/map/panda-atlas-explorer.tsx"));
});
