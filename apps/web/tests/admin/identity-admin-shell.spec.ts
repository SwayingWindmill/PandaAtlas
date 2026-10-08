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
  await expect(page.getByRole("link", { name: "内容治理", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "策展", exact: true })).toHaveCount(0);
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

test("direct legacy audit URL cannot bypass capability-scoped shell access", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...staffSession, capabilities: [] }),
    });
  });

  await page.goto("/admin/audit");
  await expect(page.getByText("当前账号没有访问此工作区所需的权限。")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "审计" })).toHaveCount(0);
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

  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fadmin%2Faudit$/);
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
  await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "账号安全" }).click();
  await expect(page).toHaveURL(/\/admin\/security\/mfa$/);
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

test("AAL2 staff manager invites an archive reviewer and sees a pending invitation", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...staffSession,
        capabilities: ["admin.shell.access", "identity.account.manage", "identity.role.manage"],
      }),
    });
  });
  let invitedEmail = "";
  await page.route("**/api/admin/staff/invitations", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    invitedEmail = (route.request().postDataJSON() as { email: string }).email;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ invitationId: "123", email: invitedEmail, status: "pending" }),
    });
  });

  await page.goto("/admin");
  await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "工作人员" }).click();
  await expect(page.getByRole("heading", { name: "邀请审核员" })).toBeVisible();
  await page.getByRole("textbox", { name: "审核员邮箱" }).fill("reviewer@example.test");
  await page.getByRole("button", { name: "发送邀请" }).click();
  await expect(page.getByRole("status")).toContainText("邀请邮件已发送");
  expect(invitedEmail).toBe("reviewer@example.test");
});

test("expired recent authentication is distinguished from an incomplete MFA enrollment", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...staffSession,
        capabilities: ["admin.shell.access", "identity.account.manage", "identity.role.manage"],
      }),
    });
  });
  await page.route("**/api/admin/staff/invitations", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/problem+json",
      body: JSON.stringify({ code: "auth.recentAuthRequired", status: 403 }),
    });
  });

  await page.goto("/admin/staff/invitations");
  await page.getByRole("textbox", { name: "审核员邮箱" }).fill("new-reviewer@example.test");
  await page.getByRole("button", { name: "发送邀请" }).click();
  await expect(page.getByRole("status")).toContainText("最近认证已过期");
  await expect(page.getByRole("status").getByRole("link", { name: "重新登录" })).toHaveAttribute(
    "href", "/auth/login?next=%2Fadmin%2Fstaff%2Finvitations",
  );
  await expect(page.getByRole("region", { name: "审核员邀请记录" }).getByRole("alert")).toContainText("最近认证已过期");
  await expect(page.getByRole("status")).not.toContainText("在账号安全中完成验证");
});

test("a reviewer cannot access staff invitation controls", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...staffSession, capabilities: ["admin.shell.access", "review.case.read"] }),
    });
  });

  await page.goto("/admin/staff/invitations");
  await expect(page.getByText("当前账号没有访问此工作区所需的权限。")).toBeVisible();
  await expect(page.getByRole("button", { name: "发送邀请" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "工作人员" })).toHaveCount(0);
});
