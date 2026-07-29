import { expect, test } from "@playwright/test";

const PREFERENCES_KEY = "panda-atlas:profile-preferences";
const LEGACY_KEY = "panda-atlas:saved-profiles";

async function mockSignedOutPassport(page: import("@playwright/test").Page) {
  await page.route("**/api/engagement/passport", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Authentication required"}' });
  });
}

test("serves canonical bilingual Passport routes", async ({ page, request }) => {
  const redirect = await request.get("/my-pandas", {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(308);
  expect(new URL(redirect.headers().location, "http://localhost").pathname).toBe("/en/me/passport");

  await mockSignedOutPassport(page);
  await page.goto("/zh/me/passport");
  await expect(page.getByRole("heading", { level: 1, name: "我的熊猫" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "护照与最近浏览使用不同存储边界" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "熊猫护照" })).toBeVisible();
  await expect(page.getByRole("link", { name: "使用邮箱验证码登录" })).toHaveAttribute("href", "/auth/login?next=/zh/me/passport");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/zh\/me\/passport$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("deletes legacy anonymous saves without converting them", async ({ page }) => {
  await mockSignedOutPassport(page);
  await page.addInitScript(({ legacyKey, preferencesKey }) => {
    localStorage.setItem(legacyKey, JSON.stringify(["mei-xiang", "bao-li"]));
    localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      saved: [{ id: "legacy-saved-id", at: "2026-07-18T00:00:00.000Z" }],
      recent: [],
    }));
  }, { legacyKey: LEGACY_KEY, preferencesKey: PREFERENCES_KEY });

  await page.goto("/zh/me/passport");
  await expect(page.getByRole("link", { name: "使用邮箱验证码登录" })).toBeVisible();
  const stored = await page.evaluate(({ preferencesKey, legacyKey }) => ({
    preferences: JSON.parse(localStorage.getItem(preferencesKey) ?? "null"),
    legacy: localStorage.getItem(legacyKey),
  }), { preferencesKey: PREFERENCES_KEY, legacyKey: LEGACY_KEY });
  expect(stored.legacy).toBeNull();
  expect(stored.preferences).toEqual({ version: 2, recent: [] });
  expect("saved" in stored.preferences).toBe(false);
  await expect(page.getByTestId("passport-section")).not.toContainText("美香");
  await expect(page.getByText("旧的匿名收藏不会转换为关注、护照或邮件许可。")).toBeVisible();
});

test("renders private Passport and local recent history", async ({ page }) => {
  await page.route("**/api/engagement/passport", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        account_id: "11111111-1111-1111-1111-111111111111",
        entries: [{
          panda_id: "stable-panda-mei-xiang",
          relationship_state: "active",
          first_followed_at: "2026-07-18T00:00:00.000Z",
          contribution_count: 2,
        }],
      }),
    });
  });
  await page.addInitScript((preferencesKey) => {
    localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      saved: [],
      recent: [{ id: "stable-panda-mei-xiang", at: "2026-07-20T00:00:00.000Z" }],
    }));
  }, PREFERENCES_KEY);

  await page.goto("/en/me/passport");
  await expect(page.getByTestId("passport-section")).toContainText("Following");
  await expect(page.getByTestId("passport-section")).toContainText("First followed");
  await expect(page.getByTestId("passport-section")).toContainText("Contributions: 2");
  await expect(page.getByTestId("recent-pandas-section")).toBeVisible();
});

test("signed-out Follow creates Pending Intent before OTP", async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Authentication required"}' });
  });
  await page.route("**/api/engagement/follow-intents", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        intent_id: "11111111-1111-1111-1111-111111111111",
        panda_id: requestBody.panda_id,
        locale: requestBody.locale,
        safe_return_path: requestBody.return_path,
        status: "pending",
        expires_at: "2026-07-28T10:00:00Z",
      }),
    });
  });

  await page.goto("/en/pandas/mei-xiang");
  const follow = page.getByRole("button", { name: "Follow Mei Xiang" });
  await expect(follow).toBeVisible();
  await follow.click();
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fen%2Fpandas%2Fmei-xiang$/);
  expect(requestBody).toMatchObject({ locale: "en", return_path: "/en/pandas/mei-xiang" });
});

test("reflows at 320 CSS pixels with private Passport", async ({ page }) => {
  await mockSignedOutPassport(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/zh/me/passport");
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(hasOverflow).toBe(false);
  await expect(page.getByTestId("passport-section")).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("keeps privacy disclosure and archive navigation", async ({ page }) => {
    await page.goto("/en/me/passport");
    await expect(page.getByRole("heading", { level: 2, name: "JavaScript is required to read local records" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse all panda profiles" }).last()).toHaveAttribute("href", "/en/pandas");
  });
});
