import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function missing(path) {
  try {
    await access(new URL(path, root));
    return false;
  } catch {
    return true;
  }
}

test("canonical Panda and Passport pages own the only product 200 routes", async () => {
  const [collection, profile, passport, atlasAlias, profileAlias, passportAlias] = await Promise.all([
    source("apps/web/app/[locale]/pandas/page.tsx"),
    source("apps/web/app/[locale]/pandas/[slug]/page.tsx"),
    source("apps/web/app/[locale]/me/passport/page.tsx"),
    source("apps/web/app/[locale]/atlas/page.tsx"),
    source("apps/web/app/[locale]/atlas/[slug]/page.tsx"),
    source("apps/web/app/[locale]/my-pandas/page.tsx"),
  ]);

  assert.match(collection, /data-testid="localized-pandas-page"/);
  assert.match(collection, /action={`\/\$\{locale\}\/pandas`}/);
  assert.match(collection, /buildPublicMetadata\(/);
  assert.match(collection, /path: "\/pandas"/);
  assert.match(profile, /<TrustedProfilePage/);
  assert.match(profile, /localizedPublicDestination\(locale, `\/pandas\/\$\{reference\.slug\}`/);
  assert.match(passport, /<MyPandasPage/);
  assert.match(passport, /buildPublicMetadata\(/);
  assert.match(passport, /path: "\/me\/passport"/);
  assert.match(passport, /privatePage: true/);

  for (const alias of [atlasAlias, profileAlias, passportAlias]) {
    assert.match(alias, /permanentRedirect\(/);
    assert.doesNotMatch(alias, /<LocalizedAtlasDiscoveryPage|<TrustedProfilePage|<MyPandasPage/);
  }
});

test("middleware and sitemap canonicalize aliases without publishing private or legacy URLs", async () => {
  const [middleware, sitemap] = await Promise.all([
    source("apps/web/middleware.ts"),
    source("apps/web/app/sitemap.ts"),
  ]);

  assert.match(middleware, /NextResponse\.redirect\(destination, 308\)/);
  assert.match(middleware, /pathname === "\/pandas" \|\| pathname === "\/atlas"/);
  assert.match(middleware, /localizedCollection = pathname\.match/);
  assert.match(middleware, /TRUSTED_PANDA_REFERENCES/);
  assert.match(middleware, /`\/\$\{locale\}\/pandas\/\$\{reference\.slug\}`/);

  assert.match(sitemap, /`\$\{siteUrl\}\/\$\{locale\}\/pandas`/);
  assert.match(sitemap, /`\$\{siteUrl\}\/\$\{locale\}\/pandas\/\$\{panda\.slug\}`/);
  assert.doesNotMatch(sitemap, /atlas|my-pandas|me\/passport/);
});

test("Saved Panda code is removed and Pending Follow owns a canonical server-derived return path", async () => {
  const [preferences, followControl, repository, login] = await Promise.all([
    source("apps/web/features/preferences/profile-preferences.ts"),
    source("apps/web/components/pandas/panda-follow-control.tsx"),
    source("services/api/app/engagement/repository.py"),
    source("apps/web/features/auth/email-otp-login.tsx"),
  ]);

  assert.equal(await missing("apps/web/components/atlas/trusted-profile-favorite.tsx"), true);
  assert.equal(await missing("apps/web/features/my-pandas/my-pandas-island.tsx"), true);
  assert.doesNotMatch(
    preferences,
    /toggleSavedProfile|removeSavedProfile|clearSavedProfiles|MAX_SAVED_PROFILES|saved:/,
  );
  assert.match(preferences, /removeItem\(LEGACY_SAVED_PREFERENCE_STORAGE_KEY\)/);
  assert.match(preferences, /removeItem\(LEGACY_SAVED_PROFILES_STORAGE_KEY\)/);
  assert.doesNotMatch(followControl, /localStorage|saved-profiles|toggleSaved/i);
  assert.match(followControl, /\/api\/engagement\/follow-intents/);
  assert.match(followControl, /\/api\/engagement\/preferences\/major_activity\/email/);
  assert.match(repository, /safe_return_path = f"\/\{locale\}\/pandas\/\{panda\['slug'\]\}"/);
  assert.match(repository, /panda_id = str\(panda\["id"\]\)/);
  assert.match(login, /SAFE_APP_PATH/);
  assert.doesNotMatch(login, /Magic Link|signInWithOtp\(/i);
});
