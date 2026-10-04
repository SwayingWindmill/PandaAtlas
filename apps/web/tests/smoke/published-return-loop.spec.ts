import { expect, test, type Page } from "@playwright/test";

import { isDeployedFeatureEnabled } from "../fixtures/deployment-features";

const notificationEnabled = isDeployedFeatureEnabled("notification");

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
  messageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  category: "knowledge_update",
  content: {
    title_zh: "美香发布了新动态",
    title_en: "New Activity for Mei Xiang",
    summary_zh: "经过审核的公开安全摘要。",
    summary_en: "A reviewed public-safe summary.",
  },
  createdAt: "2026-07-30T00:00:00Z",
  seenAt: null,
  readAt: null,
};

async function mockSignedInNotificationCenter(page: Page) {
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
  await page.route(/\/api\/notification\/inbox(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [unreadItem], unreadCount: 1 }),
    });
  });
  await page.route("**/api/notification/preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body).toEqual({ category: "knowledge_update", channel: "email", enabled: true });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          category: "knowledge_update",
          channel: "email",
          enabled: true,
          version: 2,
          updatedAt: "2026-07-30T00:06:00Z",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          category: "knowledge_update",
          channel: "email",
          enabled: false,
          version: 1,
          updatedAt: "2026-07-30T00:00:00Z",
        },
      ]),
    });
  });
  await page.route("**/api/notification/inbox/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/read", async (route) => {
    expect(route.request().method()).toBe("PATCH");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...unreadItem, readAt: "2026-07-30T00:05:00Z" }),
    });
  });
}

test("private Inbox renders current notifications and supports read and email-preference actions", async ({ page }) => {
  test.skip(!notificationEnabled, "The deployed Web build intentionally disables Notification UI.");
  await mockSignedInNotificationCenter(page);
  await page.goto("/en/me/inbox");

  await expect(page.getByRole("heading", { name: "Native Inbox and email preferences" })).toBeVisible();
  await expect(page.getByText("New Activity for Mei Xiang")).toBeVisible();
  await expect(page.getByText(/Unread:\s*1/)).toBeVisible();

  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(page.getByText(/Unread:\s*0/)).toBeVisible();

  await page.getByRole("listitem").filter({ hasText: "Birthday Activity" }).getByRole("button", { name: "Enable email" }).click();
  await expect(page.getByRole("status")).toContainText("Preference saved");
});

test("signed-out Inbox never requests private facts and provides a safe return path", async ({ page }) => {
  test.skip(!notificationEnabled, "The deployed Web build intentionally disables Notification UI.");
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

test("disabled Notification deployment keeps the private Inbox unpublished", async ({ request }) => {
  test.skip(notificationEnabled, "Notification UI is enabled in this deployment profile.");
  const response = await request.get("/en/me/inbox", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});
