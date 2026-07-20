import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const RELEASE_ID = "2026.07.20.1";
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const profiles = [
  {
    slug: "lun-lun",
    nameZh: "伦伦",
    nameEn: "Lun Lun",
    altZh: "伦伦坐在亚特兰大动物园的木质栖架旁",
  },
  {
    slug: "yang-yang",
    nameZh: "洋洋",
    nameEn: "Yang Yang",
    altZh: "洋洋在亚特兰大动物园的栖息地内休息",
  },
  {
    slug: "ya-lun",
    nameZh: "雅伦",
    nameEn: "Ya Lun",
    altZh: "雅伦在亚特兰大动物园的栖息地内坐着",
  },
] as const;

test.beforeEach(async ({ page }) => {
  await page.route(`**/media/releases/${RELEASE_ID}/*.webp`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_PIXEL_PNG,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });
});

test("publishes ten reviewed panda profiles in the current Web release", async ({ page }) => {
  await page.goto("/zh/atlas");

  await expect(page.getByTestId("public-delivery-notice")).toContainText(RELEASE_ID);
  await expect(page.getByTestId("atlas-result-summary")).toContainText("10");

  for (const profile of profiles) {
    await page.goto(`/zh/atlas?q=${encodeURIComponent(profile.nameEn)}`);
    await expect(page.getByTestId("atlas-result-summary")).toContainText("共匹配 1 项");
    await expect(page.getByRole("link", { name: new RegExp(profile.nameZh) }))
      .toHaveAttribute("href", `/zh/atlas/${profile.slug}`);
  }
});

for (const profile of profiles) {
  test(`${profile.nameEn} exposes one reviewed licensed photo and complete release metadata`, async ({ page }) => {
    await page.goto(`/zh/atlas/${profile.slug}`);

    await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(profile.nameZh) })).toBeVisible();
    await expect(page.getByTestId("revision-summary")).toContainText(RELEASE_ID);
    await expect(page.getByTestId("fact-place")).toContainText("2026-07-20");
    await expect(page.getByTestId("timeline-list").locator(":scope > li")).toHaveCount(5);

    const gallery = page.getByTestId("media-gallery");
    await expect(gallery).toBeVisible();
    await expect(gallery.getByTestId("media-item")).toHaveCount(1);
    const image = gallery.getByRole("img", { name: profile.altZh });
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute(
      "src",
      new RegExp(`/media/releases/${RELEASE_ID}/.*-w1200\\.webp$`),
    );
    await expect(gallery).toContainText("CC BY-SA 4.0");
    await expect(gallery).toContainText("O01326 / Wikimedia Commons");
  });
}

test("Ya Lun parentage is rendered from reviewed assertions", async ({ page }) => {
  await page.goto("/zh/atlas/ya-lun");

  const parents = page.getByTestId("parent-relations");
  await expect(parents).toContainText("伦伦");
  await expect(parents).toContainText("洋洋");
  await expect(parents.getByRole("link", { name: "伦伦", exact: true })).toHaveAttribute(
    "href",
    "/zh/atlas/lun-lun",
  );
  await expect(parents.getByRole("link", { name: "洋洋", exact: true })).toHaveAttribute(
    "href",
    "/zh/atlas/yang-yang",
  );
});
