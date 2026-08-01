import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("localized contributor pages remain authenticated, private, dynamic, and feature-flagged", async () => {
  const [contribute, submissions, detail, config, middleware] = await Promise.all([
    source("apps/web/app/[locale]/contribute/page.tsx"),
    source("apps/web/app/[locale]/me/submissions/page.tsx"),
    source("apps/web/app/[locale]/me/submissions/[submissionId]/page.tsx"),
    source("apps/web/features/contribute/config.ts"),
    source("apps/web/middleware.ts"),
  ]);

  for (const route of [contribute, submissions, detail]) {
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /export const revalidate = 0/);
    assert.match(route, /await connection\(\)/);
    assert.match(route, /isCommunityIntakeUiEnabled\(\)/);
    assert.match(route, /getVerifiedSupabaseAccessToken\(\)/);
    assert.match(route, /redirect\(/);
    assert.match(route, /buildPublicMetadata\(\{/);
    assert.match(route, /privatePage: true/);
    assert.match(route, /noFollow: true/);
    assert.doesNotMatch(route, /^["']use client["']/m);
  }

  assert.match(config, /NEXT_PUBLIC_COMMUNITY_INTAKE_ENABLED/);
  assert.match(middleware, /\/\^\\\/\(zh\|en\)\\\/contribute\$\//);
  assert.match(middleware, /\/\^\\\/\(zh\|en\)\\\/me\\\/submissions/);
  assert.match(middleware, /no-store, no-cache, private, max-age=0, must-revalidate/);
  assert.match(middleware, /noindex, nofollow, noarchive, nosnippet/);
});

test("contributor editor keeps drafts synchronized and formal commands explicit", async () => {
  const [editor, api] = await Promise.all([
    source("apps/web/features/contribute/contribution-editor.tsx"),
    source("apps/web/features/contribute/api.ts"),
  ]);

  assert.match(editor, /^["']use client["']/);
  assert.match(editor, /window\.setTimeout\(\(\) => void saveDraft\(\), 900\)/);
  assert.match(editor, /"save-draft"/);
  assert.match(editor, /responding \? "respond-information-request" : "submit"/);
  assert.match(editor, /"withdraw"/);
  assert.match(editor, /confirmation: true/);
  assert.match(editor, /assertion\.explanation\.length < 10/);
  assert.match(editor, /!assertion\.source_locators\.length && !assertion\.attachment_ids\.length/);
  assert.match(editor, /prepareAttachment\(/);
  assert.match(editor, /uploadAttachment\(/);
  assert.match(editor, /Evidence uploaded to the quarantine scan queue/);
  assert.match(editor, /Submission version history/);
  assert.match(editor, /Per-assertion results/);

  assert.match(api, /response\.headers\.get\("etag"\)/);
  assert.match(api, /headers: \{ "Content-Type": "application\/json", "If-Match": etag \}/);
  assert.match(api, /cache: "no-store"/);
  assert.match(api, /FormData\(\)/);
  assert.match(api, /upload_reference/);
});

test("Next proxy preserves the private FastAPI write boundary and command allowlist", async () => {
  const [proxy, commandRoute, attachmentRoute, navigation, mobileNavigation] = await Promise.all([
    source("apps/web/lib/server/fastapi-community-intake-proxy.ts"),
    source("apps/web/app/api/community-intake/submissions/[submissionId]/commands/[command]/route.ts"),
    source("apps/web/app/api/community-intake/attachments/[attachmentId]/content/route.ts"),
    source("apps/web/components/patterns/global-navigation.tsx"),
    source("apps/web/components/patterns/mobile-navigation.tsx"),
  ]);

  assert.match(proxy, /import "server-only"/);
  assert.match(proxy, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(proxy, /cache: "no-store"/);
  assert.match(proxy, /"Cache-Control": "private, no-store"/);
  assert.match(proxy, /"X-Robots-Tag": "noindex, nofollow"/);
  assert.match(proxy, /if \(etag\) headers\.set\("ETag", etag\)/);

  for (const command of [
    "save-draft",
    "submit",
    "respond-information-request",
    "withdraw",
    "prepare-attachment",
  ]) {
    assert.match(commandRoute, new RegExp(`"${command}"`));
  }
  assert.match(commandRoute, /If-Match header is required/);
  assert.match(commandRoute, /headers: \{ "If-Match": ifMatch \}/);
  assert.match(attachmentRoute, /If-Match header is required/);
  assert.match(attachmentRoute, /formData/);

  assert.match(navigation, /isCommunityIntakeUiEnabled/);
  assert.match(navigation, /contributeEnabled/);
  assert.match(mobileNavigation, /contributeEnabled/);
  assert.match(mobileNavigation, /\/contribute/);
});
