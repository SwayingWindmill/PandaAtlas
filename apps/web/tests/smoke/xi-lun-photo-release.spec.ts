import { expect, test } from "@playwright/test";

test("publishes Xi Lun in the current V2 Atlas fixture", async ({ page }) => {
  await page.goto("/zh/pandas?q=Xi%20Lun");

  await expect(page.getByTestId("public-delivery-notice")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /喜伦/ })).toHaveAttribute("href", "/zh/pandas/xi-lun");
});

test("renders Xi Lun from current V2 facts and uses the media fallback when no reviewed image is published", async ({ page }) => {
  await page.goto("/en/pandas/xi-lun");

  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Xi Lun/ })).toBeVisible();
  await expect(page.getByTestId("fact-place")).toContainText("Zoo Atlanta");
  await expect(page.getByTestId("timeline-list").locator(":scope > li")).toHaveCount(3);
  await expect(page.getByTestId("profile-hero-media-fallback")).toBeVisible();
});

test("shows Xi Lun at her current home on the panda map", async ({ page }) => {
  await page.goto("/en/map");

  await expect(page.getByRole("link", { name: /Zoo Atlanta.*Xi Lun/ })).toHaveAttribute("href", "/en/places/zoo-atlanta");
});

test("renders the current Xi Lun profile without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/en/pandas/xi-lun");
  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByTestId("profile-hero-media-fallback")).toBeVisible();
  await context.close();
});
