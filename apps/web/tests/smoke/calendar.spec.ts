import { expect, test } from "@playwright/test";

test("calendar is a Panda Moments view and the standalone route is gone", async ({ page, request }) => {
  const zh = await request.get("/zh/moments?view=calendar&year=2026&month=8");
  const en = await request.get("/en/moments?view=calendar&year=2026&month=8");
  expect(zh.status()).toBe(200);
  expect(en.status()).toBe(200);
  expect((await request.get("/zh/calendar?year=2026&month=8")).status()).toBe(404);
  expect((await request.get("/en/calendar?year=2026&month=8")).status()).toBe(404);

  const sitemap = await request.get("/sitemap.xml");
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("/zh/moments");
  expect(sitemapBody).not.toContain("/zh/calendar");

  await page.goto("/zh/moments?view=calendar&year=2026&month=8");
  await expect(page.getByRole("heading", { level: 1, name: "熊猫时光" })).toBeVisible();
  await expect(page.getByRole("link", { name: "日历" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: "按月看看熊猫世界发生了什么。" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "2026年8月" })).toBeVisible();
  await expect(page.getByRole("link", { name: "切换到时光流" })).toHaveAttribute("href", "/zh/moments?view=timeline&year=2026&month=8&anniversaries=1");
});

test("calendar month navigation stays inside Panda Moments", async ({ page }) => {
  await page.goto("/en/moments?view=calendar&year=2026&month=1");
  await expect(page.getByRole("link", { name: "Previous month" })).toHaveAttribute("href", "/en/moments?view=calendar&year=2025&month=12");
  await expect(page.getByRole("link", { name: "Next month" })).toHaveAttribute("href", "/en/moments?view=calendar&year=2026&month=2");
});
