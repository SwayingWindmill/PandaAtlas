import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

async function doesNotExist(relativePath) {
  try {
    await access(path.join(ROOT, relativePath));
    return false;
  } catch {
    return true;
  }
}

test("localized trusted profile is owned by features/profile without legacy generation or API fallback", async () => {
  const route = await readFile(
    path.join(ROOT, "apps/web/app/[locale]/atlas/[slug]/page.tsx"),
    "utf8",
  );
  const profilePage = await readFile(
    path.join(ROOT, "apps/web/features/profile/trusted-profile-page.tsx"),
    "utf8",
  );

  assert.match(route, /@\/features\/profile\/trusted-profile-page/);
  assert.match(route, /buildTrustedProfilePageViewModel\(envelope\.data, locale\)/);
  assert.doesNotMatch(route, /@\/lib\/api-client|getPandaLineage/);
  assert.doesNotMatch(route, /@\/components\/atlas\/trusted-panda-profile/);
  assert.match(profilePage, /#\$\{id\}/);
  assert.match(profilePage, /id="story"/);
  assert.match(profilePage, /id="sources"/);
  assert.match(profilePage, /id="revisions"/);

  assert.equal(await doesNotExist("apps/web/lib/panda-profile.ts"), true);
  assert.equal(
    await doesNotExist("apps/web/components/atlas/trusted-panda-profile.tsx"),
    true,
  );
});
