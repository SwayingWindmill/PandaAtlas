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
    if (entry.isDirectory()) {
      const ignored =
        entry.name === ".next" ||
        entry.name.startsWith(".next-") ||
        entry.name === ".open-next" ||
        entry.name === "node_modules";
      return ignored ? [] : sourceFiles(relative);
    }
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [relative] : [];
  }));
  return nested.flat();
}

test("My Pandas keeps public facts server-owned, Passport account-private, and recent history browser-local", async () => {
  const [route, page, island, viewModel, preferences, engagementConfig] = await Promise.all([
    source("apps/web/app/[locale]/my-pandas/page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-passport-island.tsx"),
    source("apps/web/features/my-pandas/my-pandas-view-model.ts"),
    source("apps/web/features/preferences/profile-preferences.ts"),
    source("apps/web/lib/engagement/config.ts"),
  ]);

  assert.match(route, /loadPublishedAtlasDataset\(locale\)/);
  assert.match(route, /buildMyPandasViewModel\(envelope\.data, locale\)/);
  assert.match(page, /<MyPandasPassportIsland/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(island, /^["']use client["']/);
  assert.match(island, /fetch\(["']\/api\/engagement\/passport["']/);
  assert.doesNotMatch(island, /loadPublishedAtlasDataset|NEXT_PUBLIC_API_BASE_URL|supabase/i);
  assert.doesNotMatch(viewModel, /localStorage|sessionStorage|useEffect|fetch\(/);
  assert.match(preferences, /version: STORAGE_VERSION/);
  assert.match(preferences, /saved: \[\]/);
  assert.match(preferences, /recent: recent\.slice/);
  assert.match(preferences, /removeItem\(LEGACY_SAVED_PROFILES_STORAGE_KEY\)/);
  assert.doesNotMatch(preferences, /name_zh|name_en|current_place|public_revision|source_ids/);
  assert.match(engagementConfig, /NEXT_PUBLIC_ENGAGEMENT_ENABLED/);
});

test("Engagement server routes pin trusted origins and preserve caller idempotency", async () => {
  const [proxy, otpStart, preferenceRoute, rebuildRoute, login] = await Promise.all([
    source("apps/web/lib/server/fastapi-engagement-proxy.ts"),
    source("apps/web/app/api/auth/email-otp/start/route.ts"),
    source("apps/web/app/api/engagement/preferences/[category]/[channel]/route.ts"),
    source("apps/web/app/api/engagement/passport/rebuild/route.ts"),
    source("apps/web/features/auth/email-otp-login.tsx"),
  ]);

  assert.match(proxy, /process\.env\.API_BASE_URL/);
  assert.doesNotMatch(proxy, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(proxy, /\.\.\.options\.headers[\s\S]*Authorization[\s\S]*X-Correlation-Id/);
  assert.match(otpStart, /process\.env\.SITE_URL/);
  assert.doesNotMatch(otpStart, /request\.nextUrl\.origin/);
  assert.match(preferenceRoute, /idempotency_key: idempotencyKey/);
  assert.doesNotMatch(preferenceRoute, /preference-\$\{crypto\.randomUUID/);
  assert.match(rebuildRoute, /headers\.get\("Idempotency-Key"\)/);
  assert.doesNotMatch(rebuildRoute, /passport-rebuild-\$\{crypto\.randomUUID/);
  assert.match(login, /consentIdempotencyKey\.current \?\?=/);
});

test("My Pandas centralizes application localStorage access in the preferences module", async () => {
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

test("My Pandas exposes private Passport, legacy-save separation, canonical links, and no-JS fallback", async () => {
  const [page, island, viewModel, preferences, route, legacyRoute] = await Promise.all([
    source("apps/web/features/my-pandas/my-pandas-page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-passport-island.tsx"),
    source("apps/web/features/my-pandas/my-pandas-view-model.ts"),
    source("apps/web/features/preferences/profile-preferences.ts"),
    source("apps/web/app/[locale]/my-pandas/page.tsx"),
    source("apps/web/app/my-pandas/page.tsx"),
  ]);

  assert.match(page, /<noscript>/);
  assert.match(page, /data-testid="my-pandas-page"/);
  assert.match(island, /data-testid="passport-section"/);
  assert.match(island, /data-testid="recent-pandas-section"/);
  assert.match(island, /clearRecentProfiles/);
  assert.match(island, /relationship_state: "active" \| "inactive" \| null/);
  assert.match(island, /contribution_count/);
  assert.match(island, /unavailableTitle/);
  assert.match(viewModel, /href: `\/\$\{locale\}\/atlas\/\$\{panda\.slug\}`/);
  assert.match(viewModel, /private Panda Passport/i);
  assert.match(viewModel, /never converted into Follow, Passport, or email consent/i);
  assert.match(preferences, /toggleSavedProfile[\s\S]*return false/);
  assert.doesNotMatch(viewModel, /recommendation_score|popularity_rank|followers_count|sharing_count|behavior_profile/i);
  assert.match(route, /robots: \{ index: false, follow: true \}/);
  assert.match(route, /"x-default": "\/zh\/my-pandas"/);
  assert.match(legacyRoute, /permanentRedirect\(localizedPublicDestination\(locale, ["']\/my-pandas["']\)/);
});

test("My Pandas performance budget is reproducible and part of the default gate", async () => {
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
