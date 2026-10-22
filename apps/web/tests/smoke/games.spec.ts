import { expect, test, type Page } from "@playwright/test";

import { isDeployedFeatureEnabled } from "../fixtures/deployment-features";

const engagementEnabled = isDeployedFeatureEnabled("engagement");
const XI_LUN_ID = "00000000-0000-4000-8000-000000000101";

async function signIn(page: Page) {
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accountId: "11111111-1111-1111-1111-111111111111", aal: "aal1", capabilities: [] }),
    });
  });
}

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

test("saves a finished Daily Panda to the panda book", async ({ page }) => {
  test.skip(!engagementEnabled, "The deployed Web build intentionally disables Engagement UI.");
  await signIn(page);
  const saved: unknown[] = [];
  await page.route("**/api/engagement/daily-panda-results", async (route) => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ saved: true }) });
  });

  await page.goto("/zh/games/daily");
  await page.getByPlaceholder("输入熊猫名字").fill("喜伦");
  await page.getByRole("option", { name: /喜伦/ }).click();
  await page.getByRole("button", { name: "收进熊猫图鉴" }).click();

  await expect(page.getByText("TA 已经在你的熊猫图鉴里了。")).toBeVisible();
  await expect(page.getByRole("link", { name: "打开熊猫图鉴" })).toHaveAttribute("href", "/zh/me/panda-book");
  expect(saved).toEqual([{ guessPandaIds: [XI_LUN_ID] }]);
});

test("shows the panda book with progress and the pandas met", async ({ page }) => {
  test.skip(!engagementEnabled, "The deployed Web build intentionally disables Engagement UI.");
  await signIn(page);
  await page.route("**/api/engagement/panda-book", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        publishedCount: 3,
        knownCount: 1,
        items: [{
          pandaId: XI_LUN_ID,
          firstGame: "daily_panda",
          firstMetAt: "2026-10-22T02:00:00.000Z",
          lastMetAt: "2026-10-22T02:00:00.000Z",
          timesMet: 2,
        }],
      }),
    });
  });

  await page.goto("/zh/me/panda-book");
  await expect(page.getByRole("heading", { level: 1, name: "熊猫图鉴" })).toBeVisible();
  await expect(page.getByText("已认识 1 / 3 只")).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  const card = page.getByRole("link", { name: /喜伦/ });
  await expect(card).toHaveAttribute("href", "/zh/pandas/xi-lun");
  await expect(card).toContainText("在每日一猫里认识");
  await expect(card).toContainText("遇到过 2 次");
});

test("asks a signed-out visitor to sign in for the panda book", async ({ page }) => {
  await page.goto("/en/me/panda-book");
  await expect(page.getByText("Sign in to see your panda book, synced between the website and the app.")).toBeVisible();
});
