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

const archiveSession = {
  ...session,
  roles: ["archive_editor", "senior_archive_editor"],
  capabilities: [
    "account.session.read",
    "admin.shell.access",
    "archive.workbench.read",
    "archive.cutover.manage",
    "archive.accountable.validate",
    "archive.accountable.publish",
    "archive.accountable.rollback",
    "archive.accountable.correct",
    "archive.sensitive.merge_split",
    "archive.sensitive.takedown",
  ],
};

const rehearsal = {
  generated_at: "2026-07-31T00:00:00Z",
  old_state_counts: {},
  accountable_state_counts: {},
  release_counts: {},
  orphan_counts: {},
  historical_audit_count: 12,
  archive_pointer_release_id: "00000000-0000-4000-8000-000000000196",
  public_pointer_release_id: "00000000-0000-4000-8000-000000000186",
  canonical_sha256: "a".repeat(64),
  go: true,
  blockers: [],
};

async function expectNoWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function mockArchiveSession(page: Page, recentAuth = true) {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...archiveSession, recent_auth: recentAuth }),
      headers: { "Cache-Control": "no-store, private" },
    });
  });
  await page.route("**/api/admin/archive/workbench/rehearsal-snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rehearsal),
      headers: {
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  });
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

  const response = await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 60_000 });
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("heading", { level: 1, name: "工作人员控制台" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("ZhiPanda Administration", { exact: true })).toBeVisible();
  const retiredAdminBrand = ["Panda", "Atlas Administration"].join("");
  await expect(page.getByText(retiredAdminBrand, { exact: true })).toHaveCount(0);
  await expect(page.getByText("identity.role.manage", { exact: true })).toBeVisible();
  await expect(page.getByText("archive.review", { exact: true })).toHaveCount(0);

  const logout = page.getByRole("button", { name: "退出登录" });
  await logout.focus();
  await expect(logout).toBeFocused();
  await expectNoWcagViolations(page);
});

test("Archive workbench is mobile-safe, bounded, keyboard reachable, and accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockArchiveSession(page);
  await page.route("**/api/admin/archive/workbench/metrics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ordinary_ready: 1,
        sensitive_ready: 2,
        publish_failed: 0,
        projection_lag: 1,
        emergency_followup: 0,
        cutover_state: "open",
        cutover_version: 3,
      }),
      headers: { "Cache-Control": "no-store, private" },
    });
  });
  await page.route("**/api/admin/archive/workbench?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0 }),
      headers: { "Cache-Control": "no-store, private" },
    });
  });

  await page.goto("/admin/archive", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page).toHaveURL(/\/admin\/archive$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Archive 发布与迁移工作台" }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("普通待发布", { exact: true })).toBeVisible();
  await expect(page.getByText("投影滞后", { exact: true })).toBeVisible();
  await expect(page.getByText("当前队列为空。", { exact: true })).toBeVisible();
  const refresh = page.getByRole("button", { name: "刷新工作台" });
  await refresh.focus();
  await expect(refresh).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expectNoWcagViolations(page);
});

test("Senior Archive operations fail closed without recent authentication", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockArchiveSession(page, false);

  await page.goto("/admin/archive/operations", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(page).toHaveURL(/\/admin\/archive\/operations$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "合并、拆分与紧急下架" }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole("alert").filter({ hasText: "敏感操作要求 15 分钟内认证" }),
  ).toBeVisible();
  await expect(page.getByText(`Archive: ${rehearsal.archive_pointer_release_id}`)).toBeVisible();
  await expect(page.getByText(`Public: ${rehearsal.public_pointer_release_id}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "创建新的 Merge Release" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expectNoWcagViolations(page);
});

test("admin session failures choose safe destinations", () => {
  expect(adminSessionFailureDestination(401)).toBe("/auth/login?next=%2Fadmin");
  expect(adminSessionFailureDestination(403)).toBe("/");
  expect(adminSessionFailureDestination(404)).toBe("/");
  expect(adminSessionFailureDestination(500)).toBeNull();
});
