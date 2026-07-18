import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Slice 9 Editorial Home is server-owned and sourced from the versioned public release", async () => {
  const [page, component, viewModel] = await Promise.all([
    source("apps/web/app/[locale]/page.tsx"),
    source("apps/web/features/home/editorial-home-page.tsx"),
    source("apps/web/features/home/editorial-home-view-model.ts"),
  ]);

  assert.match(page, /loadPublishedAtlasDataset\(locale\)/);
  assert.match(page, /buildEditorialHomeViewModel\(envelope, locale\)/);
  assert.match(page, /<EditorialHomePage/);
  assert.doesNotMatch(page, /searchPublishedPandas\(""/);
  assert.doesNotMatch(component, /["']use client["']/);
  assert.doesNotMatch(viewModel, /fetch\(|useEffect|localStorage|sessionStorage/);
  assert.match(viewModel, /const editorialSelection = \["mei-xiang", "bao-li", "xiao-qi-ji"\]/);
  assert.match(viewModel, /panda\.public_revision\?\.summaries/);
  assert.match(viewModel, /if \(!summary \|\| !panda\.public_revision\) return \[\]/);
});

test("Slice 9 exposes the five-section IA without unsupported homepage metrics", async () => {
  const [component, viewModel] = await Promise.all([
    source("apps/web/features/home/editorial-home-page.tsx"),
    source("apps/web/features/home/editorial-home-view-model.ts"),
  ]);

  for (const testId of [
    "editorial-home",
    "editorial-selections",
    "relationship-place-exploration",
    "recent-archive-revisions",
    "archive-method",
  ]) assert.match(component, new RegExp(`data-testid=["']${testId}["']`));

  assert.match(component, /role="search"/);
  assert.match(component, /method="get"/);
  assert.match(viewModel, /editorial selections, not rankings/i);
  assert.doesNotMatch(viewModel, /totalPublished|views_count|followers_count|growth_rate|social_proof/);
  assert.doesNotMatch(component, /<img|next\/image/);
});

test("Slice 9 keeps root locale resolution and removes quarantined legacy Home assets and animation", async () => {
  const [rootPage, globalCss, homeCss] = await Promise.all([
    source("apps/web/app/page.tsx"),
    source("apps/web/app/globals.css"),
    source("apps/web/styles/editorial-home.css"),
  ]);

  assert.match(rootPage, /permanentRedirect\(localizedPublicDestination\(locale, "\/"\)/);
  assert.match(globalCss, /@import "\.\.\/styles\/editorial-home\.css"/);
  assert.doesNotMatch(globalCss, /\.home-fade-up|@keyframes home-fade-up|\.home-hero-media/);
  assert.match(homeCss, /\.pa-home-profile-stage/);
  assert.match(homeCss, /\.pa-home-revision-list/);
  await assert.rejects(access(new URL("apps/web/public/home/", root)));
});

test("Slice 9 performance budgets are reproducible and part of the default gate", async () => {
  const [budget, packageJson, defaultGate] = await Promise.all([
    source("scripts/release/check-editorial-home-budget.mjs"),
    source("package.json"),
    source("scripts/release/default.mjs"),
  ]);

  assert.match(budget, /const firstLoadLimitBytes = 140 \* 1024/);
  assert.match(budget, /const transferLimitBytes = 500 \* 1024/);
  assert.match(budget, /\["\/layout", "\/\[locale\]\/layout", "\/\[locale\]\/page"\]/);
  assert.match(packageJson, /"check:editorial-home-budget"/);
  assert.match(defaultGate, /id: "editorial-home-budget"/);
  assert.match(defaultGate, /dependsOn: \["web-build"\]/);
});
