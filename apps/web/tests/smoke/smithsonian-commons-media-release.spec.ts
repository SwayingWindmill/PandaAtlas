import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const RELEASE_ID = "2026.07.24.3";
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function mockSmithsonianMedia(page: Page) {
  await page.route(`**/media/releases/${RELEASE_ID}/media-*.webp`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_PIXEL_PNG,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockSmithsonianMedia(page);
});

test("shows every open-license Mei Xiang and Xiao Qi Ji image", async ({ page }) => {
  for (const profile of [
    {
      path: "/zh/atlas/mei-xiang",
      count: 1,
      countLabel: "共 1 张开放许可图片",
      primaryLabel: "主图",
      galleryLabel: "画廊",
    },
    {
      path: "/en/atlas/mei-xiang",
      count: 1,
      countLabel: "1 open-license image",
      primaryLabel: "Primary image",
      galleryLabel: "Gallery image",
    },
    {
      path: "/zh/atlas/xiao-qi-ji",
      count: 5,
      countLabel: "共 5 张开放许可图片",
      primaryLabel: "主图",
      galleryLabel: "画廊",
    },
    {
      path: "/en/atlas/xiao-qi-ji",
      count: 5,
      countLabel: "5 open-license images",
      primaryLabel: "Primary image",
      galleryLabel: "Gallery image",
    },
  ]) {
    await page.goto(profile.path);

    await expect(page.getByTestId("revision-summary")).toContainText(RELEASE_ID);
    const gallery = page.getByTestId("media-gallery");
    await expect(gallery.getByTestId("media-gallery-count")).toHaveText(profile.countLabel);
    await expect(gallery.getByTestId("media-item")).toHaveCount(profile.count);
    await expect(gallery.locator('[data-media-role="primary"]')).toHaveCount(1);
    await expect(gallery.locator('[data-media-role="gallery"]')).toHaveCount(profile.count - 1);
    await expect(gallery.getByText(profile.primaryLabel, { exact: true })).toHaveCount(1);
    await expect(gallery.getByText(profile.galleryLabel, { exact: true })).toHaveCount(
      profile.count - 1,
    );
    await expect(gallery.getByRole("img")).toHaveCount(profile.count);
    await expect(gallery.getByRole("link", { name: /原始来源|Original source/ })).toHaveCount(
      profile.count,
    );
  }
});

test("keeps Xiao Qi Ji primary first and exposes all open licenses", async ({ page }) => {
  await page.goto("/en/atlas/xiao-qi-ji");

  const gallery = page.getByTestId("media-gallery");
  const items = gallery.getByTestId("media-item");
  await expect(items).toHaveCount(5);
  await expect(items.first()).toHaveAttribute("data-media-role", "primary");
  await expect(items.first()).toContainText("CC BY-SA 4.0");
  await expect(items.filter({ hasText: "CC BY 2.0" })).toHaveCount(4);
});
