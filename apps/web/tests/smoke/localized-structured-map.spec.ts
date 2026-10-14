import { expect, test } from "@playwright/test";

const RELEASE_ID_PATTERN = String.raw`2026\.\d{2}\.\d{2}\.\d+`;

test("renders the current institution map journey from the V2 fixture", async ({ page }) => {
  await page.goto("/en/map");

  await expect(page).toHaveURL(new RegExp(`/en/map\\?mode=institutions&snapshot=${RELEASE_ID_PATTERN}$`));
  await expect(page.getByTestId("structured-map-page")).toBeVisible();
  await expect(page.locator('[data-testid^="structured-map-result-institution:"]')).toHaveCount(3);
  await expect(page.getByTestId("map-visualization-enhancement")).toBeVisible();
});

test("keeps wild conservation usable without requiring the visual provider", async ({ page }) => {
  await page.goto("/en/map?mode=wild");

  await expect(page.getByTestId("structured-map-page")).toBeVisible();
  await expect(page.locator('[data-testid^="structured-map-result-conservation:"]').first()).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("normalizes unsupported structured map parameters", async ({ page }) => {
  await page.goto("/en/map?mode=combined&country=china&status=future&snapshot=wrong&selected=missing&unsupported=value");

  await expect(page).toHaveURL(new RegExp(`/en/map\\?mode=institutions&snapshot=${RELEASE_ID_PATTERN}$`));
  await expect(page.getByTestId("structured-map-page")).toBeVisible();
});

