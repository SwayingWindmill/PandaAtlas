import { expect, test } from "@playwright/test";

test("serves localized panda game routes and lists them in the sitemap", async ({ page, request }) => {
  for (const locale of ["zh", "en"] as const) {
    const hub = await request.get(`/${locale}/games`);
    const random = await request.get(`/${locale}/games/random`);
    const guess = await request.get(`/${locale}/games/guess`);
    expect(hub.status()).toBe(200);
    expect(random.status()).toBe(200);
    expect(guess.status()).toBe(200);
  }

  const sitemap = await request.get("/sitemap.xml");
  const xml = await sitemap.text();
  expect(xml).toContain("/zh/games");
  expect(xml).toContain("/en/games/random");
  expect(xml).toContain("/en/games/guess");

  await page.goto("/zh/games");
  await expect(page.getByRole("heading", { level: 1, name: "轻松玩一会儿，也认识一只新熊猫。" })).toBeVisible();
  await expect(page.getByRole("link", { name: "随机一只" })).toHaveAttribute("href", "/zh/games/random");
  await expect(page.getByRole("link", { name: "开始猜" })).toHaveAttribute("href", "/zh/games/guess");
});
