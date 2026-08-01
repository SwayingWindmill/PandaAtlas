import { expect, test } from "@playwright/test";

test("searches the localized Atlas and opens the canonical trusted profile", async ({ page }) => {
  await page.goto("/zh/pandas?q=%E7%BE%8E%E9%A6%99");

  await expect(page.getByTestId("localized-pandas-page")).toBeVisible();
  const profileLink = page.getByRole("link", { name: /美香.*Mei Xiang/ });
  await expect(profileLink).toHaveAttribute("href", "/zh/pandas/mei-xiang");

  await profileLink.click();
  await expect(page).toHaveURL(/\/zh\/pandas\/mei-xiang$/);
  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByTestId("public-delivery-notice")).toContainText("2026.07.31.1");
});

test("publishes the Ueno family in Atlas search and canonical profiles", async ({ page }) => {
  await page.goto("/en/pandas?q=Ri%20Ri");

  await expect(page.getByTestId("atlas-result-summary")).toContainText("1 pandas found; 39 pandas are currently included");
  const profileLink = page.getByRole("link", { name: /Ri Ri/ });
  await expect(profileLink).toHaveAttribute("href", "/en/pandas/ri-ri");
  await profileLink.click();

  await expect(page).toHaveURL(/\/en\/pandas\/ri-ri$/);
  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByTestId("revision-summary")).toContainText("2026.07.31.1");
});

test("redirects the legacy global distribution route into the localized structured map", async ({ page }) => {
  await page.goto("/global-distribution");

  await expect(page).toHaveURL(/\/(zh|en)\/map\?mode=institutions&snapshot=2026\.07\.31\.1$/);
  await expect(page.getByTestId("structured-map-page")).toBeVisible();
});

test("keeps the local admin proxy disabled by default", async ({ request }) => {
  const response = await request.get("/api/admin/import-sources");

  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({ detail: "Not found" });
});
