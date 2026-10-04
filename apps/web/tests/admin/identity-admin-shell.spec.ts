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

  await expect(page.getByText("Available operations")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Audit", exact: true })).toHaveAttribute("href", "/admin/audit");
  await expect(page.getByRole("link", { name: "Review", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Moderation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Curation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Publication", exact: true })).toHaveCount(0);
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

  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Audit", exact: true })).toBeVisible();
  await expect(page.getByText("The current account does not have the capability required for this V2 operation surface.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Publication" })).toHaveCount(0);
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

  const navigation = page.getByRole("navigation", { name: "Admin navigation" });
  await expect(navigation).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 320);

  const auditLink = navigation.getByRole("link", { name: "Audit", exact: true });
  await auditLink.focus();
  await expect(auditLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/audit$/);
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

  await expect(page.getByRole("alert")).toContainText("This account does not have staff access.");
  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toHaveCount(0);
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
