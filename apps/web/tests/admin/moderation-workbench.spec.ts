import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const session = {
  account_id: "00000000-0000-4000-8000-000000000197",
  email: "moderator@example.test",
  state: "active",
  roles: ["moderator"],
  capabilities: [
    "account.session.read",
    "admin.shell.access",
    "moderation.case.read",
    "moderation.sanction.issue",
    "moderation.sanction.manage",
    "moderation.appeal.decide",
    "moderation.metrics",
  ],
  recent_auth: true,
  authenticated_at: "2026-08-01T10:00:00Z",
  authentication_method: "otp",
  assurance_level: "aal1",
  expires_at: "2026-08-01T11:00:00Z",
};

const appeal = {
  appeal_case_id: "00000000-0000-4000-8000-000000000201",
  account_id: "00000000-0000-4000-8000-000000000202",
  sanction_action_id: "00000000-0000-4000-8000-000000000203",
  state: "open",
  version: 1,
  appellant_message: "The report appears to refer to a different account and needs review.",
  primary_assignee_id: null,
  first_response_due_at: "2026-08-08T10:00:00Z",
  first_responded_at: null,
  outcome: null,
  user_visible_resolution: null,
  internal_resolution: null,
  closed_at: null,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  sanction_kind: "account_suspended",
  sanction_scope: "account",
  sanction_user_visible_explanation: "Your account is suspended while the report is reviewed.",
  sla_overdue: false,
  queue_age_seconds: 3600,
};

async function mockModeration(page: Page) {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
      headers: { "Cache-Control": "no-store, private" },
    });
  });
  await page.route("**/api/admin/moderation/metrics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        active_sanctions: 2,
        suspended_accounts: 1,
        open_appeals: 1,
        overdue_appeals: 0,
        oldest_open_appeal_age_seconds: 3600,
      }),
      headers: { "Cache-Control": "no-store, private" },
    });
  });
  await page.route("**/api/admin/moderation/appeals?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [appeal], state: "all" }),
      headers: { "Cache-Control": "no-store, private" },
    });
  });
  await page.route("**/api/admin/moderation/appeals/*/claim", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...appeal,
        state: "under_review",
        version: 2,
        primary_assignee_id: session.account_id,
        first_responded_at: "2026-08-01T10:30:00Z",
      }),
      headers: { "Cache-Control": "no-store, private" },
    });
  });
}

test("moderation workbench is bounded, mobile-safe, keyboard reachable, and WCAG clean", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockModeration(page);

  const response = await page.goto("/admin/moderation", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("heading", { level: 1, name: "制裁与申诉工作台" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("有效制裁", { exact: true })).toBeVisible();
  await expect(page.getByText("account_suspended", { exact: false })).toBeVisible();

  const claim = page.getByRole("button", { name: "领取申诉" });
  await claim.focus();
  await expect(claim).toBeFocused();
  await claim.click();
  await expect(page.getByRole("button", { name: "记录决定" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test("moderation entry is hidden without explicit read capability", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...session, capabilities: ["admin.shell.access"] }),
      headers: { "Cache-Control": "no-store, private" },
    });
  });
  await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByRole("link", { name: "打开制裁与申诉工作台" })).toHaveCount(0);
});
