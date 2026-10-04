import { expect, test } from "@playwright/test";

const staffSession = {
  accountId: "11111111-1111-4111-8111-111111111111",
  aal: "aal2",
  capabilities: ["audit.read"],
};

test("current V2 admin shell exposes retained operations without retired V1 surfaces", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(staffSession),
    });
  });

  await page.goto("/admin");

  await expect(page.getByText("Retained V2 operations")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Audit", exact: true })).toHaveAttribute("href", "/admin/audit");
  await expect(page.getByRole("link", { name: /Archive/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Game Bank/i })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
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
