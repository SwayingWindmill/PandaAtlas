import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Slice 7 remains an optional client island owned by the structured map", async () => {
  const localizedPage = await source("apps/web/app/[locale]/map/page.tsx");
  const structuredPage = await source("apps/web/features/map/structured-map-page.tsx");
  const enhancement = await source("apps/web/features/map/visualization/map-visualization-enhancement.tsx");
  const island = await source("apps/web/features/map/visualization/map-visualization-island.tsx");
  const visualModel = await source("apps/web/features/map/visualization/map-visual-model.ts");
  const query = await source("apps/web/features/map/map-query.ts");
  const provider = await source("apps/web/features/map/map-provider-registry.ts");
  const thirdPartyCss = await source("apps/web/styles/third-party/maplibre.css");
  const globals = await source("apps/web/app/globals.css");
  const nextConfig = await source("apps/web/next.config.ts");
  const budget = await source("scripts/release/check-map-visualization-budget.mjs");

  assert.match(localizedPage, /buildMapVisualizationModel/);
  assert.match(structuredPage, /MapVisualizationEnhancement/);
  assert.doesNotMatch(structuredPage, /["']use client["']|maplibre-gl/);

  assert.match(enhancement, /dynamic\(/);
  assert.match(enhancement, /ssr:\s*false/);
  assert.match(enhancement, /activate-map-visualization/);
  assert.match(enhancement, /!active\s*&&/);
  assert.match(enhancement, /MAP_VISUALIZATION_LOAD_TIMEOUT_MS/);
  assert.match(enhancement, /map-visualization-failure/);
  assert.match(enhancement, /navigator\.onLine/);
  assert.match(enhancement, /MapVisualizationErrorBoundary/);

  assert.match(island, /maplibre-source-runtime\.js/);
  assert.match(island, /maplibre-gl-csp-worker\.js\?maplibre-worker/);
  assert.match(island, /cooperativeGestures:\s*true/);
  assert.match(island, /prefersReducedMapMotion/);
  assert.match(island, /structuredMapHref/);
  assert.match(island, /router\.(?:push|replace)/);
  assert.match(island, /role=["']region["']/);
  assert.match(island, /pa-map-visualization-attribution/);
  assert.match(island, /Non-drag selection|非拖拽选择/);

  assert.match(visualModel, /visualizationKey/);
  assert.match(visualModel, /country precision|国家级精度/);
  assert.match(visualModel, /structuredMapHref/);
  assert.match(query, /\bview\b/);
  assert.match(query, /canonicalMapViewportValue/);

  for (const field of ["activationPolicy", "tileUrl", "attribution", "failureBehavior"]) {
    assert.match(provider, new RegExp(`\\b${field}\\b`));
  }
  assert.match(provider, /explicit user activation/);

  assert.match(thirdPartyCss, /maplibre-gl\/dist\/maplibre-gl\.css/);
  assert.doesNotMatch(globals, /maplibre-gl\/dist\/maplibre-gl\.css/);
  assert.match(nextConfig, /transpilePackages:\s*\["maplibre-gl"\]/);
  assert.match(nextConfig, /maplibre-worker/);
  assert.match(nextConfig, /maxSize:\s*420_000/);

  assert.match(budget, /180 \* 1024/);
  assert.match(budget, /aggregate_gzip_bytes/);
  assert.match(budget, /largest\.gzip_bytes <= limitBytes/);

  for (const legacyPath of [
    "apps/web/components/atlas/global-distribution-shell.tsx",
    "apps/web/components/atlas/map-stage.tsx",
    "apps/web/components/atlas/map-overlay.tsx",
    "apps/web/components/atlas/map-viewport.ts",
  ]) {
    await assert.rejects(source(legacyPath));
  }
});
