import { expect, test } from "@playwright/test";

test("searches the localized Atlas and opens the canonical trusted profile", async ({ page }) => {
  await page.goto("/zh/atlas?q=%E7%BE%8E%E9%A6%99");

  await expect(page.getByTestId("localized-atlas-page")).toBeVisible();
  const profileLink = page.getByRole("link", { name: /美香.*Mei Xiang/ });
  await expect(profileLink).toHaveAttribute("href", "/zh/atlas/mei-xiang");

  await profileLink.click();
  await expect(page).toHaveURL(/\/zh\/atlas\/mei-xiang$/);
  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByTestId("public-delivery-notice")).toContainText("2026.07.14.3");
});

test("loads the global distribution shell directly", async ({ page }) => {
  await page.goto("/global-distribution");

  await expect(page.getByTestId("global-distribution-page")).toBeVisible();
  await expect(page.getByTestId("global-distribution-shell")).toBeVisible();
});

test("keeps the local admin proxy disabled by default", async ({ request }) => {
  const response = await request.get("/api/admin/import-sources");

  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({ detail: "Not found" });
});
