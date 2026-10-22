import { expect, test } from "@playwright/test";

test("serves localized panda game routes and lists them in the sitemap", async ({ page, request }) => {
  for (const locale of ["zh", "en"] as const) {
    const hub = await request.get(`/${locale}/games`);
    const random = await request.get(`/${locale}/games/random`);
    const guess = await request.get(`/${locale}/games/guess`);
    const daily = await request.get(`/${locale}/games/daily`);
    expect(hub.status()).toBe(200);
    expect(daily.status()).toBe(200);
    expect(random.status()).toBe(200);
    expect(guess.status()).toBe(200);
  }

  const sitemap = await request.get("/sitemap.xml");
  const xml = await sitemap.text();
  expect(xml).toContain("/zh/games");
  expect(xml).toContain("/en/games/random");
  expect(xml).toContain("/en/games/guess");
  expect(xml).toContain("/zh/games/daily");

  await page.goto("/zh/games");
  await expect(page.getByRole("heading", { level: 1, name: "轻松玩一会儿，也认识一只新熊猫。" })).toBeVisible();
  await expect(page.getByRole("link", { name: "随机一只" })).toHaveAttribute("href", "/zh/games/random");
  await expect(page.getByRole("link", { name: "开始猜" })).toHaveAttribute("href", "/zh/games/guess");
  await expect(page.getByRole("link", { name: "猜今天的熊猫" })).toHaveAttribute("href", "/zh/games/daily");
});

test("plays Daily Panda: a wrong guess reveals a clue, the right one gives the answer", async ({ page }) => {
  await page.goto("/zh/games/daily");
  await expect(page.getByText("性别：雌性")).toBeVisible();
  await expect(page.getByText("还能猜 6 次")).toBeVisible();

  await page.getByPlaceholder("输入熊猫名字").fill("美香");
  await page.getByRole("option", { name: /美香/ }).click();
  await expect(page.getByText("出生于 2016 年")).toBeVisible();
  await expect(page.getByText("性别相同 · TA 出生更晚")).toBeVisible();

  await page.getByPlaceholder("输入熊猫名字").fill("喜伦");
  await page.getByRole("option", { name: /喜伦/ }).click();
  await expect(page.getByText("猜对了！用了 2 次。")).toBeVisible();
  await expect(page.getByRole("link", { name: "打开熊猫资料" })).toHaveAttribute("href", "/zh/pandas/xi-lun");
  await expect(page.getByRole("img", { name: "TA 的公开照片" })).toBeVisible();

  await page.reload();
  await expect(page.getByText("猜对了！用了 2 次。")).toBeVisible();
});
