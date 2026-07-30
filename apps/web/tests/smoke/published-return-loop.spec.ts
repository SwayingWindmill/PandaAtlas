import { expect, test, type Page } from "@playwright/test";

const session = {
  account_id: "11111111-1111-4111-8111-111111111111",
  email: "member@example.invalid",
  state: "active",
  roles: ["member"],
  capabilities: ["account.session.read"],
  recent_auth: true,
  authenticated_at: "2026-07-30T00:00:00Z",
  authentication_method: "otp",
  assurance_level: "aal1",
  expires_at: "2026-07-30T01:00:00Z",
};

const unreadItem = {
  inbox_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  intent_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  category: "major_activity",
  body: {
    localized_snapshots: [
      { locale: "zh-CN", title: "美香发布了新动态", summary: "经过审核的公开安全摘要。" },
      { locale: "en", title: "New Activity for Mei Xiang", summary: "A reviewed public-safe summary." },
    ],
  },
  body_version: 1,
  created_at: "2026-07-30T00:00:00Z",
  expires_at: "2026-10-28T00:00:00Z",
  seen_at: null,
  read_at: null,
  retracted_at: null,
  retraction_reason: null,
};

const retractedItem = {
  inbox_item_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  intent_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  category: "correction_retraction",
  body: {
    title_zh: "通知已撤回",
    title_en: "Notification retracted",
    summary_zh: "原动态不再公开显示。",
    summary_en: "The original Activity is no longer public.",
  },
  body_version: 2,
  created_at: "2026-07-29T00:00:00Z",
  expires_at: "2026-10-27T00:00:00Z",
  seen_at: "2026-07-29T01:00:00Z",
  read_at: "2026-07-29T01:00:00Z",
  retracted_at: "2026-07-29T02:00:00Z",
  retraction_reason: "source_retracted",
};

async function mockSignedInNotificationCenter(page: Page) {
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
  await page.route(/\/api\/notification\/inbox(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [unreadItem, retractedItem], next_cursor: "cursor-older-activity", unread_count: 1 }),
    });
  });
  await page.route("**/api/notification/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          account_id: session.account_id,
          category: "major_activity",
          channel: "email",
          enabled: false,
          version: 1,
          updated_at: "2026-07-30T00:00:00Z",
        },
      ]),
    });
  });
  await page.route("**/api/notification/inbox/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/read", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(String(body.idempotency_key)).toMatch(/^inbox-read:/);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...unreadItem, read_at: "2026-07-30T00:05:00Z" }),
    });
  });
  await page.route("**/api/engagement/preferences/major_activity/email", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.enabled).toBe(true);
    expect(String(body.idempotency_key)).toMatch(/^preference-major_activity:/);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        account_id: session.account_id,
        category: "major_activity",
        channel: "email",
        enabled: true,
        version: 2,
        updated_at: "2026-07-30T00:06:00Z",
      }),
    });
  });
}

test("private Inbox exposes read, retraction, preference, locale, and mobile behavior", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockSignedInNotificationCenter(page);
  await page.goto("/en/me/inbox");

  await expect(page.getByRole("heading", { name: "Native Inbox and email preferences" })).toBeVisible();
  await expect(page.getByText("New Activity for Mei Xiang")).toBeVisible();
  await expect(page.getByText("Notification retracted")).toBeVisible();
  await expect(page.getByText("Retracted", { exact: true })).toBeVisible();
  await expect(page.getByText(/Unread:\s*1/)).toBeVisible();
  await expect(page.getByRole("link", { name: "View earlier notifications" })).toHaveAttribute(
    "href",
    "/en/me/inbox?cursor=cursor-older-activity",
  );

  const markRead = page.getByRole("button", { name: "Mark as read" });
  expect((await markRead.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await markRead.click();
  await expect(page.getByText(/Unread:\s*0/)).toBeVisible();

  const enableEmail = page.getByRole("button", { name: "Enable email" }).first();
  expect((await enableEmail.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await page.getByRole("button", { name: "Enable email" }).nth(1).click();
  await expect(page.getByRole("status")).toContainText("Preference saved");
  await expect(page.getByText("Security and role notifications are mandatory and cannot be disabled.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("link", { name: "中文" })).toHaveAttribute("href", "/zh/me/inbox");
});

test("signed-out Inbox never requests private facts and provides a safe return path", async ({ page }) => {
  let privateRequests = 0;
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Authentication required"}' });
  });
  await page.route("**/api/notification/**", async (route) => {
    privateRequests += 1;
    await route.fulfill({ status: 500, body: "unexpected" });
  });
  await page.goto("/en/me/inbox");
  await expect(page.getByRole("heading", { name: "Sign in to view notifications" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/auth/login?next=%2Fen%2Fme%2Finbox",
  );
  expect(privateRequests).toBe(0);
});
