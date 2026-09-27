import { expect, test } from "@playwright/test";

test("formal home uses the panda-first V0.9 experience", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(String(error)));

  await page.goto("/zh", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("localized-home-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "认识每一只熊猫" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "继续探索熊猫世界" })).toBeVisible();
  await expect(page.getByRole("link", { name: /开始认识熊猫/ })).toHaveAttribute("href", "/zh/pandas");
  const heroVideo = page.locator("video[data-hero-video-slot]").first();
  await expect(heroVideo).toBeAttached();
  await expect(heroVideo.locator("source")).toHaveAttribute("src", /\/media\/home-official\//);
  expect(browserErrors).toEqual([]);
});

test("formal panda directory uses PublicRead portrait discovery", async ({ page }) => {
  await page.goto("/zh/pandas", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("localized-pandas-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "熊猫图鉴" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "按名字搜索熊猫" })).toBeVisible();
  await expect(page.getByTestId("fan-v08-directory-list")).toBeVisible();

  const firstProfile = page.getByTestId("fan-v08-directory-list").locator('a[href^="/zh/pandas/"]').first();
  await expect(firstProfile).toBeVisible();
  await expect(firstProfile).not.toHaveAttribute("href", /prototype/);
});
