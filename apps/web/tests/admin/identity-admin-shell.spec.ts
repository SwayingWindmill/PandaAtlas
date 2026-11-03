import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const staffSession = {
  accountId: "11111111-1111-4111-8111-111111111111",
  aal: "aal2",
  capabilities: ["audit.read"],
};

test("Chinese Kiranism admin shell exposes capability-scoped grouped navigation", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(staffSession),
    });
  });

  await page.goto("/admin");

  await expect(page.getByText("可用工作区")).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "后台导航" });
  await expect(page.locator('[data-slot="sidebar-wrapper"]')).toBeVisible();
  await expect(page.locator('[data-slot="sidebar-inset"]')).toBeVisible();
  await expect(navigation.getByRole("link", { name: "审计", exact: true })).toHaveAttribute("href", "/admin/audit/evidence");
  await expect(navigation.getByText("治理", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "审核", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "发布", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Archive/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Game Bank/i })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("capability navigation stays visible while an unauthorized admin route is withheld", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(staffSession),
    });
  });

  await page.goto("/admin/publication");

  await expect(page.getByRole("navigation", { name: "后台导航" })).toBeVisible();
  await expect(page.getByRole("link", { name: "审计", exact: true })).toBeVisible();
  await expect(page.getByText("当前账号没有访问此工作区所需的权限。")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Publication" })).toHaveCount(0);
});

test("retired generic admin URLs are absent while the staff capabilities page remains available", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(staffSession),
    });
  });

  await page.goto("/admin/capabilities");
  await expect(page.getByRole("heading", { level: 1, name: "我的权限" })).toBeVisible();
  await expect(page.getByText("查看审计记录", { exact: true })).toBeVisible();
  await expect(page.getByText("audit.read", { exact: true })).not.toBeVisible();
  await page.getByText("查看权限代码").click();
  await expect(page.getByText("audit.read", { exact: true })).toBeVisible();
  const accountAccessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accountAccessibility.violations).toEqual([]);

  const oldAuditPage = await page.goto("/admin/audit");
  expect(oldAuditPage?.status()).toBe(404);
  const oldOperationStatus = await page.evaluate(async () => (
    await fetch("/api/admin/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "audit.list" }) })
  ).status);
  expect(oldOperationStatus).toBe(404);
});

test("sidebar collapse preserves active navigation and keyboard reopening", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(staffSession),
    });
  });

  await page.goto("/admin/audit/evidence");
  const sidebar = page.locator('[data-slot="sidebar"]');
  const audit = page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "审计" });
  await expect(audit).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "切换侧边栏" }).click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.reload();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.keyboard.press("Control+b");
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await expect(audit).toHaveAttribute("aria-current", "page");
});

test("the command palette finds authorized workspaces and keyboard selection navigates", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      accountId: "11111111-1111-4111-8111-111111111111", aal: "aal2",
      capabilities: ["admin.shell.access", "review.case.read"],
    }),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [], total: 0, limit: 25, offset: 0 }),
  }));
  await page.goto("/admin");
  await page.getByRole("button", { name: "搜索工作区" }).click();
  const palette = page.getByRole("dialog", { name: "快速进入工作区" });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("option", { name: /审核/ })).toBeVisible();
  await expect(palette.getByRole("option", { name: /发布/ })).toHaveCount(0);
  await expect(palette.getByRole("option", { name: /人员管理/ })).toHaveCount(0);
  await palette.getByRole("combobox").fill("审核");
  await expect(palette.getByRole("option", { name: /审核/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/reviews/);
  await expect(palette).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill("发布");
  await expect(palette.getByText("没有匹配的工作区")).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
  expect(result.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
});

test("Chinese admin workbench passes automated accessibility checks", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(staffSession),
    });
  });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "数据运营工作台" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("admin navigation remains operable from the keyboard at narrow width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(staffSession),
    });
  });

  await page.goto("/admin");

  await page.getByRole("button", { name: "展开导航" }).click();
  const navigation = page.getByRole("navigation", { name: "后台导航" });
  await expect(navigation).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 320);

  const auditLink = navigation.getByRole("link", { name: "审计", exact: true });
  await auditLink.focus();
  await expect(auditLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/audit\/evidence$/);
});

test("admin session denial renders the shared staff access error state", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Forbidden" }),
    });
  });

  await page.goto("/admin");

  await expect(page.getByRole("alert")).toContainText("当前账号没有后台访问权限。");
  await expect(page.getByRole("navigation", { name: "后台导航" })).toHaveCount(0);
});

test("admin session error can be retried without losing the workspace", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/admin/session", async (route) => {
    attempts += 1;
    await route.fulfill({
      status: attempts === 1 ? 500 : 200,
      contentType: "application/json",
      body: JSON.stringify(attempts === 1 ? { detail: "Temporary error" } : staffSession),
    });
  });

  await page.goto("/admin");
  await expect(page.getByRole("alert")).toContainText("无法获取当前工作人员会话。");
  await page.getByRole("button", { name: "重新尝试" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "数据运营工作台" })).toBeVisible();
  expect(attempts).toBe(2);
});

test("admin session 401 redirects to OTP login with the requested admin return path", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Authentication required" }),
    });
  });

  await page.goto("/admin/audit/evidence");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fadmin%2Faudit%2Fevidence$/);
});

test("staff can enter Chinese MFA security settings without expanding business permissions", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...staffSession, aal: "aal1", capabilities: ["admin.shell.access"] }),
    });
  });

  await page.goto("/admin");
  await page.getByRole("link", { name: "我的账号" }).click();
  await page.getByRole("navigation", { name: "我的账号页面" }).getByRole("link", { name: "双重验证" }).click();
  await expect(page).toHaveURL(/\/admin\/security\/mfa$/);
  await expect(page.getByRole("navigation", { name: "当前位置" }).getByRole("link", { name: "我的账号" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "多因素认证" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "审核" })).toHaveCount(0);
});

test("MFA staff settings stay unavailable without admin.shell.access", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...staffSession, capabilities: ["audit.read"] }),
    });
  });
  await page.goto("/admin/security/mfa");
  await expect(page.getByText("当前账号没有访问此工作区所需的权限。")).toBeVisible();
  await expect(page.getByRole("heading", { name: "多因素认证" })).toHaveCount(0);
});
