import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

async function sourceFiles(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [relative] : [];
  }));
  return nested.flat();
}

test("Slice 10 My Pandas keeps release facts server-owned and browser storage local-only", async () => {
  const [route, page, island, viewModel, preferences] = await Promise.all([
    source("apps/web/app/[locale]/my-pandas/page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-island.tsx"),
    source("apps/web/features/my-pandas/my-pandas-view-model.ts"),
    source("apps/web/features/preferences/profile-preferences.ts"),
  ]);

  assert.match(route, /loadPublishedAtlasDataset\(locale\)/);
  assert.match(route, /buildMyPandasViewModel\(envelope\.data, locale\)/);
  assert.match(page, /<MyPandasIsland/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(island, /^["']use client["']/);
  assert.doesNotMatch(island, /loadPublishedAtlasDataset|fetch\(|NEXT_PUBLIC_API_BASE_URL/);
  assert.doesNotMatch(viewModel, /localStorage|sessionStorage|useEffect|fetch\(/);
  assert.match(preferences, /version: STORAGE_VERSION/);
  assert.match(preferences, /saved: snapshot\.saved/);
  assert.match(preferences, /recent: snapshot\.recent/);
  assert.doesNotMatch(preferences, /name_zh|name_en|current_place|public_revision|source_ids/);
});

test("Slice 10 centralizes application localStorage access in the preferences module", async () => {
  const files = await sourceFiles("apps/web");
  const offenders = [];
  for (const file of files) {
    const normalized = file.split(path.sep).join("/");
    if (normalized.includes("/.next/") || normalized.includes("/tests/")) continue;
    const contents = await source(file);
    if (/localStorage/.test(contents) && normalized !== "apps/web/features/preferences/profile-preferences.ts") {
      offenders.push(normalized);
    }
  }
  assert.deepEqual(offenders, []);
});

test("Slice 10 exposes local disclosure, stale-ID handling, canonical links, and no-JS fallback", async () => {
  const [page, island, viewModel, route, legacyRoute] = await Promise.all([
    source("apps/web/features/my-pandas/my-pandas-page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-island.tsx"),
    source("apps/web/features/my-pandas/my-pandas-view-model.ts"),
    source("apps/web/app/[locale]/my-pandas/page.tsx"),
    source("apps/web/app/my-pandas/page.tsx"),
  ]);

  assert.match(page, /<noscript>/);
  assert.match(page, /data-testid="my-pandas-page"/);
  assert.match(island, /data-testid="saved-pandas-section"/);
  assert.match(island, /data-testid="recent-pandas-section"/);
  assert.match(island, /clearSavedProfiles/);
  assert.match(island, /clearRecentProfiles/);
  assert.match(island, /Profile unavailable in this release|unavailableTitle/);
  assert.match(viewModel, /href: `\/\$\{locale\}\/atlas\/\$\{panda\.slug\}`/);
  assert.match(viewModel, /not an account center/i);
  assert.doesNotMatch(viewModel, /recommendation_score|popularity_rank|followers_count|sharing_count|behavior_profile/i);
  assert.match(route, /robots: \{ index: false, follow: true \}/);
  assert.match(route, /"x-default": "\/zh\/my-pandas"/);
  assert.match(legacyRoute, /permanentRedirect\(localizedPublicDestination\(locale, ["']\/my-pandas["']\)/);
});

test("Slice 10 performance budget is reproducible and part of the default gate", async () => {
  const [budget, packageJson, defaultGate] = await Promise.all([
    source("scripts/release/check-my-pandas-budget.mjs"),
    source("package.json"),
    source("scripts/release/default.mjs"),
  ]);

  assert.match(budget, /const firstLoadLimitBytes = 140 \* 1024/);
  assert.match(budget, /const transferLimitBytes = 500 \* 1024/);
  assert.match(budget, /\["\/layout", "\/\[locale\]\/layout", "\/\[locale\]\/my-pandas\/page"\]/);
  assert.match(packageJson, /"check:my-pandas-budget"/);
  assert.match(defaultGate, /id: "my-pandas-budget"/);
  assert.match(defaultGate, /dependsOn: \["web-build"\]/);
});
