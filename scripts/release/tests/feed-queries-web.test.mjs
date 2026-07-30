import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("private Feed is server-owned, noindex, no-store, and explicitly marked viewed", async () => {
  const [route, api, page, button, proxy, login] = await Promise.all([
    source("apps/web/app/[locale]/me/feed/page.tsx"),
    source("apps/web/features/feed/feed-api.ts"),
    source("apps/web/features/feed/personalized-feed-page.tsx"),
    source("apps/web/features/feed/mark-feed-viewed-button.tsx"),
    source("apps/web/app/api/feed/last-viewed/route.ts"),
    source("apps/web/features/auth/email-otp-login.tsx"),
  ]);

  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /export const revalidate = 0/);
  assert.match(route, /await connection\(\)/);
  assert.match(route, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(route, /getVerifiedSupabaseAccessToken\(\)/);
  assert.match(route, /loadPersonalizedFeed\(accessToken, cursor\)/);
  assert.match(route, /redirect\(`\/auth\/login\?next=/);
  assert.doesNotMatch(route, /["']use client["']/);
  assert.match(api, /cache: "no-store"/);
  assert.match(api, /PRIVATE_FASTAPI_BASE_URL/);
  assert.match(api, /PUBLIC_FASTAPI_BASE_URL/);
  assert.match(api, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(page, /opening the page never writes viewed state automatically/i);
  assert.match(button, /^["']use client["']/);
  assert.match(button, /fetch\("\/api\/feed\/last-viewed"/);
  assert.match(button, /feed-view-\$\{crypto\.randomUUID\(\)\}/);
  assert.match(proxy, /\/api\/v1\/me\/feed\/last-viewed/);
  assert.match(login, /me\\\/\(\?:passport\|feed\|inbox\)/);
});

test("public Panda Activity is server rendered with explicit correction and retraction states", async () => {
  const [profileRoute, profilePage, publicActivity, timeline, card] = await Promise.all([
    source("apps/web/app/[locale]/pandas/[slug]/page.tsx"),
    source("apps/web/features/profile/trusted-profile-page.tsx"),
    source("apps/web/features/feed/public-panda-activity.tsx"),
    source("apps/web/features/feed/activity-timeline.tsx"),
    source("apps/web/features/feed/activity-card.tsx"),
  ]);

  assert.match(profileRoute, /loadPublicPandaActivity\(profile\.stableId, activityCursor\)/);
  assert.match(profileRoute, /activityUnavailable=\{activityResult\.state === "unavailable"\}/);
  assert.match(profileRoute, /activityPandas=\{atlas\.data\.pandas\}/);
  assert.doesNotMatch(profileRoute, /["']use client["']/);
  assert.match(profilePage, /<PublicPandaActivity/);
  assert.match(publicActivity, /data-testid="public-panda-activity"/);
  assert.match(publicActivity, /activity_cursor=/);
  assert.match(publicActivity, /rel="next"/);
  assert.match(timeline, /role="feed"/);
  assert.doesNotMatch(timeline, /["']use client["']/);
  assert.match(card, /activity\.retraction_state === "retracted"/);
  assert.match(card, /archive\.profile_corrected/);
  assert.match(card, /Panda profile is no longer available/);
});

test("Feed navigation and API exposure remain feature-flagged", async () => {
  const [config, desktop, mobile, backendConfig, apiRoute] = await Promise.all([
    source("apps/web/features/feed/config.ts"),
    source("apps/web/components/patterns/global-navigation.tsx"),
    source("apps/web/components/patterns/mobile-navigation.tsx"),
    source("services/api/app/core/config.py"),
    source("services/api/app/api/v1/feed.py"),
  ]);

  assert.match(config, /NEXT_PUBLIC_FEED_ENABLED/);
  assert.match(desktop, /feedEnabled \? \(/);
  assert.match(desktop, /\/me\/feed/);
  assert.match(mobile, /feedEnabled \? \(/);
  assert.match(backendConfig, /FEED_ENABLED/);
  assert.match(backendConfig, /FEED_CURSOR_SIGNING_KEY/);
  assert.match(apiRoute, /require_feed_enabled/);
  assert.match(apiRoute, /private, no-store/);
  assert.match(apiRoute, /public, max-age=60, stale-while-revalidate=300/);
});
