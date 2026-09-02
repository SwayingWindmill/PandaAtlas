import { expect, test } from "@playwright/test";

test("fan V8 prototype renders the immersive home journey", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("fan-v08-prototype")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "从一只熊猫，走进整个世界。" })).toBeVisible();
  await expect(page.getByText("V8.1 视觉原型 · 图片为评审 fixture")).toBeVisible();
  await expect(page.getByRole("heading", { name: "美香不是一个孤立的名字。" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /只公开熊猫，等你继续认识/ })).toBeVisible();
});

test("fan V8 panda directory renders the editorial discovery flow", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("fan-v08-directory")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "熊猫图鉴" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "按名字搜索熊猫" })).toBeVisible();
  await expect(page.getByRole("button", { name: "有照片" })).toBeVisible();
  await expect(page.getByTestId("fan-v08-directory-list")).toBeVisible();

  const researchCount = page.getByTestId("fan-v08-research-count");
  if (await researchCount.count()) {
    await expect(researchCount).toContainText("960");
    await expect(page.getByRole("button", { name: /继续显示 60 只/ })).toContainText("60 / 960");

    const search = page.getByRole("searchbox", { name: "按名字搜索熊猫" });
    await search.fill("阿旭");
    await expect(page.getByText("阿旭", { exact: true })).toBeVisible();
    await expect(page.getByText("1 只", { exact: true })).toBeVisible();
  }
});

test("fan V8 panda portrait opens the redesigned detail experience", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas", { waitUntil: "domcontentloaded" });
  const search = page.getByRole("searchbox", { name: "按名字搜索熊猫" });
  await search.fill("思缘");

  const pandaLink = page.locator('a[href="/zh/prototype/fan-v08/pandas/si-yuan-qiyuan-offspring-2004"]');
  await expect(pandaLink).toBeVisible();
  await pandaLink.click({ noWaitAfter: true });
  const overlay = page.locator("[data-panda-transition-overlay='true']");
  await expect(overlay).toBeVisible({ timeout: 300 });
  const initialBox = await overlay.boundingBox();
  expect(initialBox).not.toBeNull();
  await expect.poll(async () => (await overlay.boundingBox())?.width ?? 0, { timeout: 700 })
    .toBeGreaterThan((initialBox?.width ?? 0) + 20);

  await expect(page).toHaveURL(/\/zh\/prototype\/fan-v08\/pandas\/si-yuan-qiyuan-offspring-2004/);
  await expect(page.getByTestId("fan-v08-panda-detail")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "思缘" })).toBeVisible();
  await expect(page.locator("[data-panda-detail-hero] img")).toBeVisible();
});
