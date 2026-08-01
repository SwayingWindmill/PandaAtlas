import { expect, test, type Page } from "@playwright/test";

import { isDeployedFeatureEnabled } from "../fixtures/deployment-features";

const engagementEnabled = isDeployedFeatureEnabled("engagement");

const session = {
  account_id: "11111111-1111-1111-1111-111111111111",
  email: "member@example.invalid",
  state: "active",
  roles: ["member"],
  capabilities: ["account.session.read"],
  recent_auth: true,
  authenticated_at: "2026-07-29T00:00:00Z",
  authentication_method: "otp",
  assurance_level: "aal1",
  expires_at: "2026-07-29T01:00:00Z",
};

async function mockSignedOut(page: Page) {
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"detail":"Authentication required"}',
    });
  });
}

async function mockPendingContext(page: Page, locale: "zh" | "en" = "en") {
  await page.route(/\/api\/engagement\/follow-intents$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        intent_id: "22222222-2222-2222-2222-222222222222",
        panda_id: "stable-panda-mei-xiang",
        locale,
        safe_return_path: `/${locale}/pandas/mei-xiang`,
        status: "pending",
        outcome: null,
        expires_at: "2026-07-29T10:00:00Z",
      }),
    });
  });
}

test("serves only canonical Panda 200 routes and emits canonical sitemap URLs", async ({ request }) => {
  const collection = await request.get("/zh/pandas", { maxRedirects: 0 });
  expect(collection.status()).toBe(200);
  const profile = await request.get("/en/pandas/mei-xiang", { maxRedirects: 0 });
  expect(profile.status()).toBe(200);

  const collectionAlias = await request.get("/zh/atlas?q=%E7%BE%8E%E9%A6%99", { maxRedirects: 0 });
  expect(collectionAlias.status()).toBe(308);
  const collectionLocation = new URL(collectionAlias.headers().location, "http://localhost");
  expect(collectionLocation.pathname).toBe("/zh/pandas");
  expect(collectionLocation.search).toBe("?q=%E7%BE%8E%E9%A6%99");

  const profileAlias = await request.get("/zh/atlas/meixiang?from=legacy", { maxRedirects: 0 });
  expect(profileAlias.status()).toBe(308);
  const profileLocation = new URL(profileAlias.headers().location, "http://localhost");
  expect(profileLocation.pathname).toBe("/zh/pandas/mei-xiang");
  expect(profileLocation.search).toBe("?from=legacy");

  const passportAlias = await request.get("/zh/my-pandas", { maxRedirects: 0 });
  expect(passportAlias.status()).toBe(308);
  expect(new URL(passportAlias.headers().location, "http://localhost").pathname).toBe("/zh/me/passport");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("/zh/pandas");
  expect(xml).toContain("/en/pandas/mei-xiang");
  expect(xml).not.toContain("/atlas");
  expect(xml).not.toContain("/my-pandas");
  expect(xml).not.toContain("/me/passport");
});

test("restores visible Follow outcomes on the canonical profile", async ({ page }) => {
  test.skip(!engagementEnabled, "The deployed Web build intentionally disables Engagement UI.");
  await mockSignedOut(page);
  const outcomes = [
    ["followed", "You now follow Mei Xiang"],
    ["already-followed", "You already follow Mei Xiang"],
    ["cancelled", "Sign-in was cancelled"],
    ["intent-expired", "request expired"],
    ["auth-failed", "Verification did not complete"],
    ["session-expired", "Your session expired"],
  ] as const;

  for (const [outcome, expected] of outcomes) {
    await page.goto(`/en/pandas/mei-xiang?follow=${outcome}`);
    await expect(page.getByRole("status")).toContainText(expected);
  }
});

test("signed-in Follow updates immediately and asks for email consent separately", async ({ page }) => {
  test.skip(!engagementEnabled, "The deployed Web build intentionally disables Engagement UI.");
  let followWrites = 0;
  let preferenceWrites = 0;
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
  await page.route("**/api/engagement/follows/**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"detail":"Not found"}' });
      return;
    }
    followWrites += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        follow_id: "33333333-3333-3333-3333-333333333333",
        panda_id: "stable-panda-mei-xiang",
        state: "active",
        first_followed_at: "2026-07-29T00:00:00Z",
        followed_at: "2026-07-29T00:00:00Z",
        unfollowed_at: null,
        version: 1,
      }),
    });
  });
  await page.route("**/api/engagement/preferences/major_activity/email", async (route) => {
    preferenceWrites += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        category: "major_activity",
        channel: "email",
        enabled: true,
        version: 1,
        updated_at: "2026-07-29T00:00:00Z",
      }),
    });
  });

  await page.goto("/en/pandas/mei-xiang");
  const follow = page.getByRole("button", { name: "Follow Mei Xiang" });
  await expect(follow).toBeEnabled();
  await follow.click();
  await expect(page.getByRole("button", { name: "Unfollow Mei Xiang" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Receive important panda updates by email?" })).toBeVisible();
  expect(followWrites).toBe(1);
  expect(preferenceWrites).toBe(0);

  await page.getByRole("button", { name: "Enable important update emails" }).click();
  await expect(page.getByRole("status")).toContainText("Important update emails are enabled");
  expect(preferenceWrites).toBe(1);
  await expect(page.getByRole("link", { name: "Open Panda Passport" })).toHaveAttribute("href", "/en/me/passport");
});

test("expired signed-in session creates a new Pending Intent before reauthentication", async ({ page }) => {
  test.skip(!engagementEnabled, "The deployed Web build intentionally disables Engagement UI.");
  let pendingWrites = 0;
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
  await page.route("**/api/engagement/follows/**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"detail":"Not found"}' });
      return;
    }
    await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Authentication required"}' });
  });
  await page.route(/\/api\/engagement\/follow-intents$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    pendingWrites += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        intent_id: "44444444-4444-4444-4444-444444444444",
        panda_id: body.panda_id,
        locale: body.locale,
        safe_return_path: body.return_path,
        status: "pending",
        expires_at: "2026-07-29T10:00:00Z",
      }),
    });
  });

  await page.goto("/en/pandas/mei-xiang");
  await page.getByRole("button", { name: "Follow Mei Xiang" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fen%2Fpandas%2Fmei-xiang&reason=session-expired$/);
  expect(pendingWrites).toBe(1);
});

test("cross-device continuation clears the fragment and still requires OTP", async ({ page }) => {
  let continuation: unknown = null;
  await page.route("**/api/engagement/follow-intents/continue", async (route) => {
    continuation = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: '{}' });
  });
  await mockPendingContext(page, "en");

  await page.goto("/auth/login?next=/en/pandas/mei-xiang#continue=cross-device-handle-1234567890");
  await expect(page).toHaveURL(/\/auth\/login\?next=\/en\/pandas\/mei-xiang$/);
  expect(continuation).toEqual({ continuation_handle: "cross-device-handle-1234567890" });
  await expect(page.getByText("Panda to follow: mei-xiang")).toBeVisible();
  await expect(page.getByText("ZhiPanda account")).toBeVisible();
  await expect(page.getByText(/FastAPI/)).toHaveCount(0);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send verification code" })).toBeVisible();
});

test("invalid OTP preserves the intended Panda context and moves focus to the error", async ({ page }) => {
  test.skip(!engagementEnabled, "The deployed Web build intentionally disables Engagement UI.");
  await mockPendingContext(page, "en");
  await page.route("**/api/auth/email-otp/start", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"message":"sent"}' });
  });
  await page.route("**/auth/v1/verify**", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: '{"code":"otp_expired","message":"Token has expired or is invalid"}',
    });
  });

  await page.goto("/auth/login?next=/en/pandas/mei-xiang");
  await expect(page.getByText("Panda to follow: mei-xiang")).toBeVisible();
  await page.getByLabel("Email").fill("member@example.invalid");
  const sendCode = page.getByRole("button", { name: "Send verification code" });
  await expect(sendCode).toBeEnabled();
  await sendCode.click();
  const code = page.getByLabel("6-digit verification code");
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  const alert = page.getByText("That verification code is not correct. Check it and try again.");
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(page.getByText("Panda to follow: mei-xiang")).toBeVisible();
  await expect(code).toHaveValue("");
});

test("malicious return destinations fail closed and mobile controls meet minimum sizing", async ({ page }) => {
  let startBody: Record<string, unknown> | null = null;
  await page.route("**/api/auth/email-otp/start", async (route) => {
    startBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"message":"sent"}' });
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/auth/login?next=https%3A%2F%2Fevil.example%2Fsteal");
  const email = page.getByLabel("邮箱");
  await email.fill("member@example.invalid");
  const send = page.getByRole("button", { name: "发送验证码" });
  const inputStyle = await email.evaluate((element) => getComputedStyle(element).fontSize);
  const buttonBox = await send.boundingBox();
  expect(inputStyle).toBe("16px");
  expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await send.click();
  expect(startBody).toMatchObject({ next: "/admin" });
});
