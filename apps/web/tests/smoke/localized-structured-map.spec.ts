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

test("legacy map routes redirect by request language while preserving task state", async ({ request }) => {
  for (const legacyPath of ["/map", "/global-distribution"]) {
    const response = await request.get(`${legacyPath}?mode=individual&focus=mei-xiang`, {
      headers: { "accept-language": "en-US,en;q=0.9" },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toContain("/en/map?mode=individual&focus=mei-xiang");
  }
});
