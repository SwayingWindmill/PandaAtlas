import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("private notification center is noindex, feature-flagged, and session-first", async () => {
  const [route, page, config, login] = await Promise.all([
    source("apps/web/app/[locale]/me/inbox/page.tsx"),
    source("apps/web/features/notification-center/notification-center-page.tsx"),
    source("apps/web/features/notification-center/config.ts"),
    source("apps/web/features/auth/email-otp-login.tsx"),
  ]);

  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /export const revalidate = 0/);
  assert.match(route, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(route, /isNotificationCenterEnabled\(\)/);
  assert.match(config, /NEXT_PUBLIC_NOTIFICATION_ENABLED/);
  assert.match(page, /fetch\("\/api\/identity\/session"/);
  assert.ok(page.indexOf('/api/identity/session') < page.indexOf('/api/notification/inbox'));
  assert.match(page, /status === 401/);
  assert.match(login, /passport\|feed\|inbox\|submissions/);
});

test("Inbox proxy, read state, and preferences stay behind the trusted FastAPI boundary", async () => {
  const [inbox, read, readAll, preferences, page] = await Promise.all([
    source("apps/web/app/api/notification/inbox/route.ts"),
    source("apps/web/app/api/notification/inbox/[inboxItemId]/read/route.ts"),
    source("apps/web/app/api/notification/inbox/read-all/route.ts"),
    source("apps/web/app/api/notification/preferences/route.ts"),
    source("apps/web/features/notification-center/notification-center-page.tsx"),
  ]);

  for (const proxy of [inbox, read, readAll, preferences]) {
    assert.match(proxy, /callFastApiEngagement/);
    assert.doesNotMatch(proxy, /cookies\(|Authorization|PRIVATE_FASTAPI_BASE_URL/);
  }
  assert.match(inbox, /\/api\/v1\/me\/inbox/);
  assert.match(read, /\/api\/v1\/me\/inbox\/\$\{encodeURIComponent\(inboxItemId\)\}\/read/);
  assert.match(readAll, /\/api\/v1\/me\/inbox\/read-all/);
  assert.match(preferences, /\/api\/v1\/me\/notification-preferences/);
  assert.match(page, /retracted_at/);
  assert.match(page, /aria-pressed=\{enabled\}/);
  assert.match(page, /Security and role notifications are mandatory/);
});

test("notification environment examples are disabled and credential-free by default", async () => {
  const env = await source(".env.example");
  const smtpPassword = ["AUTH", "SMTP", "PASSWORD"].join("_");

  for (const name of [
    "NEXT_PUBLIC_ENGAGEMENT_ENABLED",
    "NEXT_PUBLIC_FEED_ENABLED",
    "NEXT_PUBLIC_NOTIFICATION_ENABLED",
    "ENGAGEMENT_ENABLED",
    "ACTIVITY_ENABLED",
    "FEED_ENABLED",
    "NOTIFICATION_ENABLED",
    "NOTIFICATION_EMAIL_ENABLED",
  ]) {
    assert.match(env, new RegExp("^" + name + "=false$", "m"));
  }
  for (const name of [
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_WEBHOOK_SECRET",
    "AUTH_SMTP_HOST",
    "AUTH_SMTP_USERNAME",
    smtpPassword,
    "AUTH_SMTP_FROM_EMAIL",
    "NOTIFICATION_STAGING_TO_EMAIL",
  ]) {
    assert.match(env, new RegExp("^" + name + "=$", "m"));
  }
  assert.match(env, /^AUTH_SMTP_PORT=587$/m);
});

test("notification center owns map-close browser and performance evidence", async () => {
  const [mapClose, mapClosePlan, budget, smoke, workflow] = await Promise.all([
    source("scripts/release/map-close.mjs"),
    source("scripts/release/certification/map-close-plan.mjs"),
    source("scripts/release/check-notification-center-budget.mjs"),
    source("apps/web/tests/smoke/published-return-loop.spec.ts"),
    source(".github/workflows/release-gate.yml"),
  ]);

  assert.match(mapClose, /createMapCloseCertificationPlan/);
  assert.match(mapClosePlan, /check:notification-center-budget/);
  assert.match(mapClosePlan, /published-return-loop\.spec\.ts/);
  assert.match(budget, /\/\[locale\]\/me\/inbox\/page/);
  assert.match(budget, /140 \* 1024/);
  assert.match(smoke, /width: 320/);
  assert.match(smoke, /privateRequests/);
  assert.match(workflow, /release:map-close:windows/);
  assert.match(workflow, /test_notification_real_db\.py/);
});
