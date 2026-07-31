import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

async function sourceFiles(relativeDirectory) {
  const directory = new URL(relativeDirectory.endsWith("/") ? relativeDirectory : `${relativeDirectory}/`, root);
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relative = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      const ignored = [".next", ".open-next", "node_modules", "test-results"].includes(entry.name);
      return ignored ? [] : sourceFiles(relative);
    }
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [relative] : [];
  }));
  return nested.flat();
}

test("Panda Passport keeps public facts server-owned and recent history browser-local", async () => {
  const [route, page, island, viewModel, preferences, engagementConfig] = await Promise.all([
    source("apps/web/app/[locale]/me/passport/page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-passport-island.tsx"),
    source("apps/web/features/my-pandas/my-pandas-view-model.ts"),
    source("apps/web/features/preferences/profile-preferences.ts"),
    source("apps/web/lib/engagement/config.ts"),
  ]);

  assert.match(route, /loadPublishedAtlasDataset\(locale\)/);
  assert.match(route, /buildMyPandasViewModel\(envelope\.data, locale\)/);
  assert.match(route, /buildPublicMetadata\(/);
  assert.match(route, /path: "\/me\/passport"/);
  assert.match(route, /privatePage: true/);
  assert.match(page, /<MyPandasPassportIsland/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.match(island, /^["']use client["']/);
  assert.match(island, /fetch\(["']\/api\/engagement\/passport["']/);
  assert.doesNotMatch(island, /loadPublishedAtlasDataset|NEXT_PUBLIC_API_BASE_URL|supabase/i);
  assert.doesNotMatch(viewModel, /localStorage|sessionStorage|useEffect|fetch\(/);
  assert.match(preferences, /version: STORAGE_VERSION/);
  assert.match(preferences, /recent: recent\.slice/);
  assert.match(preferences, /removeItem\(LEGACY_SAVED_PREFERENCE_STORAGE_KEY\)/);
  assert.match(preferences, /removeItem\(LEGACY_SAVED_PROFILES_STORAGE_KEY\)/);
  assert.doesNotMatch(
    preferences,
    /toggleSavedProfile|removeSavedProfile|clearSavedProfiles|MAX_SAVED_PROFILES|saved:/,
  );
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
  assert.match(login, /SAFE_APP_PATH/);
  assert.doesNotMatch(login, /Magic Link|signInWithOtp\(/i);
});

test("Panda Passport centralizes application localStorage access in the recent-history module", async () => {
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

test("Panda Passport exposes private state, canonical links, legacy cleanup, and no-JS fallback", async () => {
  const [page, island, viewModel, preferences, canonicalRoute, localizedAlias, unlocalizedAlias] = await Promise.all([
    source("apps/web/features/my-pandas/my-pandas-page.tsx"),
    source("apps/web/features/my-pandas/my-pandas-passport-island.tsx"),
    source("apps/web/features/my-pandas/my-pandas-view-model.ts"),
    source("apps/web/features/preferences/profile-preferences.ts"),
    source("apps/web/app/[locale]/me/passport/page.tsx"),
    source("apps/web/app/[locale]/my-pandas/page.tsx"),
    source("apps/web/app/my-pandas/page.tsx"),
  ]);

  assert.match(page, /<noscript>/);
  assert.match(page, /data-testid="my-pandas-page"/);
  assert.match(page, /alternatePath={`\/\$\{alternateLocale\}\/me\/passport`}/);
  assert.match(island, /data-testid="passport-section"/);
  assert.match(island, /data-testid="recent-pandas-section"/);
  assert.match(island, /clearRecentProfiles\(\)/);
  assert.match(island, /relationship_state: "active" \| "inactive" \| null/);
  assert.match(island, /contribution_count/);
  assert.match(island, /unavailableTitle/);
  assert.match(viewModel, /href: `\/\$\{locale\}\/pandas\/\$\{panda\.slug\}`/);
  assert.match(viewModel, /private Panda Passport/i);
  assert.match(viewModel, /never converted into Follow, Passport, or email consent/i);
  assert.doesNotMatch(viewModel, /savedTitle|clearSaved|savedAt|feedbackSaved|toggleSaved/i);
  assert.doesNotMatch(preferences, /toggleSavedProfile|removeSavedProfile|clearSavedProfiles/);
  assert.doesNotMatch(viewModel, /recommendation_score|popularity_rank|followers_count|sharing_count|behavior_profile/i);
  assert.match(canonicalRoute, /buildPublicMetadata\(/);
  assert.match(canonicalRoute, /path: "\/me\/passport"/);
  assert.match(canonicalRoute, /privatePage: true/);
  assert.match(localizedAlias, /permanentRedirect\(`\/\$\{locale\}\/me\/passport`/);
  assert.match(unlocalizedAlias, /localizedPublicDestination\(locale, "\/me\/passport"\)/);
});

test("Panda Passport performance budget follows the canonical route and remains in the default gate", async () => {
  const [budget, packageJson, defaultGate] = await Promise.all([
    source("scripts/release/check-my-pandas-budget.mjs"),
    source("package.json"),
    source("scripts/release/default.mjs"),
  ]);

  assert.match(budget, /const firstLoadLimitBytes = 140 \* 1024/);
  assert.match(budget, /const transferLimitBytes = 500 \* 1024/);
  assert.match(budget, /\["\/layout", "\/\[locale\]\/layout", "\/\[locale\]\/me\/passport\/page"\]/);
  assert.match(packageJson, /"check:my-pandas-budget"/);
  assert.match(defaultGate, /id: "my-pandas-budget"/);
  assert.match(defaultGate, /dependsOn: \["web-build"\]/);
});
