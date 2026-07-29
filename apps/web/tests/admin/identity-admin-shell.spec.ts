import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { adminSessionFailureDestination } from "@/components/admin/admin-session-navigation";

const session = {
  account_id: "00000000-0000-4000-8000-000000000178",
  email: "operator@example.test",
  state: "active",
  roles: ["administrator"],
  capabilities: [
    "account.session.read",
    "admin.shell.access",
    "identity.account.manage",
    "identity.role.manage",
  ],
  recent_auth: true,
  authenticated_at: "2026-07-28T06:00:00Z",
  authentication_method: "otp",
  assurance_level: "aal1",
  expires_at: "2026-07-28T07:00:00Z",
};

async function expectNoWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test("email OTP login is semantic, mobile-safe, and accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/login?next=%2Fadmin");

  await expect(page.getByRole("heading", { level: 1, name: "使用邮箱验证码登录" })).toBeVisible();
  await expect(page.getByLabel("邮箱")).toHaveCSS("font-size", "16px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expectNoWcagViolations(page);
});

test("bounded React-admin shell exposes only effective capabilities", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
      headers: { "Cache-Control": "no-store, private" },
    });
  });

  await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "工作人员控制台" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("identity.role.manage", { exact: true })).toBeVisible();
  await expect(page.getByText("archive.review", { exact: true })).toHaveCount(0);

  const logout = page.getByRole("button", { name: "退出登录" });
  await logout.focus();
  await expect(logout).toBeFocused();
  await expectNoWcagViolations(page);
});

test("admin session failures choose safe destinations", () => {
  expect(adminSessionFailureDestination(401)).toBe("/auth/login?next=%2Fadmin");
  expect(adminSessionFailureDestination(403)).toBe("/");
  expect(adminSessionFailureDestination(404)).toBe("/");
  expect(adminSessionFailureDestination(500)).toBeNull();
});
