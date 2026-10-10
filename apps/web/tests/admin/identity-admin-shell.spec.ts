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

test("IAM staff directory, invitation and role detail remain accessible", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities: [
      "admin.shell.access", "identity.staff.read", "identity.role.manage", "identity.account.manage",
    ] }),
  }));
  await page.route("**/api/admin/staff/invitations", async (route) => route.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
  await page.route("**/api/admin/staff/accounts**", async (route) => {
    const url = route.request().url();
    const payload = url.endsWith("/catalog")
      ? [{ roleKey: "reviewer", displayName: "Reviewer", description: "Review evidence" }]
      : url.endsWith("/accounts")
        ? [{ accountId: "55555555-5555-4555-8555-555555555555", email: "reviewer@example.test", state: "active", roles: ["reviewer"] }]
        : {
          accountId: "55555555-5555-4555-8555-555555555555", email: "reviewer@example.test",
          state: "active", stateReason: null, capabilities: ["review.case.read"],
          assignments: [], stateHistory: [],
        };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  for (const path of ["/admin/staff/invitations", "/admin/staff/roles"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path.endsWith("roles")) {
      await page.getByRole("button", { name: /reviewer@example.test/ }).click();
      await expect(page.getByRole("region", { name: "工作人员角色详情" })).toBeVisible();
    }
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
});

test("staff directory search and status filter narrow the people list without changing permissions", async ({ page }) => {
  const staff = [
    { accountId: "11111111-1111-4111-8111-111111111111", email: "alice@example.test", state: "active", roles: ["reviewer"] },
    { accountId: "22222222-2222-4222-8222-222222222222", email: "bob@example.test", state: "suspended", roles: ["moderator"] },
    { accountId: "33333333-3333-4333-8333-333333333333", email: "chen@example.test", state: "active", roles: ["reviewer"] },
  ];
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities: ["admin.shell.access", "identity.staff.read"] }),
  }));
  await page.route("**/api/admin/staff/accounts**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().url().endsWith("/accounts") ? staff : {
      ...staff[0], capabilities: ["review.case.read"], assignments: [], stateHistory: [], stateReason: null,
    }),
  }));

  await page.goto("/admin/staff/roles");
  await expect(page.getByRole("button", { name: /alice@example.test/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "工作人员目录" }).getByRole("table")).toBeVisible();
  const directoryRegion = page.getByRole("region", { name: "工作人员目录" });
  const widthBefore = (await directoryRegion.boundingBox())?.width ?? 0;
  const resizeHandle = page.getByRole("separator", { name: "调整工作人员目录与详情宽度" });
  await resizeHandle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await directoryRegion.boundingBox())?.width ?? 0).toBeGreaterThan(widthBefore);
  await page.getByRole("searchbox", { name: "搜索工作人员" }).fill("bob");
  await expect(page.getByRole("button", { name: /bob@example.test/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /alice@example.test/ })).toHaveCount(0);
  await expect(page.getByText("1 / 3 位工作人员")).toBeVisible();
  await page.getByRole("combobox", { name: "人员状态" }).selectOption("active");
  await expect(page.getByText("没有匹配的工作人员")).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索工作人员" }).fill("");
  await expect(page.getByRole("button", { name: /alice@example.test/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /bob@example.test/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /chen@example.test/ })).toBeVisible();
  await page.getByRole("button", { name: /alice@example.test/ }).click();
  await expect(page.getByRole("region", { name: "工作人员角色详情" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "alice@example.test" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("staff directory readers can inspect people and invitation progress without gaining mutation controls", async ({ page }) => {
  const accountId = "55555555-5555-4555-8555-555555555555";
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities: ["admin.shell.access", "identity.staff.read"] }),
  }));
  await page.route("**/api/admin/staff/invitations", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify([{ invitationId: "invite-1", email: "pending@example.test", status: "pending" }]),
  }));
  await page.route("**/api/admin/staff/accounts**", (route) => {
    const url = route.request().url();
    const data = url.endsWith("/catalog") ? [] : url.endsWith("/accounts")
      ? [{ accountId, email: "reader@example.test", state: "active", roles: ["reviewer"] }]
      : { accountId, email: "reader@example.test", state: "active", stateReason: null,
          capabilities: ["review.case.read", "audit.read"], assignments: [], stateHistory: [] };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.goto("/admin/staff/invitations");
  await expect(page.getByText("pending@example.test")).toBeVisible();
  await expect(page.getByRole("button", { name: "发送邀请" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "审核员邀请记录" }).locator('[data-slot="badge"]')).toHaveText("待接受");
  await page.goto("/admin/staff/roles");
  await page.getByRole("button", { name: /reader@example.test/ }).click();
  await expect(page.getByText("审核 · 1 项")).toBeVisible();
  await expect(page.getByText("审计 · 1 项")).toBeVisible();
  await expect(page.getByText("review.case.read", { exact: true })).not.toBeVisible();
  await page.getByText("查看原始权限代码").click();
  await expect(page.getByText("review.case.read", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "准备授予" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "停用工作人员" })).toHaveCount(0);
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

test("staff governance exposes a direct role management sidebar entry", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities: ["admin.shell.access", "identity.account.manage", "identity.role.manage"] }),
  }));

  await page.goto("/admin");
  const navigation = page.getByRole("navigation", { name: "后台导航" });
  await expect(navigation.getByRole("link", { name: "人员管理" })).toHaveAttribute("href", "/admin/staff/roles");
  await expect(navigation.getByRole("link", { name: "我的权限" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "账号安全" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "角色管理" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "工作人员" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "我的账号" })).toHaveAttribute("href", "/admin/capabilities");
  await navigation.getByRole("link", { name: "人员管理" }).click();
  await expect(page.getByRole("navigation", { name: "人员管理页面" }).getByRole("link", { name: "邀请记录" })).toBeVisible();
  await page.getByRole("navigation", { name: "人员管理页面" }).getByRole("link", { name: "邀请记录" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/staff\/invitations$/);
  await expect(page.getByRole("navigation", { name: "当前位置" }).getByRole("link", { name: "人员管理" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "人员管理" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("navigation", { name: "人员管理页面" }).getByRole("link", { name: "人员与权限" }).click();
  await expect(page).toHaveURL(/\/admin\/staff\/roles$/);
  await expect(navigation.getByRole("link", { name: "人员管理" })).toHaveAttribute("aria-current", "page");
});

test("staff navigation keeps account invitations and role management separately authorized", async ({ page }) => {
  let capabilities = ["admin.shell.access", "identity.role.manage"];
  await page.route("**/api/admin/session", async (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities }),
  }));

  await page.goto("/admin/staff/roles");
  const navigation = page.getByRole("navigation", { name: "后台导航" });
  await expect(navigation.getByRole("link", { name: "人员管理" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "人员管理页面" }).getByRole("link", { name: "邀请记录" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "工作人员权限管理" })).toBeVisible();
  await page.goto("/admin/staff/invitations");
  await expect(page.getByText("当前账号没有访问此工作区所需的权限。")).toBeVisible();

  capabilities = ["admin.shell.access", "identity.account.manage"];
  await page.reload();
  await expect(navigation.getByRole("link", { name: "人员管理" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "工作人员邀请", level: 1 })).toBeVisible();
  await page.goto("/admin/staff/roles");
  await expect(page.getByRole("heading", { name: "工作人员权限管理" })).toBeVisible({ timeout: 15_000 });
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
  await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "人员管理" }).click();
  await page.getByRole("navigation", { name: "人员管理页面" }).getByRole("link", { name: "邀请记录" }).click();
  await expect(page.getByRole("heading", { name: "工作人员邀请", level: 1 })).toBeVisible();
  await page.getByRole("textbox", { name: "审核员邮箱" }).fill("reviewer@example.test");
  await page.getByRole("button", { name: "发送邀请" }).click();
  await expect(page.getByRole("status")).toContainText("已向 reviewer@example.test 发送邀请");
  expect(invitedEmail).toBe("reviewer@example.test");
});

test("staff invitations support searchable status tracking without inventing lifecycle actions", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities: ["admin.shell.access", "identity.staff.read"] }),
  }));
  await page.route("**/api/admin/staff/invitations", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify([
      { invitationId: "one", email: "pending@example.test", status: "pending", createdAt: "2026-10-08T12:00:00Z" },
      { invitationId: "two", email: "accepted@example.test", status: "accepted", createdAt: "2026-10-09T12:00:00Z" },
      { invitationId: "three", email: "unknown@example.test", status: "unfamiliar", createdAt: "2026-10-10T12:00:00Z" },
    ]),
  }));
  await page.goto("/admin/staff/invitations");
  await expect(page.getByRole("button", { name: "发送邀请" })).toHaveCount(0);
  await expect(page.getByText("3 条邀请", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "审核员邀请记录" }).getByRole("table")).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索邀请邮箱" }).fill("accepted");
  await expect(page.getByText("accepted@example.test")).toBeVisible();
  await expect(page.getByText("pending@example.test")).toHaveCount(0);
  await page.getByRole("combobox", { name: "邀请状态" }).selectOption("pending");
  await expect(page.getByText("没有匹配的邀请记录")).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索邀请邮箱" }).fill("");
  await expect(page.getByText("pending@example.test")).toBeVisible();
  await expect(page.getByText("accepted@example.test")).toHaveCount(0);
  await page.getByRole("combobox", { name: "邀请状态" }).selectOption("other");
  await expect(page.getByText("unknown@example.test")).toBeVisible();
  await expect(page.getByText("状态待核对")).toBeVisible();
  await expect(page.getByRole("button", { name: /撤销|重发|删除/ })).toHaveCount(0);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations).toEqual([]);
});

test("staff invitation submission recovers from transient errors and displays the invited email", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities: ["admin.shell.access", "identity.account.manage"] }),
  }));
  let attempts = 0;
  await page.route("**/api/admin/staff/invitations", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    attempts += 1;
    return route.fulfill(attempts === 1
      ? { status: 503, contentType: "application/problem+json", body: '{}' }
      : { status: 201, contentType: "application/json", body: JSON.stringify({ invitationId: "sent", email: "reviewer@example.test", status: "pending" }) });
  });
  await page.goto("/admin/staff/invitations");
  await page.getByRole("textbox", { name: "审核员邮箱" }).fill("reviewer@example.test");
  await page.getByRole("button", { name: "发送邀请" }).click();
  await expect(page.getByRole("alert")).toContainText("邀请服务暂时不可用");
  await expect(page.getByRole("textbox", { name: "审核员邮箱" })).toHaveValue("reviewer@example.test");
  await page.getByRole("button", { name: "发送邀请" }).click();
  await expect(page.getByRole("status")).toContainText("reviewer@example.test");
  await expect(page.getByRole("textbox", { name: "审核员邮箱" })).toHaveValue("");
  expect(attempts).toBe(2);
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
  const invitationError = page.getByRole("region", { name: "邀请审核员" }).getByRole("alert");
  await expect(invitationError).toContainText("最近认证已过期");
  await expect(invitationError.getByRole("link", { name: "重新登录" })).toHaveAttribute(
    "href", "/auth/login?next=%2Fadmin%2Fstaff%2Finvitations",
  );
  await expect(page.getByRole("region", { name: "审核员邀请记录" }).getByRole("alert")).toContainText("最近认证已过期");
  await expect(invitationError).not.toContainText("在账号安全中完成验证");
});

test("staff manager can inspect role history and confirm grant and revoke with reasons", async ({ page }) => {
  const staffId = "55555555-5555-4555-8555-555555555555";
  const assignmentId = "66666666-6666-4666-8666-666666666666";
  let roleState: "none" | "active" | "revoked" = "none";
  await page.route("**/api/admin/session", async (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities: ["admin.shell.access", "identity.role.manage", "identity.account.manage"] }),
  }));
  await page.route("**/api/admin/staff/accounts**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/catalog")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
        { roleKey: "reviewer", displayName: "Reviewer", description: "Review evidence" },
      ]) });
    } else if (url.endsWith("/accounts")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
        { accountId: staffId, email: "reviewer@example.test", state: "active", roles: roleState === "active" ? ["reviewer"] : [] },
      ]) });
    } else if (method === "POST") {
      const input = route.request().postDataJSON() as { reason: string; roleKey?: string };
      expect(input.reason.length).toBeGreaterThan(3);
      if (url.endsWith("/revoke")) {
        roleState = "revoked";
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ assignmentId, roleKey: "reviewer", status: "revoked" }) });
      } else {
        expect(input.roleKey).toBe("reviewer");
        roleState = "active";
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ assignmentId, roleKey: "reviewer", status: "active" }) });
      }
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        accountId: staffId, email: "reviewer@example.test", state: "active",
        capabilities: roleState === "active" ? ["review.case.read"] : [],
        stateReason: null, stateHistory: [],
        assignments: roleState === "none" ? [] : [{
          assignmentId, roleKey: "reviewer", roleName: "Reviewer", assignedAt: "2026-10-08T10:00:00Z",
          assignedBy: staffSession.accountId, reason: "Assigned to evidence verification",
          status: roleState, revokedAt: roleState === "revoked" ? "2026-10-08T11:00:00Z" : null,
          revokedBy: roleState === "revoked" ? staffSession.accountId : null,
          revocationReason: roleState === "revoked" ? "Assignment completed" : null,
        }],
      }) });
    }
  });

  await page.goto("/admin/staff/roles");
  await expect(page.getByRole("heading", { name: "工作人员权限管理" })).toBeVisible();
  await page.getByRole("button", { name: /reviewer@example.test/ }).click();
  await expect(page.getByText("当前权限")).toBeVisible();
  await page.getByRole("button", { name: "准备授予" }).click();
  await page.getByRole("textbox", { name: "变更原因" }).fill("Assigned to evidence verification");
  await page.getByRole("button", { name: "确认授予" }).click();
  await expect(page.getByText("角色已授予")).toBeVisible();
  await page.getByText("查看原始权限代码").click();
  await expect(page.getByText("review.case.read")).toBeVisible();
  await page.getByRole("button", { name: "撤销 审核员" }).click();
  await page.getByRole("textbox", { name: "变更原因" }).fill("Assignment completed");
  await page.getByRole("button", { name: "确认撤销" }).click();
  await expect(page.getByText("角色已撤销")).toBeVisible();
  await page.getByRole("region", { name: "角色授权历史" }).getByText("角色授权历史").click();
  await expect(page.getByRole("region", { name: "角色授权历史" }).getByText("已撤销", { exact: true })).toBeVisible();
});

test("authorized account manager suspends and reinstates staff from the Chinese console", async ({ page }) => {
  const workerId = "55555555-5555-4555-8555-555555555555";
  const manager = { ...staffSession, capabilities: ["admin.shell.access", "identity.account.manage"] };
  let state: "active" | "suspended" = "active";
  let stateReason: string | null = null;
  const history: Array<{ eventId: string; previousState: string; nextState: string; reason: string; actorId: string; occurredAt: string }> = [];
  await page.route("**/api/admin/session", async (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(manager),
  }));
  await page.route("**/api/admin/staff/accounts**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/catalog")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    } else if (url.endsWith("/accounts")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
        { accountId: workerId, email: "worker@example.test", state, roles: ["reviewer"] },
      ]) });
    } else if (url.endsWith("/state") && route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { action: string; reason: string; idempotencyKey: string };
      expect(body.reason.length).toBeGreaterThan(3);
      expect(body.idempotencyKey).toBeTruthy();
      const previousState = state;
      state = body.action === "suspend" ? "suspended" : "active";
      stateReason = state === "suspended" ? `staff:${body.reason}` : null;
      history.unshift({ eventId: String(history.length), previousState, nextState: state, reason: body.reason,
        actorId: staffSession.accountId, occurredAt: "2026-10-08T11:00:00Z" });
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ accountId: workerId, state }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        accountId: workerId, email: "worker@example.test", state, stateReason,
        capabilities: state === "active" ? ["review.case.read"] : [],
        assignments: [], stateHistory: history,
      }) });
    }
  });
  await page.goto("/admin/staff/roles");
  await page.getByRole("button", { name: /worker@example.test/ }).click();
  await expect(page.getByText("账号状态：正常", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "准备授予" })).toHaveCount(0);
  await page.getByRole("button", { name: "停用工作人员" }).click();
  await page.getByRole("textbox", { name: "状态变更原因" }).fill("Temporary restriction during verification");
  await page.getByRole("button", { name: "确认停用" }).click();
  await expect(page.getByText("工作人员已停用")).toBeVisible();
  await expect(page.getByText("账号状态：已停用", { exact: false })).toBeVisible();
  await page.getByRole("region", { name: "账号状态历史" }).getByText("账号状态历史").click();
  await expect(page.getByRole("region", { name: "账号状态历史" }).getByText("Temporary restriction during verification", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "恢复工作人员" }).click();
  await page.getByRole("textbox", { name: "状态变更原因" }).fill("Investigation completed and reinstatement approved");
  await page.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByText("工作人员已恢复")).toBeVisible();
  await expect(page.getByRole("region", { name: "账号状态历史" }).getByText("Investigation completed and reinstatement approved")).toBeVisible();
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
  await page.goto("/admin/staff/roles");
  await expect(page.getByText("当前账号没有访问此工作区所需的权限。")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "工作人员权限管理" })).toHaveCount(0);
});
