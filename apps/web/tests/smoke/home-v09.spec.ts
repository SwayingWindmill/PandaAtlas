import { expect, test } from "@playwright/test";

test("the v09 home introduces pandas through photo cards and section entrances", async ({ page }) => {
  await page.goto("/zh");

  await expect(page.getByRole("heading", { level: 1, name: "认识每一只熊猫" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "继续探索熊猫世界" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "把喜欢的熊猫留在身边" })).toBeVisible();
  // Each photo card carries the panda's licensed cover and opens its profile.
  const card = page.locator('a[href="/zh/pandas/mei-xiang"]').filter({ has: page.locator("img") }).first();
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveAttribute("src", /\/media\/pandas\/photos\/mei-xiang\.png$/);
  await expect(page.getByRole("link", { name: "地点" }).first()).toHaveAttribute("href", "/zh/map");

  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: "Meet every panda" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Explore the panda world" })).toBeVisible();
});

test("the home background video credits its source and hero motion can be paused", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/zh");

  const hero = page.locator("main section").first();
  await expect(hero.getByRole("link", { name: "官方来源" })).toHaveAttribute("target", "_blank");
  await hero.getByRole("button", { name: "暂停动态画面" }).click();
  await expect(hero.getByRole("button", { name: "播放动态画面" })).toBeVisible();
  await expect(hero.locator("[data-panda-rail-track]")).toHaveCSS("animation-play-state", "paused");
});

test("touch-width visitors can pause the moving photo rail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");

  const hero = page.locator("main section").first();
  const rail = hero.locator("[data-panda-rail-track]");
  await expect(rail).toHaveCSS("animation-play-state", "running");
  await hero.getByRole("button", { name: "Pause motion" }).click();
  await expect(rail).toHaveCSS("animation-play-state", "paused");
});

test("reduced motion keeps the home hero still", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto("/zh");

  await expect(page.getByRole("heading", { level: 1, name: "认识每一只熊猫" })).toBeVisible();
  await expect(page.locator("main video")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "暂停动态画面" })).toHaveCount(0);
  await context.close();
});

test("the home core content works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/zh");

  await expect(page.getByRole("heading", { level: 1, name: "认识每一只熊猫" })).toBeVisible();
  await expect(page.locator('a[href="/zh/pandas/mei-xiang"]').first()).toBeAttached();
  await context.close();
});
