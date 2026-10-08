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

test("staff governance exposes a direct role management sidebar entry", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities: ["admin.shell.access", "identity.account.manage", "identity.role.manage"] }),
  }));

  await page.goto("/admin");
  const navigation = page.getByRole("navigation", { name: "后台导航" });
  await expect(navigation.getByRole("link", { name: "工作人员" })).toHaveAttribute("href", "/admin/staff/invitations");
  await expect(navigation.getByRole("link", { name: "角色管理" })).toHaveAttribute("href", "/admin/staff/roles");
  await navigation.getByRole("link", { name: "角色管理" }).click();
  await expect(page).toHaveURL(/\/admin\/staff\/roles$/);
  await expect(navigation.getByRole("link", { name: "角色管理" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "工作人员" })).not.toHaveAttribute("aria-current", "page");
});

test("staff navigation keeps account invitations and role management separately authorized", async ({ page }) => {
  let capabilities = ["admin.shell.access", "identity.role.manage"];
  await page.route("**/api/admin/session", async (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...staffSession, capabilities }),
  }));

  await page.goto("/admin/staff/roles");
  const navigation = page.getByRole("navigation", { name: "后台导航" });
  await expect(navigation.getByRole("link", { name: "角色管理" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "工作人员" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "工作人员权限管理" })).toBeVisible();
  await page.goto("/admin/staff/invitations");
  await expect(page.getByText("当前账号没有访问此工作区所需的权限。")).toBeVisible();

  capabilities = ["admin.shell.access", "identity.account.manage"];
  await page.reload();
  await expect(navigation.getByRole("link", { name: "工作人员" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "角色管理" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "邀请审核员" })).toBeVisible();
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
  await expect(page.getByText("review.case.read")).toBeVisible();
  await page.getByRole("button", { name: "撤销 审核员" }).click();
  await page.getByRole("textbox", { name: "变更原因" }).fill("Assignment completed");
  await page.getByRole("button", { name: "确认撤销" }).click();
  await expect(page.getByText("角色已撤销")).toBeVisible();
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
