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
  await expect(page.getByRole("heading", { name: "熊猫列表" })).toBeVisible();

  const researchCount = page.getByTestId("fan-v08-research-count");
  if (await researchCount.count()) {
    await expect(researchCount).toContainText("960");
    await expect(researchCount).toContainText("785 有确认个体影像");
    await expect(page.getByRole("button", { name: /继续显示 60 只/ })).toContainText("60 / 960");

    const search = page.getByRole("searchbox", { name: "按名字搜索熊猫" });
    await search.fill("阿旭");
    await expect(page.getByText("阿旭", { exact: true })).toBeVisible();
    await expect(page.getByText("1 只", { exact: true })).toBeVisible();
  }
});
