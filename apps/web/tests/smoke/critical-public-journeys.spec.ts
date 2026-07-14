import { expect, test } from "@playwright/test";

test("loads atlas and follows the canonical detail-to-lineage route", async ({ page }) => {
  await page.goto("/atlas");

  await expect(page.getByTestId("atlas-page")).toBeVisible();

  const firstAtlasCard = page.locator('[data-testid^="panda-card-link-"]').first();
  await expect(firstAtlasCard).toBeVisible();
  await expect(firstAtlasCard).toHaveAttribute("href", /\/atlas\/.+/);

  const detailHref = await firstAtlasCard.getAttribute("href");
  expect(detailHref).toMatch(/^\/atlas\/[^/?#]+$/);
  await page.goto(detailHref!);
  await expect(page).toHaveURL(/\/atlas\/[^/?#]+$/);
  await expect(page.getByTestId("panda-profile-page")).toBeVisible();

  const lineageLink = page.getByTestId("profile-lineage-link");
  await expect(lineageLink).toHaveAttribute("href", /\/lineage\?focus=[^&]+$/);
  const lineageHref = await lineageLink.getAttribute("href");
  expect(lineageHref).toMatch(/^\/lineage\?focus=[^&]+$/);

  await page.goto(lineageHref!);
  await expect(page).toHaveURL(/\/lineage\?focus=[^&]+/);
  await expect(page.getByTestId("lineage-page")).toBeVisible();
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
