import { expect, test } from "@playwright/test";

const RELEASE_ID = "2026.08.12.1";

test("publishes Xi Lun in the current V2 Atlas fixture", async ({ page }) => {
  await page.goto("/zh/pandas?q=Xi%20Lun");

  await expect(page.getByTestId("public-delivery-notice")).toContainText(RELEASE_ID);
  await expect(page.getByRole("link", { name: /喜伦/ })).toHaveAttribute("href", "/zh/pandas/xi-lun");
});

test("renders Xi Lun from current V2 facts and uses the media fallback when no reviewed image is published", async ({ page }) => {
  await page.goto("/en/pandas/xi-lun");

  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Xi Lun/ })).toBeVisible();
  await expect(page.getByTestId("revision-summary")).toContainText(RELEASE_ID);
  await expect(page.getByTestId("fact-place")).toContainText("Zoo Atlanta");
  await expect(page.getByTestId("timeline-list").locator(":scope > li")).toHaveCount(3);
  await expect(page.getByTestId("profile-hero-media-fallback")).toBeVisible();
});

test("shows Xi Lun current residency in the structured map", async ({ page }) => {
  await page.goto(`/en/map?mode=individual&focus=xi-lun&snapshot=${RELEASE_ID}`);

  const results = page.locator('[data-testid^="structured-map-result-residency:"]');
  await expect(results).toHaveCount(1);
  await expect(results.filter({ hasText: "Current" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "View panda profile" }).first()).toHaveAttribute(
    "href",
    "/en/pandas/xi-lun",
  );
});

test("renders the current Xi Lun profile without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/en/pandas/xi-lun");
  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByTestId("profile-hero-media-fallback")).toBeVisible();
  await context.close();
});
