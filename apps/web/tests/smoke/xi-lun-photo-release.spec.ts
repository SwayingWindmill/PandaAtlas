import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const RELEASE_ID = "2026.07.21.1";
const MEDIA_RELEASE_ID = "2026.07.21.1";
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function mockXiLunMedia(page: Page) {
  await page.route(`**/media/releases/${MEDIA_RELEASE_ID}/media-xi-lun-*.webp`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_PIXEL_PNG,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockXiLunMedia(page);
});

test("publishes Xi Lun as the fifteenth trusted Atlas profile", async ({ page }) => {
  await page.goto("/zh/atlas?q=Xi%20Lun");

  await expect(page.getByTestId("public-delivery-notice")).toContainText(RELEASE_ID);
  await expect(page.getByTestId("atlas-result-summary")).toContainText("共匹配 1 项");
  await expect(page.getByRole("link", { name: /喜伦/ })).toHaveAttribute(
    "href",
    "/zh/atlas/xi-lun",
  );

  await page.goto("/en/atlas");
  await expect(page.getByTestId("atlas-result-summary")).toContainText("15");
});

test("renders Xi Lun bilingual profile, reviewed media, current residency, and three events", async ({ page }) => {
  for (const profile of [
    {
      path: "/zh/atlas/xi-lun",
      heading: /喜伦/,
      alt: "喜伦在亚特兰大动物园的栖息地内坐着",
      place: "成都大熊猫繁育研究基地",
    },
    {
      path: "/en/atlas/xi-lun",
      heading: /Xi Lun/,
      alt: "Xi Lun sitting in her habitat at Zoo Atlanta",
      place: "Chengdu Research Base of Giant Panda Breeding",
    },
  ]) {
    await page.goto(profile.path);

    await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: profile.heading })).toBeVisible();
    await expect(page.getByTestId("revision-summary")).toContainText(RELEASE_ID);
    await expect(page.getByTestId("fact-place")).toContainText(profile.place);
    await expect(page.getByTestId("fact-place")).toContainText("2026-07-20");
    await expect(page.getByTestId("timeline-list").locator(":scope > li")).toHaveCount(5);

    const gallery = page.getByTestId("media-gallery");
    await expect(gallery.getByTestId("media-item")).toHaveCount(1);
    await expect(gallery.getByRole("img", { name: profile.alt })).toHaveAttribute(
      "src",
      new RegExp(`/media/releases/${MEDIA_RELEASE_ID}/media-xi-lun-.*-w1200\\.webp$`),
    );
    await expect(gallery).toContainText("CC BY-SA 4.0");
    await expect(gallery).toContainText("O01326 / Wikimedia Commons");
  }
});

test("renders Xi Lun parentage and structured lineage from reviewed assertions", async ({ page }) => {
  await page.goto("/zh/atlas/xi-lun");
  const parents = page.getByTestId("parent-relations");
  await expect(parents.getByRole("link", { name: "伦伦", exact: true })).toHaveAttribute(
    "href",
    "/zh/atlas/lun-lun",
  );
  await expect(parents.getByRole("link", { name: "洋洋", exact: true })).toHaveAttribute(
    "href",
    "/zh/atlas/yang-yang",
  );

  await page.goto("/en/lineage?focus=xi-lun&ancestors=1");
  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
  await expect(page.getByTestId("lineage-relation-parent-xi-lun-father")).toContainText("Yang Yang");
  await expect(page.getByTestId("lineage-relation-parent-xi-lun-mother")).toContainText("Lun Lun");
  await expect(page.getByTestId("lineage-relation-parent-xi-lun-father")).toContainText("Confirmed");
  await expect(page.getByTestId("lineage-relation-parent-xi-lun-mother")).toContainText("Confirmed");
});

test("shows Xi Lun current and historical footprints in the structured map", async ({ page }) => {
  await page.goto(`/en/map?mode=individual&focus=xi-lun&snapshot=${RELEASE_ID}`);

  const results = page.locator('[data-testid^="structured-map-result-residency:"]');
  await expect(results).toHaveCount(2);
  await expect(results.filter({ hasText: "Current" })).toHaveCount(1);
  await expect(results.filter({ hasText: "Historical" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Open trusted profile" }).first()).toHaveAttribute(
    "href",
    "/en/atlas/xi-lun",
  );
});

test("keeps Xi Lun profile keyboard-operable at 320 px", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("panda-atlas:saved-profiles");
    localStorage.removeItem("panda-atlas:profile-preferences");
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/en/atlas/xi-lun");

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const favorite = page.getByRole("button", { name: /^Save / });
  await favorite.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("renders Xi Lun profile and lineage without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await mockXiLunMedia(page);

  await page.goto("/en/atlas/xi-lun");
  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByRole("img", { name: "Xi Lun sitting in her habitat at Zoo Atlanta" })).toBeVisible();

  await page.goto("/en/lineage?focus=xi-lun&ancestors=1");
  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
  await expect(page.getByTestId("lineage-relation-parent-xi-lun-father")).toContainText("Confirmed");
  await context.close();
});
